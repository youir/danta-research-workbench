import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { MAX_STATE_BYTES, validateStateValues } from '../src/shared/constants/persistedState.js';

const HISTORY_LIMIT = 10;
const HISTORY_INTERVAL = 30 * 60 * 1000;

export function createWorkbenchStateStore(directory, { now = Date.now } = {}) {
  const currentPath = path.join(directory, 'current.json');
  const previousPath = path.join(directory, 'previous.json');
  const historyDirectory = path.join(directory, 'history');
  let queue = Promise.resolve();
  let lastHistoryAt = 0;
  let message = '';

  function serial(action) {
    const result = queue.then(action);
    queue = result.catch(() => {});
    return result;
  }

  async function atomicWrite(filename, value) {
    await fs.mkdir(path.dirname(filename), { recursive: true, mode: 0o700 });
    const temporary = `${filename}.${randomUUID()}.tmp`;
    let handle;
    try {
      handle = await fs.open(temporary, 'wx', 0o600);
      await handle.writeFile(JSON.stringify(value));
      await handle.sync();
      await handle.close();
      handle = null;
      await fs.rename(temporary, filename);
    } finally {
      await handle?.close().catch(() => {});
      await fs.rm(temporary, { force: true }).catch(() => {});
    }
  }

  async function readSnapshot(filename) {
    const stat = await fs.stat(filename);
    if (!stat.isFile() || stat.size > MAX_STATE_BYTES + 4096) throw new Error('本机状态文件大小或类型异常。');
    const snapshot = JSON.parse(await fs.readFile(filename, 'utf8'));
    if (snapshot.version !== 1 || typeof snapshot.savedAt !== 'string' || !Number.isFinite(Date.parse(snapshot.savedAt))) throw new Error('本机状态版本无法识别。');
    return { version: 1, savedAt: snapshot.savedAt, values: validateStateValues(snapshot.values) };
  }

  async function history() {
    const names = await fs.readdir(historyDirectory).catch(error => {
      if (error.code === 'ENOENT') return [];
      throw error;
    });
    return names.filter(name => /^state-[0-9T-]+-[a-f0-9-]+\.json$/.test(name)).sort().reverse();
  }

  async function load() {
    try { return await readSnapshot(currentPath); }
    catch (error) {
      const currentMissing = error.code === 'ENOENT';
      const candidates = [previousPath, ...(await history()).map(name => path.join(historyDirectory, name))];
      for (const candidate of candidates) {
        let snapshot;
        try { snapshot = await readSnapshot(candidate); } catch { continue; }
        // Preserve the unreadable file for diagnosis, then repair the current file.
        if (!currentMissing) await fs.copyFile(currentPath, path.join(directory, `unreadable-${randomUUID()}.json`));
        await atomicWrite(currentPath, snapshot);
        message = '上次状态文件不可用，已从本机备份恢复。';
        return snapshot;
      }
      if (!currentMissing || (await fs.stat(previousPath).catch(() => null)) || (await history()).length) {
        throw new Error('本机状态和备份无法读取。已保留原文件，请先导出当前任务备份。');
      }
      return null;
    }
  }

  async function archive(snapshot, force = false) {
    if (!snapshot || (!force && now() - lastHistoryAt < HISTORY_INTERVAL)) return;
    const stamp = new Date(now()).toISOString().replace(/[:.Z]/g, '-');
    await atomicWrite(path.join(historyDirectory, `state-${stamp}-${randomUUID()}.json`), snapshot);
    lastHistoryAt = now();
    const names = await history();
    await Promise.all(names.slice(HISTORY_LIMIT).map(name => fs.rm(path.join(historyDirectory, name))));
  }

  async function status() {
    const current = await load();
    const backups = [];
    for (const [id, filename] of [['previous', previousPath], ...(await history()).map(name => [name, path.join(historyDirectory, name)])]) {
      try { const item = await readSnapshot(filename); backups.push({ id: id === 'previous' ? `previous:${item.savedAt}` : id, savedAt: item.savedAt }); }
      catch { /* Invalid backups remain on disk but are not offered for restore. */ }
    }
    return { supported: true, savedAt: current?.savedAt || null, message, backups };
  }

  return {
    load: () => serial(async () => ({ ...(await status()), values: (await load())?.values || null })),
    status: () => serial(status),
    save: values => serial(async () => {
      const checked = validateStateValues(values);
      const current = await load();
      if (current && JSON.stringify(current.values) === JSON.stringify(checked)) return { supported: true, savedAt: current.savedAt };
      if (current) {
        await archive(current);
        await atomicWrite(previousPath, current);
      }
      const snapshot = { version: 1, savedAt: new Date(now()).toISOString(), values: checked };
      await atomicWrite(currentPath, snapshot);
      return { supported: true, savedAt: snapshot.savedAt };
    }),
    restore: id => serial(async () => {
      const isPrevious = typeof id === 'string' && id.startsWith('previous:');
      if (!isPrevious && !(await history()).includes(id)) throw new Error('所选备份已不存在，请刷新备份列表。');
      const target = await readSnapshot(isPrevious ? previousPath : path.join(historyDirectory, id));
      if (isPrevious && id !== `previous:${target.savedAt}`) throw new Error('最近备份已经更新，请刷新后重新选择。');
      const current = await load();
      await archive(current, true);
      if (current) await atomicWrite(previousPath, current);
      const snapshot = { ...target, savedAt: new Date(now()).toISOString() };
      await atomicWrite(currentPath, snapshot);
      return { supported: true, values: snapshot.values, savedAt: snapshot.savedAt };
    }),
  };
}
