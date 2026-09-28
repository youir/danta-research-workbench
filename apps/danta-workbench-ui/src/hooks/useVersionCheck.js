import { useEffect, useState } from 'react';

const CHECK_INTERVAL = 30 * 60 * 1000; // 30分钟检查一次
const VERSION_FILE = '/version.json';

export function useVersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [newVersion, setNewVersion] = useState('');
  const [currentVersion] = useState(() => {
    // 从构建时注入的版本号读取
    return window.__APP_VERSION__ || '0.1.0';
  });

  useEffect(() => {
    let mounted = true;

    async function checkVersion() {
      if (!mounted) return;

      try {
        const response = await fetch(VERSION_FILE, {
          cache: 'no-cache',
          headers: { 'Cache-Control': 'no-cache' }
        });

        if (!response.ok) return;

        const data = await response.json();
        const serverVersion = data.version;

        if (serverVersion && serverVersion !== currentVersion) {
          setNewVersion(serverVersion);
          setUpdateAvailable(true);
        }
      } catch (error) {
        // 静默失败，不影响正常使用
        console.debug('版本检查失败:', error);
      }
    }

    // 立即检查一次
    checkVersion();

    // 定时检查
    const timer = setInterval(checkVersion, CHECK_INTERVAL);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [currentVersion]);

  function dismissUpdate() {
    setUpdateAvailable(false);
  }

  function applyUpdate() {
    window.location.reload();
  }

  return {
    updateAvailable,
    newVersion,
    currentVersion,
    dismissUpdate,
    applyUpdate
  };
}
