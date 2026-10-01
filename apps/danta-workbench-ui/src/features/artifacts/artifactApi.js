const BASE = '/__danta/artifacts';
async function request(route, body) {
  const response = await fetch(`${BASE}/${route}`, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin', cache: 'no-store' });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '成果读取失败。');
  return result;
}
export const getArtifactStatus = () => request('status');
export const selectArtifactRoot = () => request('select', { confirm: true });
export const forgetArtifactRoot = () => request('forget', {});
export const listArtifacts = taskId => request(`list?taskId=${encodeURIComponent(taskId)}`);
export const importArtifact = taskId => request('import', { taskId });
export const attachArtifactPreview = (taskId, key) => request('attach-preview', { taskId, key });
export const openArtifact = (taskId, key) => request('open', { taskId, key });
export function artifactUrl(taskId, artifact, download = false) {
  return `${BASE}/content?${new URLSearchParams({ taskId, key: artifact.key, fingerprint: artifact.fingerprint || '', ...(download ? { download: '1' } : {}) })}`;
}
export async function readArtifact(taskId, artifact, signal) {
  const response = await fetch(artifactUrl(taskId, artifact), { credentials: 'same-origin', cache: 'no-store', signal });
  if (!response.ok) { const result = await response.json(); throw new Error(result.error || '预览读取失败。'); }
  return response;
}
