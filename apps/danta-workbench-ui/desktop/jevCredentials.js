import { safeStorage } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

const MAX_FILE_BYTES = 8192;
const TEST_REQUEST = {
  model: 'jev-latest',
  state: 'This sentence mentions tissue pathology.',
  questions: { mentions_pathology: { type: 'noul', instructions: 'Does the sentence mention pathology?' } },
};

export function createJevCredentialStore(filePath) {
  function supported() {
    return ['win32', 'darwin'].includes(process.platform) && safeStorage.isEncryptionAvailable();
  }

  async function readRecord() {
    try {
      const stat = await fs.stat(filePath);
      if (!stat.isFile() || stat.size > MAX_FILE_BYTES) return null;
      const record = JSON.parse(await fs.readFile(filePath, 'utf8'));
      if (record?.version !== 1 || typeof record.ciphertext !== 'string') return null;
      return record;
    } catch { return null; }
  }

  async function writeRecord(record) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.${process.pid}.tmp`;
    try {
      await fs.writeFile(temporary, JSON.stringify(record), { mode: 0o600 });
      await fs.rename(temporary, filePath);
    } finally {
      await fs.rm(temporary, { force: true }).catch(() => {});
    }
  }

  async function readKey() {
    if (!supported()) return '';
    const record = await readRecord();
    if (!record) return '';
    try { return safeStorage.decryptString(Buffer.from(record.ciphertext, 'base64')); }
    catch { return ''; }
  }

  async function status() {
    if (!supported()) return { supported: false, saved: false, verified: false, verifiedAt: null, message: '当前系统无法安全保存密钥。请使用 Windows 或 macOS 桌面版。' };
    const record = await readRecord();
    const saved = Boolean(record && await readKey());
    return { supported: true, saved, verified: saved && Boolean(record.verifiedAt), verifiedAt: saved ? record.verifiedAt || null : null };
  }

  async function save(apiKey) {
    if (!supported()) throw new Error('当前系统无法安全保存 Jev 密钥。');
    const value = typeof apiKey === 'string' ? apiKey.trim() : '';
    if (value.length < 16 || value.length > 512 || /\s/.test(value)) throw new Error('密钥格式不完整。请核对后重新输入。');
    const ciphertext = safeStorage.encryptString(value).toString('base64');
    await writeRecord({ version: 1, ciphertext, verifiedAt: null });
    return status();
  }

  async function verify() {
    if (!supported()) return status();
    const key = await readKey();
    if (!key) return { ...(await status()), message: '尚未保存 Jev API Key。' };
    const record = await readRecord();
    let message = '';
    let verifiedAt = null;
    try {
      const response = await fetch('https://api.typesafe.ai/v1/systemone', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(TEST_REQUEST),
        signal: AbortSignal.timeout(12000),
      });
      if (response.status === 401 || response.status === 403) message = '密钥未通过服务验证，请检查是否填写正确。';
      else if (response.status === 429) message = '服务暂时限流或额度不足，请稍后重试。';
      else if (!response.ok) message = `Jev 服务暂时无法验证（HTTP ${response.status}）。`;
      else {
        const result = await response.json();
        const value = result?.answers?.mentions_pathology?.noul;
        if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1) {
          verifiedAt = new Date().toISOString();
          message = 'Jev 连接验证成功。';
        } else message = 'Jev 返回了无法识别的验证结果。';
      }
    } catch {
      message = '暂时无法连接 Jev 服务，请检查网络后重试。';
    }
    await writeRecord({ ...record, verifiedAt });
    return { ...(await status()), message };
  }

  async function forget() {
    await fs.rm(filePath, { force: true });
    return status();
  }

  return { status, save, verify, forget };
}
