import { ArrowRight } from '@phosphor-icons/react';
import { PageBack } from '../../../shared/components/PageBack.jsx';
import { PROMPT_STARTERS, MECHANISM_WORKFLOW } from '../../../shared/constants/workflows.js';
import { ResearchTaskCard } from '../../research-tasks/components/ResearchTaskCard.jsx';

const workflowById = Object.fromEntries(PROMPT_STARTERS.map(item => [item.id, item]));

function AreaHeader({ id, eyebrow, title, description, onBack }) {
  return <><PageBack onBack={onBack} /><div className="home-eyebrow">{eyebrow}</div><h1 id={id}>{title}</h1><p className="subpage-lede">{description}</p></>;
}

function AreaAction({ number, title, description, onClick }) {
  return <button className="workflow-entry area-action" type="button" onClick={onClick}>
    <span className="workflow-entry-number">{number}</span>
    <span className="workflow-entry-copy"><strong>{title}</strong><small>{description}</small></span>
    <ArrowRight size={17} aria-hidden="true" />
  </button>;
}

export function TasksArea({ tasks, onBack, onOpenWorkflow, onResumeTask, onOpenCodexThread }) {
  return <section className="subpage-view work-area" aria-labelledby="tasks-area-title">
    <AreaHeader id="tasks-area-title" eyebrow="持续研究" title="研究任务" description="从已有任务继续，或为选题和论文写作建立独立任务卡。" onBack={onBack} />
    <div className="area-action-grid" aria-label="新建研究任务">
      <AreaAction number="01" title="梳理选题" description="从现象、证据和条件整理可讨论的问题" onClick={() => onOpenWorkflow(workflowById.topic)} />
      <AreaAction number="02" title="论文写作" description="起草、修改、润色或回复审稿意见" onClick={() => onOpenWorkflow(workflowById.writing)} />
    </div>
    <section className="research-task-list-section" aria-labelledby="tasks-area-list-title">
      <div className="quick-start-heading"><h2 id="tasks-area-list-title">全部任务卡</h2><p>{tasks.length ? `本机保存 ${tasks.length} 项 · 最近更新在前` : '开始一项工作后，任务卡会出现在这里。'}</p></div>
      {tasks.length > 0 && <div className="research-task-list">{tasks.map(task => <ResearchTaskCard key={task.id} task={task} tasks={tasks} onResumeTask={onResumeTask} onOpenCodexThread={onOpenCodexThread} />)}</div>}
    </section>
  </section>;
}

export function SourcesArea({ onBack, onNavigate, onOpenWorkflow }) {
  return <section className="subpage-view work-area" aria-labelledby="sources-area-title">
    <AreaHeader id="sources-area-title" eyebrow="来源与证据" title="文献资料" description="按来源查看已授权的资料。笔记在 Obsidian 中维护，工作台只读取你允许的范围。" onBack={onBack} />
    <div className="area-action-grid" aria-label="文献资料工作">
      <AreaAction number="01" title="研究记录" description="查看课题项目和日志中的记录" onClick={() => onNavigate('records')} />
      <AreaAction number="02" title="文献与信息源" description="查看文献笔记、RSS 线索和文献脉络" onClick={() => onNavigate('literature')} />
      <AreaAction number="03" title="科研日报" description="查看今日日报、归档和自动化引导" onClick={() => onNavigate('daily-briefs')} />
      <AreaAction number="04" title="历史归档" description="查找旧记录，或在授权后新建阶段记录" onClick={() => onNavigate('archive')} />
    </div>
    <div className="area-secondary-action"><span>需要单独准备日报启动语？</span><button className="text-button" type="button" onClick={() => onOpenWorkflow(workflowById.briefing)}>创建日报任务 <ArrowRight size={15} aria-hidden="true" /></button></div>
  </section>;
}

export function OutputsArea({ onBack, onOpenWorkflow, onOpenMechanism }) {
  return <section className="subpage-view work-area" aria-labelledby="outputs-area-title">
    <AreaHeader id="outputs-area-title" eyebrow="组会与科研表达" title="汇报制图" description="先确定汇报目的和真实证据，再准备可编辑的 PPT 或科研图。" onBack={onBack} />
    <div className="area-action-grid" aria-label="汇报制图工作">
      <AreaAction number="01" title="科研 PPT" description="选择模板与单位标识，整理组会或阶段汇报" onClick={() => onOpenWorkflow(workflowById.ppt)} />
      <AreaAction number="02" title="组会准备 / 复盘" description="梳理讨论目标、已决定和待确认事项" onClick={() => onOpenWorkflow(workflowById.meeting)} />
      <AreaAction number="03" title="科研机制图" description={MECHANISM_WORKFLOW.detail} onClick={onOpenMechanism} />
    </div>
  </section>;
}
