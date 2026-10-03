#!/usr/bin/env python3
"""Read-only structural checks for the existing research literature CSVs.

This does not assess scientific support, actual research consent, or agent behavior.
"""

import argparse
import csv
import re
from pathlib import Path
from workspace_context import context, within


LITERATURE_FIELDS = {"文献ID", "DOI", "PMID", "关联前后版本ID", "证据ID"}
EVIDENCE_FIELDS = {"证据ID", "DOI或PMID或链接", "阅读深度及位置", "实际结果", "支持的主张"}
TEST_MARKERS = ("非真实数据", "测试知识库", "虚构示例", "示例数据")


def read_csv(path: Path, required: set[str], issues: list[str]) -> list[dict[str, str]]:
    try:
        with path.open(newline="", encoding="utf-8-sig") as handle:
            reader = csv.DictReader(handle, strict=True)
            missing = required - set(reader.fieldnames or [])
            if missing:
                issues.append(f"{path}: 缺少列 {', '.join(sorted(missing))}")
                return []
            rows = []
            for row in reader:
                line = reader.line_num
                if None in row or any(value is None for value in row.values()):
                    issues.append(f"{path}:{line}: CSV 列数不符")
                    continue
                if any(value.strip() for value in row.values()):
                    cleaned = {key: value.strip() for key, value in row.items()}
                    cleaned['__csv_line__'] = str(reader.line_num)
                    rows.append(cleaned)
            return rows
    except (OSError, UnicodeError, csv.Error) as exc:
        issues.append(f"{path}: 无法读取 CSV: {exc}")
        return []


def doi(value: str) -> str:
    return re.sub(r"^(?:https?://(?:dx\.)?doi\.org/|doi:\s*)", "", value.strip(), flags=re.I).lower()


def is_test_row(row: dict[str, str]) -> bool:
    return any(marker in value for value in row.values() for marker in TEST_MARKERS)


def validate(literature_csv: Path, evidence_csv: Path) -> list[str]:
    issues: list[str] = []
    literature = read_csv(literature_csv, LITERATURE_FIELDS, issues)
    evidence = read_csv(evidence_csv, EVIDENCE_FIELDS, issues)

    seen_ids: set[str] = set()
    seen_identifiers: dict[tuple[str, str], str] = {}
    for row in literature:
        index = row["__csv_line__"]
        ref = f"{literature_csv}:{index}"
        work_id = row["文献ID"]
        if not work_id or work_id in seen_ids:
            issues.append(f"{ref}: 文献ID 为空或重复")
        seen_ids.add(work_id)
        if is_test_row(row):
            issues.append(f"{ref}: 测试材料不得进入正式文献记录")
        for kind, value in (("DOI", doi(row["DOI"])), ("PMID", row["PMID"].strip())):
            if not value:
                continue
            previous = seen_identifiers.get((kind, value))
            if previous and previous not in re.split(r"[;；,，\s]+", row["关联前后版本ID"]):
                issues.append(f"{ref}: {kind} 与 {previous} 重复，须显式关联版本并避免重复计数")
            seen_identifiers[(kind, value)] = work_id

    seen_evidence: set[str] = set()
    evidence_by_id: dict[str, dict[str, str]] = {}
    for row in evidence:
        index = row["__csv_line__"]
        ref = f"{evidence_csv}:{index}"
        evidence_id = row["证据ID"]
        source = row["DOI或PMID或链接"]
        depth = row["阅读深度及位置"]
        if not evidence_id or evidence_id in seen_evidence:
            issues.append(f"{ref}: 证据ID 为空或重复")
        seen_evidence.add(evidence_id)
        evidence_by_id[evidence_id] = row
        if not source or not depth:
            issues.append(f"{ref}: 缺少来源标识或实际阅读范围")
        if is_test_row(row):
            issues.append(f"{ref}: 测试材料不得进入正式证据矩阵")
        if row["支持的主张"] and not row["实际结果"]:
            issues.append(f"{ref}: 支持的主张缺少所记录的实际结果")
        if row["实际结果"] and ("元数据" in depth or "未读" in depth):
            issues.append(f"{ref}: 未阅读内容不能记录实际结果")
        if "全文已获取" in depth and "已读" not in depth:
            issues.append(f"{ref}: 全文已获取不等于全文已阅读")

    for row in literature:
        index = row["__csv_line__"]
        for evidence_id in filter(None, re.split(r"[;；,，\s]+", row["证据ID"])):
            linked = evidence_by_id.get(evidence_id)
            if linked is None:
                issues.append(f"{literature_csv}:{index}: 证据ID {evidence_id} 未见于权威证据矩阵")
                continue
            source = linked["DOI或PMID或链接"]
            source_doi = doi(source)
            if source_doi.startswith("10.") and row["DOI"] and source_doi != doi(row["DOI"]):
                issues.append(f"{literature_csv}:{index}: 证据ID {evidence_id} 的 DOI 与文献记录不一致")
            if source.isdigit() and row["PMID"] and source != row["PMID"]:
                issues.append(f"{literature_csv}:{index}: 证据ID {evidence_id} 的 PMID 与文献记录不一致")
    return issues


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workspace", type=Path, help="existing workbench root; files are never changed")
    args = parser.parse_args()
    root = args.workspace.expanduser().resolve()
    if (root / '.danta-vault.json').exists():
        root, _, mapping = context(root)
        literature = within(root, mapping['roles']['literature_access'])
        evidence = within(root, mapping['roles']['evidence_matrix'])
    else:
        literature = within(root, '我的开题/03_文献与证据/文献获取与版本.csv')
        evidence = within(root, '我的开题/03_文献与证据/证据矩阵.csv')
    issues = validate(literature, evidence)
    for issue in issues:
        print(issue)
    if issues:
        print(f"FAIL: {len(issues)} structural issue(s)")
        return 1
    print("PASS: CSV structure and source/version checks only; scientific claims and permissions not verified")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, KeyError) as exc:
        print('Could not validate records: ' + str(exc))
        raise SystemExit(1)
