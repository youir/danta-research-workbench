import { memo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle, DownloadSimple, FilePlus, ShareNetwork, X } from '@phosphor-icons/react';
import { PPT_TEMPLATES } from '../../../shared/constants/pptTemplates.js';

const MEETING_REVIEW_SEED = '我想复盘一次组会：……请根据实际讨论记录整理导师/同门反馈、已决定事项、尚未决定的问题和行动项，不要补写没有发生的内容。';

export const WorkflowWorkspace = memo(({ workflow, thought, setThought, files = [], selectedPptTemplate = null, onSelectPptTemplate, onBack, onBegin, onFilesAdded, onRemoveFile, onOpenMechanism }) => {
  const fileInputRef = useRef(null);
  const [meetingMode, setMeetingMode] = useState('prepare');

  function changeMeetingMode(mode) {
    setMeetingMode(mode);
    if (mode === 'review' && thought === workflow.seed) setThought(MEETING_REVIEW_SEED);
    if (mode === 'prepare' && thought === MEETING_REVIEW_SEED) setThought(workflow.seed);
  }

  return (
    <section className="workflow-workspace" aria-labelledby="workflow-title">
      <div className="workspace-topline">
        <button className="back-link" type="button" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" />全部工作</button>
        <span>独立工作区</span>
      </div>
      <div className="workspace-heading">
        <div className="home-eyebrow">龚博士的研究工作台</div>
        <h1 id="workflow-title">{workflow.label}</h1>
        <p>{workflow.workspaceDescription}</p>
      </div>

      {workflow.id === 'ppt' && (
        <>
          <section className="ppt-template-library" aria-labelledby="ppt-template-title">
            <div className="ppt-template-heading">
              <div><span className="panel-kicker">组会汇报 · 可编辑 PPTX</span><h2 id="ppt-template-title">选择一套汇报模板</h2><p>四种科研版式都保留真实病理与实验图表的呈现空间，可先预览，也可直接下载。</p></div>
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
            <div className="ppt-template-status" aria-live="polite"><span>{selectedPptTemplate ? `已选择：${selectedPptTemplate.title}。整理启动语时会附上模板文件路径。` : '暂未选择模板。可以先比较四种风格，也可以直接整理启动语。'}</span>{selectedPptTemplate && <button type="button" onClick={() => onSelectPptTemplate(null)}>清除选择</button>}</div>
          </section>
        </>
      )}

      <div className="workspace-grid">
        <section className="workspace-panel discussion-panel" aria-labelledby="discussion-title">
          <div className="workspace-panel-heading">
            <div><span className="panel-kicker">先从你的问题开始</span><h2 id="discussion-title">{workflow.id === 'meeting' ? '组会任务' : '新建讨论'}</h2></div>
            <span className="panel-status">内容可修改</span>
          </div>
          {workflow.id === 'meeting' && (
            <div className="mode-switch" role="group" aria-label="选择组会任务">
              <button type="button" className={meetingMode === 'prepare' ? 'is-selected' : ''} aria-pressed={meetingMode === 'prepare'} onClick={() => changeMeetingMode('prepare')}>准备组会</button>
              <button type="button" className={meetingMode === 'review' ? 'is-selected' : ''} aria-pressed={meetingMode === 'review'} onClick={() => changeMeetingMode('review')}>复盘组会</button>
            </div>
          )}
          <label className="visually-hidden" htmlFor={`${workflow.id}-thought`}>描述本次{workflow.label}任务</label>
          <textarea id={`${workflow.id}-thought`} className="discussion-textarea" value={thought} onChange={event => setThought(event.target.value)} rows={7} />
          <div className="workspace-form-footer">
            <span>生成后由你检查启动语，再复制到 Codex；本页不会启动对话。</span>
            <button className="primary-button compact" type="button" onClick={() => onBegin(thought, workflow.focus, workflow.id === 'ppt' ? selectedPptTemplate : null)}>整理启动语 <ArrowRight size={16} aria-hidden="true" /></button>
          </div>
        </section>

        <div className="workspace-sidepanels">
          <section className="workspace-panel" aria-labelledby="conversation-title">
            <div className="workspace-panel-heading"><div><span className="panel-kicker">对话接续</span><h2 id="conversation-title">Codex 对话</h2></div><span className="connection-pill">尚未同步</span></div>
            <div className="workspace-empty"><p>从启动语进入 Codex 开始讨论。</p><span>本机原型暂不能读取或管理历史对话；可在 Codex 对话中继续。</span></div>
          </section>

          <section className="workspace-panel" aria-labelledby="files-title">
            <div className="workspace-panel-heading"><div><span className="panel-kicker">本次任务</span><h2 id="files-title">工作文件</h2></div><button className="file-add-button" type="button" onClick={() => fileInputRef.current?.click()}><FilePlus size={16} aria-hidden="true" />添加</button></div>
            <input ref={fileInputRef} className="visually-hidden" type="file" multiple onChange={onFilesAdded} aria-label="选择本次工作文件" />
            {files.length ? (
              <ul className="workflow-file-list">{files.map(name => <li key={name}><span title={name}>{name}</span><button type="button" aria-label={`移除 ${name}`} onClick={() => onRemoveFile(name)}><X size={15} aria-hidden="true" /></button></li>)}</ul>
            ) : (
              <div className="workspace-empty"><p>尚未添加工作文件。</p><span>当前仅暂存文件名，不读取或上传内容；刷新页面后清空。</span></div>
            )}
          </section>
        </div>
      </div>
    </section>
  );
});

WorkflowWorkspace.displayName = 'WorkflowWorkspace';
