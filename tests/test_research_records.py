#!/usr/bin/env python3
"""Offline regression cases for the existing literature CSV contract."""

import csv
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "validate_research_records.py"
LITERATURE_COLUMNS = (
    "文献ID", "DOI", "PMID", "题名", "作者年份", "版本与发表状态", "关联前后版本ID",
    "获取状态", "原文位置或链接", "阅读范围", "访问核验日期", "证据ID", "待办事项ID", "限制说明",
)
EVIDENCE_COLUMNS = (
    "证据ID", "题名", "作者年份", "DOI或PMID或链接", "发表状态", "阅读深度及位置",
    "研究类型", "样本或模型", "分析单位", "主要方法", "实际结果", "支持的主张",
    "不能支持的主张", "偏倚与替代解释", "与候选题关系", "核验日期",
)


def write_csv(path: Path, columns: tuple[str, ...], rows: list[dict[str, str]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)


class ResearchRecordTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="danta-records-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.folder = self.root / "我的开题" / "03_文献与证据"
        self.folder.mkdir(parents=True)
        self.literature = [{"文献ID": "L001", "DOI": "https://doi.org/10.1234/example", "PMID": "12345", "证据ID": "E001"}]
        self.evidence = [{
            "证据ID": "E001", "DOI或PMID或链接": "10.1234/example", "阅读深度及位置": "摘要，结果段",
            "实际结果": "摘要报告组间差异", "支持的主张": "摘要报告存在差异",
        }]

    def check(self, expected_returncode: int):
        lit_path = self.folder / "文献获取与版本.csv"
        ev_path = self.folder / "证据矩阵.csv"
        write_csv(lit_path, LITERATURE_COLUMNS, self.literature)
        write_csv(ev_path, EVIDENCE_COLUMNS, self.evidence)
        before = (lit_path.read_bytes(), ev_path.read_bytes())
        result = subprocess.run([sys.executable, str(SCRIPT), str(self.root)], capture_output=True, text=True)
        self.assertEqual(result.returncode, expected_returncode, result.stdout + result.stderr)
        self.assertEqual(before, (lit_path.read_bytes(), ev_path.read_bytes()), "validator must not edit research records")
        return result.stdout

    def test_valid_abstract_is_limited_but_allowed(self):
        self.assertIn("PASS", self.check(0))

    def test_test_vault_source_cannot_enter_real_evidence(self):
        self.evidence[0]["DOI或PMID或链接"] = "测试知识库/00-总览/虚构示例.md"
        self.assertIn("测试材料", self.check(1))

    def test_gy_folder_name_is_not_a_test_marker(self):
        self.evidence[0]["DOI或PMID或链接"] = "GY/00-总览/研究总览.md"
        self.assertIn("PASS", self.check(0))

    def test_duplicate_publication_needs_version_link(self):
        self.literature.append({"文献ID": "L002", "DOI": "10.1234/EXAMPLE", "PMID": "12345"})
        self.assertIn("显式关联版本", self.check(1))
        self.literature[1]["关联前后版本ID"] = "L001"
        self.assertIn("PASS", self.check(0))

    def test_claim_needs_source_and_recorded_result(self):
        self.evidence[0]["DOI或PMID或链接"] = ""
        self.evidence[0]["实际结果"] = ""
        output = self.check(1)
        self.assertIn("缺少来源标识", output)
        self.assertIn("缺少所记录的实际结果", output)

    def test_cross_csv_evidence_reference(self):
        self.literature[0]["证据ID"] = "E404"
        self.assertIn("未见于权威证据矩阵", self.check(1))
        self.literature[0]["证据ID"] = "E001"
        self.evidence[0]["DOI或PMID或链接"] = "10.1234/other"
        self.assertIn("DOI 与文献记录不一致", self.check(1))

    def test_download_is_not_full_text_reading(self):
        self.evidence[0]["阅读深度及位置"] = "全文已获取"
        self.assertIn("不等于全文已阅读", self.check(1))

    def test_metadata_cannot_supply_results(self):
        self.evidence[0]["阅读深度及位置"] = "元数据"
        self.assertIn("不能记录实际结果", self.check(1))


if __name__ == "__main__":
    unittest.main()
