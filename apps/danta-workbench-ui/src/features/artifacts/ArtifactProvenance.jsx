import { useEffect, useRef, useState } from 'react';
import { getArtifactProvenance, verifyArtifactOutput } from './artifactApi.js';

const RUN_LABELS = { succeeded: '记录：运行成功', failed: '记录：运行失败', unknown: '运行结果未记录' };
const CHECK_LABELS = { passed: '记录：核查通过', failed: '记录：核查未通过', not_checked: '尚未登记核查' };
const formatTime = value => value ? new Date(value).toLocaleString('zh-CN') : '未记录';

// Disclosure loads only its bounded sidecar, never the indexed inputs or scripts.
export function ArtifactProvenance({ taskId, artifact }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [verification, setVerification] = useState(null);
  const alive = useRef(false);
  const loading = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function read() {
    if (result || loading.current) return;
    loading.current = true; setBusy(true); setError('');
    try {
      const data = await getArtifactProvenance(taskId, artifact.key);
      if (alive.current) setResult(data);
    } catch (failure) { if (alive.current) setError(failure.message); }
    finally { loading.current = false; if (alive.current) setBusy(false); }
  }
  async function verify() {
    if (loading.current) return;
    loading.current = true; setBusy(true); setError(''); setVerification(null);
    try {
      const data = await verifyArtifactOutput(taskId, artifact.key);
      if (alive.current) setVerification(data);
    } catch (failure) { if (alive.current) setError(failure.message); }
    finally { loading.current = false; if (alive.current) setBusy(false); }
  }
  const record = result?.record;
  return <details className="artifact-provenance" onToggle={event => { if (event.currentTarget.open) read(); }}>
    <summary>来源与方法 <span>{artifact.hasProvenance ? '已登记 · 展开查看' : '尚未登记'}</span></summary>
    <div className="artifact-provenance-body">
      {busy && <p role="status">正在读取或核对本机文件…</p>}
      {error && <p className="artifact-error" role="status">{error} <button type="button" className="text-button" disabled={busy} onClick={read}>重新读取记录</button></p>}
      {result?.message && <p className="artifact-small-note">{result.message}</p>}
      {record && <>
        <p className="artifact-source-status"><span>{RUN_LABELS[record.status]}</span><span>{CHECK_LABELS[record.checkStatus]}</span></p>
        <dl>
          <dt>运行编号 / 步骤</dt><dd>{record.runId}{record.stepKey ? ` / ${record.stepKey}` : ''}</dd>
          <dt>时间与退出码</dt><dd>{formatTime(record.startedAt)} → {formatTime(record.endedAt)} · 退出码 {record.exitCode ?? '未记录'}</dd>
          {[['方法', record.method], ['命令', record.command], ['参数', record.parameters], ['环境', record.environment],
            ['输入索引', record.inputs.join('\n')], ['脚本索引', record.scripts.join('\n')], ['日志索引', record.log],
            ['核查说明', record.checkNote]].filter(([, value]) => value).map(([label, value]) => <div className="artifact-source-row" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
        <p className="artifact-small-note">命令和索引仅供查看；工作台不会执行命令或打开其中列出的文件。</p>
        {record.outputSha256 ? <>
          <p className="artifact-source-hash">记录中的原件 SHA-256：{record.outputSha256}</p>
          <button className="secondary-button compact" type="button" disabled={busy || !artifact.available} onClick={verify}>核对当前原件</button>
          <p className="artifact-small-note">点击后读取本机原件（最多 100 MB），核对文件内容。运行与科学结论仍需结合方法、日志及证据判断。</p>
        </> : <p className="artifact-small-note">未登记原件校验和，可请 Codex 随下一版补充；不补造历史运行记录。</p>}
        {verification && <p role="status" className={verification.matches ? 'artifact-small-note' : 'artifact-error'}>{verification.message} 核对时间：{formatTime(verification.checkedAt)}</p>}
      </>}
    </div>
  </details>;
}
