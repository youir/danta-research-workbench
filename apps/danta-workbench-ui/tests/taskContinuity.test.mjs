import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createResearchTask, migrateLegacyResearchTasks } from '../src/shared/constants/researchTasks.js';
import { MECHANISM_WORKFLOW, PROMPT_STARTERS } from '../src/shared/constants/workflows.js';
import { buildTaskArchiveDraft, createTaskRecord, makeRelatedTaskContext } from '../src/shared/utils/taskRecords.js';
import { makeKickoffPrompt } from '../src/shared/utils/promptBuilder.js';
import { createLocalBridgeService } from '../server/localBridge.js';

const workflow = PROMPT_STARTERS.find(item => item.id === 'ppt');

test('multiple tasks of the same workflow retain independent content and choices', () => {
  const first = createResearchTask(workflow, { content: '模拟任务一', selectedPptLogo: { id: 'naval' } });
  const second = createResearchTask(workflow, { content: '模拟任务二' });
  assert.notEqual(first.id, second.id);
  first.pptPromptChoices.format = '组会文献汇报';
  first.records.push(createTaskRecord());
  assert.equal(second.content, '模拟任务二');
  assert.equal(second.selectedPptLogo, null);
  assert.equal(second.pptPromptChoices.format, '');
  assert.equal(second.records.length, 0);
});

test('legacy migration preserves the original drafts and creates only useful task cards', () => {
  const legacy = {
    drafts: Object.fromEntries(PROMPT_STARTERS.map(item => [item.id, item.seed])),
    filesByWorkflow: { ppt: ['模拟材料.png'] },
    selectedPptLogo: { id: 'naval' },
    pptPromptChoices: { format: '研究进展汇报' },
    mechanismBrief: '模拟机制图需求',
  };
  legacy.drafts.ppt = '模拟汇报内容';
  const original = structuredClone(legacy);
  const migrated = migrateLegacyResearchTasks(legacy);
  assert.equal(migrated.length, 2);
  const ppt = migrated.find(task => task.workflowId === 'ppt');
  assert.equal(ppt.content, '模拟汇报内容');
  assert.deepEqual(ppt.files, ['模拟材料.png']);
  assert.equal(ppt.selectedPptLogo.id, 'naval');
  assert.equal(ppt.pptPromptChoices.format, '研究进展汇报');
  assert.equal(migrated.find(task => task.workflowId === 'mechanism').content, '模拟机制图需求');
  assert.deepEqual(legacy, original);
});

test('unfinished tasks preserve sources, versions and unresolved questions in both handoff and archive', () => {
  const task = createResearchTask(workflow, {
    title: '功能验证（模拟）', stageId: 'evidence', statusId: 'waiting_input',
    objective: '检查任务接续', nextStep: '补齐来源页码', openQuestions: '来源尚未读取全文',
    records: [{ ...createTaskRecord(), title: '来源索引（模拟）', kind: 'source', location: '03_文献证据_Literature-Evidence/模拟索引.md', version: 'v1', source: 'SOURCE-001', note: '尚未读取全文，不用于研究结论' }],
    archiveLinks: [{ vaultName: '功能验证库', path: '14_历史归档_Archive/工作台归档/模拟快照.md' }],
  });
  const draft = buildTaskArchiveDraft(task);
  const prompt = makeKickoffPrompt('接续这项任务', workflow.focus, null, null, task);
  for (const text of ['SOURCE-001', 'v1', '补齐来源页码', '来源尚未读取全文', task.id]) {
    assert.ok(draft.body.includes(text));
    assert.ok(prompt.includes(text));
  }
  assert.ok(!draft.body.includes(workflow.seed));
  assert.match(draft.body, /等待补充/);
  assert.match(prompt, /无须为归档另设本人审核环节/);
  assert.match(prompt, /功能验证库/);
});

test('existing task cards without record fields remain usable and blank records are excluded', () => {
  const task = createResearchTask(workflow);
  delete task.records;
  delete task.archiveLinks;
  assert.doesNotThrow(() => buildTaskArchiveDraft(task));
  assert.doesNotThrow(() => makeKickoffPrompt('继续任务', workflow.focus, null, null, task));
  task.records = [createTaskRecord()];
  assert.ok(!buildTaskArchiveDraft(task).body.includes('未命名记录'));
});

test('oversized snapshots fail explicitly instead of dropping Unicode content', () => {
  for (const content of ['汉'.repeat(34_000), 'a'.repeat(61_000)]) {
    const task = createResearchTask(workflow, { content });
    assert.throws(() => buildTaskArchiveDraft(task), /过长/);
    assert.equal(task.content, content);
  }
});

test('related drawing tasks inherit context and independent material indexes without claiming parent completion', () => {
  const parent = createResearchTask(workflow, { content: '模拟任务背景', files: ['模拟材料.png'], records: [{ ...createTaskRecord(), title: '模拟来源', version: 'v1' }] });
  const child = createResearchTask(MECHANISM_WORKFLOW, makeRelatedTaskContext(parent, MECHANISM_WORKFLOW));
  assert.equal(child.parentTaskId, parent.id);
  assert.ok(child.content.includes('模拟任务背景'));
  assert.equal(child.statusId, 'in_progress');
  child.records[0].version = 'v2';
  child.files.push('模拟图.svg');
  assert.equal(parent.records[0].version, 'v1');
  assert.deepEqual(parent.files, ['模拟材料.png']);
});

test('stage snapshots write only with scope, preserve same-title versions and keep unresolved work', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'danta-task-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const service = createLocalBridgeService({ folderPicker: async () => directory });
  const task = createResearchTask(workflow, { title: '功能验证（模拟）', statusId: 'in_progress', nextStep: '继续补齐材料' });
  const draft = buildTaskArchiveDraft(task);
  await service.chooseVault();
  await assert.rejects(service.createArchive(draft), /授权/);
  assert.deepEqual(await fs.readdir(directory), []);
  await service.authorizeScopes(['archive-write']);
  const first = await service.createArchive(draft);
  const firstContents = await fs.readFile(path.join(directory, first.path), 'utf8');
  const second = await service.createArchive(draft);
  assert.notEqual(first.path, second.path);
  assert.equal(await fs.readFile(path.join(directory, first.path), 'utf8'), firstContents);
  assert.match(firstContents, /继续补齐材料/);
  assert.match(firstContents, /研究任务阶段快照/);
  assert.equal(task.statusId, 'in_progress');
  await assert.rejects(service.vaultData('archive'), /读取授权/);
  await assert.rejects(service.createArchive({ ...draft, body: 'a'.repeat(60_001) }), /不超过/);
  assert.equal((await fs.readdir(path.join(directory, '14_历史归档_Archive/工作台归档'))).length, 2);
});
