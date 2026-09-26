import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from '@xmldom/xmldom';
import { exportOpml, mergeItems, normalizeHttpUrl, parseFeed, parseOpml, plainText, safeFilename, stableSourceId, yamlQuote } from '../DantaRssCollector/src/feed-core.js';

const source = { id: 'feed-a', name: '示例来源', url: 'https://example.org/rss.xml' };

test('RSS entries become safe short metadata with stable IDs', async () => {
  const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>期刊订阅</title><item><title>Pathology &amp; Evidence</title><link>https://example.org/paper?id=1&amp;lang=en</link><guid>paper-1</guid><pubDate>Fri, 25 Sep 2026 09:00:00 GMT</pubDate><description><![CDATA[<p>Methods <strong>and findings</strong><script>steal()</script><img src="x"></p>]]></description></item></channel></rss>`;
  const [item] = await parseFeed(xml, source, DOMParser);
  assert.equal(item.source, '期刊订阅');
  assert.equal(item.title, 'Pathology & Evidence');
  assert.equal(item.url, 'https://example.org/paper?id=1&lang=en');
  assert.equal(item.excerpt, 'Methods and findings');
  assert.equal(item.read, false);
  assert.equal(item.favorite, false);
  assert.equal((await parseFeed(xml, source, DOMParser))[0].id, item.id);
});

test('Atom links use the alternate HTTP link and unsupported schemes are dropped', async () => {
  const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><title>Group</title><entry><id>tag:example.org,2026:1</id><title>New study</title><link rel="self" href="https://example.org/api/1"/><link rel="alternate" href="https://example.org/article/1"/><updated>2026-09-25T10:00:00Z</updated><summary>Short summary</summary></entry><entry><id>2</id><title>Bad URL</title><link href="javascript:alert(1)"/></entry></feed>`;
  const items = await parseFeed(xml, source, DOMParser);
  assert.equal(items.length, 1);
  assert.equal(items[0].url, 'https://example.org/article/1');
  assert.equal(items[0].excerpt, 'Short summary');
});

test('rejects oversized and entity-bearing XML before parsing', async () => {
  await assert.rejects(parseFeed('<!DOCTYPE rss [<!ENTITY x "y">]><rss/>', source, DOMParser), /XML 声明/);
  await assert.rejects(parseFeed('x'.repeat(2_500_001), source, DOMParser), /2.5 MB/);
});

test('supports RSS 1.0/RDF items and inherited xml:base links', async () => {
  const rdf = `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xml:base="articles/"><channel><title>Pathology Feed</title></channel><item><title>Study</title><link>case-1</link><description>Short note</description></item></rdf:RDF>`;
  const items = await parseFeed(rdf, { ...source, url: 'https://example.org/rss/feed.xml' }, DOMParser);
  assert.equal(items.length, 1);
  assert.equal(items[0].source, 'Pathology Feed');
  assert.equal(items[0].url, 'https://example.org/rss/articles/case-1');
});

test('merge preserves local reading, favorite and archive state', () => {
  const old = [{ id: 'a', read: true, favorite: true, savedPath: '01_saved.md', title: 'old' }];
  const merged = mergeItems(old, [{ id: 'a', read: false, favorite: false, savedPath: '', title: 'updated' }, { id: 'b', publishedAt: '2026-09-25T00:00:00Z' }]);
  assert.equal(merged.find(item => item.id === 'a').title, 'updated');
  assert.equal(merged.find(item => item.id === 'a').read, true);
  assert.equal(merged.find(item => item.id === 'a').favorite, true);
  assert.equal(merged.find(item => item.id === 'a').savedPath, '01_saved.md');
  assert.equal(merged.length, 2);
});

test('URL, plain text and YAML helpers handle unsafe or awkward values', () => {
  assert.equal(normalizeHttpUrl(' javascript:alert(1) '), null);
  assert.equal(normalizeHttpUrl('https://example.org/feed'), 'https://example.org/feed');
  assert.equal(plainText('<p>hello <b>world</b></p><script>bad()</script>', DOMParser), 'hello world');
  assert.equal(safeFilename('a/b:c'), 'a-b-c');
  assert.equal(yamlQuote('x"\ny'), '"x\\" y"');
});

test('OPML import/export preserves groups, skips duplicate feeds and performs no network work', async () => {
  const feeds = [
    { name: 'News <&> "one"', group: 'Pathology & AI', url: 'https://example.org/feed?a=1&b=2' },
    { name: 'Independent', group: '未分组', url: 'https://example.net/rss' },
  ];
  const xml = exportOpml(feeds);
  const parsed = parseOpml(xml, DOMParser);
  assert.deepEqual(parsed.feeds, feeds);
  const nested = parseOpml('<opml><body><outline text="Papers"><outline text="Pathology"><outline title="A" xmlUrl="https://example.org/rss"/><outline title="Duplicate" xmlUrl="https://example.org/rss#copy"/><outline xmlUrl="javascript:alert(1)"/></outline></outline></body></opml>', DOMParser);
  assert.deepEqual(nested.feeds, [{ name: 'A', group: 'Papers / Pathology', url: 'https://example.org/rss' }]);
  assert.equal(nested.skipped, 2);
});

test('source IDs are stable and do not contain private query material', async () => {
  const first = await stableSourceId('https://example.org/feed?token=private');
  assert.equal(first, await stableSourceId('https://example.org/feed?token=private'));
  assert.ok(first.startsWith('source-'));
  assert.ok(!first.includes('private'));
});
