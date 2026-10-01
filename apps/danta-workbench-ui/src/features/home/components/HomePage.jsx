import { memo } from 'react';
import { ArrowClockwise, ArrowRight } from '@phosphor-icons/react';
import { getStartActionLabel } from '../../../shared/constants/workflows.js';
import { ResearchTaskCard } from '../../research-tasks/components/ResearchTaskCard.jsx';

export const HomePage = memo(({ thought, setThought, taskFocus, recovery, researchTasks = [], onBegin, onNavigateArea, onResumeTask, onOpenCodexThread, onRestoreKickoff }) => {
  const latestTask = researchTasks[0];

  return <section className="home-view" aria-labelledby="home-title">
    <div className="home-eyebrow">龚博士的研究工作台</div>
    <h1 id="home-title">接着做，或开始一项研究</h1>
    <p className="home-lede">继续已有任务，或写下今天想解决的问题。草稿会留在这台电脑上。</p>

    {recovery && <section className="resume-card" aria-labelledby="resume-card-title">
      <div className="resume-card-copy"><span className="panel-kicker">{recovery.handedOff ? '上次交接' : '待接续'} · {recovery.timeLabel}</span><h2 id="resume-card-title">{recovery.title}</h2><p>{recovery.description}</p></div>
      <button className="secondary-button" type="button" onClick={onRestoreKickoff}><ArrowClockwise size={16} aria-hidden="true" />继续上次工作</button>
    </section>}

    {latestTask && <section className="research-task-list-section home-latest-task" aria-labelledby="home-latest-task-title">
      <div className="quick-start-heading"><h2 id="home-latest-task-title">最近的研究任务</h2><button className="text-button" type="button" onClick={() => onNavigateArea('tasks')}>查看全部 {researchTasks.length} 项 <ArrowRight size={15} aria-hidden="true" /></button></div>
      <ResearchTaskCard task={latestTask} tasks={researchTasks} onResumeTask={onResumeTask} onOpenCodexThread={onOpenCodexThread} />
    </section>}

    <section className="home-new-work" aria-labelledby="home-new-work-title">
      <div className="quick-start-heading"><h2 id="home-new-work-title">写下今天的问题</h2><p>{thought.trim() ? '上次草稿已自动恢复' : '先梳理思路，再决定下一步。'}</p></div>
      <form className="thought-form" onSubmit={event => { event.preventDefault(); onBegin(thought, taskFocus); }}>
        <label className="visually-hidden" htmlFor="research-thought">写下研究观察、困惑或决定</label>
        <textarea id="research-thought" value={thought} onChange={event => setThought(event.target.value)} onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') onBegin(thought, taskFocus); }} placeholder="例如：这个病理现象背后可能有哪些机制？我手头的证据还缺什么？" rows={4} />
        <button className="primary-button" type="submit">{getStartActionLabel(taskFocus)} <ArrowRight size={18} weight="bold" aria-hidden="true" /></button>
      </form>
    </section>

    <p className="home-navigation-hint">选题与论文在“研究任务”；文献与日报在“文献资料”；组会、PPT 和机制图在“汇报制图”。</p>

    <p className="local-note">草稿保存在本机 · 研究判断由龚博士和导师作出</p>
  </section>;
});

HomePage.displayName = 'HomePage';
