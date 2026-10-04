import { useCallback, useEffect, useRef, useState } from 'react';
import { getResearchSteps } from '../../../shared/utils/localApi.js';
import { createResearchStep, currentResearchStep, mergeResearchSteps, STEP_LIMIT, STEP_STATUSES } from '../../../shared/utils/researchSteps.js';

export function ResearchSteps({ task, actions }) {
  const current = currentResearchStep(task);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [documents, setDocuments] = useState(null);
  const revision = useRef(0);
  const actionsRef = useRef(actions); actionsRef.current = actions;
  const permitted = actions?.vaultStatus?.scopes?.includes('records');
  const vaultPath = actions?.vaultStatus?.path || '';
  const vaultScope = actions?.vaultStatus?.scopeOptions?.find(option => option.id === 'records')?.paths?.join('|') || '';

  const refresh = useCallback(async (key = '') => {
    if (!permitted) { setMessage('请在设置中查看研究记录连接；已有有效授权会直接沿用。'); return; }
    const request = ++revision.current;
    setBusy(true); setMessage('');
    try {
      const result = await getResearchSteps(task.id, key);
      if (revision.current !== request) return;
      actionsRef.current?.patch(currentTask => {
        const steps = mergeResearchSteps(currentTask.steps, result.steps);
        const activeStepKey = currentTask.activeStepKey || result.steps.find(step => step.status !== 'complete')?.key || result.steps[0]?.key || '';
        return JSON.stringify(steps) === JSON.stringify(currentTask.steps) && activeStepKey === currentTask.activeStepKey ? null : { steps, activeStepKey };
      });
      if (key) setDocuments(result.documents || []);
      setMessage(result.truncated ? '记录较多，读取达到上限；部分步骤可能尚未显示。' : result.steps.length ? '已与当前知识库的步骤记录核对。' : '暂未找到本任务的步骤记录。可先写下本步目标，进入 Codex 开始。');
    } catch (error) { if (revision.current === request) { setMessage(error.message); setDocuments(null); } }
    finally { if (revision.current === request) setBusy(false); }
  }, [task.id, permitted, vaultPath, vaultScope]);

  useEffect(() => {
    setDocuments(null); setMessage(''); setEditing(false);
    if (permitted) void refresh();
    const onFocus = () => { if (permitted && !document.hidden) void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => { revision.current += 1; window.removeEventListener('focus', onFocus); };
  }, [refresh, permitted]);
  useEffect(() => { setDocuments(null); }, [task.activeStepKey]);

  function add() {
    if (!title.trim() || !goal.trim()) return;
    const step = createResearchStep(title, goal);
    actions?.patch(currentTask => ({ steps: [...(currentTask.steps || []), step], activeStepKey: step.key }));
    setEditing(false); setTitle(''); setGoal(''); setMessage('本步目标已保存。进入 Codex 后才会建立知识库记录。');
  }

  return <section className="research-steps" aria-labelledby="research-steps-title">
    <div className="research-steps-heading"><div><h3 id="research-steps-title">当前研究步骤</h3><p>只记录正在推进的工作，过程和成果随时找回。</p></div>
      <button className="text-button" type="button" disabled={busy || !permitted} onClick={() => refresh()}>同步记录</button>
    </div>
    {current ? <div className="research-step-current">
      <div className="research-step-heading"><strong>{current.title}</strong><span className="connection-pill">{current.directory ? current.available ? STEP_STATUSES[current.status] : '记录待核对' : '本机草稿 · 待 Codex 开始'}</span></div>
      <p>{current.goal}</p>
      {current.nextAction && <p><strong>下一步：</strong>{current.nextAction}</p>}
      {current.directory && <small className="research-step-path">{current.projectId} · {current.stepId} · {current.directory}</small>}
      <div className="research-step-actions">
        <button className="primary-button compact" type="button" onClick={() => actions?.begin()}>继续这一步</button>
        <button className="secondary-button compact" type="button" disabled={!current.available || !permitted || busy} onClick={() => refresh(current.key)}>查看过程</button>
        <button className="secondary-button compact" type="button" onClick={() => window.dispatchEvent(new CustomEvent('danta:show-artifacts', { detail: { taskId: task.id } }))}>查看本任务成果</button>
      </div>
    </div> : <p className="research-step-note">普通交流可以直接开始；需要处理材料或产出文件时，再添加实际步骤。</p>}
    {documents && <details className="research-step-documents" open><summary>步骤过程记录（只读）</summary>
      <button type="button" className="text-button" onClick={() => setDocuments(null)}>收起记录</button>
      {documents.map(document => <article key={document.path}><h4>{document.title}</h4><small>{document.path}</small><pre>{document.body}</pre></article>)}
      {!documents.length && <p>记录文件暂不可用，可回到 Codex 核对本步文件位置。</p>}
    </details>}
    {(task.steps?.length || 0) > 1 && <details className="research-step-history"><summary>全部步骤 · {task.steps.length}</summary>
      <ul>{task.steps.map(step => <li key={step.key}><button className="text-button" type="button" aria-pressed={step.key === task.activeStepKey} onClick={() => actions?.patch({ activeStepKey: step.key })}>{step.title} · {step.directory ? STEP_STATUSES[step.status] : '待开始'}</button></li>)}</ul>
    </details>}
    {editing ? <form className="research-step-form" onSubmit={event => { event.preventDefault(); add(); }}>
      <label>这一步做什么？<input autoFocus required maxLength={100} value={title} onChange={event => setTitle(event.target.value)} placeholder="用一句话命名正在推进的工作" /></label>
      <label>做到什么就可以进入下一步？<input required maxLength={240} value={goal} onChange={event => setGoal(event.target.value)} placeholder="填写实际目标，未确定的细节可以继续讨论" /></label>
      <div><button className="primary-button compact" type="submit" disabled={!title.trim() || !goal.trim()}>保存本步目标</button><button className="text-button" type="button" onClick={() => setEditing(false)}>取消</button></div>
    </form> : <button className="text-button" type="button" disabled={(task.steps?.length || 0) >= STEP_LIMIT} onClick={() => { setGoal(task.objective || ''); setEditing(true); }}>添加本次步骤</button>}
    {message && <p className="research-step-note" role="status">{message}</p>}
    {!permitted && <button type="button" className="text-button" onClick={actions?.openVault}>查看研究记录连接</button>}
  </section>;
}
