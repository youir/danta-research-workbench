import { useCallback, useEffect, useRef, useState } from 'react';
import { forgetArtifactRoot, getArtifactStatus, selectArtifactRoot } from './artifactApi.js';

export function useArtifactConnection() {
  const [status, setStatus] = useState({ connected: false, selected: false, root: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const revision = useRef(0);
  const lock = useRef(false);
  const refresh = useCallback(async () => {
    if (lock.current) return;
    lock.current = true; const request = ++revision.current;
    setBusy(true); setError('');
    try { const result = await getArtifactStatus(); if (request === revision.current) setStatus(result); return result; }
    catch (error) { if (request === revision.current) setError(error.message); }
    finally { lock.current = false; if (request === revision.current) setBusy(false); }
  }, []);
  useEffect(() => { const request = ++revision.current; getArtifactStatus().then(result => { if (request === revision.current) setStatus(result); }).catch(error => { if (request === revision.current) setError(error.message); }); return () => { revision.current += 1; }; }, []);
  async function run(action) {
    if (lock.current) return;
    lock.current = true; const request = ++revision.current;
    setBusy(true); setError('');
    try { const result = await action(); if (request !== revision.current) return; if (result.status) setStatus(result.status); else if ('connected' in result) setStatus(result); }
    catch (error) { if (request === revision.current) setError(error.message); }
    finally { lock.current = false; if (request === revision.current) setBusy(false); }
  }
  return { status, busy, error, refresh, select: () => run(selectArtifactRoot), forget: () => run(forgetArtifactRoot) };
}
