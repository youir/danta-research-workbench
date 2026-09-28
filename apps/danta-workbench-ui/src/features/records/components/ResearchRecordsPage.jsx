import { memo } from 'react';
import { ArrowRight, Notebook } from '@phosphor-icons/react';

export const ResearchRecordsPage = memo(({ onOpenVault }) => (
  <section className="subpage-view" aria-labelledby="records-title">
    <div className="home-eyebrow">持续研究</div>
    <h1 id="records-title">研究记录</h1>
    <p className="subpage-lede">想法、证据、决定、组会反馈和产物最终归入龚博士的唯一研究档案。</p>
    <div className="empty-state">
      <Notebook size={30} weight="light" aria-hidden="true" />
      <h2>研究记录尚未连接</h2>
      <p>当前网页不会读取 GY，也不展示演示记录。连接能力接入并由龚博士授权后，才会显示真实内容。</p>
      <button className="text-button" type="button" onClick={onOpenVault}>查看知识库状态 <ArrowRight size={16} aria-hidden="true" /></button>
    </div>
  </section>
));

ResearchRecordsPage.displayName = 'ResearchRecordsPage';
