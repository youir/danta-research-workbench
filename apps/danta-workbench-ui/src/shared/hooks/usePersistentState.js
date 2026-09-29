import { useEffect, useState } from 'react';

const STORAGE_PREFIX = 'danta-workbench:v2:';
const LEGACY_SESSION_PREFIX = 'danta-workbench:v1:';

export function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const saved = window.localStorage.getItem(`${STORAGE_PREFIX}${key}`);
      if (saved !== null) return JSON.parse(saved);
      const legacy = window.sessionStorage.getItem(`${LEGACY_SESSION_PREFIX}${key}`);
      return legacy === null ? initialValue : JSON.parse(legacy);
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try { window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value)); }
    catch { /* Keep editing available if local browser storage is disabled or full. */ }
  }, [key, value]);

  return [value, setValue];
}
