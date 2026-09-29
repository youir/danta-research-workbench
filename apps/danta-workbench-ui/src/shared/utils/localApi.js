const LOCAL_API = '/__danta';

async function requestLocal(path, init = {}) {
  const response = await fetch(`${LOCAL_API}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
    cache: 'no-store',
    credentials: 'same-origin',
  });
  let payload;
  try { payload = await response.json(); } catch { throw new Error('本机服务返回了无法识别的结果。'); }
  if (!response.ok) throw new Error(payload.error || '本机操作失败。');
  return payload;
}

export function getVaultStatus() {
  return requestLocal('/vault/status');
}

export function chooseVault() {
  return requestLocal('/vault/select', { method: 'POST', body: '{}' });
}

export function authorizeVaultScopes(scopes) {
  return requestLocal('/vault/authorize', { method: 'POST', body: JSON.stringify({ scopes }) });
}

export function disconnectVault() {
  return requestLocal('/vault/disconnect', { method: 'POST', body: '{}' });
}

export function getVaultData(section) {
  return requestLocal(`/vault/data?section=${encodeURIComponent(section)}`);
}

export function createVaultArchive(payload) {
  return requestLocal('/vault/archive', { method: 'POST', body: JSON.stringify(payload) });
}

export function getCodexStatus() {
  return requestLocal('/codex/status');
}

export function createCodexThread(payload) {
  return requestLocal('/codex/new-thread', { method: 'POST', body: JSON.stringify(payload) });
}
