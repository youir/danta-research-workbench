import { memo } from 'react';
import { FolderOpen, Info } from '@phosphor-icons/react';

export const VaultConnection = memo(({ vaultName, vaultStatus, onPickerChange, pickerRef }) => (
  <section className="vault-connection" aria-labelledby="vault-connection-title">
    <div className="vault-connection-header"><div><span className="panel-kicker">Obsidian · GY</span><h2 id="vault-connection-title">知识库状态</h2></div><span className="vault-status-pill">{vaultStatus}</span></div>
    <p>选择 GY 文件夹后，网页只显示文件夹名称。当前版本没有读取、扫描、上传或写入知识库的功能。</p>
    <input ref={pickerRef} type="file" className="visually-hidden" onChange={onPickerChange} aria-label="选择 GY 知识库文件夹" />
    <button className="secondary-button" type="button" onClick={() => pickerRef.current?.click()}><FolderOpen size={18} aria-hidden="true" />{vaultName ? '重新选择文件夹' : '选择 GY 文件夹'}</button>
    {vaultName && <div className="vault-info"><strong>已选择名称</strong><code>{vaultName}</code></div>}
    <div className="connection-explainer"><Info size={18} aria-hidden="true" /><div><strong>记录如何接入</strong><p>研究记录、RSS 面板和归档目前在 Obsidian 知识库与插件中维护，尚未同步到本机网页。要接入网页，需要另行实现并由龚博士确认授权范围。</p></div></div>
  </section>
));

VaultConnection.displayName = 'VaultConnection';
