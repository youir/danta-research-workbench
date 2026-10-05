import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { validBioInput, bioInputPrompt } from '../src/shared/utils/bioInputs.js';
import { createResearchStep, mergeResearchSteps } from '../src/shared/utils/researchSteps.js';
import { createResearchTask } from '../src/shared/constants/researchTasks.js';
import { PROMPT_STARTERS } from '../src/shared/constants/workflows.js';
import { validateStateValues } from '../src/shared/constants/persistedState.js';
import { makeTaskBackup, parseTaskBackup } from '../src/shared/utils/taskBackup.js';
import { makeKickoffPrompt } from '../src/shared/utils/promptBuilder.js';
import { parseArtifactProvenance } from '../server/artifactProvenance.js';
import { createArtifactService } from '../server/artifactService.js';

const taskId = 'test-task-0001';
const entry = { id: 'result-01', version: 'v1', original: 'result.md', provenance: 'source.json' };
const record = { schemaVersion: 1, taskId, artifactId: entry.id, artifactVersion: entry.version,
  runId: 'synthetic-run-01', status: 'succeeded', exitCode: 0, checkStatus: 'not_checked',
  method: '合成测试，不是科研分析', inputs: ['只显示索引，不读取此文件'] };

async function fixture(t, provenance = record) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'danta-bio-delivery-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const root = path.join(dir, 'synthetic-output'), folder = path.join(root, taskId);
  await fs.mkdir(folder, { recursive: true });
  const content = '# 虚构测试成果\n\n不是实际科研结果。';
  await fs.writeFile(path.join(folder, 'result.md'), content);
  await fs.writeFile(path.join(folder, 'source.json'), JSON.stringify(provenance));
  await fs.writeFile(path.join(folder, 'danta-artifacts.json'), JSON.stringify({ schemaVersion: 1, taskId, artifacts: [entry] }));
  const options = { memoryPath: path.join(dir, 'memory.json'), folderPicker: async () => root, openFile: async () => { throw new Error('Must not open external programs'); } };
  const service = createArtifactService(options);
  await service.select({ confirm: true });
  const listed = await service.list(taskId);
  return { dir, folder, content, options, service, artifact: listed.artifacts[0] };
}

test('bio input stays optional, bounded and separate from permission or execution', () => {
  for (const value of [undefined, null, {}, { kind: 'counts', species: '虚构测试物种' }]) assert.equal(validBioInput(value), true);
  for (const value of [[], { kind: 'unknown' }, { location: [] }, { unexpected: 'test' }, { samples: 'x'.repeat(801) }]) assert.equal(validBioInput(value), false);
  const prompt = bioInputPrompt({ kind: 'counts', location: '仅作测试的材料索引', species: '测试' }).join('\n');
  assert.match(prompt, /尚未读取或验证/); assert.match(prompt, /不授予额外/); assert.match(prompt, /方案不登记为运行/);
  assert.deepEqual(bioInputPrompt({}), []);
});

test('bio step input survives state validation, backup, remote refresh and handoff', () => {
  const step = { ...createResearchStep('虚构材料检查', '验证接续'), bioInput: { kind: 'counts', location: '虚构索引', samples: '功能测试分组' } };
  const task = createResearchTask(PROMPT_STARTERS.find(item => item.id === 'topic'), { steps: [step], activeStepKey: step.key });
  validateStateValues({ researchTasks: JSON.stringify([task]) });
  const restored = parseTaskBackup(JSON.stringify(makeTaskBackup({ tasks: [task] }))).tasks[0];
  assert.deepEqual(restored.steps[0].bioInput, step.bioInput);
  assert.deepEqual(mergeResearchSteps([step], [{ key: step.key, available: true, directory: 'synthetic/step' }])[0].bioInput, step.bioInput);
  assert.match(makeKickoffPrompt('仅测试', task.focus, null, null, restored), /功能测试分组/);
  assert.equal(restored.statusId, 'in_progress');
});

test('source records reject task/version mismatches and false success/check states', () => {
  assert.equal(parseArtifactProvenance(record, taskId, entry).status, 'succeeded');
  for (const patch of [{ taskId: 'other-task' }, { artifactVersion: 'v2' }, { exitCode: 1 }, { checkStatus: 'passed' },
    { status: 'failed', exitCode: 0 }, { startedAt: '2026-10-05T01:00:00Z', endedAt: '2026-10-05T00:00:00Z' }, { outputSha256: 'bad' }]) {
    assert.throws(() => parseArtifactProvenance({ ...record, ...patch }, taskId, entry));
  }
});

test('source record text and indexes are bounded and control characters removed', () => {
  assert.throws(() => parseArtifactProvenance({ ...record, inputs: Array(31).fill('test') }, taskId, entry));
  assert.throws(() => parseArtifactProvenance({ ...record, command: 'x'.repeat(6001) }, taskId, entry));
  assert.equal(parseArtifactProvenance({ ...record, method: 'a\0b' }, taskId, entry).method, 'ab');
});

test('source viewing is read-only; old artifacts still preview and grants restore', async t => {
  const f = await fixture(t);
  const before = await fs.readFile(path.join(f.folder, 'source.json'), 'utf8');
  assert.equal((await f.service.provenance(taskId, f.artifact.key)).record.method, record.method);
  assert.equal((await f.service.content({ taskId, key: f.artifact.key })).bytes.toString(), f.content);
  assert.equal(await fs.readFile(path.join(f.folder, 'source.json'), 'utf8'), before);
  assert.equal((await createArtifactService(f.options).status()).connected, true);
  await fs.writeFile(path.join(f.folder, 'danta-artifacts.json'), JSON.stringify({ schemaVersion: 1, taskId, artifacts: [{ ...entry, provenance: '' }] }));
  assert.equal((await f.service.provenance(taskId, f.artifact.key)).record, null);
  assert.equal((await f.service.content({ taskId, key: f.artifact.key })).bytes.toString(), f.content);
});

test('output hash detects changed original without treating hash agreement as scientific validation', async t => {
  const f = await fixture(t);
  const sha = createHash('sha256').update(f.content).digest('hex');
  await fs.writeFile(path.join(f.folder, 'source.json'), JSON.stringify({ ...record, outputSha256: sha }));
  assert.equal((await f.service.verifyOutput({ taskId, key: f.artifact.key })).matches, true);
  await fs.writeFile(path.join(f.folder, 'result.md'), f.content + '\n功能测试修改');
  assert.equal((await f.service.verifyOutput({ taskId, key: f.artifact.key })).matches, false);
});

test('source files cannot escape task boundaries or exceed read limits', async t => {
  const f = await fixture(t);
  const writeManifest = provenance => fs.writeFile(path.join(f.folder, 'danta-artifacts.json'), JSON.stringify({ schemaVersion: 1, taskId, artifacts: [{ ...entry, provenance }] }));
  await writeManifest('../outside.json');
  await assert.rejects(f.service.provenance(taskId, f.artifact.key), /越界/);
  await writeManifest('source.json');
  await fs.writeFile(path.join(f.folder, 'source.json'), ' '.repeat(128 * 1024 + 1));
  await assert.rejects(f.service.provenance(taskId, f.artifact.key), /大小限制/);
  await f.service.forget();
  await assert.rejects(f.service.provenance(taskId, f.artifact.key), /选择成果目录/);
});
