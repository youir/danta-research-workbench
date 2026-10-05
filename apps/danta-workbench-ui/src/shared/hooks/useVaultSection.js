import { useEffect, useState } from 'react';
import { getVaultData } from '../utils/localApi.js';

export function useVaultSection(section, enabled, identity = '') {
  const [state, setState] = useState({ data: null, loading: false, error: '', identity });

  useEffect(() => {
    let active = true;
    if (!enabled) {
      setState({ data: null, loading: false, error: '', identity });
      return () => { active = false; };
    }
    setState({ data: null, loading: true, error: '', identity });
    getVaultData(section).then(data => {
      if (active) setState({ data, loading: false, error: '', identity });
    }).catch(error => {
      if (active) setState({ data: null, loading: false, error: error?.message || '读取本机知识库失败。', identity });
    });
    return () => { active = false; };
  }, [section, enabled, identity]);

  return enabled && state.identity === identity ? state : { data: null, loading: enabled, error: '' };
}
