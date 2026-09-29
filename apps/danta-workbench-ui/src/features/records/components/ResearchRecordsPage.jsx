import { memo } from 'react';
import { ArrowRight, ClockCounterClockwise, FolderOpen, Notebook } from '@phosphor-icons/react';
import { PageBack } from '../../../shared/components/PageBack.jsx';
import { useVaultSection } from '../../../shared/hooks/useVaultSection.js';

function dateLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '日期未注明' : new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

export const ResearchRecordsPage = memo(({ onOpenVault, onBack, canRead = false }) => {
  const { data, loading, error } = useVaultSection('records', canRead);
  const files = data?.files || [];

  return (
    <section className="subpage-view data-page" aria-labelledby="records-title">
      <PageBack onBack={onBack} />
      <div className="home-eyebrow">持续研究</div>
      <h1 id="records-title">研究记录</h1>
      <p className="subpage-lede">只读展示已授权的课题和组会 Markdown。记录内容仍由龚博士在 Obsidian 中维护。</p>

      {!canRead ? <div className="empty-state data-empty-state"><Notebook size={30} weight="light" aria-hidden="true" /><h2>需要授权研究记录范围</h2><p>授权后，本页只读取 <code>05_课题项目_Projects/</code> 和 <code>10_日志复盘_Journal/</code> 中的 Markdown 文件。</p><button className="text-button" type="button" onClick={onOpenVault}>设置知识库范围 <ArrowRight size={16} aria-hidden="true" /></button></div>
        : loading ? <div className="data-loading" role="status">正在读取授权的研究记录…</div>
          : error ? <div className="empty-state data-empty-state"><Notebook size={30} weight="light" aria-hidden="true" /><h2>暂时无法读取</h2><p>{error}</p><button className="text-button" type="button" onClick={onOpenVault}>检查授权 <ArrowRight size={16} aria-hidden="true" /></button></div>
            : files.length ? <>
              <div className="data-list-heading"><strong>{files.length} 条本机记录</strong><span>按最近修改时间排列</span></div>
              <div className="vault-record-list">{files.map(file => <article className="vault-record-card" key={file.path}>
                <div className="vault-record-meta"><span><ClockCounterClockwise size={14} aria-hidden="true" />{dateLabel(file.date)}</span><code>{file.path}</code></div>
                <h2>{file.title}</h2>
                {file.excerpt && <p>{file.excerpt}</p>}
              </article>)}</div>
              {data.truncated && <p className="data-limit-note">已达到本次读取的文件数量或体积上限。收窄知识库中的目录后再查看剩余记录。</p>}
            </> : <div className="empty-state data-empty-state"><Notebook size={30} weight="light" aria-hidden="true" /><h2>授权范围内还没有 Markdown 记录</h2><p>创建记录后，重新打开本页即可查看。</p><button className="text-button" type="button" onClick={onOpenVault}>查看授权目录 <FolderOpen size={16} aria-hidden="true" /></button></div>}
    </section>
  );
});

ResearchRecordsPage.displayName = 'ResearchRecordsPage';
