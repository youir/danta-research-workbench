import { memo, useEffect, useMemo, useState } from 'react';
import { CheckCircle, FolderOpen, Info, LockKey, ShieldCheck, XCircle } from '@phosphor-icons/react';
import { PageBack } from '../../../shared/components/PageBack.jsx';

export const VaultConnection = memo(({ status, onSelect, onAuthorize, onDisconnect, onBack, busy = false, notice = '' }) => {
  const options = status?.scopeOptions || [];
  const [selectedScopes, setSelectedScopes] = useState(status?.scopes || []);
  const [confirmed, setConfirmed] = useState(false);
  const [localMessage, setLocalMessage] = useState('');

  useEffect(() => {
    setSelectedScopes(status?.scopes || []);
  }, [status?.name, status?.scopes?.join(',')]);

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
        <p>文件夹路径和授权只保存在本机桥接进程内存中，不会写进 Git、浏览器存储或云端。工作台退出后，需要重新选择并授权。</p>

        <div className="vault-actions">
          <button className="primary-button compact" type="button" onClick={async () => { setLocalMessage(''); try { await onSelect(); setConfirmed(false); } catch (error) { setLocalMessage(error?.message || '选择知识库失败。'); } }} disabled={busy}>
            <FolderOpen size={17} aria-hidden="true" />{busy ? '正在打开文件夹选择器…' : status?.name ? '更换知识库' : '选择 Obsidian 知识库'}
          </button>
          {status?.selected && <button className="text-button vault-disconnect" type="button" onClick={async () => { setSelectedScopes([]); setConfirmed(false); setLocalMessage(''); try { await onDisconnect(); } catch (error) { setLocalMessage(error?.message || '清除本机授权失败。'); } }} disabled={busy}><XCircle size={16} aria-hidden="true" />断开并清除本机授权</button>}
        </div>

        {status?.selected && <>
          <div className="vault-scope-heading"><ShieldCheck size={18} aria-hidden="true" /><div><strong>选择允许工作台访问的范围</strong><span>未勾选的目录不会读取。</span></div></div>
          {availableOptions.length ? <fieldset className="vault-scope-list">
            <legend className="visually-hidden">Obsidian 读取与归档授权范围</legend>
            {options.map(option => (
              <label key={option.id} className={`vault-scope-option${option.available ? '' : ' is-disabled'}`}>
                <input type="checkbox" checked={selectedScopes.includes(option.id)} disabled={!option.available || busy} onChange={event => toggleScope(option.id, event.target.checked)} />
                <span className="vault-scope-copy"><strong>{option.label}</strong><small>{option.description}</small>{!option.available && <small className="scope-unavailable">此目录尚不存在，当前 vault 无法启用。</small>}</span>
                <span className={`scope-mode ${option.mode}`}>{option.mode === 'write' ? '新建' : '只读'}</span>
              </label>
            ))}
          </fieldset> : <div className="vault-empty-scopes">当前文件夹中没有找到工作台支持的科研目录。不会自动改动或创建你的知识库结构。</div>}

          {selectedCount > 0 && <label className="vault-consent"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} /><span>我已确认以上目录属于本次授权范围，允许工作台按所选权限在本机读取或新建文件。所选范围将显示在上方。</span></label>}
          <button className="primary-button vault-authorize" type="button" onClick={connect} disabled={busy || selectedCount === 0 || !confirmed}>
            <CheckCircle size={17} aria-hidden="true" />{busy ? '正在保存…' : status?.connected ? '更新授权范围' : '授权所选范围并连接'}
          </button>
        </>}

        {(notice || localMessage) && <p className={`vault-feedback${/失败|无效|不可用/.test(localMessage) ? ' is-error' : ''}`} role="status">{localMessage || notice}</p>}
        <div className="connection-explainer"><Info size={18} aria-hidden="true" /><div><strong>每项范围的边界</strong><p>读取范围只允许访问列出的 Markdown 或 RSS 缓存文件；不会读取其他目录、图片附件或隐藏插件数据。归档范围只会在“历史归档”中创建新笔记，不覆盖、不删除已有内容。</p></div></div>
        <div className="vault-local-note"><LockKey size={15} aria-hidden="true" />授权仅在当前本机工作台服务运行期间有效；断开会立即清除路径和授权。</div>
      </section>
    </section>
  );
});

VaultConnection.displayName = 'VaultConnection';
