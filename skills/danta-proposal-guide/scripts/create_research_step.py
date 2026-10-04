#!/usr/bin/env python3
"""Create or resume one real research step; source materials stay at their original paths."""
import argparse
from datetime import date
import json
from pathlib import Path
import re
import shutil
import sys
from uuid import uuid4

from workspace_context import context, registry, within

KEY = re.compile(r"^[a-zA-Z0-9-]{8,100}$")


def slugify(title):
    slug = re.sub(r"[^\w\u3400-\u9fff-]+", "-", title.strip(), flags=re.UNICODE)
    return slug.strip("-_ ")[:32].rstrip("-_ ") or "研究步骤"


def steps_root(workspace, project_id=""):
    root = workspace.expanduser().resolve()
    if (root / ".danta-vault.json").exists():
        root, _, data = context(root)
        registry(root, data)
        projects = data["projects"]
        selected = project_id or data["active_project_id"]
        if selected not in projects:
            raise ValueError("Requested project is not registered in this vault.")
        project = within(root, projects[selected]["root"])
        if not project.is_dir():
            raise ValueError("Research project directory is unavailable.")
        return root, within(root, str(project.relative_to(root) / "07_研究步骤_Steps")), selected
    if project_id and project_id != "legacy":
        raise ValueError("A legacy workspace has no registered project with this ID.")
    legacy = within(root, "我的开题")
    if not (legacy / "00_状态与下一步.md").is_file():
        raise ValueError("Expected a marked vault or a legacy workbench root.")
    return root, within(root, "我的开题/11_研究步骤"), "legacy"


def markdown(title, body, **fields):
    metadata = {"title": title, "tags": ["research-step"], "created": date.today().isoformat(),
                "type": "research-step-record", "summary": title, **fields}
    header = "\n".join(f"{key}: {json.dumps(value, ensure_ascii=False)}" for key, value in metadata.items())
    return f"---\n{header}\n---\n\n{body.rstrip()}\n"


def step_fields(card):
    if card.is_symlink() or not card.is_file() or card.stat().st_size > 256 * 1024:
        return {}
    text = card.read_text(encoding="utf-8")
    if not text.startswith("---\n") or "\n---" not in text[4:]:
        return {}
    fields = {}
    for line in text.split("---", 2)[1].splitlines():
        match = re.fullmatch(r"([a-z_]+):\s*(.*)", line)
        if not match:
            continue
        if match[1] in fields:
            return {}
        try:
            fields[match[1]] = json.loads(match[2])
        except json.JSONDecodeError:
            fields[match[1]] = match[2].strip()
    return fields


def files_for(step_id, title, goal, phase, project_id, task_id="", step_key="", artifact_dir=""):
    files = {
        "00_步骤卡.md": markdown(title, f"# {step_id} {title}\n\n本步目标：{goal}\n\n"
            "进度以本卡头部 status 与 next_action 为准，由主引导按真实工作更新。\n\n"
            "## 材料、过程与成果\n\n"
            "- [输入索引](01_输入_Input/00_输入索引.md)\n"
            "- [过程记录](02_过程_Process/00_过程记录.md)\n"
            "- [产出索引](03_产出_Output/00_产出索引.md)\n"
            "- [核查与下一步](04_核查与交接_Review/00_核查与交接.md)\n\n"
            "唯一状态、证据和决定仍链接原记录；不要复制成第二份。",
            danta_step_schema=1, project_id=project_id, task_id=task_id, step_id=step_id,
            step_key=step_key, goal=goal, phase=phase, status="planned", next_action="", updated=date.today().isoformat()),
        "01_输入_Input/00_输入索引.md": markdown("输入索引", "# 输入索引\n\n"
            "只登记本步实际使用的材料位置、版本、来源与已授权范围。原始数据保留原位。\n\n"
            "| 材料/ID | 来源或路径 | 版本/日期 | 实际读取范围 |\n|---|---|---|---|"),
        "02_过程_Process/00_过程记录.md": markdown("过程记录", "# 过程记录\n\n"
            "执行后记录实际日期、方法/工具版本、参数、运行位置、变更与失败。未运行内容不记成结果。"),
        "03_产出_Output/00_产出索引.md": markdown("产出索引", "# 产出索引\n\n"
            + (f"工作台成果目录（原件唯一位置）：`{artifact_dir}`\n\n" if artifact_dir else
               "有工作台成果目录时沿用该目录；尚未配置时先明确本步交付位置，再制作文件。\n\n")
            + "保留旧版本；索引登记实际文件、同版本预览、来源与待核查项，不重复复制权威文件。\n\n"
            "| 产物 | 原件位置 | 版本 | 证据/数据来源 | 状态 |\n|---|---|---|---|---|"),
        "04_核查与交接_Review/00_核查与交接.md": markdown("核查与交接", "# 核查与交接\n\n"
            "实际结束或中断时再记录已核查项、阻塞和最小下一步；普通问答无需填写完整报告。"),
        "00_index.md": markdown(title + "目录", "# 本步目录\n\n[步骤卡](00_步骤卡.md)"),
    }
    for name, filename in [("01_输入_Input", "00_输入索引.md"), ("02_过程_Process", "00_过程记录.md"),
                           ("03_产出_Output", "00_产出索引.md"), ("04_核查与交接_Review", "00_核查与交接.md")]:
        files[f"{name}/00_index.md"] = markdown(name.split("_", 1)[1], f"# {name}\n\n[记录入口]({filename})")
    return files


def find_existing(parent, args, project_id):
    found = []
    if parent.is_dir():
        for item in sorted(parent.iterdir(), key=lambda entry: entry.name):
            if item.is_symlink() or not item.is_dir() or not re.fullmatch(r"STEP-\d{4,}-.+", item.name):
                continue
            fields = step_fields(item / "00_步骤卡.md")
            if fields.get("danta_step_schema") != 1 or fields.get("project_id") != project_id:
                continue
            if args.step_key:
                matches = fields.get("step_key") == args.step_key
                if matches and fields.get("task_id") != args.task_id:
                    raise ValueError("This step key belongs to another task.")
            else:
                matches = fields.get("title") == args.title.strip() and fields.get("goal") == args.goal.strip() and not fields.get("task_id")
            if matches:
                required = files_for(fields["step_id"], args.title, args.goal, args.phase, project_id)
                if any(not within(item, file).is_file() for file in required):
                    raise ValueError("Existing step is incomplete. Preserve it and inspect missing records; do not silently reuse or overwrite.")
                found.append((item, fields))
    if args.step_key and len(found) > 1:
        raise ValueError("Multiple records have this step key. Resolve the duplicate before resuming.")
    return found[-1] if found and not args.new else None


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--workspace", type=Path, required=True)
    ap.add_argument("--title", required=True)
    ap.add_argument("--goal", required=True)
    ap.add_argument("--phase", default="")
    ap.add_argument("--project-id", default="", help="Resume the original registered project even if the active project changed")
    ap.add_argument("--task-id", default="")
    ap.add_argument("--step-key", default="", help="Stable key from the workbench task card")
    ap.add_argument("--artifact-dir", default="", help="Existing per-task output path, recorded as an index only")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--new", action="store_true", help="Explicitly create another standalone step")
    args = ap.parse_args()
    if not args.title.strip() or not args.goal.strip():
        ap.error("Title and goal must be nonempty")
    if len(args.title) > 240 or len(args.goal) > 1000 or len(args.phase) > 240:
        ap.error("Title, goal or phase exceeds the supported length")
    for value in (args.title, args.goal, args.phase, args.artifact_dir):
        if any(char in value for char in "\n\r\x00"):
            ap.error("Text fields must each be one line")
    if bool(args.task_id) != bool(args.step_key) or any(value and not KEY.fullmatch(value) for value in (args.task_id, args.step_key)):
        ap.error("Use --task-id and --step-key together with valid stable IDs")
    if args.new and args.step_key:
        ap.error("A new workbench step needs a new step key; do not reuse a key with --new")
    root, parent, project_id = steps_root(args.workspace, args.project_id)
    index = within(root, str(parent.relative_to(root) / "00_index.md"))
    if index.exists() and not index.is_file():
        raise ValueError("Steps index is not a regular file")

    def plan():
        existing = find_existing(parent, args, project_id)
        if existing:
            item, fields = existing
            return item, fields["step_id"], False
        used = [int(match[1]) for item in parent.iterdir() if (match := re.match(r"^STEP-(\d+)(?:-|$)", item.name))] if parent.is_dir() else []
        step_id = f"STEP-{max(used, default=0) + 1:04d}"
        return within(root, str(parent.relative_to(root) / f"{step_id}-{slugify(args.title)}")), step_id, True

    if args.dry_run:
        step, step_id, is_new = plan()
        print(json.dumps({"created": False, "reused": not is_new, "project_id": project_id, "step_id": step_id, "step": str(step)}, ensure_ascii=False))
        return 0
    parent.mkdir(parents=True, exist_ok=True)
    lock = parent / ".create-step.lock"
    with lock.open("x", encoding="utf-8"):
        pass
    temporary = None
    try:
        step, step_id, is_new = plan()
        if is_new:
            temporary = parent / f".step-{uuid4()}.tmp"
            temporary.mkdir()
            for relative, content in files_for(step_id, args.title.strip(), args.goal.strip(), args.phase.strip(), project_id, args.task_id, args.step_key or str(uuid4()), args.artifact_dir).items():
                target = temporary / relative
                target.parent.mkdir(exist_ok=True)
                target.write_text(content, encoding="utf-8")
            if step.exists():
                raise ValueError("Destination appeared during creation; retry after inspecting it")
            temporary.rename(step)
            temporary = None
        # A failed index update can be repaired by the same retry, without creating another step.
        old = index.read_text(encoding="utf-8") if index.exists() else markdown("研究步骤", "# 研究步骤\n\n只登记实际开始的步骤。")
        target_link = f"{step.name}/00_步骤卡.md"
        if target_link not in old:
            entry = f"\n- [{step_id} {args.title.strip().replace('[', '').replace(']', '')}]({target_link})\n"
            staging_index = parent / f".index-{uuid4()}.tmp"
            try:
                staging_index.write_text(old + entry, encoding="utf-8")
                if index.exists() and index.read_text(encoding="utf-8") != old:
                    raise ValueError("Steps index changed; retry to merge safely")
                staging_index.replace(index)
            finally:
                staging_index.unlink(missing_ok=True)
        print(json.dumps({"created": is_new, "reused": not is_new, "project_id": project_id, "step_id": step_id, "step_key": args.step_key, "step": str(step)}, ensure_ascii=False))
    finally:
        if temporary is not None:
            shutil.rmtree(temporary)
        lock.unlink(missing_ok=True)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError, TypeError) as exc:
        print("Could not create research step: " + str(exc), file=sys.stderr)
        sys.exit(1)
