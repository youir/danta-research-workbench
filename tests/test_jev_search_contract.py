"""Offline checks for automatic Jev routing and its research-data boundaries."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
GUIDE = ROOT / 'skills/danta-proposal-guide/references/literature-search.md'
INTEGRATION = ROOT / 'skills/danta-proposal-guide/references/jev-search-integration.md'
ROUTING = ROOT / 'skills/danta-proposal-guide/references/skill-routing.md'
MAIN = ROOT / 'skills/danta-proposal-guide/SKILL.md'
DAILY = ROOT / 'skills/danta-bio-daily-briefing/SKILL.md'
DAILY_WORKFLOW = ROOT / 'skills/danta-bio-daily-briefing/references/briefing-workflow.md'
EVIDENCE_AGENT = ROOT / '.codex/agents/danta_evidence.toml'


class JevSearchContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.guide = GUIDE.read_text(encoding='utf-8')
        cls.integration = INTEGRATION.read_text(encoding='utf-8')
        cls.routing = ROUTING.read_text(encoding='utf-8')

    def test_jev_runs_automatically_when_public_candidate_set_is_large_enough(self):
        self.assertIn('自动：用 Jev 筛选公开搜索结果', self.guide)
        self.assertIn('工作台的默认后台步骤', self.guide)
        self.assertIn('4 条或更多候选', self.guide)
        self.assertIn('无需点名 Jev、选工具或确认', MAIN.read_text(encoding='utf-8'))
        self.assertIn('自动用 Jev 重排', EVIDENCE_AGENT.read_text(encoding='utf-8'))
        self.assertIn('可以并行检索 Consensus 与 Semantic Scholar', self.guide)
        self.assertIn('不是检索源', self.guide)
        self.assertIn('按搜索工具原顺序继续阅读', self.guide)

    def test_public_daily_briefing_uses_jev_without_exposing_local_profile(self):
        daily = DAILY.read_text(encoding='utf-8')
        workflow = DAILY_WORKFLOW.read_text(encoding='utf-8')
        self.assertIn('她不需要提 Jev', daily)
        self.assertIn('不读取私有画像来构造查询', workflow)

    def test_private_research_is_excluded_by_default(self):
        self.assertIn('私有 vault 的内容默认不发送给 Jev', self.integration)
        self.assertIn('患者资料', self.integration)
        self.assertIn('私有 vault 的内容默认不发送', self.integration)
        self.assertIn('候选用 `P1`、`P2` 等临时编号', self.integration)
        self.assertIn('不发送 DOI、作者名或 URL', self.integration)

    def test_jev_does_not_author_queries_or_make_research_decisions(self):
        self.assertIn('Jev 只选择其中一条', self.integration)
        self.assertIn('最多补搜一轮', self.guide)
        self.assertIn('不能用来证明研究质量差', self.integration)

    def test_reranking_is_not_treated_as_validated_biomedical_evidence(self):
        self.assertIn('接近 0.5', self.integration)
        self.assertIn('中文等 CJK 输入', self.integration)
        self.assertIn('不能直接外推为生物医学检索表现', self.integration)

    def test_missing_jev_fails_open_to_original_results(self):
        self.assertIn('按搜索工具原顺序继续阅读', self.guide)
        self.assertIn('回退到原始候选顺序', self.integration)
        self.assertIn('当前没有可用 Jev MCP', self.integration)
        self.assertIn('自动按', self.routing)


if __name__ == '__main__':
    unittest.main()
