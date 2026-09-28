import { memo } from 'react';
import { X } from '@phosphor-icons/react';

export const Notice = memo(({ message, type = 'info', onClose }) => {
  if (!message) return null;

  const iconMap = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  return (
    <div className={`notice-toast notice-${type}`} role="alert">
      <span className="notice-icon" aria-hidden="true">
        {iconMap[type] || iconMap.info}
      </span>
      <span className="notice-message">{message}</span>
      {onClose && (
        <button
          className="notice-close"
          onClick={onClose}
          aria-label="关闭通知"
          type="button"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
});

Notice.displayName = 'Notice';
