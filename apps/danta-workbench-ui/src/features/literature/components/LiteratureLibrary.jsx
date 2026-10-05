import { usePersistentState } from '../../../shared/hooks/usePersistentState.js';
import { normalizeDoi, normalizePmid, safeLiteratureUrl, READING_STATUSES } from '../../../shared/utils/literatureCards.js';
import { LiteratureReadingPanel } from './LiteratureReadingPanel.jsx';

export function LiteratureLibrary({ library }) {
  const [draft, setDraft] = usePersistentState('literatureDraft', { title: '', identifier: '' });
  const [search, setSearch] = usePersistentState('readingSearch', '');
  const cards = library.cards;
  const card = cards.find(item => item.id === library.selectedId) || null;
  const filtered = cards.filter(item => `${item.title} ${item.doi} ${item.pmid}`.toLowerCase().includes(search.trim().toLowerCase()));
  function addManual(event) {
    event.preventDefault();
    const identifier = draft.identifier.trim();
    const doi = normalizeDoi(identifier), pmid = normalizePmid(identifier), url = safeLiteratureUrl(identifier);
    if (identifier && !doi && !pmid && !url) { library.notice('请填写有效的 DOI、数字型 PMID 或 http(s) 链接。', 'error'); return; }
    const id = library.collect({ title: draft.title, doi, pmid, url: url || (doi ? `https://doi.org/${doi}` : pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : ''), originLabel: '手动线索' }, library.targetTaskId);
    if (id) setDraft({ title: '', identifier: '' });
  }
  return <section className="literature-library" aria-labelledby="reading-heading">
    <div className="data-section-heading"><div><span className="panel-kicker">本机保存 · 关联任务 · 可恢复</span><h2 id="reading-heading">我的阅读</h2></div><span>{cards.length} 张阅读卡</span></div>
    <p className="reading-boundary">已选择的线索单独保留为本机草稿；重开后恢复。原知识库文件保持原位，导出或交接后再归档。</p>
    <details className="reading-manual"><summary>添加 DOI / PMID / 链接，或手动登记线索</summary>
      <form onSubmit={addManual}><label>题名<input maxLength={300} value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} placeholder="尚未取得题名时可先填 DOI / PMID" /></label>
        <label>DOI / PMID / 来源链接<input maxLength={1600} value={draft.identifier} onChange={event => setDraft(current => ({ ...current, identifier: event.target.value }))} placeholder="10.… / PMID 数字 / https://…" /></label>
        <button type="submit" className="primary-button compact">保存线索{library.targetTaskId ? '并关联任务' : ''}</button>
      </form>
    </details>
    <div className="reading-workspace">
      <aside className="reading-list" aria-label="已保存的阅读卡">
        <input type="search" value={search} onChange={event => setSearch(event.target.value)} aria-label="搜索阅读卡" placeholder="搜索题名、DOI 或 PMID" />
        {filtered.length ? filtered.map(item => <button key={item.id} type="button" className={`reading-choice${card?.id === item.id ? ' is-selected' : ''}`} aria-pressed={card?.id === item.id} onClick={() => library.select(item.id)}><strong>{item.title || '题名待填写'}</strong><span>{READING_STATUSES[item.status]}</span>{item.position && <small>停留：{item.position}</small>}{item.nextAction && <small>下一步：{item.nextAction}</small>}</button>) : <p className="data-empty-inline">{cards.length ? '没有符合搜索条件的阅读卡。' : '从待整理线索中选择一条，或在上方添加来源。'}</p>}
      </aside>
      <div>
        {card && library.targetTaskId && !library.tasks.find(task => task.id === library.targetTaskId)?.literatureIds?.includes(card.id) && <button type="button" className="secondary-button reading-attach" onClick={() => library.link(card.id, library.targetTaskId)}>把这张阅读卡加入所选任务</button>}
        {card && cards.some(item => item.id !== card.id && item.title.trim().toLowerCase() === card.title.trim().toLowerCase()) && <p className="reading-boundary">有另一张同题名阅读卡。可能是不同版本，已分别保留，请在 Codex 中核对。</p>}
        <LiteratureReadingPanel card={card} onChange={library.update} tasks={library.tasks} onResumeTask={library.resumeTask} onUnlink={library.unlink} onBegin={library.begin} onRemove={library.remove} />
      </div>
    </div>
  </section>;
}
