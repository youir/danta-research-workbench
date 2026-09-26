#!/usr/bin/env python3
"""Render a compact, self-contained biomedical research daily brief from JSON."""
import argparse
from datetime import date
from html import escape
import json
from pathlib import Path
from urllib.parse import urlsplit

EVIDENCE = {
    'peer_reviewed': '同行评审',
    'preprint': '预印本',
    'guideline': '指南 / 共识',
    'database': '数据库 / 资源',
    'commentary': '评论 / 新闻',
    'unknown': '来源状态待核实',
}
DEPTH = {
    'metadata': '已核题录',
    'abstract': '已读摘要',
    'full_text': '已读全文',
    'user_provided': '用户提供材料',
    'unknown': '阅读范围待核实',
}


def validate(data):
    if not isinstance(data, dict):
        raise ValueError('报告必须是 JSON 对象。')
    for key in ('date', 'status', 'title', 'coverage', 'sections'):
        if key not in data:
            raise ValueError('缺少必需字段：' + key)
    try:
        if not isinstance(data['date'], str):
            raise TypeError()
        date.fromisoformat(data['date'])
    except (TypeError, ValueError):
        raise ValueError('date 必须使用 YYYY-MM-DD。')
    if data['status'] not in ('ready', 'partial', 'no_sources', 'no_new_items'):
        raise ValueError('status 不受支持。')
    if not isinstance(data['title'], str) or not data['title'].strip() or len(data['title']) > 100:
        raise ValueError('title 必须是 1–100 个字符。')
    if 'intro' in data and (not isinstance(data['intro'], str) or len(data['intro']) > 240):
        raise ValueError('intro 必须是 240 个字符以内的文本。')
    if not isinstance(data['coverage'], dict) or not isinstance(data['sections'], list):
        raise ValueError('coverage 必须是对象，sections 必须是列表。')
    if not isinstance(data['coverage'].get('period'), str):
        raise ValueError('coverage.period 必须说明检索时段。')
    for field in ('sources', 'unavailable'):
        if field in data['coverage'] and (not isinstance(data['coverage'][field], list) or
                not all(isinstance(x, str) for x in data['coverage'][field])):
            raise ValueError('coverage.%s 必须是文本列表。' % field)
    seen_ids = set()
    for i, section in enumerate(data['sections']):
        if (not isinstance(section, dict) or not isinstance(section.get('title'), str) or
                not section['title'].strip() or len(section['title']) > 60 or
                not isinstance(section.get('items'), list)):
            raise ValueError('section %d 格式错误。' % i)
        if len(section['items']) > 3:
            raise ValueError('每个版块最多展示 3 条；请先筛选，不要靠页面截断。')
        for j, item in enumerate(section['items']):
            limits = {'id': 80, 'title': 80, 'summary': 600, 'source': 120, 'published': 40}
            for key, limit in limits.items():
                if (not isinstance(item.get(key), str) or not item[key].strip() or
                        len(item[key]) > limit):
                    raise ValueError('section %d item %d 缺少文本字段 %s。' % (i, j, key))
            if item['id'] in seen_ids:
                raise ValueError('日报中的 item id 必须唯一：' + item['id'])
            seen_ids.add(item['id'])
            for key, limit in (('relevance', 300), ('question', 240)):
                if key in item and (not isinstance(item[key], str) or len(item[key]) > limit):
                    raise ValueError('字段 %s 必须是 %d 个字符以内的文本。' % (key, limit))
            if item['evidence'] not in EVIDENCE:
                raise ValueError('不支持的 evidence 类型：' + item['evidence'])
    if data['status'] in ('no_sources', 'no_new_items') and any(s['items'] for s in data['sections']):
        raise ValueError('空状态不能同时含有内容条目。')
    return data


def safe_url(value):
    if not isinstance(value, str) or len(value) > 2048:
        return None
    parsed = urlsplit(value)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
        return None
    if any(ord(c) < 32 for c in value):
        return None
    return value


def e(value):
    return escape(str(value), quote=True)


def render(data):
    validate(data)
    status = data['status']
    empty_copy = {
        'no_sources': ('还没有接入科研信息源', '在 Obsidian 的“龚博士科研信息源”中添加你认可的 RSS/Atom 来源，或直接提供本次要看的材料。'),
        'no_new_items': ('今天没有值得列入的新增线索', '本次来源已检查，没有符合当前主题和证据要求的新内容。'),
        'partial': ('本次只覆盖了部分来源', '以下简报仅根据当前可访问内容整理；不可访问的来源列在页尾。'),
        'ready': ('本次科研脉搏', '内容按实际来源和阅读范围整理。'),
    }
    heading, default_intro = empty_copy[status]
    intro = data.get('intro') or default_intro
    day = date.fromisoformat(data['date'])
    date_label = '%d年%d月%d日' % (day.year, day.month, day.day)
    sections = []
    all_items = [item for sec in data['sections'] for item in sec['items']]
    counts = {k: sum(1 for item in all_items if item['evidence'] == k) for k in EVIDENCE if any(x['evidence'] == k for x in all_items)}
    pulse = ''.join('<span class="count"><b>%d</b> %s</span>' % (n, e(EVIDENCE[k])) for k, n in counts.items())
    if not pulse and status in ('ready', 'partial'):
        pulse = '<span class="quiet">本次没有可统计的新条目</span>'
    for section in data['sections']:
        if not section['items']:
            continue
        cards = []
        for item in section['items']:
            url = safe_url(item.get('url'))
            source = '<a href="%s" rel="noreferrer noopener">%s</a>' % (e(url), e(item['source'])) if url else e(item['source'])
            depth = DEPTH.get(item.get('read_depth', 'unknown'), DEPTH['unknown'])
            relevance = '<p class="relevance">%s</p>' % e(item['relevance']) if item.get('relevance') else ''
            question = '<p class="question"><span>可继续追问</span> %s</p>' % e(item['question']) if item.get('question') else ''
            cards.append('''<article class="item" id="%s">
  <div class="meta"><span>%s</span><span>%s</span><span>%s</span></div>
  <h3>%s</h3><p>%s</p>%s%s
  <p class="source">来源：%s · %s</p>
</article>''' % (e(item['id']), e(EVIDENCE[item['evidence']]), e(item['published']), e(depth), e(item['title']), e(item['summary']), relevance, question, source, e(item['published'])))
        sections.append('<section><h2>%s</h2>%s</section>' % (e(section['title']), '\n'.join(cards)))
    if not sections:
        empty = '<div class="empty"><h2>%s</h2><p>%s</p></div>' % (e(heading), e(intro))
    else:
        empty = ''
    coverage = data['coverage']
    source_list = coverage.get('sources', [])
    unavailable = coverage.get('unavailable', [])
    source_text = '、'.join(e(x) for x in source_list) if source_list else '无可用来源'
    unavailable_html = '<p>未能访问：%s</p>' % '、'.join(e(x) for x in unavailable) if unavailable else ''
    return '''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>%s · %s</title><style>
:root{color-scheme:light;--paper:#f9f9f7;--ink:#302f2a;--muted:#75736c;--line:#e3e1d9;--clay:#b86b50;--sage:#718d7e}
*{box-sizing:border-box}body{margin:0;background:#fcfcfb;color:var(--ink);font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
main{max-width:900px;margin:auto}.hero{padding:36px 30px 28px;background:var(--paper);border-bottom:1px solid var(--line)}
.date{font-size:13px;letter-spacing:.04em;color:var(--muted)}h1{font:500 clamp(30px,5vw,42px)/1.15 Georgia,"Songti SC",serif;margin:10px 0 12px}
.intro{max-width:680px;color:#57564f;font-size:16px;margin:0}.pulse{display:flex;gap:20px;flex-wrap:wrap;margin-top:22px;padding-top:13px;border-top:1px solid var(--line);font-size:13px;color:var(--muted)}
.count b{font:600 19px Georgia,serif;color:var(--ink);margin-right:4px}.quiet{color:var(--clay)}.body{padding:28px 30px 22px}section{margin:0 0 25px}h2{font-size:17px;margin:0 0 7px;font-weight:650}.item{padding:16px 0;border-bottom:1px solid var(--line)}.item:last-child{border:0}
.meta{display:flex;gap:10px;flex-wrap:wrap;color:var(--muted);font-size:12px}.meta span:first-child{color:var(--sage);font-weight:600}h3{font-size:18px;line-height:1.4;margin:6px 0 5px}.item p{margin:3px 0}.relevance{color:#4f5f54}.question{font-size:14px;color:#5c5a52}.question span{font-weight:600;color:var(--clay)}.source{font-size:12px;color:var(--muted);margin-top:7px!important}.source a{color:inherit;text-decoration:underline;text-underline-offset:3px}
.empty{padding:22px 0;color:#57564f}.empty h2{font:500 24px Georgia,"Songti SC",serif}.empty p{max-width:660px}.foot{border-top:1px solid var(--line);padding:15px 30px 28px;color:var(--muted);font-size:12px}.foot p{margin:3px 0}
@media(max-width:640px){.hero{padding:27px 20px 22px}.body{padding:22px 20px 14px}.foot{padding:14px 20px 24px}.pulse{gap:12px}}
</style></head><body><main>
<header class="hero"><div class="date">龚博士 · %s</div><h1>%s</h1><p class="intro">%s</p>%s</header>
<div class="body">%s%s</div><footer class="foot"><p>覆盖时段：%s</p><p>已读取来源：%s</p>%s<p>日报是文献导航；证据等级和阅读范围以原始来源为准。</p></footer>
</main></body></html>''' % (e(data['title']), e(data['date']), e(date_label), e(data['title']), e(intro), ('<div class="pulse" aria-label="证据类型统计">%s</div>' % pulse) if all_items else '', '\n'.join(sections), empty, e(coverage.get('period', '未注明')), source_text, unavailable_html)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path, help='JSON content matching assets/content.schema.json')
    parser.add_argument('output', type=Path, help='HTML output path; existing files are preserved')
    args = parser.parse_args()
    try:
        data = validate(json.loads(args.input.read_text(encoding='utf-8')))
        if args.output.exists():
            raise ValueError('目标文件已存在，为保留日报归档未覆盖：' + str(args.output))
        html = render(data)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(html, encoding='utf-8')
        print('已生成：' + str(args.output))
        return 0
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print('未生成日报：' + str(exc))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
