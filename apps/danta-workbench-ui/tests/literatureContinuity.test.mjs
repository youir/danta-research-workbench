import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { collectLiterature, normalizeDoi, normalizePmid, safeLiteratureUrl, updateLiteratureCard, validLiteratureCards, mergeLiteratureBackup, readingMarkdown, removeLiteratureDraft, LITERATURE_LIMIT } from '../src/shared/utils/literatureCards.js';
import { makeTaskBackup, parseTaskBackup } from '../src/shared/utils/taskBackup.js';
import { createResearchTask } from '../src/shared/constants/researchTasks.js';
import { PROMPT_STARTERS, MECHANISM_WORKFLOW } from '../src/shared/constants/workflows.js';
import { makeKickoffPrompt } from '../src/shared/utils/promptBuilder.js';
import { buildTaskArchiveDraft, makeRelatedTaskContext } from '../src/shared/utils/taskRecords.js';
import { validateStateValues } from '../src/shared/constants/persistedState.js';
import { createWorkbenchStateStore } from '../server/workbenchState.js';
import { createLocalBridgeService } from '../server/localBridge.js';

const workflow = PROMPT_STARTERS.find(item => item.id === 'topic');
const source = { title: '功能验证用虚构病理学文献', doi: '10.9999/danta-test', url: 'https://doi.org/10.9999/danta-test', originLabel: '模拟 RSS', originKey: 'rss:test:1' };
const makeCard = () => collectLiterature([], source).card;
async function temporary(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'danta-literature-test-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return dir;
}

test('DOI/PMID normalize without network; unsafe links are rejected', () => {
  assert.equal(normalizeDoi('https://doi.org/10.9999/DANTA-TEST'), source.doi);
  assert.equal(normalizeDoi('https://doi.org/10.9999%2FDANTA-TEST?utm_source=rss#abstract'), source.doi);
  assert.equal(normalizePmid('PMID: 12345678'), '12345678');
  for (const url of ['javascript:alert(1)', 'file:///private/secret', 'https://user:pass@example.org', 'data:text/html,test']) assert.equal(safeLiteratureUrl(url), '');
  assert.equal(collectLiterature([], { url: 'https://pubmed.ncbi.nlm.nih.gov/12345678/' }).card.pmid, '12345678');
  assert.equal(collectLiterature([], { url: 'https://example.org/public-test' }).card.title, '来源链接 · 题名待核实');
});

test('RSS, daily briefing and manual DOI reuse one card while preserving reading progress and origins', () => {
  let card = updateLiteratureCard(makeCard(), 'notes', '虚构测试笔记，不是科研结论');
  card = updateLiteratureCard(card, 'position', '摘要末段');
  const result = collectLiterature([card], { ...source, doi: '10.9999/DANTA-TEST', originKey: 'brief:test:1', originLabel: '模拟日报' });
  assert.equal(result.cards.length, 1);
  assert.equal(result.card.id, card.id);
  assert.equal(result.card.notes, card.notes);
  assert.equal(result.card.position, '摘要末段');
  assert.equal(result.card.origins.length, 2);
  assert.equal(collectLiterature(result.cards, { ...source, originKey: 'brief:test:1' }).card.origins.length, 2);
  assert.equal(collectLiterature(result.cards, { title: source.title, url: source.url + '?utm_source=rss' }).cards.length, 1);
});

test('tracking query variants reuse a URL and equal titles without stable identifiers remain separate', () => {
  const first = collectLiterature([], { title: '同题名模拟线索', url: 'https://example.org/paper?utm_source=rss' }).card;
  assert.equal(collectLiterature([first], { title: '原标题', url: 'https://example.org/paper#result' }).cards.length, 1);
  assert.equal(collectLiterature([first], { title: first.title, url: 'https://example.org/other-paper' }).cards.length, 2);
});

test('note identity includes the vault; two same relative paths in different vaults remain separate', () => {
  const first = collectLiterature([], { title: '模拟笔记', originKey: 'note:vault-a:reading.md', notePath: 'reading.md', vaultPath: 'test-vault-a' }).card;
  assert.equal(collectLiterature([first], { title: '模拟笔记', originKey: 'note:vault-b:reading.md', notePath: 'reading.md', vaultPath: 'test-vault-b' }).cards.length, 2);
  assert.equal(collectLiterature([first], { title: '模拟笔记', originKey: 'note:vault-a:reading.md' }).cards.length, 1);
});

test('conflicting identifiers and ambiguous matches fail without mutating existing cards', () => {
  const first = makeCard(), original = structuredClone(first);
  assert.throws(() => collectLiterature([first], { ...source, doi: '10.9999/other' }), /冲突/);
  const second = collectLiterature([], { title: '第二篇测试', pmid: '12345678' }).card;
  assert.throws(() => collectLiterature([first, second], { ...source, pmid: second.pmid }), /多张/);
  assert.deepEqual(first, original);
  assert.throws(() => collectLiterature([], { title: source.title, doi: source.doi, url: 'https://doi.org/10.9999/wrong' }), /冲突/);
  assert.throws(() => collectLiterature([], { pmid: '12345678', url: 'https://pubmed.ncbi.nlm.nih.gov/87654321/' }), /冲突/);
});

test('reading completion requires actual scope and cannot silently change identifiers or authority', () => {
  const card = makeCard();
  assert.equal(card.status, 'unread'); assert.equal(card.readScope, 'unknown');
  assert.throws(() => updateLiteratureCard(card, 'status', 'complete'), /实际阅读范围/);
  const complete = updateLiteratureCard(updateLiteratureCard(card, 'readScope', 'abstract'), 'status', 'complete');
  assert.equal(complete.readScope, 'abstract');
  assert.throws(() => updateLiteratureCard(complete, 'readScope', 'unknown'), /实际阅读范围/);
  assert.throws(() => updateLiteratureCard(card, 'doi', '10.9999/changed'), /标识变更/);
  assert.deepEqual(updateLiteratureCard(card, 'url', 'javascript:alert(1)'), card);
});

test('reading cards validate size, duplicates, timestamps and URL schemes before persistence', () => {
  const card = makeCard();
  assert.ok(validLiteratureCards([card]));
  assert.ok(!validLiteratureCards([card, card]));
  assert.ok(!validLiteratureCards([{ ...card, updatedAt: 1e20 }]));
  assert.ok(!validLiteratureCards([{ ...card, notes: 'a'.repeat(6001) }]));
  assert.ok(!validLiteratureCards([{ ...card, url: 'javascript:alert(1)' }]));
  assert.throws(() => validateStateValues({ literatureCards: JSON.stringify([{ ...card, readScope: 'invented' }]) }), /阅读卡/);
});

test('task handoff, stage archive and related output task use the same card ID without completing research', () => {
  const card = updateLiteratureCard(makeCard(), 'position', '摘要 · 测试位置');
  const task = createResearchTask(workflow, { literatureIds: [card.id], nextStep: '核对原文' });
  const prompt = makeKickoffPrompt('测试接续', task.focus, null, null, task, [card]);
  const archive = buildTaskArchiveDraft(task, [card]);
  for (const body of [prompt, archive.body]) {
    assert.ok(body.includes(card.id)); assert.ok(body.includes(card.position));
    assert.match(body, /只读摘要不能写全文结论/); assert.match(body, /已有有效授权/);
    assert.match(body, /不另建第二份权威文献总表/);
  }
  const child = createResearchTask(MECHANISM_WORKFLOW, makeRelatedTaskContext(task, MECHANISM_WORKFLOW));
  assert.deepEqual(child.literatureIds, task.literatureIds);
  child.literatureIds.push('test-other-id');
  assert.deepEqual(task.literatureIds, [card.id]);
  assert.equal(task.statusId, 'in_progress');
});

test('old task backups remain readable and new backups retain cards and references', () => {
  const card = makeCard(), task = createResearchTask(workflow, { literatureIds: [card.id] });
  const backup = makeTaskBackup({ tasks: [task], activeTaskId: task.id, literatureCards: [card], selectedLiteratureId: card.id });
  assert.deepEqual(parseTaskBackup(JSON.stringify(backup)).literatureCards, [card]);
  delete backup.literatureCards; delete task.literatureIds;
  assert.deepEqual(parseTaskBackup(JSON.stringify(backup)).literatureCards, []);
  backup.literatureCards = null;
  assert.throws(() => parseTaskBackup(JSON.stringify(backup)), /阅读卡/);
});

test('backup merges deduplicate DOI, remap task IDs and keep local reading progress', () => {
  const local = updateLiteratureCard(makeCard(), 'notes', '本机新进度');
  const imported = { ...makeCard(), notes: '旧备份进度', origins: [{ ...local.origins[0], key: 'brief:test:2', label: '旧日报' }] };
  const merged = mergeLiteratureBackup([local], [imported]);
  assert.equal(merged.cards.length, 1); assert.equal(merged.cards[0].notes, local.notes);
  assert.equal(merged.idMap.get(imported.id), local.id);
  assert.equal(merged.cards[0].origins.length, 2);
  assert.equal(mergeLiteratureBackup(merged.cards, [imported]).cards.length, 1);
  const sameId = { ...local, notes: '旧备份进度', origins: [{ ...local.origins[0], key: 'brief:same-id:2', label: '备份中的其他来源' }] };
  const sameIdMerged = mergeLiteratureBackup([local], [sameId]);
  assert.equal(sameIdMerged.cards[0].notes, local.notes);
  assert.equal(sameIdMerged.cards[0].origins.length, 2);
  assert.equal(mergeLiteratureBackup(sameIdMerged.cards, [sameId]).cards[0].origins.length, 2);
  const blankTitle = { ...makeCard(), title: '' };
  assert.equal(mergeLiteratureBackup([], [blankTitle]).cards[0].title, '');
});

test('failed imports are atomic; same ID with conflicting DOI does not change local records', () => {
  const local = makeCard(), before = structuredClone(local);
  const earlier = collectLiterature([], { title: '先前测试文献', doi: '10.9999/first' }).card;
  assert.throws(() => mergeLiteratureBackup([local], [earlier, { ...local, doi: '10.9999/conflict' }]), /未导入任何内容/);
  assert.deepEqual(local, before);
});

test('Markdown export has real newlines, quoted metadata and honest draft status', () => {
  const card = { ...makeCard(), title: '测试题名\nstatus: verified' };
  const output = readingMarkdown(card);
  assert.ok(output.startsWith('---\ntitle: ')); assert.ok(output.includes('\nstatus: draft\n'));
  assert.ok(!output.split('---')[1].includes('\nstatus: verified\n'));
  assert.match(output, /不是已核实的证据记录/);
});

test('a recreated disk state store restores page, reading card, task references and unfinished form', async t => {
  const dir = await temporary(t), card = updateLiteratureCard(makeCard(), 'nextAction', '继续核对方法 · 测试');
  const task = createResearchTask(workflow, { literatureIds: [card.id] });
  const values = Object.fromEntries(Object.entries({
    activePage: 'literature', literatureView: 'reading', selectedLiteratureId: card.id,
    literatureTargetTaskId: task.id, literatureCards: [card], researchTasks: [task],
    literatureDraft: { title: '未填完的测试线索', identifier: '10.9999/test' },
  }).map(([key, value]) => [key, JSON.stringify(value)]));
  await createWorkbenchStateStore(dir).save(values);
  assert.deepEqual((await createWorkbenchStateStore(dir).load()).values, values);
});

test('scoped RSS/notes collection leaves source files and grants unchanged; archive still requires its own grant', async t => {
  const dir = await temporary(t), vault = path.join(dir, 'synthetic-vault');
  const notesDir = '03_文献证据_Literature-Evidence', rssDir = '.obsidian/plugins/danta-rss-collector';
  await fs.mkdir(path.join(vault, notesDir), { recursive: true });
  await fs.mkdir(path.join(vault, rssDir), { recursive: true });
  const noteFile = path.join(vault, notesDir, 'test.md');
  const rssFile = path.join(vault, rssDir, 'data.json');
  const note = '# 虚构测试文献\n\n只作功能验证，不是龚博士研究资料。';
  const rss = JSON.stringify({ items: [{ id: 'test-rss', title: source.title, url: source.url, excerpt: '合成测试摘要' }] });
  await fs.writeFile(noteFile, note); await fs.writeFile(rssFile, rss);
  const service = createLocalBridgeService({ folderPicker: async () => vault, vaultMemoryPath: path.join(dir, 'vault-memory.json') });
  await service.chooseVault();
  await assert.rejects(service.vaultData('literature'), /授权/);
  await service.authorizeScopes(['literature', 'rss']);
  const before = (await service.vaultStatus()).scopes;
  const lines = await service.vaultData('rss'), notes = await service.vaultData('literature');
  let cards = collectLiterature([], { ...lines.items[0], originKey: 'rss:test' }).cards;
  cards = collectLiterature(cards, { title: notes.files[0].title, originKey: 'note:test', notePath: notes.files[0].path, vaultPath: vault }).cards;
  assert.equal(cards.length, 2);
  assert.deepEqual((await service.vaultStatus()).scopes, before);
  const task = createResearchTask(workflow, { literatureIds: [cards[0].id] });
  await assert.rejects(service.createArchive(buildTaskArchiveDraft(task, cards)), /授权/);
  assert.equal(await fs.readFile(noteFile, 'utf8'), note); assert.equal(await fs.readFile(rssFile, 'utf8'), rss);
  const restarted = createLocalBridgeService({ vaultMemoryPath: path.join(dir, 'vault-memory.json') });
  assert.deepEqual((await restarted.restoreRememberedVault()).scopes, before);
});

test('desktop package includes the complete local bridge and state-validation dependency closure', async t => {
  const pkg = JSON.parse(await fs.readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.ok(pkg.build.files.includes('src/shared/utils/literatureCards.js'));
  const dir = await temporary(t);
  for (const file of pkg.build.files.filter(file => file.endsWith('.js') || file === 'package.json')) {
    await fs.mkdir(path.dirname(path.join(dir, file)), { recursive: true });
    await fs.copyFile(new URL('../' + file, import.meta.url), path.join(dir, file));
  }
  const bridge = await import(pathToFileURL(path.join(dir, 'server/localBridge.js')).href);
  const state = await import(pathToFileURL(path.join(dir, 'server/workbenchState.js')).href);
  assert.equal(typeof bridge.createLocalBridgeService, 'function');
  const values = { literatureCards: JSON.stringify([makeCard()]) };
  await state.createWorkbenchStateStore(path.join(dir, 'synthetic-state')).save(values);
  assert.deepEqual((await state.createWorkbenchStateStore(path.join(dir, 'synthetic-state')).load()).values, values);
});

test('removing a local draft only unlinks affected tasks and preserves other progress', () => {
  const first = makeCard(), second = collectLiterature([], { title: '另一个虚构测试', doi: '10.9999/second' }).card;
  const linked = createResearchTask(workflow, { literatureIds: [first.id, second.id] });
  const untouched = createResearchTask(workflow, { literatureIds: [second.id], content: '保留的任务草稿' });
  const cards = [first, second], tasks = [linked, untouched], before = structuredClone({ cards, tasks });
  const result = removeLiteratureDraft(cards, tasks, first.id);
  assert.deepEqual(result.cards, [second]);
  assert.deepEqual(result.taskLinks, [{ id: linked.id, literatureIds: [second.id] }]);
  assert.deepEqual({ cards, tasks }, before);
  assert.deepEqual(removeLiteratureDraft(cards, tasks, 'not-found-id').taskLinks, []);
});

test('card and provenance limits fail atomically; draft removal releases capacity', () => {
  const cards = Array.from({ length: LITERATURE_LIMIT }, (_, i) => collectLiterature([], { title: `容量测试 ${i}`, doi: `10.9999/capacity-${i}` }).card);
  const before = structuredClone(cards);
  assert.throws(() => collectLiterature(cards, { doi: '10.9999/new-capacity' }), /500/);
  assert.deepEqual(cards, before);
  assert.equal(collectLiterature(removeLiteratureDraft(cards, [], cards[0].id).cards, { doi: '10.9999/new-capacity' }).cards.length, LITERATURE_LIMIT);
  let origins = [makeCard()];
  for (let i = 1; i < 40; i++) origins = collectLiterature(origins, { ...source, originKey: `test-origin-${i}` }).cards;
  const originsBefore = structuredClone(origins);
  assert.throws(() => collectLiterature(origins, { ...source, originKey: 'test-origin-overflow' }), /40/);
  assert.deepEqual(origins, originsBefore);
  assert.equal(collectLiterature(origins, source).cards.length, 1);
  assert.throws(() => mergeLiteratureBackup(origins, [{ ...origins[0], origins: [{ ...origins[0].origins[0], key: 'backup-overflow' }] }]), /未导入任何内容/);
  assert.deepEqual(origins, originsBefore);
});

test('empty provenance keys and malformed draft state cannot be imported', () => {
  const card = makeCard();
  const malformed = { ...card, origins: [{ ...card.origins[0], key: '' }] };
  assert.equal(validLiteratureCards([malformed]), false);
  assert.throws(() => parseTaskBackup(JSON.stringify(makeTaskBackup({ literatureCards: [malformed] }))), /阅读卡/);
  assert.throws(() => validateStateValues({ literatureDraft: JSON.stringify({ title: [], identifier: '' }) }), /格式|草稿/);
});

test('reading handoff uses the evidence guide and only the selected paper context', () => {
  const first = updateLiteratureCard(makeCard(), 'notes', '本次选中阅读草稿');
  const other = updateLiteratureCard(collectLiterature([], { title: '别篇测试', doi: '10.9999/other-selected' }).card, 'notes', '不可混入的别篇草稿');
  const task = createResearchTask(workflow, { literatureIds: [first.id, other.id] });
  const prompt = makeKickoffPrompt('接续本篇', '文献证据', null, null, { ...task, literatureIds: [first.id] }, [first, other]);
  assert.match(prompt, /本次方向：文献证据/);
  assert.match(prompt, /先核对题录、实际原文可用性与已读范围/);
  assert.ok(prompt.includes(first.notes)); assert.ok(!prompt.includes(other.notes));
  assert.ok(!prompt.includes('组会 PPT 模板：'));
  assert.equal(task.literatureIds.length, 2);
});

test('actual JSON and Markdown file roundtrip preserves progress and source locations', async t => {
  const dir = await temporary(t), card = updateLiteratureCard(makeCard(), 'notes', '仅测试文件落盘，不是正式证据');
  const task = createResearchTask(workflow, { literatureIds: [card.id] });
  const backupPath = path.join(dir, 'synthetic-reading-backup.json'), markdownPath = path.join(dir, 'synthetic-reading.md');
  await fs.writeFile(backupPath, JSON.stringify(makeTaskBackup({ tasks: [task], literatureCards: [card], selectedLiteratureId: card.id }), null, 2));
  await fs.writeFile(markdownPath, readingMarkdown(card));
  const restored = parseTaskBackup(await fs.readFile(backupPath, 'utf8'));
  assert.deepEqual(restored.literatureCards, [card]);
  assert.deepEqual(restored.tasks[0].literatureIds, [card.id]);
  const exported = await fs.readFile(markdownPath, 'utf8');
  assert.ok(exported.includes(card.notes)); assert.ok(exported.includes(source.url));
  assert.match(exported, /status: draft/);
});
