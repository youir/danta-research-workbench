import { ArrowRight } from '@phosphor-icons/react';
import { MECHANISM_WORKFLOW, PROMPT_STARTERS } from '../../../shared/constants/workflows.js';
import { getResearchStage, getResearchTaskStatus } from '../../../shared/constants/researchTasks.js';

function taskUpdatedLabel(timestamp) {
  if (!timestamp) return '本机保存';
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? '本机保存' : new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

export function ResearchTaskCard({ task, tasks = [], onResumeTask, onOpenCodexThread }) {
  const stage = getResearchStage(task.stageId);
  const status = getResearchTaskStatus(task.statusId);
  const workflow = task.workflowId === MECHANISM_WORKFLOW.id ? MECHANISM_WORKFLOW : PROMPT_STARTERS.find(item => item.id === task.workflowId);
  const workflowLabel = workflow?.label || task.focus || '研究任务';
  const parentTask = tasks.find(item => item.id === task.parentTaskId);

  return <article className="research-task-card">
    <button className="research-task-card-open" type="button" onClick={() => onResumeTask?.(task)}>
      <span className="research-task-card-main">
        <span className="research-task-card-title">{task.title || workflowLabel}</span>
        <span className="research-task-card-meta">{workflowLabel} · {stage.label} · {status.label}</span>
        {task.nextStep && <span className="research-task-card-next">下一步：{task.nextStep}</span>}
        {task.records?.length > 0 && <span className="research-task-card-next">成果与来源：{task.records.length} 条{task.archiveLinks?.length > 0 ? ` · 已保存 ${task.archiveLinks.length} 份阶段记录` : ''}</span>}
        {!task.records?.length && task.archiveLinks?.length > 0 && <span className="research-task-card-next">已保存 {task.archiveLinks.length} 份 Obsidian 阶段记录</span>}
        {parentTask && <span className="research-task-card-next">关联任务：{parentTask.title || parentTask.focus}</span>}
        {task.linkedCodexThreadId && <span className="research-task-card-next">已关联 Codex 对话（工作台不读取对话内容）</span>}
      </span>
      <span className="research-task-card-updated">{taskUpdatedLabel(task.updatedAt)}</span>
      <ArrowRight size={17} aria-hidden="true" />
    </button>
    {task.linkedCodexThreadId && <button className="research-task-codex-button" type="button" aria-label={`在 Codex 中打开「${task.title || workflowLabel}」关联对话`} onClick={() => onOpenCodexThread?.(task)}>打开 Codex 对话</button>}
  </article>;
}
