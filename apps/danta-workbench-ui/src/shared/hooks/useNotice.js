import { useState, useRef, useEffect, useCallback } from 'react';

export function useNotice(duration = 3200) {
  const [notice, setNotice] = useState({ message: '', type: 'info' });
  const timerRef = useRef(null);
  const isMountedRef = useRef(true);

  const show = useCallback((message, type = 'info') => {
    if (!isMountedRef.current) return;

    setNotice({ message, type });
    clearTimeout(timerRef.current);

    if (duration > 0) {
      timerRef.current = setTimeout(() => {
        if (isMountedRef.current) setNotice({ message: '', type: 'info' });
      }, duration);
    }
  }, [duration]);

  const hide = useCallback(() => {
    if (!isMountedRef.current) return;
    clearTimeout(timerRef.current);
    setNotice({ message: '', type: 'info' });
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      clearTimeout(timerRef.current);
    };
  }, []);

  return [notice, show, hide];
}
