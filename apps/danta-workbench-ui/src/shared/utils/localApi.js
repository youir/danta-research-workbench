const LOCAL_API = '/__danta';

async function requestLocal(path, init = {}) {
  if (init.body && new TextEncoder().encode(init.body).length > 96 * 1024) {
    throw new Error('内容超过本机服务单次保存范围，请拆分后再提交。原内容仍保留在本机草稿中。');
  }
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

export function rememberVaultLocation() {
  return requestLocal('/vault/remember', { method: 'POST', body: '{}' });
}

export function restoreVaultLocation() {
  return requestLocal('/vault/restore', { method: 'POST', body: '{}' });
}

export function forgetVaultLocation() {
  return requestLocal('/vault/forget', { method: 'POST', body: '{}' });
}

export function addVaultScopeFolder(scopeId) {
  return requestLocal('/vault/scope-folder/add', { method: 'POST', body: JSON.stringify({ scopeId }) });
}

export function removeVaultScopeFolder(scopeId, relativePath) {
  return requestLocal('/vault/scope-folder/remove', { method: 'POST', body: JSON.stringify({ scopeId, relativePath }) });
}

export function authorizeVaultScopes(scopes) {
  return requestLocal('/vault/authorize', { method: 'POST', body: JSON.stringify({ scopes }) });
}

export function disconnectVault() {
  return requestLocal('/vault/disconnect', { method: 'POST', body: '{}' });
}

export function inspectVaultStructure() {
  return requestLocal('/vault/structure');
}

export function repairVaultStructure() {
  return requestLocal('/vault/structure/repair', { method: 'POST', body: JSON.stringify({ confirm: true }) });
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

export function getJevStatus() {
  return requestLocal('/jev/status');
}

export function configureJev(apiKey) {
  return requestLocal('/jev/configure', { method: 'POST', body: JSON.stringify({ apiKey }) });
}

export function verifyJev() {
  return requestLocal('/jev/verify', { method: 'POST', body: '{}' });
}

export function forgetJev() {
  return requestLocal('/jev/forget', { method: 'POST', body: '{}' });
}

export function createCodexThread(payload) {
  return requestLocal('/codex/new-thread', { method: 'POST', body: JSON.stringify(payload) });
}

export function openCodexThread(threadId) {
  return requestLocal('/codex/open-thread', { method: 'POST', body: JSON.stringify({ threadId }) });
}
