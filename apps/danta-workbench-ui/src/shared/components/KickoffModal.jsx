import { memo, useEffect, useRef, useState } from 'react';
import { ArrowSquareOut, Copy, Check, FolderOpen } from '@phosphor-icons/react';
import { getCodexStatus } from '../utils/localApi.js';

export const KickoffModal = memo(({
  isOpen,
  kickoffPrompt,
  copied,
  onCopy,
  onCreateThread,
  defaultProjectId = '',
  onOpenSettings,
  workflowLabel = '研究讨论',
  onClose,
  copyButtonRef,
  dialogRef
}) => {
  const previouslyFocusedRef = useRef(null);
  const wasOpenRef = useRef(false);
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [codexAvailable, setCodexAvailable] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [handoffBusy, setHandoffBusy] = useState(false);
  const [handoffResult, setHandoffResult] = useState('');
  const [projectError, setProjectError] = useState('');

  useEffect(() => {
    let active = true;
    if (!isOpen) return () => { active = false; };
    setLoadingProjects(true);
    setProjectError('');
    setHandoffResult('');
    getCodexStatus().then(status => {
      if (!active) return;
      setCodexAvailable(Boolean(status.available));
      setProjects(status.projects || []);
      setProjectId(current => {
        if (status.projects?.some(project => project.id === defaultProjectId)) return defaultProjectId;
        return status.projects?.some(project => project.id === current) ? current : status.projects?.[0]?.id || '';
      });
      if (!status.available) setProjectError(status.message || '暂时无法连接本机 Codex。');
    }).catch(error => { if (active) setProjectError(error?.message || '无法读取 Codex 工作区列表。'); })
      .finally(() => { if (active) setLoadingProjects(false); });
    return () => { active = false; };
  }, [isOpen, defaultProjectId]);

  useEffect(() => {
    if (!isOpen) {
      if (wasOpenRef.current && previouslyFocusedRef.current instanceof HTMLElement) {
        previouslyFocusedRef.current.focus();
      }
      wasOpenRef.current = false;
      previouslyFocusedRef.current = null;
      return undefined;
    }

    if (!wasOpenRef.current) previouslyFocusedRef.current = document.activeElement;
    wasOpenRef.current = true;
    const dialog = dialogRef.current;
    const focusable = () => [...(dialog?.querySelectorAll('button:not([disabled]), select:not([disabled]), textarea:not([disabled]), input:not([disabled]), a[href]') || [])];
    copyButtonRef.current?.focus();

    const handleDialogKeydown = event => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusable();
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleDialogKeydown);
    return () => {
      window.removeEventListener('keydown', handleDialogKeydown);
    };
  }, [isOpen, onClose, copyButtonRef, dialogRef]);

  if (!isOpen) return null;

  async function createThread() {
    if (!projectId || !onCreateThread) return;
    setHandoffBusy(true);
    setHandoffResult('');
    setProjectError('');
    try {
      const result = await onCreateThread(projectId);
      const openStatus = result.opened ? '已尝试打开新对话' : '未能打开窗口，请在 Codex 最近记录中进入新对话';
      const copyStatus = result.copied ? `启动语已复制，进入后按 ${navigator.platform?.includes('Mac') ? '⌘V' : 'Ctrl+V'} 粘贴` : '启动语未复制成功，请用下方按钮手动复制';
      setHandoffResult(`已在「${result.workspaceName}」创建新对话。${openStatus}；${copyStatus}。粘贴后仍需你自行提交。`);
    } catch (error) {
      setProjectError(error?.message || '创建 Codex 新对话失败。');
    } finally {
      setHandoffBusy(false);
    }
  }

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="kickoff-description"
      >
        <h2 id="modal-title">启动语已生成</h2>
        <p id="kickoff-description">检查内容后选择目标工作区。工作台会创建新对话、尝试打开它，并把启动语复制到系统剪贴板。</p>
        <pre className="kickoff-prompt">{kickoffPrompt}</pre>
        <section className="codex-handoff-panel" aria-labelledby="codex-handoff-title">
          <div className="codex-handoff-heading"><div><span className="panel-kicker">本机 Codex</span><h3 id="codex-handoff-title">新对话放到哪个工作区？</h3></div><span className="connection-pill">不自动提交</span></div>
          {loadingProjects ? <p className="codex-handoff-status" role="status">正在读取 Codex 工作区…</p> : projects.length ? <label className="codex-workspace-select">Codex 工作区<select value={projectId} onChange={event => { setProjectId(event.target.value); setHandoffResult(''); }} disabled={handoffBusy}><option value="" disabled>选择一个工作区</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name} · {project.rootLabel}</option>)}</select></label> : <p className="codex-handoff-status">{projectError || '没有可用的 Codex 工作区。请先在 Codex 中添加一个工作区。'}</p>}
          <div className="codex-workspace-helper"><span>本次可临时更换工作区；常用位置在设置中保存。</span>{onOpenSettings && <button className="text-button" type="button" onClick={onOpenSettings}>打开设置</button>}</div>
          {projects.length > 0 && <button className="primary-button compact codex-open-button" type="button" onClick={createThread} disabled={!codexAvailable || !projectId || handoffBusy || loadingProjects}><FolderOpen size={17} aria-hidden="true" />{handoffBusy ? '正在创建新对话…' : handoffResult ? '再次创建新对话' : '创建并打开 Codex 新对话'}<ArrowSquareOut size={15} aria-hidden="true" /></button>}
          {projectError && projects.length > 0 && <p className="codex-handoff-error" role="status">{projectError}</p>}
          {handoffResult && <p className="codex-handoff-success" role="status"><Check size={16} aria-hidden="true" />{handoffResult}</p>}
          <p className="codex-handoff-note">Codex 本机接口目前不支持把文字预填到输入框，因此创建后需粘贴一次。该功能使用 Codex 的实验性本机协议；如果桌面跳转未成功，新对话仍会出现在 Codex 最近记录里。</p>
        </section>
        <div className="modal-actions">
          <button
            ref={copyButtonRef}
            className="primary-button"
            type="button"
            onClick={onCopy}
          >
            {copied ? (
              <>
                <Check size={18} aria-hidden="true" />
                已复制 · 再复制
              </>
            ) : (
              <>
                <Copy size={18} aria-hidden="true" />
                复制启动语
              </>
            )}
          </button>
          <button className="secondary-button" type="button" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </>
  );
});

KickoffModal.displayName = 'KickoffModal';
