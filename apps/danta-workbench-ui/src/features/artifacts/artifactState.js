const token = /^[a-f0-9]{64}$/;
const text = (value, max) => typeof value === 'string' ? value.slice(0, max) : '';
const integer = (value, fallback, max) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(max, Math.floor(Number(value)))) : fallback;

export function normalizePreviewState(value) {
  const source = value && typeof value === 'object' ? value : {};
  const tabs = Array.isArray(source.tabs) ? source.tabs.filter(item => item && token.test(item.key)).slice(-12).map(item => ({ key: item.key, title: text(item.title, 160), version: text(item.version, 40) })) : [];
  const views = {};
  for (const [key, raw] of Object.entries(source.views && typeof source.views === 'object' ? source.views : {}).slice(-100)) {
    if (!token.test(key) || !raw || typeof raw !== 'object') continue;
    views[key] = { page: Math.max(1, integer(raw.page, 1, 100000)), zoom: [0.5, 0.75, 1, 1.25, 1.5, 2].includes(raw.zoom) ? raw.zoom : 1, scroll: integer(raw.scroll, 0, 10000000), feedback: text(raw.feedback, 6000), feedbackPage: Math.max(1, integer(raw.feedbackPage || raw.page, 1, 100000)), fingerprint: token.test(raw.fingerprint) ? raw.fingerprint : '' };
  }
  return { tabs, views, selectedKey: tabs.some(item => item.key === source.selectedKey) ? source.selectedKey : tabs.at(-1)?.key || '', open: Boolean(source.open), expanded: Boolean(source.expanded), width: Math.max(35, Math.min(65, Number(source.width) || 48)) };
}
