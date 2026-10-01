import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowClockwise, ArrowLeft, ArrowsOut, DownloadSimple, File, FolderOpen, X } from '@phosphor-icons/react';
import { artifactUrl, attachArtifactPreview, importArtifact, listArtifacts, openArtifact } from './artifactApi.js';
import { normalizePreviewState as normalizeState } from './artifactState.js';

const ArtifactViewer = lazy(() => import('./ArtifactViewer.jsx').then(module => ({ default: module.ArtifactViewer })));

// State belongs to the task card; local file authority belongs to the bridge.
export function ArtifactWorkspace({ task, connection, onStateChange, onOpenSettings, onRevise, children }) {
  const state = normalizeState(task?.previewState);
  const [artifacts, setArtifacts] = useState([]);
  const [warning, setWarning] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 1150px)').matches);
  const revision = useRef(0);
  const seen = useRef(null);
  const busyRef = useRef(false);
  const workspaceRef = useRef(null);
  const panelRef = useRef(null);
  const libraryRef = useRef(null);
  const stateRef = useRef(state); stateRef.current = state;
  const changeRef = useRef(onStateChange); changeRef.current = onStateChange;
  const patch = useCallback(update => changeRef.current(current => normalizeState({ ...normalizeState(current), ...(typeof update === 'function' ? update(normalizeState(current)) : update) })), []);
  useEffect(() => { const media = window.matchMedia('(max-width: 1150px)'); const changed = () => setNarrow(media.matches); media.addEventListener('change', changed); return () => media.removeEventListener('change', changed); }, []);

  const refresh = useCallback(async () => {
    if (!task?.id || !connection.status.connected) return;
    const request = ++revision.current;
    setBusy(true); setError('');
    try {
      const result = await listArtifacts(task.id);
      if (revision.current === request) {
        const added = seen.current ? result.artifacts.filter(item => !seen.current.has(item.key)) : [];
        seen.current = new Set(result.artifacts.map(item => item.key));
        setArtifacts(result.artifacts); setWarning(result.warning || (added.length ? `发现 ${added.length} 份新成果，请点击成果卡查看。当前标签与意见保留。` : ''));
      }
    } catch (error) { if (revision.current === request) setError(error.message); }
    finally { if (revision.current === request) setBusy(false); }
  }, [task?.id, connection.status.connected, connection.status.root]);
  useEffect(() => {
    setArtifacts([]); setError(''); setWarning('');
    seen.current = null;
    void refresh();
    const onFocus = () => { if (!document.hidden && !busyRef.current) void refresh(); };
    window.addEventListener('focus', onFocus); document.addEventListener('visibilitychange', onFocus);
    return () => { revision.current += 1; window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); };
  }, [refresh]);
  busyRef.current = busy;

  const current = artifacts.find(item => item.key === state.selectedKey);
  const currentTab = state.tabs.find(item => item.key === state.selectedKey);
  const view = state.views[state.selectedKey] || {};
  useEffect(() => {
    if (!current?.fingerprint || !state.open) return;
    const previous = stateRef.current.views[current.key];
    if (previous?.fingerprint && previous.fingerprint !== current.fingerprint) setWarning('当前文件已更新，阅读位置已重置；已写的意见保留，请核对定位后再提交。');
    if (previous?.fingerprint !== current.fingerprint) patch(old => ({ views: { ...old.views, [current.key]: { ...old.views[current.key], ...(previous?.fingerprint ? { page: 1, scroll: 0 } : {}), fingerprint: current.fingerprint } } }));
  }, [current?.fingerprint, current?.key, state.open, patch]);
  useEffect(() => { if (state.open) panelRef.current?.focus(); }, [state.open]);
  if (!task) return children;

  function open(artifact) {
    setError('');
    patch(old => ({ selectedKey: artifact.key, open: true, tabs: old.tabs.some(item => item.key === artifact.key) ? old.tabs : [...old.tabs, { key: artifact.key, title: artifact.title, version: artifact.version }].slice(-12) }));
  }
  function close(key) {
    patch(old => {
      const tabs = old.tabs.filter(item => item.key !== key);
      const selectedKey = old.selectedKey === key ? tabs.at(-1)?.key || '' : old.selectedKey;
      return { tabs, selectedKey, open: tabs.length > 0 && old.open, expanded: tabs.length > 0 && old.expanded };
    });
  }
  function changeView(update) {
    const key = state.selectedKey;
    patch(old => ({ views: { ...old.views, [key]: { ...old.views[key], ...update } } }));
  }
  function collapse() { patch({ open: false, expanded: false }); requestAnimationFrame(() => libraryRef.current?.focus()); }
  async function action(fn) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    const request = ++revision.current;
    try {
      const result = await fn();
      if (revision.current !== request || result?.cancelled) return;
      if (result?.artifacts) { setArtifacts(result.artifacts); seen.current = new Set(result.artifacts.map(item => item.key)); setWarning(result.warning || ''); }
      if (result?.selectedKey) { const selected = result.artifacts?.find(item => item.key === result.selectedKey); if (selected) open(selected); }
    } catch (error) { if (revision.current === request) setError(error.message); }
    finally { if (revision.current === request) { busyRef.current = false; setBusy(false); } }
  }
  const panelOpen = state.open && state.tabs.length > 0;
  return <div ref={workspaceRef} className={`artifact-workspace${panelOpen ? ' has-artifact-panel' : ''}`} style={{ '--artifact-width': `${state.width}%` }}>
    <div className="artifact-task-content" inert={(state.expanded || narrow) && panelOpen ? true : undefined}>
      <section ref={libraryRef} tabIndex={-1} className="artifact-library" aria-label="本任务成果">
        <div className="artifact-library-heading"><div><span className="panel-kicker">本任务成果</span><strong>{artifacts.length ? `${artifacts.length} 件成果与版本` : '成果预览'}</strong></div>
          <div className="artifact-library-actions">
            {state.tabs.length > 0 && !panelOpen && <button className="text-button" type="button" onClick={() => patch({ open: true })}>恢复预览</button>}
            {connection.status.connected ? <><button className="text-button" type="button" onClick={refresh} disabled={busy}><ArrowClockwise size={16} />刷新</button><button className="secondary-button compact" type="button" disabled={busy} onClick={() => action(() => importArtifact(task.id))}><FolderOpen size={16} />导入已有成果</button></> : <button className="secondary-button compact" type="button" onClick={onOpenSettings}>设置成果位置</button>}
          </div>
        </div>
        {connection.status.connected && artifacts.length > 0 && <div className="artifact-cards">{artifacts.map(item => <button key={item.key} type="button" className={state.selectedKey === item.key && panelOpen ? 'is-selected' : ''} onClick={() => open(item)}><File size={18} aria-hidden="true" /><span><strong>{item.title}</strong><small>{item.version} · {item.available ? item.canPreview ? '可预览' : '原件已关联' : '文件不可用'}</small></span></button>)}</div>}
        {!artifacts.length && <p className="artifact-small-note">{connection.status.connected ? 'Codex 按启动语保存成果和清单后，回到任务点刷新即可查看。也可导入此成果目录内的已有文件。' : '连接一次成果输出文件夹后，可在任务旁查看原件配套预览；制作与修改仍在 Codex 中完成。'}</p>}
        {(error || warning) && <p role="status" className={error ? 'artifact-error' : 'artifact-small-note'}>{error || warning}</p>}
      </section>
      {children}
    </div>
    {panelOpen && <>
      <div className="artifact-resizer" role="separator" tabIndex={0} aria-label="调整预览面板宽度" aria-orientation="vertical" aria-valuemin={35} aria-valuemax={65} aria-valuenow={state.width}
        onPointerDown={event => event.currentTarget.setPointerCapture(event.pointerId)}
        onPointerMove={event => { if (!event.buttons) return; const rect = workspaceRef.current.getBoundingClientRect(); patch({ width: Math.max(35, Math.min(65, (rect.right - event.clientX) / rect.width * 100)) }); }}
        onKeyDown={event => { if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); patch({ width: Math.max(35, Math.min(65, state.width + (event.key === 'ArrowLeft' ? 2 : -2))) }); } }} />
      <aside ref={panelRef} tabIndex={-1} className={`artifact-panel${state.expanded ? ' is-expanded' : ''}`} aria-label="成果文件预览" onKeyDown={event => {
        if (event.key === 'Escape') { if (state.expanded) patch({ expanded: false }); else collapse(); }
        if ((state.expanded || narrow) && event.key === 'Tab') {
          const items = [...panelRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]')];
          const first = items[0], last = items.at(-1);
          if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panelRef.current)) { event.preventDefault(); first?.focus(); }
        }
      }}>
        <div className="artifact-panel-heading"><strong>成果预览</strong><div><button type="button" onClick={() => patch({ expanded: !state.expanded })} aria-label={state.expanded ? '返回任务侧边预览' : '展开预览'}>{state.expanded ? <ArrowLeft size={18} /> : <ArrowsOut size={18} />}</button><button type="button" onClick={collapse} aria-label="收起预览并返回任务"><ArrowLeft size={16} />返回任务</button></div></div>
        <div className="artifact-tabs" role="tablist" aria-label="打开的成果文件">{state.tabs.map(tab => <div className={tab.key === state.selectedKey ? 'is-selected' : ''} key={tab.key}>
          <button type="button" role="tab" aria-selected={tab.key === state.selectedKey} aria-controls="artifact-active-view" onClick={() => patch({ selectedKey: tab.key })} onKeyDown={event => {
            if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
            event.preventDefault(); const index = state.tabs.findIndex(item => item.key === tab.key); const next = state.tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + state.tabs.length) % state.tabs.length]; patch({ selectedKey: next.key });
            requestAnimationFrame(() => panelRef.current?.querySelectorAll('[role="tab"]')[state.tabs.indexOf(next)]?.focus());
          }} title={`${tab.title} · ${tab.version}`}>{tab.title} · {tab.version}</button>
          <button type="button" onClick={() => close(tab.key)} aria-label={`关闭 ${tab.title} ${tab.version} 预览标签`}><X size={13} /></button>
        </div>)}</div>
        <div className="artifact-file-meta"><strong>{current?.title || currentTab?.title || '文件不可用'}</strong><span>{current?.version || currentTab?.version} · {current?.updatedAt ? new Date(current.updatedAt).toLocaleString('zh-CN') : '本机关联'}</span></div>
        <div className="artifact-active-view" id="artifact-active-view" role="tabpanel">
          {current?.canPreview && connection.status.connected ? <Suspense fallback={<p className="artifact-loading">正在打开预览工具…</p>}><ArtifactViewer key={current.key} taskId={task.id} artifact={current} view={view} onViewChange={changeView} /></Suspense> : <div className="artifact-preview-empty"><File size={36} /><p>{connection.status.connected ? current?.previewError || '尚未找到这份文件。请刷新，或导入已有成果重新关联。' : '成果目录未连接。恢复连接后继续查看，意见草稿仍保留。'}</p>
            {!connection.status.connected && <button className="secondary-button" type="button" onClick={onOpenSettings}>查看成果设置</button>}
            {current?.source === 'imported' && current.available && <button className="secondary-button" type="button" disabled={busy} onClick={() => action(() => attachArtifactPreview(task.id, current.key))}>关联同版本预览件</button>}
            {current?.available && !current.canPreview && <button className="text-button" type="button" onClick={() => onRevise(current, { ...view, feedback: '' })}>请 Codex 生成预览</button>}
          </div>}
        </div>
        <div className="artifact-original-actions">
          {current?.source === 'imported' && current.canPreview && <button className="text-button" type="button" disabled={busy} onClick={() => action(() => attachArtifactPreview(task.id, current.key))}>更换预览件</button>}
          <button className="text-button" type="button" disabled={!current?.available || busy || !connection.status.connected} onClick={() => action(() => openArtifact(task.id, current.key))}>打开原件</button>
          {current?.available && connection.status.connected && <a href={artifactUrl(task.id, current, true)} download><DownloadSimple size={15} />保存副本</a>}
          <button className="text-button" type="button" disabled={busy} onClick={refresh}>刷新成果</button>
        </div>
        <div className="artifact-feedback">
          <label htmlFor="artifact-feedback">本次想怎么改？{current?.ext === '.pdf' && <span> · 定位第 {view.feedbackPage || view.page || 1} 页</span>}</label>
          {current?.ext === '.pdf' && view.feedback && <button className="text-button" type="button" onClick={() => changeView({ feedbackPage: view.page || 1 })}>改为当前第 {view.page || 1} 页</button>}
          <textarea id="artifact-feedback" rows={3} maxLength={6000} value={view.feedback || ''} placeholder="例如：第 3 页缩短解释，保留原始数据图。也可以同时写下多页意见。" onChange={event => changeView({ feedback: event.target.value, feedbackPage: view.feedback ? view.feedbackPage || view.page || 1 : view.page || 1 })} />
          <div><small>草稿自动保存；进入 Codex 后粘贴并提交。</small><button className="primary-button compact" type="button" disabled={!current?.available || !view.feedback?.trim() || !connection.status.connected} onClick={() => onRevise(current, view)}>继续 Codex 修改</button></div>
        </div>
      </aside>
    </>}
  </div>;
}
