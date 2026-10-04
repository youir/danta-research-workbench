import { RESEARCH_STAGES, RESEARCH_TASK_STATUSES, getResearchStage } from '../../../shared/constants/researchTasks.js';
import { ResearchSteps } from '../../research-tasks/components/ResearchSteps.jsx';
import { TaskRecords } from '../../research-tasks/components/TaskRecords.jsx';

export function ResearchTaskDetails({ task, onChange, recordActions }) {
  if (!task) return null;
  const stage = getResearchStage(task.stageId);

  return (
    <section className="research-task-details" aria-labelledby="research-task-title">
      <div className="research-task-details-heading">
        <div>
          <span className="panel-kicker">本机保存 · 可随时恢复</span>
          <h2 id="research-task-title">研究任务卡</h2>
        </div>
        {task.linkedCodexThreadId ? <button className="secondary-button compact" type="button" onClick={() => recordActions?.openConversation(task.linkedCodexThreadId)}>继续 Codex 对话</button> : <span className="research-task-id" title={`任务编号 ${task.id}`}>本机任务卡</span>}
      </div>
      <div className="research-task-fields">
        <label className="research-task-title-field">任务名称
          <input value={task.title} maxLength={100} onChange={event => onChange('title', event.target.value)} placeholder="给这项研究任务起个便于找回的名字" />
        </label>
        <label className="research-task-objective-field">本次目标
          <input value={task.objective} maxLength={240} onChange={event => onChange('objective', event.target.value)} placeholder="这一步最希望弄清楚或完成什么？" />
        </label>
        <label>当前阶段
          <select value={task.stageId} onChange={event => onChange('stageId', event.target.value)}>
            {RESEARCH_STAGES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label>任务状态
          <select value={task.statusId} onChange={event => onChange('statusId', event.target.value)}>
            {RESEARCH_TASK_STATUSES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label className="research-task-next-field">下一步
          <input value={task.nextStep} maxLength={240} onChange={event => onChange('nextStep', event.target.value)} placeholder="例如：核对关键论文的原文方法" />
        </label>
        <label className="research-task-questions-field">待确认问题
          <textarea value={task.openQuestions} maxLength={1200} rows={2} onChange={event => onChange('openQuestions', event.target.value)} placeholder="还有哪些问题需要自己、导师或课题组判断？可以暂时留空。" />
        </label>
      </div>
      <p className="research-task-stage-help">{stage.help} 填写即时保存，可在任何阶段继续任务或保存阶段记录。</p>
      {task.codexThreadIds?.length > 1 && <details className="task-conversation-history"><summary>这项任务的历史对话 · {task.codexThreadIds.length} 段</summary><ul>{task.codexThreadIds.map((id, index) => <li key={id}><button className="text-button" type="button" onClick={() => recordActions?.openConversation(id)}>{id === task.linkedCodexThreadId ? '当前对话' : `历史对话 ${index + 1}`} · {id.slice(0, 8)}</button></li>)}</ul></details>}
      <ResearchSteps key={task.id} task={task} actions={recordActions?.steps} />
      <TaskRecords task={task} actions={recordActions} />
    </section>
  );
}
