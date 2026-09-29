import { memo } from 'react';
import { ArrowLeft, ArrowRight, ArrowSquareOut, ShareNetwork } from '@phosphor-icons/react';

export const MechanismWorkspace = memo(({ brief, setBrief, showProcess, setShowProcess, onBack, onBegin }) => (
  <section className="mechanism-page" aria-labelledby="mechanism-title">
    <div className="workspace-topline">
      <button className="back-link" type="button" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" />返回</button>
      <span>科研绘图任务整理区 · 证据先行</span>
    </div>
    <div className="workspace-heading mechanism-heading">
      <div><div className="home-eyebrow">网页任务整理区</div><h1 id="mechanism-title">把生物学逻辑变成可核对的图</h1><p>先核实节点关系与证据，再确认逻辑草图和绘图方式。</p></div>
      <button className="secondary-button" type="button" aria-expanded={showProcess} aria-controls="mechanism-process" onClick={() => setShowProcess(value => !value)}>{showProcess ? '收起制作过程' : '查看制作过程'} <ArrowRight size={16} aria-hidden="true" /></button>
    </div>

    {showProcess && (
      <section id="mechanism-process" className="process-panel" aria-label="机制图制作过程">
        <p className="process-note">这是工作方法说明，不是实时进度；实际制图在 Codex 中完成。</p>
        <ol className="process-list">
          <li><span>01</span><div><strong>明确图的任务</strong><small>确认场景、受众、核心主张和图中边界。</small></div></li>
          <li><span>02</span><div><strong>整理节点—关系—来源</strong><small>记录分子、细胞、组织、关系方向、模型背景和来源位置。</small></div></li>
          <li><span>03</span><div><strong>标明证据状态</strong><small>区分直接证据、推断、待验证假说；不凭空补线。</small></div></li>
          <li><span>04</span><div><strong>由龚博士确认逻辑</strong><small>先处理争议和待核实问题，再进入视觉制作。</small></div></li>
          <li><span>05</span><div><strong>制作并检查</strong><small>按需调用 PPT Master，输出可编辑图形与 SVG 源稿并检查。</small></div></li>
        </ol>
      </section>
    )}

    <div className="mechanism-grid">
      <section className="workspace-panel discussion-panel" aria-labelledby="mechanism-brief-title">
        <div className="workspace-panel-heading"><div><span className="panel-kicker">需求整理</span><h2 id="mechanism-brief-title">机制图主题与证据</h2></div><span className="panel-status">由你确认</span></div>
        <label className="visually-hidden" htmlFor="mechanism-brief">描述机制图主题、已有证据和用途</label>
        <textarea id="mechanism-brief" className="discussion-textarea" value={brief} onChange={event => setBrief(event.target.value)} rows={9} />
        <div className="workspace-form-footer"><span>启动语会要求先核实关系来源和证据状态。</span><button className="primary-button compact" type="button" onClick={() => onBegin(brief, '科研机制图')}>整理绘图启动语 <ArrowRight size={16} aria-hidden="true" /></button></div>
      </section>

      <section className="workspace-panel resource-panel" aria-labelledby="resource-title">
        <div className="workspace-panel-heading"><div><span className="panel-kicker">可选工具</span><h2 id="resource-title">技能库与绘图入口</h2></div></div>
        <div className="resource-link-list">
          <a href="https://github.com/BioTender-max/awesome-bio-agent-skills" target="_blank" rel="noreferrer"><span><strong>BioTender 生物技能库</strong><small>查找生物信息学、数据分析和科研图相关 skill</small></span><ArrowSquareOut size={17} aria-hidden="true" /></a>
          <a href="https://www.biorender.com/" target="_blank" rel="noreferrer"><span><strong>BioRender 绘图平台</strong><small>外部绘图工具；是否使用及是否上传材料由你决定</small></span><ArrowSquareOut size={17} aria-hidden="true" /></a>
        </div>
        <div className="local-skill-card"><ShareNetwork size={19} aria-hidden="true" /><span><strong>工作台内置流程</strong><small>Codex 按需使用 <code>$danta-research-ppt</code> 与 PPT Master；技能不代表外部平台已连接。</small></span></div>
        <p className="resource-note">BioTender 是技能集合，不是绘图平台。以上外链只打开网站，不会传送研究内容。</p>
      </section>
    </div>
  </section>
));

MechanismWorkspace.displayName = 'MechanismWorkspace';
