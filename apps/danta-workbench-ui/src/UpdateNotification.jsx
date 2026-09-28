import { useVersionCheck } from './hooks/useVersionCheck';

export function UpdateNotification() {
  const { updateAvailable, newVersion, dismissUpdate, applyUpdate } = useVersionCheck();

  if (!updateAvailable) return null;

  return (
    <div className="update-notification" role="alert">
      <div className="update-content">
        <span className="update-icon">🎉</span>
        <div className="update-text">
          <strong>发现新版本 {newVersion}</strong>
          <span>点击更新以获得最新功能和修复</span>
        </div>
      </div>
      <div className="update-actions">
        <button
          className="update-dismiss"
          type="button"
          onClick={dismissUpdate}
          aria-label="稍后提醒"
        >
          稍后
        </button>
        <button
          className="update-apply"
          type="button"
          onClick={applyUpdate}
        >
          立即更新
        </button>
      </div>
    </div>
  );
}
