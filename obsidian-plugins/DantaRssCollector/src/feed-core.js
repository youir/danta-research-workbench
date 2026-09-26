const MAX_FEED_CHARS = 2_500_000;
const MAX_ITEMS_PER_FEED = 60;
const MAX_EXCERPT_CHARS = 480;

export function normalizeHttpUrl(value, base) {
  try {
    const url = new URL(String(value).trim(), base);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

export function plainText(value, Parser = globalThis.DOMParser) {
  if (!value) return '';
  const safeMarkup = String(value)
    .replace(/<\s*(script|style|iframe|object|svg)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\s(?:src|srcset|href|xlink:href|poster|background)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  if (Parser) {
    try {
      const doc = new Parser().parseFromString(`<div>${safeMarkup}</div>`, 'text/html');
      return (doc.body?.textContent || doc.documentElement?.textContent || '')
        .replace(/\s+/g, ' ').trim();
    } catch { /* Fall through to conservative tag removal. */ }
  }
  return safeMarkup.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/\s+/g, ' ').trim();
}

function localName(element) {
  return String(element?.localName || element?.nodeName || '').split(':').pop().toLowerCase();
}

function children(element) {
  return Array.from(element?.children || element?.childNodes || []).filter(node => node.nodeType === 1);
}

function childText(element, names) {
  const wanted = new Set(names);
  const node = children(element).find(item => wanted.has(localName(item)));
  return node?.textContent?.trim() || '';
}

function atomLink(entry) {
  const links = children(entry).filter(node => localName(node) === 'link');
  const preferred = links.find(node => !node.getAttribute('rel') || node.getAttribute('rel') === 'alternate') || links[0];
  return preferred?.getAttribute('href') || preferred?.textContent?.trim() || '';
}

function baseFor(element, fallback) {
  const chain = [];
  let current = element;
  while (current && current.nodeType === 1) { chain.unshift(current); current = current.parentElement || current.parentNode; }
  return chain.reduce((base, node) => {
    const xmlBase = node.getAttributeNS?.('http://www.w3.org/XML/1998/namespace', 'base') || node.getAttribute?.('xml:base') || '';
    if (!xmlBase) return base;
    try { return new URL(xmlBase, base).href; } catch { return base; }
  }, fallback);
}

async function stableKey(feedId, identity) {
  const bytes = new TextEncoder().encode(`${feedId}\n${String(identity).trim()}`);
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return `${feedId}-${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`;
  }
  // Defensive fallback for test runtimes missing Web Crypto. Obsidian provides SHA-256.
  let hash = 2166136261;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619);
  return `${feedId}-${(hash >>> 0).toString(36)}`;
}

export async function parseFeed(xml, source, Parser = globalThis.DOMParser) {
  if (typeof xml !== 'string' || xml.length > MAX_FEED_CHARS) throw new Error('订阅内容为空或超过 2.5 MB 限制');
  if (/<!\s*(DOCTYPE|ENTITY)\b/i.test(xml)) throw new Error('订阅文件包含不支持的 XML 声明');
  if (!Parser) throw new Error('当前环境缺少 XML 解析器');
  const doc = new Parser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('订阅文件不是有效的 RSS/Atom XML');
  const root = doc.documentElement;
  const isAtom = localName(root) === 'feed';
  const channel = children(root).find(node => localName(node) === 'channel') || root;
  const isRdf = localName(root).toLowerCase() === 'rdf';
  if (!isAtom && !(['rss', 'rdf'].includes(localName(root).toLowerCase()) && (isRdf || channel !== root))) throw new Error('这个网址不是可识别的 RSS/Atom 订阅');
  const entries = isAtom
    ? Array.from(root.getElementsByTagNameNS?.('*', 'entry') || root.getElementsByTagName('entry'))
    : isRdf ? children(root).filter(node => localName(node) === 'item') : Array.from(channel.getElementsByTagName('item'));
  const feedTitle = isAtom ? childText(root, ['title']) : childText(channel, ['title']);
  const sourceName = String(feedTitle || source.name || new URL(source.url).hostname).trim().slice(0, 120);
  const parsedItems = [];
  const seen = new Set();
  for (const entry of entries.slice(0, 200)) {
    const title = childText(entry, ['title']) || '（无标题）';
    const link = isAtom ? atomLink(entry) : childText(entry, ['link']);
    const itemBase = baseFor(entry, source.url);
    const url = normalizeHttpUrl(link || source.url, itemBase);
    const guid = childText(entry, isAtom ? ['id'] : ['guid']);
    const publishedRaw = childText(entry, ['published', 'updated', 'pubDate', 'date']);
    const parsedDate = Date.parse(publishedRaw);
    const summaryRaw = childText(entry, ['description', 'summary', 'encoded', 'content']);
    const excerpt = plainText(summaryRaw, Parser).slice(0, MAX_EXCERPT_CHARS);
    const publishedAt = Number.isFinite(parsedDate) ? new Date(parsedDate).toISOString() : '';
    const identity = guid || url || `${title}\n${publishedRaw}`;
    const id = await stableKey(source.id, identity);
    if (!url || seen.has(id)) continue;
    seen.add(id);
    parsedItems.push({
      id,
      feedId: source.id,
      source: sourceName,
      title: title.replace(/\s+/g, ' ').trim().slice(0, 300),
      url,
      publishedAt,
      excerpt,
      read: false,
      favorite: false,
      savedPath: '',
      fetchedAt: new Date().toISOString(),
    });
    if (parsedItems.length >= MAX_ITEMS_PER_FEED) break;
  }
  return parsedItems.sort((a, b) => Date.parse(b.publishedAt || '') - Date.parse(a.publishedAt || ''));
}

export function mergeItems(existing, incoming, limit = 1200) {
  const old = new Map((existing || []).map(item => [item.id, item]));
  for (const item of incoming) {
    const previous = old.get(item.id);
    old.set(item.id, previous ? {
      ...item,
      read: previous.read,
      favorite: previous.favorite,
      savedPath: previous.savedPath,
    } : item);
  }
  return [...old.values()].sort((a, b) => Date.parse(b.publishedAt || b.fetchedAt) - Date.parse(a.publishedAt || a.fetchedAt)).slice(0, limit);
}

export function safeFilename(text, max = 64) {
  return String(text || 'untitled').normalize('NFKC').replace(/[\\/:*?"<>|#^[\]]/g, '-')
    .replace(/\s+/g, ' ').trim().replace(/[. ]+$/g, '').slice(0, max) || 'untitled';
}

export function yamlQuote(value) {
  return `"${String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ')}"`;
}

export async function stableSourceId(url) {
  const bytes = new TextEncoder().encode(String(url).trim());
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return `source-${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`;
  }
  let hash = 2166136261;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619);
  return `source-${(hash >>> 0).toString(36)}`;
}

export function parseOpml(xml, Parser = globalThis.DOMParser) {
  if (typeof xml !== 'string' || xml.length > MAX_FEED_CHARS) throw new Error('OPML 文件为空或超过 2.5 MB 限制');
  if (/<!\s*(DOCTYPE|ENTITY)\b/i.test(xml)) throw new Error('OPML 文件包含不支持的 XML 声明');
  if (!Parser) throw new Error('当前环境缺少 XML 解析器');
  const doc = new Parser().parseFromString(xml, 'application/xml');
  const root = doc.documentElement;
  if (doc.getElementsByTagName('parsererror').length || localName(root) !== 'opml' || !root.getElementsByTagName('body').length) throw new Error('这不是有效的 OPML 文件');
  const feeds = [];
  const seen = new Set();
  let skipped = 0;
  for (const node of Array.from(root.getElementsByTagName('outline'))) {
    const raw = node.getAttribute('xmlUrl') || node.getAttribute('xmlurl') || '';
    if (!raw) continue;
    const url = normalizeHttpUrl(raw);
    if (!url || seen.has(url)) { skipped++; continue; }
    seen.add(url);
    const groups = [];
    let parent = node.parentElement || node.parentNode;
    while (parent && localName(parent) === 'outline') {
      const label = parent.getAttribute('text') || parent.getAttribute('title');
      if (label) groups.unshift(label);
      parent = parent.parentElement || parent.parentNode;
    }
    feeds.push({ url, name: (node.getAttribute('title') || node.getAttribute('text') || new URL(url).hostname).trim().slice(0, 100), group: groups.join(' / ').slice(0, 60) || '未分组' });
  }
  if (!feeds.length) throw new Error('OPML 中没有可导入的 RSS/Atom 来源');
  return { feeds, skipped };
}

export function exportOpml(feeds) {
  const esc = value => String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  const groups = new Map();
  for (const feed of feeds) {
    const group = feed.group || '';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(feed);
  }
  const outline = feed => `<outline type="rss" text="${esc(feed.name)}" title="${esc(feed.name)}" xmlUrl="${esc(feed.url)}"/>`;
  const rows = [];
  for (const [group, entries] of groups) {
    rows.push(group ? `<outline text="${esc(group)}">${entries.map(outline).join('')}</outline>` : entries.map(outline).join(''));
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0"><head><title>龚博士科研信息源</title></head><body>${rows.join('')}</body></opml>\n`;
}
