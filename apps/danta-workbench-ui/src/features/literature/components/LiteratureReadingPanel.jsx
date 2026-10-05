import { ArrowSquareOut, DownloadSimple } from '@phosphor-icons/react';
import { readingMarkdown, READING_SCOPES, READING_STATUSES } from '../../../shared/utils/literatureCards.js';

export function LiteratureReadingPanel({ card, onChange, tasks = [], onResumeTask, onUnlink, onBegin, onRemove }) {
  if (!card) return <div className="data-empty-inline">选择一张阅读卡，继续上次的阅读。</div>;
  const linkedTasks = tasks.filter(task => task.literatureIds?.includes(card.id));
  function exportNote() {
    const blob = new Blob([readingMarkdown(card)], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `阅读草稿_${card.title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 70)}_${new Date().toLocaleDateString('sv-SE')}.md`;
    document.body.append(anchor);
    anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="reading-panel" aria-labelledby="reading-card-title">
    <div className="panel-kicker">本机阅读草稿 · 填写即时保存</div>
    <h2 id="reading-card-title">{card.title || '题名待填写'}</h2>
    <p className="reading-boundary">阅读状态由你记录；打开来源或读过日报不代表已读论文。草稿尚未写入知识库。</p>
    <div className="reading-source-actions">
      {card.url && <a className="secondary-button compact" href={card.url} target="_blank" rel="noreferrer">打开来源 <ArrowSquareOut size={15} /></a>}
      <button type="button" className="text-button" onClick={exportNote}><DownloadSimple size={15} />导出阅读草稿</button>
      <button type="button" className="text-button reading-remove" onClick={() => onRemove(card.id)}>删除本机草稿</button>
    </div>
    <div className="reading-identifiers"><span>DOI：{card.doi || '待核实'}</span><span>PMID：{card.pmid || '待核实'}</span></div>
    <div className="reading-fields">
      <label>题名<input maxLength={300} value={card.title} onChange={event => onChange(card.id, 'title', event.target.value)} /></label>
      <div className="reading-field-pair">
        <label>阅读状态<select value={card.status} onChange={event => onChange(card.id, 'status', event.target.value)}>{Object.entries(READING_STATUSES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label>实际阅读范围<select value={card.readScope} onChange={event => onChange(card.id, 'readScope', event.target.value)}>{Object.entries(READING_SCOPES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      </div>
      <label>上次读到哪里<input maxLength={500} value={card.position} onChange={event => onChange(card.id, 'position', event.target.value)} placeholder="章节、页码、图号；若仅摘要请写清楚" /></label>
      <label>下一步想核实什么<input maxLength={1000} value={card.nextAction} onChange={event => onChange(card.id, 'nextAction', event.target.value)} placeholder="例如：核对图 2 的对照和实验方法" /></label>
      <label>阅读笔记<textarea rows={5} maxLength={6000} value={card.notes} onChange={event => onChange(card.id, 'notes', event.target.value)} placeholder="实际结果、原文定位、限制，以及与本次问题的关系。个人推断单列。" /></label>
      <details><summary>来源与版本</summary><label>已核对的版本或出版状态<input maxLength={500} value={card.publicationNote} onChange={event => onChange(card.id, 'publicationNote', event.target.value)} placeholder="尚未核对可留空，不能据留空判断无更正或撤稿" /></label>
        {card.summary && <p className="reading-source-summary"><strong>发现时的线索摘要：</strong>{card.summary}</p>}
        <ul className="reading-origins">{card.origins.map(origin => <li key={origin.key}><span>{origin.label}</span>{origin.notePath && <code>{origin.notePath}</code>}{origin.url && <a href={origin.url} target="_blank" rel="noreferrer">原发现入口 <ArrowSquareOut size={12} /></a>}</li>)}</ul>
      </details>
    </div>
    <div className="reading-linked-tasks"><h3>关联研究任务</h3>
      {linkedTasks.length ? linkedTasks.map(task => <div key={task.id} className="reading-task-link"><button type="button" className="text-button" onClick={() => onResumeTask(task)}>{task.title || task.focus} →</button><button type="button" className="text-button" onClick={() => onBegin(card, task)}>交给 Codex 接续</button><button type="button" className="text-button" onClick={() => onUnlink(card.id, task.id)} aria-label={`取消与任务 ${task.title} 的关联，保留阅读卡`}>取消关联</button></div>) : <><p>尚未关联任务。可在上方选择已有任务后加入，也可以先单独阅读。</p><button type="button" className="secondary-button compact" onClick={() => onBegin(card, null)}>交给 Codex 阅读这篇</button></>}
      <p className="reading-boundary">Codex 接续会携带草稿、实际阅读范围和原笔记位置，按已有有效授权核对并增量归档。</p>
    </div>
  </section>;
}
