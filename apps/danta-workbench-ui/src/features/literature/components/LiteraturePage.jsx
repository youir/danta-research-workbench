import { memo } from 'react';
import { ArrowRight, BookOpenText } from '@phosphor-icons/react';

export const LiteraturePage = memo(({ onOpenVault }) => (
  <section className="subpage-view" aria-labelledby="literature-title">
    <div className="home-eyebrow">来源可追溯</div>
    <h1 id="literature-title">文献与信息源</h1>
    <p className="subpage-lede">RSS 线索先由龚博士复核，再决定是否进入正式文献记录。</p>
    <div className="empty-state">
      <BookOpenText size={30} weight="light" aria-hidden="true" />
      <h2>网页尚未连接 RSS 数据</h2>
      <p>RSS 收集和工作台面板目前运行在 Obsidian 插件中；本地网页不会读取缓存或假造条目。</p>
      <button className="text-button" type="button" onClick={onOpenVault}>查看知识库状态 <ArrowRight size={16} aria-hidden="true" /></button>
    </div>
  </section>
));

LiteraturePage.displayName = 'LiteraturePage';
