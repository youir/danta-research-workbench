import { useEffect, useState, useSyncExternalStore } from 'react';

const STORAGE_PREFIX = 'danta-workbench:v2:';
const LEGACY_SESSION_PREFIX = 'danta-workbench:v1:';
let storageError = '';
const failedKeys = new Set();
const storageListeners = new Set();

function reportStorageError(key) {
  failedKeys.add(key);
  if (storageError) return;
  storageError = '本机自动保存失败。请立即导出任务备份；在修复浏览器存储前，关闭工作台可能丢失本次修改。';
  for (const listener of storageListeners) listener();
}

function clearStorageError(key) {
  failedKeys.delete(key);
  if (failedKeys.size || !storageError) return;
  storageError = '';
  for (const listener of storageListeners) listener();
}

export function useStorageHealth() {
  return useSyncExternalStore(
    listener => { storageListeners.add(listener); return () => storageListeners.delete(listener); },
    () => storageError,
    () => '',
  );
}

export function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const saved = window.localStorage.getItem(`${STORAGE_PREFIX}${key}`);
      if (saved !== null) return JSON.parse(saved);
      const legacy = window.sessionStorage.getItem(`${LEGACY_SESSION_PREFIX}${key}`);
      return legacy === null ? initialValue : JSON.parse(legacy);
    } catch {
      reportStorageError(key);
      return initialValue;
    }
  });

  useEffect(() => {
    try { window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value)); clearStorageError(key); }
    catch { reportStorageError(key); }
  }, [key, value]);

  return [value, setValue];
}
