import { useEffect, useState } from 'react';
import { getVaultData } from '../utils/localApi.js';

export function useVaultSection(section, enabled) {
  const [state, setState] = useState({ data: null, loading: false, error: '' });

  useEffect(() => {
    let active = true;
    if (!enabled) {
      setState({ data: null, loading: false, error: '' });
      return () => { active = false; };
    }
    setState(current => ({ ...current, loading: true, error: '' }));
    getVaultData(section).then(data => {
      if (active) setState({ data, loading: false, error: '' });
    }).catch(error => {
      if (active) setState({ data: null, loading: false, error: error?.message || '读取本机知识库失败。' });
    });
    return () => { active = false; };
  }, [section, enabled]);

  return state;
}
