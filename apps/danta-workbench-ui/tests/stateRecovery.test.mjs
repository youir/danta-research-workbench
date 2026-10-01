import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createServer } from 'node:http';
import { createWorkbenchStateStore } from '../server/workbenchState.js';
import { createLocalBridgeRequestHandler, createLocalBridgeService } from '../server/localBridge.js';
import { STORAGE_PREFIX, validateStateValues } from '../src/shared/constants/persistedState.js';
import { getHandoffThreadId, isSameKickoff, retainThreadLinks } from '../src/shared/utils/taskHandoff.js';

const values = text => ({ homeThought: JSON.stringify(text), activePage: JSON.stringify('ppt') });
async function temporary(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'danta-state-test-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return dir;
}

test('disk state survives a new process/store and unchanged saves do not rotate backups', async t => {
  const dir = await temporary(t);
  const store = createWorkbenchStateStore(dir);
  assert.equal((await store.load()).values, null);
  await store.save(values('第一轮模拟草稿'));
  await store.save(values('第二轮模拟草稿'));
  const before = await store.status();
  await store.save(values('第二轮模拟草稿'));
  assert.deepEqual(await store.status(), before);
  assert.deepEqual((await createWorkbenchStateStore(dir).load()).values, values('第二轮模拟草稿'));
});

test('corrupt current state recovers the previous draft and preserves the broken file', async t => {
  const dir = await temporary(t);
  const store = createWorkbenchStateStore(dir);
  await store.save(values('已保存的模拟草稿'));
  await store.save(values('最近的模拟草稿'));
  await fs.writeFile(path.join(dir, 'current.json'), '{broken');
  const recovered = await createWorkbenchStateStore(dir).load();
  assert.deepEqual(recovered.values, values('已保存的模拟草稿'));
  assert.match(recovered.message, /恢复/);
  assert.ok((await fs.readdir(dir)).some(name => name.startsWith('unreadable-')));
  assert.deepEqual((await createWorkbenchStateStore(dir).load()).values, recovered.values);
});

test('unreadable state without a good backup cannot be silently replaced by defaults', async t => {
  const dir = await temporary(t);
  const original = '{broken';
  await fs.writeFile(path.join(dir, 'current.json'), original);
  const store = createWorkbenchStateStore(dir);
  await assert.rejects(store.save(values('新默认值')), /无法读取/);
  assert.equal(await fs.readFile(path.join(dir, 'current.json'), 'utf8'), original);
});

test('historical restore retains the current draft and rejects arbitrary or stale backup identifiers', async t => {
  const dir = await temporary(t);
  let clock = Date.parse('2026-10-01T00:00:00Z');
  const store = createWorkbenchStateStore(dir, { now: () => clock });
  await store.save(values('模拟版本一'));
  clock += 1000;
  await store.save(values('模拟版本二'));
  const backup = (await store.status()).backups.find(item => item.id.startsWith('previous:'));
  await store.restore(backup.id);
  assert.deepEqual((await store.load()).values, values('模拟版本一'));
  const undo = (await store.status()).backups.find(item => item.id.startsWith('previous:'));
  await store.restore(undo.id);
  assert.deepEqual((await store.load()).values, values('模拟版本二'));
  clock += 1000;
  await store.save(values('模拟版本三'));
  await assert.rejects(store.restore(backup.id), /更新/);
  await assert.rejects(store.restore('../current.json'), /不存在/);
});

test('history retention is bounded and serial saves keep the latest update', async t => {
  const dir = await temporary(t);
  let clock = Date.parse('2026-10-01T00:00:00Z');
  const store = createWorkbenchStateStore(dir, { now: () => clock });
  for (let i = 0; i < 16; i += 1) {
    clock += 31 * 60 * 1000;
    await store.save(values(`模拟版本 ${i}`));
  }
  assert.equal((await fs.readdir(path.join(dir, 'history'))).length, 10);
  await Promise.all([store.save(values('倒数第二版')), store.save(values('最后一版'))]);
  assert.deepEqual((await store.load()).values, values('最后一版'));
});

test('only application state is accepted; wrong types and unknown credentials are rejected', () => {
  assert.throws(() => validateStateValues({ jevApiKey: '"not-a-key"' }), /不支持/);
  assert.throws(() => validateStateValues({ researchTasks: '{}' }), /类型/);
  assert.throws(() => validateStateValues({ researchTasks: '[null]' }), /任务卡/);
  assert.throws(() => validateStateValues({ homeThought: 'not-json' }), /无法读取/);
});

test('state transport accepts large drafts only on its dedicated route and rejects external origins', async t => {
  const dir = await temporary(t);
  const service = createLocalBridgeService({ workbenchStateStore: createWorkbenchStateStore(dir) });
  const server = createServer(createLocalBridgeRequestHandler(service));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (endpoint, body, origin = base) => fetch(`${base}/__danta/${endpoint}`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const draft = values('模拟'.repeat(50_000));
  assert.equal((await request('state/save', { values: draft })).status, 200);
  assert.equal((await request('state/save', { values: draft }, 'https://untrusted.example')).status, 403);
  assert.equal((await request('vault/archive', { body: 'x'.repeat(100_000) })).status, 413);
  assert.deepEqual((await service.loadWorkbenchState()).values, draft);
});

test('reopening an existing thread does not create a new thread and returns actual open/copy failures', async () => {
  const calls = [];
  const service = createLocalBridgeService({
    openThread: async id => { calls.push(id); return false; },
    copyText: async () => { throw new Error('模拟剪贴板失败'); },
  });
  const threadId = 'test-thread-12345678';
  assert.deepEqual(await service.openCodexThread({ threadId, prompt: '模拟接续内容' }), { threadId, opened: false, copied: false });
  assert.deepEqual(calls, [threadId]);
  const pending = { taskId: 'task-a', handoffThreadId: threadId };
  assert.equal(getHandoffThreadId(pending, null), threadId);
  assert.equal(getHandoffThreadId({ taskId: 'task-a' }, { id: 'task-b', linkedCodexThreadId: threadId }), '');
  const updated = retainThreadLinks({ linkedCodexThreadId: threadId }, 'next-thread-123456');
  assert.deepEqual(updated.codexThreadIds, [threadId, 'next-thread-123456']);
});

test('a late handoff result cannot replace a different or dismissed kickoff', () => {
  const snapshot = { id: 'kickoff-a', taskId: 'task-a', prompt: '模拟启动语', updatedAt: 1 };
  assert.equal(isSameKickoff({ ...snapshot, projectId: 'selected-project' }, snapshot), true);
  assert.equal(isSameKickoff({ ...snapshot, id: 'kickoff-b' }, snapshot), false);
  assert.equal(isSameKickoff(null, snapshot), false);
  const legacy = { taskId: 'task-a', prompt: '旧版模拟启动语', updatedAt: 1 };
  assert.equal(isSameKickoff({ ...legacy }, legacy), true);
  assert.equal(isSameKickoff({ ...legacy, updatedAt: 2 }, legacy), false);
});

test('renderer migrates cached drafts, flushes final edits, and hydrates disk before mounting', async t => {
  const dir = await temporary(t);
  const store = createWorkbenchStateStore(dir);
  const cache = new Map([[`${STORAGE_PREFIX}homeThought`, JSON.stringify('模拟旧版草稿')]]);
  const oldGlobals = { window: globalThis.window, document: globalThis.document, fetch: globalThis.fetch, desktop: globalThis.__IS_DESKTOP_BUILD__ };
  t.after(() => { globalThis.window = oldGlobals.window; globalThis.document = oldGlobals.document; globalThis.fetch = oldGlobals.fetch; globalThis.__IS_DESKTOP_BUILD__ = oldGlobals.desktop; });
  globalThis.__IS_DESKTOP_BUILD__ = true;
  globalThis.window = { localStorage: { getItem: key => cache.get(key) ?? null, setItem: (key, value) => cache.set(key, value), removeItem: key => cache.delete(key) } };
  globalThis.document = { addEventListener() {} };
  globalThis.fetch = async (url, init) => {
    const result = url.endsWith('/save') ? await store.save(JSON.parse(init.body).values) : await store.load();
    return { ok: true, json: async () => result };
  };
  const first = await import(`../src/shared/utils/desktopState.js?test=${crypto.randomUUID()}`);
  await first.initializeDesktopState();
  await first.flushDesktopState();
  assert.deepEqual((await store.load()).values, { homeThought: JSON.stringify('模拟旧版草稿') });
  first.queueDesktopState('homeThought', JSON.stringify('关闭前最后的模拟修改'));
  await Promise.all([first.flushDesktopState(), first.flushDesktopState()]);
  cache.set(`${STORAGE_PREFIX}homeThought`, JSON.stringify('过时的浏览器缓存'));
  const second = await import(`../src/shared/utils/desktopState.js?test=${crypto.randomUUID()}`);
  await second.initializeDesktopState();
  await second.flushDesktopState();
  assert.equal(second.getPersistedValue('homeThought'), JSON.stringify('关闭前最后的模拟修改'));
  assert.equal(cache.get(`${STORAGE_PREFIX}homeThought`), second.getPersistedValue('homeThought'));
});
