import { memo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle, DownloadSimple, FilePlus, ShareNetwork, Newspaper, X } from '@phosphor-icons/react';
import { PPT_TEMPLATES } from '../../../shared/constants/pptTemplates.js';
import { PptLogoSelector } from './PptLogoSelector.jsx';

const MEETING_REVIEW_SEED = '我想复盘一次组会：……请根据实际讨论记录整理导师/同门反馈、已决定事项、尚未决定的问题和行动项，不要补写没有发生的内容。';
const PPT_GUIDE_MARKER = '【汇报信息填空框架】';

export const WorkflowWorkspace = memo(({ workflow, thought, setThought, files = [], selectedPptTemplate = null, selectedPptLogo = null, pptPromptChoices = {}, onPptPromptChoicesChange, onSelectPptTemplate, onSelectPptLogo, onBack, onBegin, onFilesAdded, onRemoveFile, onOpenMechanism, onViewDailyBriefs }) => {
  const fileInputRef = useRef(null);
  const [meetingMode, setMeetingMode] = useState('prepare');

  function changeMeetingMode(mode) {
    setMeetingMode(mode);
    if (mode === 'review' && thought === workflow.seed) setThought(MEETING_REVIEW_SEED);
    if (mode === 'prepare' && thought === MEETING_REVIEW_SEED) setThought(workflow.seed);
  }

  function insertPptPromptFrame() {
    if (thought.includes(PPT_GUIDE_MARKER)) return;
    const frame = [
      PPT_GUIDE_MARKER,
      `汇报形式：${pptPromptChoices.format || '……'}`,
      '主题 / 论文 / 核心问题：……',
      `本次目标：${pptPromptChoices.purpose || '……'}`,
      `面向听众：${pptPromptChoices.audience || '……'}`,
      `预计时长：${pptPromptChoices.duration || '……'}`,
      '已有真实材料（只列实际已获得的内容，如文献、病理图像、实验数据或分析结果）：……',
      '希望讨论 / 请大家帮助判断的问题：……',
      '目前不确定或缺少的信息：……',
      '请根据我提供的材料梳理汇报主线、证据和未决问题；没有提供的信息标为待补充，不推测或补造。',
    ].join('\n');
    const existingText = thought === workflow.seed ? '' : thought.trim();
    setThought([existingText, frame].filter(Boolean).join('\n\n'));
  }

  const sidePanels = (
    <div className="workspace-sidepanels">
      <section className="workspace-panel" aria-labelledby="conversation-title">
        <div className="workspace-panel-heading"><div><span className="panel-kicker">下一步</span><h2 id="conversation-title">带着启动语进入 Codex</h2></div><span className="connection-pill">手动接续</span></div>
        <div className="workspace-empty"><p>检查并复制启动语，再在目标项目的新对话中粘贴。</p><span>网页任务区与 Codex 项目暂未连接；此处不会创建或同步对话。</span></div>
      </section>

      <section className="workspace-panel" aria-labelledby="files-title">
        <div className="workspace-panel-heading"><div><span className="panel-kicker">本次任务</span><h2 id="files-title">工作文件</h2></div><button className="file-add-button" type="button" onClick={() => fileInputRef.current?.click()}><FilePlus size={16} aria-hidden="true" />添加</button></div>
        <input ref={fileInputRef} className="visually-hidden" type="file" multiple onChange={onFilesAdded} aria-label="选择本次工作文件" />
        {files.length ? (
          <ul className="workflow-file-list">{files.map(name => <li key={name}><span title={name}>{name}</span><button type="button" aria-label={`移除 ${name}`} onClick={() => onRemoveFile(name)}><X size={15} aria-hidden="true" /></button></li>)}</ul>
        ) : (
          <div className="workspace-empty"><p>尚未添加工作文件。</p><span>当前仅记录文件名，不读取或上传内容；关闭此标签页后清空。需要使用文件时，请在 Codex 对话中提供。</span></div>
        )}
      </section>
    </div>
  );

  return (
    <section className="workflow-workspace" aria-labelledby="workflow-title">
      <div className="workspace-topline">
        <button className="back-link" type="button" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" />全部工作</button>
        <span>网页任务整理区</span>
      </div>
      <div className="workspace-heading">
        <div className="home-eyebrow">龚博士的研究工作台</div>
        <h1 id="workflow-title">{workflow.label}</h1>
        <p>{workflow.workspaceDescription}</p>
        {workflow.id === 'briefing' && <button className="secondary-button daily-workflow-link" type="button" onClick={onViewDailyBriefs}><Newspaper size={16} aria-hidden="true" />查看定时任务已生成的日报</button>}
      </div>

      {workflow.id === 'ppt' && (
        <ol className="ppt-flow-guide" aria-label="科研 PPT 准备步骤">
          <li aria-current="step"><span>01</span><strong>整理汇报任务</strong><small>主题、听众、目的与材料</small></li>
          <li><span>02</span><strong>选择呈现方式</strong><small>模板与单位标识</small></li>
          <li><span>03</span><strong>检查启动语</strong><small>复制到 Codex 新对话</small></li>
        </ol>
      )}

      <div className={`workspace-grid${workflow.id === 'ppt' ? ' is-ppt-setup' : ''}`}>
        <section className="workspace-panel discussion-panel" aria-labelledby="discussion-title">
          <div className="workspace-panel-heading">
            <div><span className="panel-kicker">{workflow.id === 'ppt' ? '第 1 步 · 先整理内容' : '先从你的问题开始'}</span><h2 id="discussion-title">{workflow.id === 'meeting' ? '组会任务' : workflow.id === 'ppt' ? '本次汇报要讲什么？' : '新建讨论'}</h2></div>
            <span className="panel-status">内容可修改</span>
          </div>
          {workflow.id === 'meeting' && (
            <div className="mode-switch" role="group" aria-label="选择组会任务">
              <button type="button" className={meetingMode === 'prepare' ? 'is-selected' : ''} aria-pressed={meetingMode === 'prepare'} onClick={() => changeMeetingMode('prepare')}>准备组会</button>
              <button type="button" className={meetingMode === 'review' ? 'is-selected' : ''} aria-pressed={meetingMode === 'review'} onClick={() => changeMeetingMode('review')}>复盘组会</button>
            </div>
          )}
          {workflow.id === 'ppt' && (
            <section className="ppt-guidance" aria-labelledby="ppt-guidance-title">
              <div className="ppt-guidance-heading">
                <div><h3 id="ppt-guidance-title">先选几项汇报信息（可跳过）</h3><p>不确定的内容可以留空；已有文字会保留，框架只会追加在后面。</p></div>
                <button className="text-button" type="button" onClick={insertPptPromptFrame} disabled={thought.includes(PPT_GUIDE_MARKER)}>{thought.includes(PPT_GUIDE_MARKER) ? '框架已插入，可直接编辑' : '插入填空框架'}</button>
              </div>
              <div className="ppt-guidance-grid">
                <label>汇报形式
                  <select value={pptPromptChoices.format || ''} onChange={event => onPptPromptChoicesChange(current => ({ ...current, format: event.target.value }))}>
                    <option value="">暂不选择</option><option>组会文献汇报</option><option>研究进展汇报</option><option>结果讨论</option><option>开题 / 研究方案讨论</option><option>其他科研汇报</option>
                  </select>
                </label>
                <label>本次目标
                  <select value={pptPromptChoices.purpose || ''} onChange={event => onPptPromptChoicesChange(current => ({ ...current, purpose: event.target.value }))}>
                    <option value="">暂不选择</option><option>介绍并讨论文献</option><option>同步研究进展</option><option>解释已有结果</option><option>讨论实验或分析方案</option><option>请导师和同门帮助判断问题</option><option>其他</option>
                  </select>
                </label>
                <label>主要听众
                  <select value={pptPromptChoices.audience || ''} onChange={event => onPptPromptChoicesChange(current => ({ ...current, audience: event.target.value }))}>
                    <option value="">暂不选择</option><option>导师与课题组成员</option><option>同领域研究者</option><option>跨专业听众</option><option>答辩或评审专家</option><option>其他</option>
                  </select>
                </label>
                <label>预计时长
                  <select value={pptPromptChoices.duration || ''} onChange={event => onPptPromptChoicesChange(current => ({ ...current, duration: event.target.value }))}>
                    <option value="">暂不选择</option><option>5–10 分钟</option><option>10–15 分钟</option><option>15–20 分钟</option><option>20 分钟以上</option><option>暂未确定</option>
                  </select>
                </label>
              </div>
            </section>
          )}
          <label className={workflow.id === 'ppt' ? 'field-label' : 'visually-hidden'} htmlFor={`${workflow.id}-thought`}>{workflow.id === 'ppt' ? '本次汇报内容与已有材料' : `描述本次${workflow.label}任务`}</label>
          <textarea id={`${workflow.id}-thought`} className="discussion-textarea" value={thought} onChange={event => setThought(event.target.value)} rows={7} />
          <div className="workspace-form-footer">
            {workflow.id === 'ppt' ? (
              <span>先写主题、听众、汇报目的与已有材料；接着选择模板和 Logo。</span>
            ) : (
              <>
                <span>生成后由你检查启动语，再复制到 Codex；本页不会启动对话。</span>
                <button className="primary-button compact" type="button" onClick={() => onBegin(thought, workflow.focus)}>整理启动语 <ArrowRight size={16} aria-hidden="true" /></button>
              </>
            )}
          </div>
        </section>

        {workflow.id !== 'ppt' && sidePanels}
      </div>

      {workflow.id === 'ppt' && (
        <>
          <section className="ppt-template-library" aria-labelledby="ppt-template-title">
            <div className="ppt-template-heading">
              <div><span className="panel-kicker">第 2 步 · 汇报版式</span><h2 id="ppt-template-title">选择一套汇报模板</h2><p>四种科研版式都保留真实病理与实验图表的呈现空间。内容始终以你提供的真实研究材料为准。</p></div>
              <button className="secondary-button" type="button" onClick={onOpenMechanism}><ShareNetwork size={17} aria-hidden="true" />机制图工作区 <ArrowRight size={15} aria-hidden="true" /></button>
            </div>
            <div className="ppt-template-grid" role="group" aria-label="组会 PPT 模板">
              {PPT_TEMPLATES.map(template => {
                const selected = selectedPptTemplate?.id === template.id;
                return (
                  <article className={`ppt-template-card${selected ? ' is-selected' : ''}`} key={template.id} style={{ '--template-accent': template.accent }}>
                    <button className="ppt-template-pick" type="button" aria-pressed={selected} aria-label={`选择${template.title}`} onClick={() => onSelectPptTemplate(template)}>
                      <span className="ppt-template-preview"><img src={template.preview} alt={`${template.title}封面预览`} loading="lazy" /><span className="ppt-template-selection">{selected ? <><CheckCircle size={15} weight="fill" aria-hidden="true" />已选</> : '预览风格'}</span></span>
                      <span className="ppt-template-copy"><span className="ppt-template-meta">{template.style}</span><strong>{template.title}</strong><small>{template.description}</small></span>
                    </button>
                    <a className="ppt-template-download" href={template.downloadUrl} download={template.fileName}><DownloadSimple size={15} aria-hidden="true" />下载可编辑 PPTX</a>
                  </article>
                );
              })}
            </div>
            <div className="ppt-template-status" aria-live="polite"><span>{selectedPptTemplate ? `已选择：${selectedPptTemplate.title}。整理启动语时会附上模板文件路径。` : '模板可选；不选时会生成通用版启动语。'}</span>{selectedPptTemplate && <button type="button" onClick={() => onSelectPptTemplate(null)}>清除选择</button>}</div>
          </section>
          <PptLogoSelector selectedLogo={selectedPptLogo} onSelectLogo={onSelectPptLogo} />
          <div className="ppt-final-action">
            <div><span className="panel-kicker">第 3 步 · 检查启动语</span><p>会把汇报需求、所选模板和单位标识整理在一起，供你确认后复制。</p></div>
            <button className="primary-button compact" type="button" onClick={() => onBegin(thought, workflow.focus, selectedPptTemplate, selectedPptLogo)}>整理启动语 <ArrowRight size={16} aria-hidden="true" /></button>
          </div>
          {sidePanels}
        </>
      )}
    </section>
  );
});

WorkflowWorkspace.displayName = 'WorkflowWorkspace';
