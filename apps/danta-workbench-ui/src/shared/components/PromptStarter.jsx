import { memo } from 'react';

export const PromptStarter = memo(({
  id,
  label,
  detail,
  onClick,
  ariaKeyshortcuts
}) => (
  <button
    className="prompt-starter"
    onClick={() => onClick(id)}
    aria-keyshortcuts={ariaKeyshortcuts}
    type="button"
  >
    <span className="starter-title">{label}</span>
    <span className="starter-detail">{detail}</span>
  </button>
));

PromptStarter.displayName = 'PromptStarter';
