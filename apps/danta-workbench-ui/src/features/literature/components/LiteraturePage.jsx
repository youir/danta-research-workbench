import { memo, useMemo, useState } from 'react';
import { ArrowSquareOut, ArrowRight, BookOpenText, Rss } from '@phosphor-icons/react';
import { PageBack } from '../../../shared/components/PageBack.jsx';
import { useVaultSection } from '../../../shared/hooks/useVaultSection.js';
import { usePersistentState } from '../../../shared/hooks/usePersistentState.js';

function dateLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '发布日期未注明' : new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

export const LiteraturePage = memo(({ onOpenVault, onBack, canReadRss = false, canReadLiterature = false }) => {
  const rss = useVaultSection('rss', canReadRss);
  const literature = useVaultSection('literature', canReadLiterature);
  const [filter, setFilter] = usePersistentState('literatureFilter', 'all');
  const [search, setSearch] = usePersistentState('literatureSearch', '');
  const [seedPmid, setSeedPmid] = usePersistentState('linkedDiscoveriesPmid', '');
  const [linkedDiscoveriesError, setLinkedDiscoveriesError] = useState('');
  const items = rss.data?.items || [];
  const visibleItems = useMemo(() => items.filter(item => {
    if (filter === 'unread' && item.read) return false;
    if (filter === 'favorites' && !item.favorite) return false;
    const needle = search.trim().toLocaleLowerCase();
    return !needle || `${item.title} ${item.source} ${item.excerpt}`.toLocaleLowerCase().includes(needle);
  }), [items, filter, search]);
  const notes = literature.data?.files || [];

  function openLinkedDiscoveries(event) {
    event.preventDefault();
    const pmid = seedPmid.trim();
    if (!/^\d{1,12}$/.test(pmid)) {
      setLinkedDiscoveriesError('请输入数字型 PMID。');
      return;
    }
    setLinkedDiscoveriesError('');
    window.open(`https://linkeddiscoveries.ncbi.nlm.nih.gov/${pmid}/`, '_blank', 'noopener,noreferrer');
  }

  return (
    <section className="subpage-view data-page" aria-labelledby="literature-title">
      <PageBack onBack={onBack} />
      <div className="home-eyebrow">来源可追溯</div>
      <h1 id="literature-title">文献与信息源</h1>
      <p className="subpage-lede">查看 Obsidian 已缓存的 RSS 线索和文献笔记，或按 PMID 手动打开 NLM 的文献脉络图。本页的文献与 RSS 列表只读缓存；打开 Linked Discoveries 时只用所填 PMID 查询，不附带本地文献资料。</p>

      <section className="linked-discoveries-panel literature-note-section" aria-labelledby="linked-discoveries-heading">
        <div className="data-section-heading"><div><span className="panel-kicker">PubMed 文献脉络</span><h2 id="linked-discoveries-heading"><BookOpenText size={18} aria-hidden="true" />Linked Discoveries</h2></div></div>
        <p className="linked-discoveries-description">输入关键论文的 PMID，打开 NLM 文献关系图，查看相关论文、前后引文、主题及出版更新。</p>
        <form className="linked-discoveries-form" onSubmit={openLinkedDiscoveries} noValidate>
          <label htmlFor="linked-discoveries-pmid">种子论文 PMID</label>
          <div className="linked-discoveries-input-row">
            <input id="linked-discoveries-pmid" type="text" inputMode="numeric" pattern="[0-9]+" value={seedPmid} onChange={event => { setSeedPmid(event.target.value); setLinkedDiscoveriesError(''); }} placeholder="例如 29096998" aria-describedby="linked-discoveries-note" required />
            <button className="secondary-button" type="submit">打开图谱 <ArrowSquareOut size={15} aria-hidden="true" /></button>
          </div>
          {linkedDiscoveriesError && <p className="linked-discoveries-error" role="alert">{linkedDiscoveriesError}</p>}
        </form>
        <p id="linked-discoveries-note" className="linked-discoveries-note">点击后会将所填的公开 PMID 发给 NLM；须为符合条件且带摘要的 PubMed 记录。该工具处于试验阶段，只用于发现线索；引文可能不全，也不判断研究质量或复现成败。请回到 PubMed 和原文核实。<a href="https://linkeddiscoveries.ncbi.nlm.nih.gov/userguide/" target="_blank" rel="noreferrer">查看 NLM 使用说明 <ArrowSquareOut size={12} aria-hidden="true" /></a></p>
      </section>

      {!canReadRss && !canReadLiterature ? <div className="empty-state data-empty-state"><BookOpenText size={30} weight="light" aria-hidden="true" /><h2>需要授权文献或 RSS 读取范围</h2><p>你可以分别授权 RSS 缓存与文献笔记。未选中的范围不会读取。</p><button className="text-button" type="button" onClick={onOpenVault}>设置知识库范围 <ArrowRight size={16} aria-hidden="true" /></button></div> : <>
        {canReadRss && <section className="rss-workbench" aria-labelledby="rss-heading">
          <div className="data-section-heading"><div><span className="panel-kicker">Obsidian 已有缓存</span><h2 id="rss-heading"><Rss size={18} aria-hidden="true" />科研动态线索</h2></div><span className="vault-status-pill">{rss.data?.feeds?.length ?? '…'} 个来源 · {items.length} 条缓存</span></div>
          {rss.loading && <div className="data-loading" role="status">正在读取已授权的 RSS 缓存…</div>}
          {rss.error && <p className="data-error" role="status">{rss.error}</p>}
          {!rss.loading && !rss.error && rss.data && <>
            <div className="rss-filter-row">
              <div className="segmented-filter" aria-label="筛选 RSS 线索">{[['all', '全部'], ['unread', '未读'], ['favorites', '收藏']].map(([id, label]) => <button key={id} type="button" className={filter === id ? 'is-active' : ''} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div>
              <input className="rss-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索标题或摘要" aria-label="搜索 RSS 线索" />
            </div>
            {visibleItems.length ? <div className="rss-item-list">{visibleItems.map(item => <article className="rss-item-card" key={item.id || `${item.source}-${item.url}`}>
              <div className="rss-item-meta"><span>{item.source || '来源未注明'}</span><span>{dateLabel(item.publishedAt)}</span>{item.favorite && <span className="rss-favorite">已收藏</span>}</div>
              <h3><a href={item.url} target="_blank" rel="noreferrer">{item.title}<ArrowSquareOut size={14} aria-hidden="true" /></a></h3>
              {item.excerpt && <p>{item.excerpt}</p>}
              <div className="rss-item-footer"><span>{item.read ? '已读' : '未读复核'}</span>{item.savedPath && <code>已存入 {item.savedPath}</code>}</div>
            </article>)}</div> : <div className="data-empty-inline">缓存中没有符合当前筛选的线索。打开 Obsidian RSS 插件后可手动更新。</div>}
            {rss.data.truncated && <p className="data-limit-note">RSS 笔记已达到本次读取上限。</p>}
          </>}
        </section>}

        {canReadLiterature && <section className="literature-note-section" aria-labelledby="literature-notes-heading">
          <div className="data-section-heading"><div><span className="panel-kicker">已有 Markdown</span><h2 id="literature-notes-heading"><BookOpenText size={18} aria-hidden="true" />文献阅读笔记</h2></div><span className="vault-status-pill">{notes.length} 条</span></div>
          {literature.loading && <div className="data-loading" role="status">正在读取授权的文献笔记…</div>}
          {literature.error && <p className="data-error" role="status">{literature.error}</p>}
          {!literature.loading && !literature.error && (notes.length ? <div className="vault-record-list">{notes.map(note => <article className="vault-record-card" key={note.path}><div className="vault-record-meta"><span>{dateLabel(note.date)}</span><code>{note.path}</code></div><h3>{note.title}</h3>{note.excerpt && <p>{note.excerpt}</p>}</article>)}</div> : <div className="data-empty-inline">授权范围内还没有文献 Markdown 笔记。</div>)}
        </section>}
      </>}
    </section>
  );
});

LiteraturePage.displayName = 'LiteraturePage';
