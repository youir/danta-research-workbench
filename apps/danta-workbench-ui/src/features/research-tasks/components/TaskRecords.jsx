import { Archive, Plus, Trash } from '@phosphor-icons/react';
import { TASK_RECORD_KINDS, TASK_RECORD_LIMIT } from '../../../shared/utils/taskRecords.js';

function savedAtLabel(timestamp) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? '保存时间未注明' : new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

export function TaskRecords({ task, actions }) {
  if (!actions) return null;
  const records = task.records || [];
  const archives = task.archiveLinks || [];

  return <section className="task-records" aria-label="成果与来源">
    <div className="task-records-heading">
      <div><h3>成果与来源</h3><p>记录文件位置、版本、来源和待解决问题。填写即时保存，接续任务时会带入启动语。</p></div>
      <button type="button" className="secondary-button compact" disabled={records.length >= TASK_RECORD_LIMIT} onClick={actions.add}><Plus size={15} aria-hidden="true" />添加记录</button>
    </div>
    {!records.length && <p className="task-records-empty">可填写已完成的稿件、科研图、分析记录或文献线索。工作台仅保存这些索引，不读取原文件。</p>}
    {records.map((record, index) => <details className="task-record-editor" key={record.id} open>
      <summary>{index + 1}. {record.title || '新阶段记录'}</summary>
      <div className="task-record-fields">
        <label>记录名称<input maxLength={120} value={record.title || ''} onChange={event => actions.update(record.id, 'title', event.target.value)} placeholder="这份材料或本次产物叫什么？" /></label>
        <label>记录类型<select value={record.kind || 'note'} onChange={event => actions.update(record.id, 'kind', event.target.value)}>{TASK_RECORD_KINDS.map(kind => <option key={kind.id} value={kind.id}>{kind.label}</option>)}</select></label>
        <label className="task-record-wide">文件位置或链接<input maxLength={800} value={record.location || ''} onChange={event => actions.update(record.id, 'location', event.target.value)} placeholder="填写原文件路径、知识库相对路径或公开链接" /></label>
        <label>版本<input maxLength={80} value={record.version || ''} onChange={event => actions.update(record.id, 'version', event.target.value)} placeholder="例如 v1、修订日期或分析运行编号" /></label>
        <label>来源与定位<input maxLength={1000} value={record.source || ''} onChange={event => actions.update(record.id, 'source', event.target.value)} placeholder="文献 ID、原始数据编号、页码或图表位置" /></label>
        <label className="task-record-wide">记录与未决问题<textarea rows={2} maxLength={1600} value={record.note || ''} onChange={event => actions.update(record.id, 'note', event.target.value)} placeholder="实际完成了什么、存在什么限制、下一步如何接续？" /></label>
      </div>
      <button type="button" className="text-button task-record-remove" aria-label={`移除记录 ${record.title || index + 1}，保留原文件`} onClick={() => actions.remove(record.id)}><Trash size={14} aria-hidden="true" />移除这条索引</button>
    </details>)}
    {records.length >= TASK_RECORD_LIMIT && <p className="research-task-stage-help">当前任务已登记 {TASK_RECORD_LIMIT} 条记录，可把其他材料整理为一个索引文件后记录其位置。</p>}
    <div className="task-snapshot-actions">
      <p>任何阶段都可保存一份 Obsidian 记录，包含任务内容、成果索引和下一步；每次新建一个版本。</p>
      <button type="button" className="secondary-button" disabled={actions.busy} onClick={actions.canArchive ? actions.archive : actions.openVault}><Archive size={16} aria-hidden="true" />{actions.busy ? '正在保存阶段记录…' : actions.canArchive ? '保存阶段记录到 Obsidian' : '连接知识库并开启归档'}</button>
    </div>
    {archives.length > 0 && <details className="task-archive-history">
      <summary>已保存的阶段记录 · {archives.length} 个版本</summary>
      <ul>{[...archives].reverse().map(archive => <li key={`${archive.path}:${archive.savedAt}`}><span>{archive.vaultName || 'Obsidian'} · {savedAtLabel(archive.savedAt)}</span><code>{archive.path}</code></li>)}</ul>
    </details>}
  </section>;
}
