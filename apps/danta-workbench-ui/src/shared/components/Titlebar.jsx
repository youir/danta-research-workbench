import { memo } from 'react';

export const Titlebar = memo(() => (
  <header className="titlebar">
    <h1>龚博士科研工作台</h1>
    <p>思维优先 · 决策在人</p>
  </header>
));

Titlebar.displayName = 'Titlebar';
