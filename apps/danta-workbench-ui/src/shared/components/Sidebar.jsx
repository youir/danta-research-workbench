import { memo } from 'react';
import { FolderOpen } from '@phosphor-icons/react';
import { NAV_ITEMS } from '../constants/navigation.js';

export const Sidebar = memo(({ activePage, vaultName, onNavigate }) => (
  <aside className="sidebar">
    <button className="vault-status" type="button" onClick={() => onNavigate('vault')}>
      <span className={`status-dot ${vaultName ? 'selected' : ''}`} aria-hidden="true" />
      <span><strong>{vaultName || 'GY 本机知识库'}</strong><small>{vaultName ? '仅记下文件夹名称' : '尚未选择'}</small></span>
      <FolderOpen size={16} aria-hidden="true" />
    </button>
    <nav className="primary-nav" aria-label="主导航">
      {NAV_ITEMS.map(({ id, label, Icon }) => (
        <button key={id} className={`nav-item ${activePage === id ? 'active' : ''}`} type="button" aria-current={activePage === id ? 'page' : undefined} onClick={() => onNavigate(id)}>
          <Icon size={20} weight={activePage === id ? 'regular' : 'light'} aria-hidden="true" /><span>{label}</span>
        </button>
      ))}
    </nav>
    <div className="sidebar-footer">本机运行 · 私人研究由龚博士掌握</div>
  </aside>
));

Sidebar.displayName = 'Sidebar';
