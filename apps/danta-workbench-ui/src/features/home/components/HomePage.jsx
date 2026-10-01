import { memo, useRef, useState } from 'react';
import { ArrowClockwise, ArrowRight, DownloadSimple, FolderOpen, UploadSimple } from '@phosphor-icons/react';
import { MECHANISM_WORKFLOW, PROMPT_STARTERS, getStartActionLabel } from '../../../shared/constants/workflows.js';
import { getResearchStage, getResearchTaskStatus } from '../../../shared/constants/researchTasks.js';

function taskUpdatedLabel(timestamp) {
  if (!timestamp) return '本机保存';
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp));
}

export const HomePage = memo(({ thought, setThought, taskFocus, recovery, researchTasks = [], vaultConnected = false, vaultName = '', vaultRestoreMessage = '', onBegin, onOpenWorkflow, onResume, onResumeTask, onOpenCodexThread, onOpenVault, onRestoreKickoff, onExportBackup, onImportBackup }) => {
  const textareaRef = useRef(null);
  const backupInputRef = useRef(null);
  const [backupMessage, setBackupMessage] = useState('');

  async function importBackup(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try { setBackupMessage(await onImportBackup(file)); }
    catch (error) { setBackupMessage(error?.message || '读取任务备份失败。'); }
  }

  return (
    <section className="home-view" aria-labelledby="home-title">
      <div className="home-eyebrow">龚博士的研究工作台</div>
      <h1 id="home-title">今天，最想弄清楚什么？</h1>
      <p className="home-lede">写下一个观察、困惑或正在犹豫的决定。主助理会先理解问题，再陪你推进。</p>

      {recovery && <section className="resume-card" aria-labelledby="resume-card-title">
        <div className="resume-card-copy"><span className="panel-kicker">本机自动保存 · {recovery.timeLabel}</span><h2 id="resume-card-title">{recovery.title}</h2><p>{recovery.kind === 'kickoff' ? '启动语已保留。恢复后可继续复制，或创建并打开 Codex 新对话。' : '上次填写已保存在本机浏览器，离开页面或刷新后仍可继续。'}</p></div>
        <button className="secondary-button" type="button" onClick={recovery.kind === 'kickoff' ? onRestoreKickoff : onResume}><ArrowClockwise size={16} aria-hidden="true" />{recovery.kind === 'kickoff' ? '恢复启动语' : '继续上次工作'}</button>
      </section>}

      {researchTasks.length > 0 && <section className="research-task-list-section" aria-labelledby="research-task-list-title">
        <div className="quick-start-heading">
          <h2 id="research-task-list-title">继续研究任务</h2>
          <p>任务卡保存在本机，可随时恢复到上次阶段。</p>
        </div>
        <div className="research-task-list">
          {researchTasks.map(task => {
            const stage = getResearchStage(task.stageId);
            const status = getResearchTaskStatus(task.statusId);
            const workflow = task.workflowId === MECHANISM_WORKFLOW.id ? MECHANISM_WORKFLOW : PROMPT_STARTERS.find(item => item.id === task.workflowId);
            const workflowLabel = workflow?.label || task.focus || '研究任务';
            const parentTask = researchTasks.find(item => item.id === task.parentTaskId);
            return <article className="research-task-card" key={task.id}>
              <button className="research-task-card-open" type="button" onClick={() => onResumeTask?.(task)}>
                <span className="research-task-card-main">
                  <span className="research-task-card-title">{task.title || workflowLabel}</span>
                  <span className="research-task-card-meta">{workflowLabel} · {stage.label} · {status.label}</span>
                  {task.nextStep && <span className="research-task-card-next">下一步：{task.nextStep}</span>}
                  {task.records?.length > 0 && <span className="research-task-card-next">成果与来源：{task.records.length} 条{task.archiveLinks?.length > 0 ? ` · 已保存 ${task.archiveLinks.length} 份阶段记录` : ''}</span>}
                  {!task.records?.length && task.archiveLinks?.length > 0 && <span className="research-task-card-next">已保存 {task.archiveLinks.length} 份 Obsidian 阶段记录</span>}
                  {parentTask && <span className="research-task-card-next">关联任务：{parentTask.title || parentTask.focus}</span>}
                  {task.linkedCodexThreadId && <span className="research-task-card-next">已关联 Codex 新对话（工作台不读取对话内容）</span>}
                </span>
                <span className="research-task-card-updated">{taskUpdatedLabel(task.updatedAt)}</span>
                <ArrowRight size={17} aria-hidden="true" />
              </button>
              {task.linkedCodexThreadId && <button className="research-task-codex-button" type="button" aria-label={`在 Codex 中打开「${task.title || workflowLabel}」关联对话`} onClick={() => onOpenCodexThread?.(task)}>打开 Codex 对话</button>}
            </article>;
          })}
        </div>
      </section>}

      <section className="task-backup-panel" aria-label="本机任务备份">
        <div><strong>本机任务备份</strong><p>导出任务卡与未完成启动语；导入时只合并新任务，同编号保留本机版本。备份文件由你自己保管，不上传。</p></div>
        <div className="task-backup-actions">
          <button className="text-button" type="button" onClick={onExportBackup}><DownloadSimple size={16} aria-hidden="true" />导出备份</button>
          <button className="text-button" type="button" onClick={() => backupInputRef.current?.click()}><UploadSimple size={16} aria-hidden="true" />导入备份</button>
          <input ref={backupInputRef} type="file" accept=".json,application/json" className="visually-hidden" aria-label="选择工作台任务备份 JSON 文件" onChange={importBackup} />
        </div>
        {backupMessage && <p className="task-backup-message" role="status">{backupMessage}</p>}
      </section>

      <form className="thought-form" onSubmit={event => { event.preventDefault(); onBegin(thought, taskFocus); }}>
        <label className="visually-hidden" htmlFor="research-thought">写下研究观察、困惑或决定</label>
        <textarea
          id="research-thought"
          ref={textareaRef}
          value={thought}
          onChange={event => setThought(event.target.value)}
          onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') onBegin(thought, taskFocus); }}
          placeholder="例如：这个病理现象背后可能有哪些机制？我手头的证据还缺什么？"
          rows={4}
        />
        <button className="primary-button" type="submit">{getStartActionLabel(taskFocus)} <ArrowRight size={18} weight="bold" aria-hidden="true" /></button>
      </form>

      <div className="quick-start-heading">
        <h2>或直接进入一项工作</h2>
        <p>选择类型会新建独立任务卡；创建后可在首页继续或恢复。</p>
      </div>
      <div className="workflow-entry-grid" aria-label="常用科研工作">
        {PROMPT_STARTERS.map((workflow, index) => (
          <button className="workflow-entry" key={workflow.id} type="button" onClick={() => onOpenWorkflow(workflow)}>
            <span className="workflow-entry-number">0{index + 1}</span>
            <span className="workflow-entry-copy"><strong>{workflow.label}</strong><small>{workflow.detail}</small></span>
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        ))}
      </div>

      <button className="resume-row" type="button" onClick={onOpenVault}>
        <FolderOpen size={20} aria-hidden="true" />
        <span className="resume-label">知识库连接状态</span>
        <span className="resume-divider" aria-hidden="true" />
        <span className="resume-summary">{vaultRestoreMessage || (vaultConnected ? `${vaultName} 已连接；读取范围由龚博士选择` : vaultName ? `${vaultName} 已选择，尚未授权读取范围` : '研究资料仍由 Obsidian 知识库维护')}</span>
        <span className="inline-link">查看说明 <ArrowRight size={15} aria-hidden="true" /></span>
      </button>
      <p className="local-note">草稿保存在本机浏览器 · Obsidian 只按勾选范围读取 · 研究判断由龚博士和导师作出</p>
    </section>
  );
});

HomePage.displayName = 'HomePage';
