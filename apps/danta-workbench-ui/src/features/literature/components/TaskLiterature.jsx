import { READING_STATUSES } from '../../../shared/utils/literatureCards.js';

export function TaskLiterature({ task, actions }) {
  if (!actions) return null;
  const ids = task.literatureIds || [];
  return <section className="task-literature" aria-label="任务相关文献">
    <div className="task-records-heading"><div><h3>相关文献与阅读</h3><p>同篇使用同一张阅读卡；接续时带入阅读位置与下一步。</p></div><button className="secondary-button compact" type="button" onClick={() => actions.open('')}>找文献 / 添加线索</button></div>
    {!ids.length && <p className="task-records-empty">可以从 RSS、日报或已有笔记添加。关联材料不代表论文已读或结论已验证。</p>}
    {ids.map(id => {
      const card = actions.cards.find(item => item.id === id);
      return <div key={id} className="task-literature-row">{card ? <><button type="button" className="text-button" onClick={() => actions.open(id)}>{card.title || '题名待填写'} →</button><span>{READING_STATUSES[card.status]}{card.position ? ` · ${card.position}` : ''}</span>{card.nextAction && <small>下一步：{card.nextAction}</small>}</> : <span>关联阅读卡暂未找到，请恢复包含阅读卡的任务备份。</span>}</div>;
    })}
  </section>;
}
