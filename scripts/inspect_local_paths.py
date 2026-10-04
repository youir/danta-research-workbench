#!/usr/bin/env python3
"""Read only known application/path metadata, never vault notes or credentials."""
import argparse
import json
import os
from pathlib import Path
import shutil
import sys


def read_metadata(path):
    if not path.is_file() or path.is_symlink() or path.stat().st_size > 256 * 1024:
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, UnicodeError, json.JSONDecodeError):
        return None


def inspect(workspace=None):
    home = Path.home()
    appdata = Path(os.environ.get("APPDATA", home / "Library/Application Support"))
    saved = []
    for name in ("danta-workbench-ui", "龚博士科研工作台"):
        base = appdata / name
        vault = read_metadata(base / "vault-location.json")
        artifacts = read_metadata(base / "artifact-location.json")
        if isinstance(vault, dict) or isinstance(artifacts, dict):
            saved.append({"app_data": str(base), "vault": vault.get("path", "") if isinstance(vault, dict) else "",
                          "saved_scopes": sorted(vault.get("grants", {}).keys()) if isinstance(vault, dict) and isinstance(vault.get("grants"), dict) else [],
                          "artifacts": artifacts.get("grant", {}).get("root", "") if isinstance(artifacts, dict) and isinstance(artifacts.get("grant"), dict) else ""})
    obsidian = read_metadata(appdata / "obsidian/obsidian.json")
    candidates = []
    if isinstance(obsidian, dict) and isinstance(obsidian.get("vaults"), dict):
        for entry in obsidian["vaults"].values():
            if isinstance(entry, dict) and isinstance(entry.get("path"), str):
                candidates.append({"path": entry["path"], "exists": Path(entry["path"]).is_dir(), "open": entry.get("open") is True})
    report = {"platform": sys.platform, "user_directory": str(home), "saved_workbench_locations": saved,
              "obsidian_candidates": candidates, "codex_cli": shutil.which("codex") or "未在 PATH 找到",
              "note": "仅候选路径与保存记录。授权有效性由工作台核对，路径存在不等于授权。未读笔记/附件/密钥。"}
    if workspace:
        root = workspace.expanduser().resolve()
        marker = read_metadata(root / ".danta-vault.json")
        report["checked_workspace"] = {"path": str(root), "exists": root.is_dir(), "marked_vault": isinstance(marker, dict) and marker.get("kind") == "danta-research-vault"}
        if isinstance(marker, dict) and isinstance(marker.get("path_map"), str):
            name = marker["path_map"]
            parts = name.replace("\\", "/").split("/")
            target = root.joinpath(*parts)
            if target.name == "Path-Map.json" and name and not Path(name).is_absolute() and not any(part in ("..", "") for part in parts) and all(not root.joinpath(*parts[:i]).is_symlink() for i in range(1, len(parts)+1)) and root in target.resolve().parents:
                mapping = read_metadata(target)
                if isinstance(mapping, dict):
                    report["checked_workspace"].update({"path_map": str(target), "active_project_id": mapping.get("active_project_id", ""), "active_project": mapping.get("active_project", ""), "project_roots": {key: value.get("root", "") for key, value in (mapping.get("projects", {}) if isinstance(mapping.get("projects"), dict) else {}).items() if isinstance(value, dict)}})
        report["checked_workspace"]["skill_locations"] = [str(root / relative) for relative in (".agents/skills/danta-proposal-guide", ".codex/skills/danta-proposal-guide") if (root / relative / "SKILL.md").is_file()]
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", type=Path, help="An already confirmed private vault, checked for path metadata only")
    args = parser.parse_args()
    print(json.dumps(inspect(args.workspace), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
