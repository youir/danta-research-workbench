const DATE_PATTERN = /(\d{4})[-_.年](\d{2})[-_.月](\d{2})/;
const EVIDENCE_LABELS = {
  peer_reviewed: '同行评审', preprint: '预印本', guideline: '指南 / 共识',
  database: '数据库 / 资源', commentary: '评论 / 新闻', unknown: '来源状态待核实',
};
const DEPTH_LABELS = {
  metadata: '已核题录', abstract: '已读摘要', full_text: '已读全文',
  user_provided: '用户提供材料', unknown: '阅读范围待核实',
};

function normalizeDate(value, fallback = '') {
  const match = String(value || '').match(DATE_PATTERN);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : fallback;
}

function cleanText(node) {
  return node?.textContent?.replace(/\s+/g, ' ').trim() || '';
}

function reportFromJson(data, fileName) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.sections)) return null;
  const date = normalizeDate(data.date, normalizeDate(fileName));
  if (!date || typeof data.title !== 'string') return null;
  const sections = data.sections.map(section => ({
    title: String(section.title || '研究动态'),
    items: (Array.isArray(section.items) ? section.items : []).map(item => ({
      title: String(item.title || ''),
      summary: String(item.summary || ''),
      relevance: String(item.relevance || ''),
      question: String(item.question || ''),
      source: String(item.source || ''),
      url: safeHttpUrl(item.url),
      doi: typeof item.doi === 'string' ? item.doi : '',
      pmid: ['string', 'number'].includes(typeof item.pmid) ? String(item.pmid) : '',
      published: String(item.published || ''),
      evidence: EVIDENCE_LABELS[item.evidence] || '来源状态待核实',
      readDepth: DEPTH_LABELS[item.read_depth] || '阅读范围待核实',
    })).filter(item => item.title || item.summary),
  }));
  return {
    id: `${date}-${fileName}`,
    fileName,
    date,
    title: data.title,
    intro: String(data.intro || ''),
    status: String(data.status || 'ready'),
    coverage: String(data.coverage?.period || ''),
    sources: Array.isArray(data.coverage?.sources) ? data.coverage.sources.map(String) : [],
    unavailable: Array.isArray(data.coverage?.unavailable) ? data.coverage.unavailable.map(String) : [],
    scope: '',
    sections,
  };
}

function safeHttpUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
}

function reportFromHtml(source, fileName) {
  const doc = new DOMParser().parseFromString(source, 'text/html');
  const date = normalizeDate(doc.title, normalizeDate(doc.querySelector('.date')?.textContent, normalizeDate(fileName)));
  if (!date) return null;

  const oldItems = [...doc.querySelectorAll('.sheet .item')];
  const currentItems = [...doc.querySelectorAll('main .item')];
  const items = [...oldItems, ...currentItems];
  if (!items.length && !doc.querySelector('.empty')) return null;

  const sections = [];
  if (oldItems.length) {
    sections.push({
      title: '值得留意',
      items: oldItems.map(item => {
        const anchor = item.querySelector('.meta a');
        return {
          title: cleanText(item.querySelector('h2')),
          summary: cleanText(item.querySelector('.abstract')),
          relevance: cleanText(item.querySelector('.relevance')).replace(/^为什么可能相关：?\s*/, ''),
          question: '', source: anchor ? cleanText(anchor) : cleanText(item.querySelector('.meta')),
          url: safeHttpUrl(anchor?.getAttribute('href')),
          published: '', evidence: cleanText(item.querySelector('.tags')),
          readDepth: '',
        };
      }),
    });
  } else if (currentItems.length) {
    const parseCurrentItem = item => {
        const source = item.querySelector('.source');
        const anchor = source?.querySelector('a');
        const paragraphs = [...item.querySelectorAll('p')];
        const relevance = cleanText(item.querySelector('.relevance'));
        const question = cleanText(item.querySelector('.question'));
        return {
          title: cleanText(item.querySelector('h3')),
          summary: cleanText(item.querySelector(':scope > p:not(.relevance):not(.question)')) || cleanText(paragraphs[0]),
          relevance,
          question: question.replace(/^可继续追问\s*/, ''),
          source: cleanText(anchor) || cleanText(source).replace(/^来源：/, ''),
          url: safeHttpUrl(anchor?.getAttribute('href')),
          published: cleanText(item.querySelector('.meta span:nth-child(2)')),
          evidence: cleanText(item.querySelector('.meta span:first-child')),
          readDepth: cleanText(item.querySelector('.meta span:nth-child(3)')),
        };
      };
    const sectionNodes = [...doc.querySelectorAll('main .body > section')];
    if (sectionNodes.length) {
      sectionNodes.forEach(section => {
        const sectionItems = [...section.querySelectorAll('.item')].map(parseCurrentItem);
        if (sectionItems.length) sections.push({ title: cleanText(section.querySelector('h2')) || '研究动态', items: sectionItems });
      });
    } else {
      sections.push({ title: cleanText(doc.querySelector('main h2')) || '值得留意', items: currentItems.map(parseCurrentItem) });
    }
  }

  const title = cleanText(doc.querySelector('.title-block h1, main h1')) || doc.title.replace(/\s*[·|｜].*$/, '') || '科研日报';
  const scope = cleanText(doc.querySelector('.scope'));
  const footerLines = [...doc.querySelectorAll('.foot p, footer p')].map(cleanText).filter(Boolean);
  const intro = cleanText(doc.querySelector('.intro'));
  const emptyText = cleanText(doc.querySelector('.empty'));
  return {
    id: `${date}-${fileName}`, fileName, date, title,
    intro: intro || emptyText,
    status: items.length ? 'ready' : 'empty',
    coverage: footerLines.find(line => /覆盖时段|覆盖范围|监测范围/.test(line)) || scope,
    sources: [],
    unavailable: footerLines.filter(line => /未能访问/.test(line)),
    scope,
    sections,
  };
}

export async function parseDailyBriefFile(file) {
  try {
    const contents = await file.text();
    const extension = file.name.toLowerCase().split('.').pop();
    const report = extension === 'json'
      ? reportFromJson(JSON.parse(contents), file.name)
      : extension === 'html' || extension === 'htm'
        ? reportFromHtml(contents, file.name)
        : null;
    return report;
  } catch {
    return null;
  }
}

export async function listDailyBriefFiles(directoryHandle) {
  const reports = [];
  for await (const entry of directoryHandle.values()) {
    if (entry.kind !== 'file' || !/\.(html?|json)$/i.test(entry.name)) continue;
    const file = await entry.getFile();
    const report = await parseDailyBriefFile(file);
    if (report) reports.push({ ...report, lastModified: file.lastModified });
  }
  return reports.sort((a, b) => b.date.localeCompare(a.date) || b.lastModified - a.lastModified);
}

const DB_NAME = 'danta-daily-briefs';
const STORE_NAME = 'settings';
const DIRECTORY_KEY = 'report-directory';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDirectoryHandle(handle) {
  const db = await openDatabase();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(handle, DIRECTORY_KEY);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export async function loadDirectoryHandle() {
  const db = await openDatabase();
  const handle = await new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(DIRECTORY_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return handle;
}
