import { memo } from 'react';
import { NAV_ITEMS } from '../constants/navigation.js';

export const Sidebar = memo(({ activePage, onNavigate }) => (
  <nav className="sidebar" aria-label="主导航">
    <ul className="nav-list">
      {NAV_ITEMS.map(({ id, label, Icon }) => (
        <li key={id}>
          <button
            className={`nav-item ${activePage === id ? 'is-active' : ''}`}
            onClick={() => onNavigate(id)}
            aria-current={activePage === id ? 'page' : undefined}
            type="button"
          >
            <Icon size={20} aria-hidden="true" />
            <span>{label}</span>
          </button>
        </li>
      ))}
    </ul>
  </nav>
));

Sidebar.displayName = 'Sidebar';
