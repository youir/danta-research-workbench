const scalar = (value, max = 2000) => {
  if (value == null) return '';
  if (typeof value !== 'string' || value.length > max) throw new Error('来源记录的文字字段格式或长度无效。');
  return value.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
};
const array = value => {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 30) throw new Error('来源记录的索引数量超过上限。');
  return value.map(item => scalar(item, 1600));
};
const date = value => { const text = scalar(value, 80); if (text && !Number.isFinite(Date.parse(text))) throw new Error('来源记录的时间无效。'); return text; };

// This record is reported evidence. No referenced input, script, URL or log is opened.
export function parseArtifactProvenance(value, taskId, artifact) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.schemaVersion !== 1
    || value.taskId !== taskId || value.artifactId !== artifact.id || value.artifactVersion !== artifact.version) throw new Error('来源记录与本任务、成果或版本不匹配。');
  const runId = scalar(value.runId, 100);
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(runId)) throw new Error('来源记录的运行编号无效。');
  const status = value.status || 'unknown';
  const checkStatus = value.checkStatus || 'not_checked';
  if (!['succeeded', 'failed', 'unknown'].includes(status) || !['passed', 'failed', 'not_checked'].includes(checkStatus)) throw new Error('来源记录的状态无法识别。');
  const exitCode = value.exitCode ?? null;
  if (exitCode !== null && !Number.isInteger(exitCode)) throw new Error('退出码无效。');
  if ((status === 'succeeded' && exitCode !== 0) || (status === 'failed' && (exitCode === null || exitCode === 0))) throw new Error('运行状态与退出码不一致。');
  const sha256 = scalar(value.outputSha256, 64).toLowerCase();
  if (sha256 && !/^[a-f0-9]{64}$/.test(sha256)) throw new Error('来源记录的 SHA-256 无效。');
  const startedAt = date(value.startedAt), endedAt = date(value.endedAt);
  if (startedAt && endedAt && Date.parse(endedAt) < Date.parse(startedAt)) throw new Error('结束时间早于开始时间。');
  const checkNote = scalar(value.checkNote, 4000);
  if (checkStatus !== 'not_checked' && !checkNote.trim()) throw new Error('请在来源记录中说明实际核查范围与结果。');
  return { runId, stepKey: scalar(value.stepKey, 100), status, checkStatus, exitCode, startedAt, endedAt,
    method: scalar(value.method), command: scalar(value.command, 6000), parameters: scalar(value.parameters, 6000), environment: scalar(value.environment, 4000),
    inputs: array(value.inputs), scripts: array(value.scripts), log: scalar(value.log, 1600), checkNote, outputSha256: sha256 };
}
