import { memo, useEffect, useState } from 'react';
import { Archive, ArrowRight, CheckCircle, ClockCounterClockwise, FilePlus } from '@phosphor-icons/react';
import { PageBack } from '../../../shared/components/PageBack.jsx';
import { useVaultSection } from '../../../shared/hooks/useVaultSection.js';
import { usePersistentState } from '../../../shared/hooks/usePersistentState.js';
import { createVaultArchive } from '../../../shared/utils/localApi.js';

const EMPTY_DRAFT = { title: '', body: '', category: '研究记录' };

function dateLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '日期未注明' : new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

export const ArchivePage = memo(({ onBack, onOpenVault, onCheckpoint, canRead = false, canWrite = false }) => {
  const { data, loading, error } = useVaultSection('archive', canRead);
  const [draft, setDraft] = usePersistentState('archiveDraft', EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [created, setCreated] = useState(null);
  const files = data?.files || [];

  function updateDraft(patch) {
    setDraft(current => ({ ...current, ...patch }));
    onCheckpoint?.();
  }

  useEffect(() => {
    if (created && data?.files?.some(file => file.path === created.path)) setCreated(null);
  }, [created, data?.files]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setFeedback('');
    try {
      const result = await createVaultArchive(draft);
      setCreated(result);
      setDraft(EMPTY_DRAFT);
      setFeedback('已在历史归档中新建文件；原有文件没有修改。');
    } catch (submitError) {
      setFeedback(submitError?.message || '归档写入失败。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="subpage-view data-page archive-page" aria-labelledby="archive-title">
      <PageBack onBack={onBack} />
      <div className="home-eyebrow">留痕与复用</div>
      <h1 id="archive-title">历史归档</h1>
      <p className="subpage-lede">归档操作只会在已授权目录中新建 Markdown，适合收存已结束阶段的复盘、决定与方法记录。</p>

      {canWrite ? <section className="archive-create-panel" aria-labelledby="archive-create-title">
        <div className="data-section-heading"><div><span className="panel-kicker">只新增文件</span><h2 id="archive-create-title"><FilePlus size={19} aria-hidden="true" />创建归档记录</h2></div><span className="scope-mode write">新建</span></div>
        <p className="archive-path-note">目标位置：<code>14_历史归档_Archive/工作台归档/</code>。同名文件会自动加序号，不会覆盖。</p>
        <form className="archive-form" onSubmit={submit}>
          <label>标题<input required maxLength={240} value={draft.title} onChange={event => updateDraft({ title: event.target.value })} placeholder="例如：2026 年 9 月组会阶段复盘" /></label>
          <label>记录类型<select value={draft.category} onChange={event => updateDraft({ category: event.target.value })}><option>研究记录</option><option>组会复盘</option><option>阶段决定</option><option>方法记录</option><option>其他</option></select></label>
          <label>归档内容<textarea required maxLength={60_000} rows={7} value={draft.body} onChange={event => updateDraft({ body: event.target.value })} placeholder="粘贴已核实的讨论结论、研究记录或方法说明。不要把尚未确认的推断写成事实。" /></label>
          <div className="archive-form-footer"><span>草稿保存在此浏览器本机，可离开页面后继续。</span><button className="primary-button compact" type="submit" disabled={busy || !draft.title.trim() || !draft.body.trim()}><Archive size={17} aria-hidden="true" />{busy ? '正在新建…' : '写入历史归档'}</button></div>
        </form>
        {feedback && <p className="archive-feedback" role="status"><CheckCircle size={16} aria-hidden="true" />{feedback}{created && <code>{created.path}</code>}</p>}
      </section> : <div className="empty-state data-empty-state"><Archive size={30} weight="light" aria-hidden="true" /><h2>新建归档需要单独授权</h2><p>工作台只会新建 Markdown 文件。请在知识库设置中勾选“新建归档”，并确认写入边界。</p><button className="text-button" type="button" onClick={onOpenVault}>设置归档授权 <ArrowRight size={16} aria-hidden="true" /></button></div>}

      {canRead ? <section className="archive-list-section" aria-labelledby="archive-list-title">
        <div className="data-section-heading"><div><span className="panel-kicker">已授权只读</span><h2 id="archive-list-title"><ClockCounterClockwise size={18} aria-hidden="true" />现有归档</h2></div><span className="vault-status-pill">{files.length} 条</span></div>
        {loading && <div className="data-loading" role="status">正在读取已授权的归档…</div>}
        {error && <p className="data-error" role="status">{error}</p>}
        {!loading && !error && (files.length ? <div className="vault-record-list">{files.map(file => <article className="vault-record-card" key={file.path}><div className="vault-record-meta"><span>{dateLabel(file.date)}</span><code>{file.path}</code></div><h3>{file.title}</h3>{file.excerpt && <p>{file.excerpt}</p>}</article>)}</div> : <div className="data-empty-inline">授权范围内还没有 Markdown 归档。</div>)}
      </section> : <button className="text-button archive-read-link" type="button" onClick={onOpenVault}>如需浏览已有归档，另行启用“查看历史归档”只读范围 <ArrowRight size={15} aria-hidden="true" /></button>}
    </section>
  );
});

ArchivePage.displayName = 'ArchivePage';
