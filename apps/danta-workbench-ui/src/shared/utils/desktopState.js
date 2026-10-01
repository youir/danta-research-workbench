import { MAX_STATE_BYTES, PERSISTED_STATE_KEYS, STORAGE_PREFIX, validateStateValues } from '../constants/persistedState.js';

let values = {};
let supported = false;
let ready = false;
let revision = 0;
let savedRevision = 0;
let timer;
let running;
let health = { supported: false, phase: 'unsupported', savedAt: null, error: '', message: '' };
const listeners = new Set();

export function subscribeDesktopState(listener) { listeners.add(listener); return () => listeners.delete(listener); }
export function getDesktopStateHealth() { return health; }
function notify(patch) { health = { ...health, ...patch }; for (const listener of listeners) listener(); }

async function request(endpoint, body) {
  const response = await fetch(`/__danta/state${endpoint}`, {
    method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15_000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '任务自动备份暂不可用。');
  return result;
}

export async function initializeDesktopState() {
  if (typeof __IS_DESKTOP_BUILD__ === 'undefined' || !__IS_DESKTOP_BUILD__) return;
  supported = true;
  notify({ supported: true, phase: 'loading' });
  for (const key of PERSISTED_STATE_KEYS) {
    try {
      const saved = window.localStorage.getItem(`${STORAGE_PREFIX}${key}`)
        ?? window.sessionStorage?.getItem(`danta-workbench:v1:${key}`) ?? null;
      if (saved !== null) { JSON.parse(saved); values[key] = saved; }
    } catch { /* The hook reports invalid browser storage. */ }
  }
  try {
    const result = await request('');
    if (!result.supported) throw new Error('桌面任务存储未连接，请重启工作台。');
    if (result.values !== null) {
      values = validateStateValues(result.values);
      for (const key of PERSISTED_STATE_KEYS) {
        try {
          if (Object.hasOwn(values, key)) window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, values[key]);
          else window.localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
        } catch { /* Disk state remains authoritative when the browser cache is full. */ }
      }
    }
    ready = true;
    if (result.values === null) revision += 1;
    notify({ phase: 'saved', savedAt: result.savedAt || null, message: result.message || '', error: '' });
    timer = setTimeout(() => void flushDesktopState().catch(() => {}), 600);
  } catch (error) {
    notify({ phase: 'error', error: error.message || '任务自动备份无法读取，请先导出当前任务。' });
  }
  window.__dantaFlushState = flushDesktopState;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushDesktopState().catch(() => {});
  });
}

export function getPersistedValue(key) { return supported ? values[key] : undefined; }
export function hasDesktopPersistence() { return supported && ready; }

export function queueDesktopState(key, value) {
  if (!supported || values[key] === value) return;
  values[key] = value;
  revision += 1;
  if (!ready) return;
  notify({ phase: 'saving' });
  clearTimeout(timer);
  timer = setTimeout(() => void flushDesktopState().catch(() => {}), 600);
}

export async function flushDesktopState() {
  if (!supported) return;
  if (!ready) throw new Error('任务自动备份未连接，请先导出当前任务。');
  clearTimeout(timer);
  while (running) await running;
  if (savedRevision === revision) return;
  const targetRevision = revision;
  const snapshot = { ...values };
  running = (async () => {
    try {
      validateStateValues(snapshot);
      if (new TextEncoder().encode(JSON.stringify({ values: snapshot })).length > MAX_STATE_BYTES + 4096) throw new Error('任务自动备份超过保存范围，请先导出并整理任务。');
      notify({ phase: 'saving' });
      const result = await request('/save', { values: snapshot });
      savedRevision = targetRevision;
      notify({ phase: revision === savedRevision ? 'saved' : 'saving', savedAt: result.savedAt, error: '' });
    } catch (error) {
      notify({ phase: 'error', error: error.message || '任务自动备份失败，请先导出当前任务。' });
      throw error;
    }
  })();
  try { await running; } finally { running = null; }
  if (revision !== savedRevision) await flushDesktopState();
}

export async function getDesktopBackups() { await flushDesktopState(); return request('/status'); }

export async function restoreDesktopBackup(id) {
  await flushDesktopState();
  const result = await request('/restore', { id });
  // The backend has retained the current state before the restore. Reopening
  // hydrates the selected disk snapshot before React can persist any defaults.
  ready = false;
  window.location.reload();
  return result;
}
