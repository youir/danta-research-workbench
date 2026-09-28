import { memo } from 'react';
import { FolderOpen } from '@phosphor-icons/react';

export const VaultConnection = memo(({
  vaultName,
  vaultStatus,
  onPickerChange,
  pickerRef
}) => (
  <section className="vault-connection" aria-labelledby="vault-title">
    <div className="vault-connection-header">
      <h2 id="vault-title">知识库连接</h2>
      <span className="vault-status">{vaultStatus}</span>
    </div>
    <p>
      工作台只读取你选择的 Obsidian 知识库,不上传笔记,不扫描其他目录。
      研究记录持续归档,下次对话从这里接续。
    </p>
    <label className="vault-picker-label">
      <input
        ref={pickerRef}
        type="file"
        className="visually-hidden"
        onChange={onPickerChange}
        aria-label="选择知识库目录"
      />
      <span className="vault-picker-button">
        <FolderOpen size={18} aria-hidden="true" />
        {vaultName ? '重新选择知识库' : '选择知识库'}
      </span>
    </label>
    {vaultName && (
      <div className="vault-info">
        <strong>当前知识库:</strong>
        <code>{vaultName}</code>
      </div>
    )}
  </section>
));

VaultConnection.displayName = 'VaultConnection';
