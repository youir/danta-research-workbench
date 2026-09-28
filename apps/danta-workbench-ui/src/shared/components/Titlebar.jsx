import { memo } from 'react';
import { ArrowSquareOut, Atom } from '@phosphor-icons/react';
import { UpdateControl } from './UpdateControl.jsx';

export const Titlebar = memo(({ guideUrl, frameworkUrl }) => (
  <header className="titlebar">
    <div className="titlebar-brand"><Atom size={25} weight="light" aria-hidden="true" /><div><strong>龚博士科研工作台</strong><small>思维优先 · 决策在人</small></div></div>
    <div className="titlebar-actions">
      <a className="titlebar-link" href={guideUrl} target="_blank" rel="noreferrer">使用说明 <ArrowSquareOut size={14} aria-hidden="true" /></a>
      <a className="titlebar-link" href={frameworkUrl} target="_blank" rel="noreferrer">框架图 <ArrowSquareOut size={14} aria-hidden="true" /></a>
      <UpdateControl />
    </div>
  </header>
));

Titlebar.displayName = 'Titlebar';
