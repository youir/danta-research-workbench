import { memo, useRef } from 'react';
import { ArrowRight, FolderOpen } from '@phosphor-icons/react';
import { PROMPT_STARTERS, getStartActionLabel } from '../../../shared/constants/workflows.js';

export const HomePage = memo(({ thought, setThought, taskFocus, onBegin, onOpenWorkflow, onOpenVault }) => {
  const textareaRef = useRef(null);

  return (
    <section className="home-view" aria-labelledby="home-title">
      <div className="home-eyebrow">龚博士的研究工作台</div>
      <h1 id="home-title">今天，最想弄清楚什么？</h1>
      <p className="home-lede">写下一个观察、困惑或正在犹豫的决定。主助理会先理解问题，再陪你推进。</p>

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
        <p>每项工作都有自己的讨论页；启动语可以继续修改。</p>
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
        <span className="resume-summary">网页尚未连接 GY；研究资料仍由 Obsidian 知识库维护</span>
        <span className="inline-link">查看说明 <ArrowRight size={15} aria-hidden="true" /></span>
      </button>
      <p className="local-note">当前标签页自动暂存草稿 · 不读取 GY · 研究判断由龚博士和导师作出</p>
    </section>
  );
});

HomePage.displayName = 'HomePage';
