import { memo, useEffect, useMemo, useState } from 'react';
import { ArrowClockwise, CheckCircle, FolderOpen, Info, LockKey, ShieldCheck, Wrench, XCircle } from '@phosphor-icons/react';
import { PageBack } from '../../../shared/components/PageBack.jsx';

export const VaultConnection = memo(({ status, structure, onSelect, onRemember, onRestore, onForget, onAddScopeFolder, onRemoveScopeFolder, onAuthorize, onDisconnect, onInspectStructure, onRepairStructure, onBack, busy = false, notice = '' }) => {
  const options = status?.scopeOptions || [];
  const [selectedScopes, setSelectedScopes] = useState(status?.scopes || []);
  const [confirmed, setConfirmed] = useState(false);
  const [localMessage, setLocalMessage] = useState('');
  const [confirmStructureRepair, setConfirmStructureRepair] = useState(false);

  useEffect(() => {
    setSelectedScopes(status?.scopes || []);
  }, [status?.name, status?.scopes?.join(',')]);

  useEffect(() => setConfirmStructureRepair(false), [structure]);

  const availableOptions = useMemo(() => options.filter(option => option.available), [options]);
  const availableIds = new Set(availableOptions.map(option => option.id));
  const selectedScopeIds = selectedScopes.filter(id => availableIds.has(id));
  const selectedCount = selectedScopeIds.length;

  function toggleScope(id, checked) {
    setSelectedScopes(current => checked ? [...new Set([...current, id])] : current.filter(item => item !== id));
    setConfirmed(false);
  }

  async function connect() {
    setLocalMessage('');
    try {
      const nextStatus = await onAuthorize(selectedScopeIds);
      setSelectedScopes(nextStatus.scopes || selectedScopeIds);
      setConfirmed(false);
      setLocalMessage('授权范围已保存在本机工作台内存中。打开研究记录、文献或归档页时，才会读取对应内容。');
    } catch (error) {
      setLocalMessage(error?.message || '保存授权范围失败。');
    }
  }

  async function inspectStructure() {
    setLocalMessage('');
    try {
      await onInspectStructure();
      setConfirmStructureRepair(false);
    } catch (error) {
      setLocalMessage(error?.message || '检查知识库结构失败。');
    }
  }

  async function addExistingFolder(scopeId) {
    setLocalMessage('');
    try {
      const result = await onAddScopeFolder(scopeId);
      if (!result.cancelled) {
        setConfirmed(false);
        setLocalMessage('已关联知识库内的现有文件夹。请核对下方实际路径并重新确认读取范围；原文件没有改动。');
      }
    } catch (error) {
      setLocalMessage(error?.message || '关联已有文件夹失败。');
    }
  }

  async function removeExistingFolder(scopeId, relativePath) {
    setLocalMessage('');
    try {
      await onRemoveScopeFolder(scopeId, relativePath);
      setConfirmed(false);
      setLocalMessage('已移除这项关联；原文件夹和笔记未改动。');
    } catch (error) {
      setLocalMessage(error?.message || '移除文件夹关联失败。');
    }
  }

  async function runMemoryAction(action, success) {
    setLocalMessage('');
    try {
      await action();
      setConfirmed(false);
      setLocalMessage(success);
    } catch (error) { setLocalMessage(error?.message || '保存知识库位置失败。'); }
  }

  async function repairStructure() {
    if (!confirmStructureRepair) return;
    setLocalMessage('');
    try {
      const report = await onRepairStructure();
      setConfirmStructureRepair(false);
      setLocalMessage(`已补齐 ${report.created || 0} 个标准空文件夹；现有笔记和文件没有被移动或修改。`);
    } catch (error) {
      setLocalMessage(error?.message || '补齐标准文件夹失败。');
    }
  }

  return (
    <section className="subpage-view vault-page" aria-labelledby="vault-connection-title">
      <PageBack onBack={onBack} />
      <div className="home-eyebrow">本机资料 · Obsidian</div>
      <h1 id="vault-connection-title">知识库连接</h1>
      <p className="subpage-lede">先选一个 vault，再按用途勾选读取或归档范围。网页不会在选择时扫描内容；读取只在你打开相应页面后发生，数据留在本机。</p>

      <section className="vault-connection" aria-labelledby="vault-connection-status">
        <div className="vault-connection-header">
          <div><span className="panel-kicker">本机 Obsidian</span><h2 id="vault-connection-status">{status?.connected ? '已授权连接' : status?.selected ? '已选择知识库' : '尚未选择知识库'}</h2></div>
          <span className="vault-status-pill">{status?.name || '需要你选择'}</span>
        </div>
        {status?.selected && <p className="vault-selected-path"><strong>已选择的完整路径：</strong><code>{status.path}</code></p>}
        <p>请核对完整路径。读取授权只在本次运行期间有效。若主动保存位置，桌面版会在本机应用数据中记住路径及目录关联；不会写进 Git 或云端，也不会在重启后自动读取笔记。</p>

        <div className="vault-actions">
          <button className="primary-button compact" type="button" onClick={async () => { setLocalMessage(''); try { await onSelect(); setConfirmed(false); } catch (error) { setLocalMessage(error?.message || '选择知识库失败。'); } }} disabled={busy}>
            <FolderOpen size={17} aria-hidden="true" />{busy ? '正在打开文件夹选择器…' : status?.name ? '更换知识库' : '选择 Obsidian 知识库'}
          </button>
          {status?.selected && <button className="text-button vault-disconnect" type="button" onClick={async () => { setSelectedScopes([]); setConfirmed(false); setLocalMessage(''); try { await onDisconnect(); } catch (error) { setLocalMessage(error?.message || '清除本机授权失败。'); } }} disabled={busy}><XCircle size={16} aria-hidden="true" />断开并清除本机授权</button>}
        </div>

        {status?.memoryAvailable && <div className="vault-memory-panel">
          {status.remembered && <p>上次保存的位置：<code>{status.remembered.path}</code></p>}
          <div className="vault-actions">
            {!status.selected && status.remembered && <button className="text-button" type="button" disabled={busy} onClick={() => runMemoryAction(onRestore, '已找回上次的知识库位置。请核对路径并重新勾选读取范围。')}>使用上次知识库</button>}
            {status.selected && <button className="text-button" type="button" disabled={busy} onClick={() => runMemoryAction(onRemember, '已保存当前路径和目录关联；重启后仍须重新授权读取。')}>{status.remembered?.path === status.path ? '更新保存的位置与关联' : '记住当前路径与关联'}</button>}
            {status.remembered && <button className="text-button" type="button" disabled={busy} onClick={() => runMemoryAction(onForget, '已忘记上次保存的位置；没有删除知识库内容。')}>忘记上次路径</button>}
          </div>
        </div>}

        {status?.selected && <section className="vault-structure-panel" aria-labelledby="vault-structure-title">
          <div className="vault-structure-heading">
            <div><strong id="vault-structure-title">检查科研知识库目录</strong><span>只读取目录名称，不打开笔记或附件。</span></div>
            <button className="text-button" type="button" onClick={inspectStructure} disabled={busy}>
              <ArrowClockwise size={15} aria-hidden="true" />{busy ? '正在检查…' : structure ? '重新检查' : '检查结构'}
            </button>
          </div>

          {structure && <div className="vault-structure-report" aria-live="polite">
            {!structure.isLikelyVault && <p className="vault-structure-warning">当前选中的文件夹未识别为已有 Obsidian 科研知识库。为避免在错误位置批量建目录，请先检查并重新选择 vault。</p>}
            {structure.isLikelyVault && <p className="vault-structure-summary">标准目录：{structure.present}/{structure.total} 个匹配{structure.missing.length ? `，缺少 ${structure.missing.length} 个` : '，结构完整'}。这只核对目录名称，不代表旧笔记已进入这些目录。</p>}

            {structure.otherTopLevelDirectories?.length > 0 && <div className="vault-structure-list">
              <strong>知识库根目录下还有这些文件夹</strong>
              <p>以下只显示名称，没有读取笔记。若旧研究资料在其中，可在下方为相应范围逐个关联现有文件夹。</p>
              <ul>{structure.otherTopLevelDirectories.map(item => <li key={item}><code>{item}</code></li>)}</ul>
            </div>}

            {structure.mismatches?.length > 0 && <div className="vault-structure-list">
              <strong>发现名称可能不匹配</strong>
              <ul>{structure.mismatches.map(item => <li key={item.expected}><code>{item.actual}</code><span aria-hidden="true">→</span><code>{item.expected}</code></li>)}</ul>
              <p>工作台不会自动改名或搬动这些目录。可在下方将含有旧笔记的文件夹关联到对应读取范围；无需为读取而改名或搬动原文件。</p>
            </div>}

            {structure.conflicts?.length > 0 && <div className="vault-structure-list is-warning">
              <strong>这些位置有同名文件，无法创建目录</strong>
              <ul>{structure.conflicts.map(item => <li key={item}><code>{item}</code></li>)}</ul>
            </div>}

            {structure.missing.length > 0 && <details className="vault-structure-missing">
              <summary>查看缺少的标准目录（{structure.missing.length}）</summary>
              <ul>{structure.missing.map(item => <li key={item}><code>{item}</code></li>)}</ul>
            </details>}

            {structure.isLikelyVault && structure.repairableCount > 0 && <div className="vault-structure-repair">
              <p><Wrench size={15} aria-hidden="true" />可补齐 {structure.repairableCount} 个缺失的标准空文件夹。不会覆盖、删除或移动已有内容。</p>
              <label className="vault-consent"><input type="checkbox" checked={confirmStructureRepair} disabled={busy} onChange={event => setConfirmStructureRepair(event.target.checked)} /><span>我已核对当前知识库路径，确认在“{status.name}”中创建缺失的标准空文件夹。</span></label>
              <button className="primary-button compact" type="button" onClick={repairStructure} disabled={busy || !confirmStructureRepair}>
                <Wrench size={16} aria-hidden="true" />{busy ? '正在补齐…' : `确认并补齐 ${structure.repairableCount} 个目录`}
              </button>
            </div>}
          </div>}
        </section>}

        {status?.selected && <>
          <div className="vault-scope-heading"><ShieldCheck size={18} aria-hidden="true" /><div><strong>选择允许工作台访问的范围</strong><span>未勾选的目录不会读取。</span></div></div>
          <p className="vault-mapping-intro">旧笔记不在标准目录时，点击对应项目的“关联现有文件夹”，在系统窗口中选择 <strong>{status.name}</strong> 内的具体文件夹。授权后会按需读取该文件夹及其子文件夹的 Markdown。不能选整个知识库；关联后需重新确认该项读取授权。</p>
          {options.length ? <fieldset className="vault-scope-list">
            <legend className="visually-hidden">Obsidian 读取与归档授权范围</legend>
            {options.map(option => (
              <div key={option.id} className="vault-scope-entry">
                <label className={`vault-scope-option${option.available ? '' : ' is-disabled'}`}>
                  <input type="checkbox" checked={selectedScopes.includes(option.id)} disabled={!option.available || busy} onChange={event => toggleScope(option.id, event.target.checked)} />
                  <span className="vault-scope-copy"><strong>{option.label}</strong><small>{option.description}</small>{!option.available && <small className="scope-unavailable">尚未找到对应目录。可在下方关联现有文件夹。</small>}</span>
                  <span className={`scope-mode ${option.mode}`}>{option.mode === 'write' ? '新建' : '只读'}</span>
                </label>
                {option.mode === 'read' && <div className="vault-mapping-controls">
                  <button className="text-button" type="button" onClick={() => addExistingFolder(option.id)} disabled={busy}><FolderOpen size={15} aria-hidden="true" />关联现有文件夹</button>
                  {option.mappedPaths?.map(relativePath => <div className="vault-mapped-path" key={relativePath}><code>{relativePath}</code><button className="text-button" type="button" onClick={() => removeExistingFolder(option.id, relativePath)} disabled={busy} aria-label={`移除 ${option.label} 中的 ${relativePath} 关联`}>移除关联</button></div>)}
                </div>}
                <details className="vault-scope-paths"><summary>查看实际{option.mode === 'write' ? '新建' : '读取'}位置</summary><ul>{option.fullPaths?.map(item => <li key={item}><code>{item}</code></li>)}</ul></details>
              </div>
            ))}
          </fieldset> : <div className="vault-empty-scopes">当前文件夹中没有找到工作台支持的科研目录。不会自动改动或创建你的知识库结构。</div>}

          {selectedCount > 0 && <label className="vault-consent"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} /><span>我已确认以上目录属于本次授权范围，允许工作台按所选权限在本机读取或新建文件。所选范围将显示在上方。</span></label>}
          <button className="primary-button vault-authorize" type="button" onClick={connect} disabled={busy || selectedCount === 0 || !confirmed}>
            <CheckCircle size={17} aria-hidden="true" />{busy ? '正在保存…' : status?.connected ? '更新授权范围' : '授权所选范围并连接'}
          </button>
        </>}

        {(notice || localMessage) && <p className={`vault-feedback${/失败|无效|不可用/.test(localMessage) ? ' is-error' : ''}`} role="status">{localMessage || notice}</p>}
        <div className="connection-explainer"><Info size={18} aria-hidden="true" /><div><strong>每项范围的边界</strong><p>只读取已授权标准目录、明确关联的文件夹及列出的 RSS 缓存；不会读取其他目录、图片附件或其他插件数据。归档范围只会在“历史归档”中创建新笔记，不覆盖、不删除已有内容。</p></div></div>
        <div className="vault-local-note"><LockKey size={15} aria-hidden="true" />授权仅在当前本机工作台服务运行期间有效；断开会立即清除本次连接和授权。保存过的位置可另行“忘记”。</div>
      </section>
    </section>
  );
});

VaultConnection.displayName = 'VaultConnection';
