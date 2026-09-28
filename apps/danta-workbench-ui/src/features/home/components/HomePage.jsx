import { memo } from 'react';
import { PROMPT_STARTERS } from '../../../shared/constants/workflows.js';
import { PromptStarter } from '../../../shared/components/PromptStarter.jsx';

export const HomePage = memo(({ onOpenWorkflow }) => (
  <div className="home-page">
    <section className="home-hero">
      <div className="home-eyebrow">龚博士的研究工作台</div>
      <h1>今天,最想弄清楚什么?</h1>
      <p>把零散的科研想法、证据线索和工作任务集中到独立空间,逐步梳理并付诸实施。</p>
    </section>

    <section className="prompt-starters-section" aria-labelledby="starters-title">
      <h2 id="starters-title" className="visually-hidden">快速启动</h2>
      <div className="prompt-starters">
        {PROMPT_STARTERS.map((starter, index) => (
          <PromptStarter
            key={starter.id}
            {...starter}
            onClick={() => onOpenWorkflow(starter)}
            ariaKeyshortcuts={`Alt+${index + 1}`}
          />
        ))}
      </div>
    </section>

    <section className="home-guide" aria-labelledby="guide-title">
      <div className="guide-content">
        <span className="guide-eyebrow">工作台结构</span>
        <h2 id="guide-title">七类 agent 分工协作</h2>
        <p>
          工作台按职责调用七类专业 agent:文献证据、生信数据、论文写作、方法统计、组会汇报、质疑审查、知识整理。
          每类 agent 只处理自己职责内的工作,不替你作研究判断。
        </p>
        <ul className="guide-features">
          <li>文献证据带来源,生信结果带参数,不假装核查过</li>
          <li>PPT 和机制图自动生成可编辑格式,区分真实与计划数据</li>
          <li>研究记录保存在你的 Obsidian 知识库,下次对话从这里继续</li>
        </ul>
      </div>
      <div className="guide-visual">
        <svg className="guide-image" viewBox="0 0 480 360" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="480" height="360" rx="16" fill="var(--surface-raised)"/>
          <rect x="24" y="24" width="432" height="48" rx="8" fill="var(--accent-soft)"/>
          <circle cx="48" cy="48" r="12" fill="var(--accent-primary)"/>
          <rect x="72" y="40" width="120" height="8" rx="4" fill="var(--accent-primary)"/>
          <rect x="72" y="52" width="80" height="6" rx="3" fill="var(--accent-border)"/>

          <rect x="24" y="96" width="200" height="112" rx="12" fill="var(--surface-sidebar)"/>
          <rect x="40" y="112" width="168" height="8" rx="4" fill="var(--ink-muted)"/>
          <rect x="40" y="132" width="120" height="6" rx="3" fill="var(--line-default)"/>
          <rect x="40" y="156" width="168" height="32" rx="8" fill="var(--accent-soft)"/>

          <rect x="240" y="96" width="216" height="240" rx="12" fill="var(--surface-sidebar)"/>
          <rect x="256" y="112" width="184" height="8" rx="4" fill="var(--ink-muted)"/>
          <rect x="256" y="132" width="140" height="6" rx="3" fill="var(--line-default)"/>
          <rect x="256" y="156" width="184" height="48" rx="8" fill="var(--accent-soft)"/>
          <circle cx="272" cy="180" r="8" fill="var(--accent-primary)"/>
          <rect x="256" y="220" width="184" height="48" rx="8" fill="var(--surface-hover)"/>
          <rect x="256" y="284" width="184" height="40" rx="8" fill="var(--surface-hover)"/>

          <rect x="24" y="224" width="200" height="112" rx="12" fill="var(--surface-sidebar)"/>
          <rect x="40" y="240" width="140" height="8" rx="4" fill="var(--ink-muted)"/>
          <rect x="40" y="260" width="168" height="60" rx="8" fill="var(--line-subtle)"/>
        </svg>
      </div>
    </section>
  </div>
));

HomePage.displayName = 'HomePage';
