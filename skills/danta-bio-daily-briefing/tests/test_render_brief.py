import importlib.util
from pathlib import Path
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts' / 'render_brief.py'
SPEC = importlib.util.spec_from_file_location('render_brief', SCRIPT)
brief = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(brief)


class BriefTests(unittest.TestCase):
    def test_empty_state_is_explicit_and_has_no_fake_items(self):
        data = {
            'date': '2026-09-26', 'status': 'no_sources', 'title': '科研日报',
            'coverage': {'period': '未检索', 'sources': []}, 'sections': []
        }
        html = brief.render(data)
        self.assertIn('还没有接入科研信息源', html)
        self.assertIn('无可用来源', html)
        self.assertIn('2026年9月26日', html)
        self.assertNotIn('aria-label="证据类型统计"', html)
        self.assertNotIn('<article', html)

    def test_empty_status_cannot_hide_real_items(self):
        data = {
            'date': '2026-09-26', 'status': 'no_sources', 'title': '日报',
            'coverage': {'period': 'today', 'sources': []},
            'sections': [{'title': '值得留意', 'items': [{
                'id': 'one', 'title': 't', 'summary': 's', 'source': 'src',
                'evidence': 'unknown', 'published': 'today'
            }]}]
        }
        with self.assertRaises(ValueError):
            brief.validate(data)

    def test_content_is_escaped_and_unsafe_links_are_plain_text(self):
        data = {
            'date': '2026-09-26', 'status': 'ready', 'title': '<img src=x>',
            'coverage': {'period': '近24小时', 'sources': ['PubMed']},
            'sections': [{'title': '值得留意', 'items': [{
                'id': 'one', 'title': '<script>alert(1)</script>', 'summary': '结果 <b>不可信</b>',
                'source': 'PubMed', 'url': 'javascript:alert(1)', 'evidence': 'preprint',
                'published': '2026-09-26', 'read_depth': 'abstract'
            }]}]
        }
        html = brief.render(data)
        self.assertIn('&lt;script&gt;', html)
        self.assertNotIn('<script>alert', html)
        self.assertNotIn('href="javascript:', html)
        self.assertIn('预印本', html)

    def test_does_not_silently_truncate_long_sections(self):
        data = {
            'date': '2026-09-26', 'status': 'ready', 'title': '日报',
            'coverage': {'period': 'today', 'sources': []},
            'sections': [{'title': 'x', 'items': [{'id': str(i), 'title': 't', 'summary': 's',
                'source': 'src', 'evidence': 'unknown', 'published': 'today'} for i in range(4)]}]
        }
        with self.assertRaises(ValueError):
            brief.validate(data)


if __name__ == '__main__':
    unittest.main()
