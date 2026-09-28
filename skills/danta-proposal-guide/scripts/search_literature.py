#!/usr/bin/env python3
"""Search Consensus and Semantic Scholar for public, approved literature queries."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


CONSENSUS_URL = 'https://api.consensus.app/v1/search'
SEMANTIC_SCHOLAR_URL = 'https://api.semanticscholar.org/graph/v1/paper/search'
S2_FIELDS = ','.join((
    'paperId', 'title', 'year', 'publicationDate', 'authors', 'venue',
    'externalIds', 'abstract', 'url', 'citationCount', 'openAccessPdf',
))
MAX_RESPONSE_BYTES = 8 * 1024 * 1024


def get_json(url, api_key):
    request = Request(
        url,
        headers={
            'Accept': 'application/json',
            'User-Agent': 'DantaResearchWorkbench/1.20 (literature discovery)',
            'x-api-key': api_key,
        },
    )
    try:
        with urlopen(request, timeout=30) as response:
            raw = response.read(MAX_RESPONSE_BYTES + 1)
            if len(raw) > MAX_RESPONSE_BYTES:
                raise ValueError('响应超过 8 MiB，已停止读取。')
            return json.loads(raw.decode('utf-8')), response.status, None
    except HTTPError as exc:
        detail = exc.read(4096).decode('utf-8', 'replace').strip()
        message = 'HTTP %d' % exc.code
        if exc.headers.get('Retry-After'):
            message += '；Retry-After=' + exc.headers['Retry-After']
        if detail:
            message += '；' + detail.replace(api_key, '[REDACTED]')[:800]
        return None, exc.code, message
    except (URLError, TimeoutError, OSError, UnicodeError, json.JSONDecodeError, ValueError) as exc:
        return None, None, type(exc).__name__ + ': ' + str(exc)


def paper_list(payload, source):
    if source == 'semantic_scholar':
        papers = payload.get('data') if isinstance(payload, dict) else None
        if isinstance(papers, list):
            return papers
        raise ValueError('Semantic Scholar 响应中未找到论文 data 数组。')
    if isinstance(payload, dict):
        for key in ('papers', 'results', 'data'):
            papers = payload.get(key)
            if isinstance(papers, list):
                return papers
    raise ValueError('Consensus 响应中未找到论文数组；保留响应错误，不猜测字段。')


def query_provider(source, query, limit):
    env_name = ('CONSENSUS_API_KEY' if source == 'consensus'
                else 'SEMANTIC_SCHOLAR_API_KEY')
    api_key = os.environ.get(env_name, '').strip()
    if not api_key:
        return {'status': 'skipped_missing_key', 'key_variable': env_name,
                'result_count': 0, 'papers': []}

    if source == 'consensus':
        url = CONSENSUS_URL + '?' + urlencode({'query': query, 'page': 0, 'page_size': limit})
    else:
        url = SEMANTIC_SCHOLAR_URL + '?' + urlencode({
            'query': query, 'limit': limit, 'fields': S2_FIELDS,
        })
    payload, http_status, error = get_json(url, api_key)
    if error:
        return {'status': 'error', 'http_status': http_status,
                'error': error, 'result_count': 0, 'papers': []}
    try:
        papers = paper_list(payload, source)
    except (AttributeError, ValueError) as exc:
        return {'status': 'error', 'http_status': http_status,
                'error': str(exc), 'result_count': 0, 'papers': []}
    return {'status': 'ok', 'http_status': http_status,
            'result_count': len(papers), 'papers': papers}


def main():
    parser = argparse.ArgumentParser(
        description=(
            '按用户明确给出的查询词，检索 Consensus 和/或 Semantic Scholar。'
            '查询会发送给所选外部服务；不要传入未公开研究信息或本地文件内容。'
        )
    )
    parser.add_argument('--query', required=True, help='公开或已获准发送的学术检索词')
    parser.add_argument('--source', choices=('both', 'consensus', 'semantic-scholar'),
                        default='both')
    parser.add_argument('--limit', type=int, default=10,
                        help='每个来源最多返回论文数（1–20）；默认 10')
    parser.add_argument('--output', type=Path,
                        help='可选 JSON 输出文件；不指定时只写标准输出')
    args = parser.parse_args()
    query = args.query.strip()
    if not query:
        parser.error('--query 不能为空。')
    if not 1 <= args.limit <= 20:
        parser.error('--limit 必须在 1 到 20 之间。')

    selected = (('consensus', 'semantic_scholar') if args.source == 'both'
                else ('consensus',) if args.source == 'consensus'
                else ('semantic_scholar',))
    result = {
        'generated_at_utc': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'query': query,
        'requested_limit_per_source': args.limit,
        'notice': '文献发现结果；摘要和元数据需回到原文核对，不代表独立证据评价。',
        'sources': {source: query_provider(source, query, args.limit)
                    for source in selected},
    }
    rendered = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
    if args.output:
        path = args.output.expanduser()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(rendered, encoding='utf-8')
        print('检索结果已保存：' + str(path.resolve()))
    else:
        sys.stdout.write(rendered)

    statuses = [item['status'] for item in result['sources'].values()]
    if 'ok' in statuses:
        return 0
    if 'error' in statuses:
        return 1
    return 2


if __name__ == '__main__':
    sys.exit(main())
