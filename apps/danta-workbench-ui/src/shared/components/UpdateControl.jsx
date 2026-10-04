import { DESKTOP_MAINTENANCE_PROMPT } from '../utils/maintenancePrompt.js';
import { useEffect, useRef, useState } from 'react';
import { ArrowClockwise, ArrowSquareOut, Check, Copy, X } from '@phosphor-icons/react';

const REPOSITORY = 'https://github.com/youir/danta-research-workbench';
const RELEASE_API = 'https://api.github.com/repos/youir/danta-research-workbench/releases?per_page=100';
const UPDATE_PROMPT = '请检查并安全更新当前 danta-research-workbench 仓库的网页前端：先查看当前分支、工作区和未提交修改，再比较 GitHub main；保留本地改动，有覆盖或冲突风险先停下说明。更新后运行 apps/danta-workbench-ui 的 npm run check 并打开本机网页。不要扫描 GY 或其他研究资料。';
const IS_DESKTOP_APP = __IS_DESKTOP_BUILD__;

function localCommit() {
  return typeof __APP_COMMIT__ === 'undefined' ? '' : __APP_COMMIT__;
}

function hasLocalChanges() {
  return typeof __APP_HAS_LOCAL_CHANGES__ !== 'undefined' && __APP_HAS_LOCAL_CHANGES__;
}

function compareVersions(left, right) {
  const parts = value => String(value || '').replace(/^v/i, '').split(/[.+-]/).slice(0, 3).map(Number);
  const a = parts(left);
  const b = parts(right);
  for (let index = 0; index < 3; index += 1) {
    const difference = (a[index] || 0) - (b[index] || 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
}

export function UpdateControl() {
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const closeButtonRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    closeButtonRef.current?.focus();
    const closeOnEscape = event => {
      if (event.key === 'Escape') setOpen(false);
    };
    const trapTab = event => {
      if (event.key !== 'Tab') return;
      const controls = [...(dialogRef.current?.querySelectorAll('button:not([disabled]), a[href]') || [])];
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('keydown', trapTab);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('keydown', trapTab);
    };
  }, [open]);

  async function checkForUpdates() {
    setOpen(true);
    setChecking(true);
    setCopied(false);
    setResult({ state: 'checking' });
    try {
      if (IS_DESKTOP_APP) {
        const response = await fetch(RELEASE_API, {
          cache: 'no-store',
          headers: { Accept: 'application/vnd.github+json' },
        });
        if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
        const releases = await response.json();
        const release = Array.isArray(releases)
          ? releases.filter(item => /^workbench-v\d+\.\d+\.\d+/i.test(item.tag_name || '') && !item.draft && !item.prerelease)
            .reduce((latest, item) => !latest || compareVersions(item.tag_name.replace(/^workbench-v/i, ''), latest.tag_name.replace(/^workbench-v/i, '')) > 0 ? item : latest, null)
          : null;
        if (!release) throw new Error('No desktop release found');
        const current = __APP_VERSION__;
        const latest = String(release.tag_name || '').replace(/^workbench-v/i, '');
        const installer = release.assets?.find(asset => /-x64-Setup\.exe$/i.test(asset.name));
        setResult({
          state: compareVersions(latest, current) > 0 ? 'desktop-update' : 'desktop-current',
          current,
          latest,
          releaseUrl: release.html_url || `${REPOSITORY}/releases`,
          downloadUrl: installer?.browser_download_url || release.html_url || `${REPOSITORY}/releases`,
        });
        return;
      }
      const response = await fetch('https://api.github.com/repos/youir/danta-research-workbench/commits/main', {
        cache: 'no-store',
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
      const latest = await response.json();
      const current = localCommit();
      const dirty = hasLocalChanges();
      setResult({
        state: current && current === latest.sha ? (dirty ? 'local-changes' : 'current') : current ? (dirty ? 'update-local-changes' : 'update') : 'unknown',
        current,
        latest: latest.sha,
        dirty,
        message: latest.commit?.message?.split('\n')[0] || '',
      });
    } catch {
      setResult({ state: 'error' });
    } finally {
      setChecking(false);
    }
  }

  async function copyUpdatePrompt() {
    try {
      await navigator.clipboard.writeText(IS_DESKTOP_APP ? DESKTOP_MAINTENANCE_PROMPT : UPDATE_PROMPT);
      setCopied(true);
    } catch {
      setCopied(false);
      setResult(current => ({ ...current, copyFailed: true }));
    }
  }

  return (
    <>
      <button className="update-trigger" type="button" onClick={checkForUpdates} aria-label="检查 GitHub 更新">
        <ArrowClockwise size={16} aria-hidden="true" />检查更新
      </button>
      {open && (
        <div className="update-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section ref={dialogRef} className="update-dialog" role="dialog" aria-modal="true" aria-labelledby="update-title" onMouseDown={event => event.stopPropagation()}>
            <div className="update-heading"><div><span className="panel-kicker">{IS_DESKTOP_APP ? 'GitHub · 桌面版发布' : 'GitHub · main'}</span><h2 id="update-title">检查工作台更新</h2></div><button ref={closeButtonRef} type="button" className="dialog-close" aria-label="关闭" onClick={() => setOpen(false)}><X size={18} aria-hidden="true" /></button></div>
            {checking && <p className="update-state">{IS_DESKTOP_APP ? '正在检查最新桌面版…' : '正在检查公开仓库的最新提交…'}</p>}
            {result?.state === 'desktop-current' && <div className="update-state success"><Check size={18} aria-hidden="true" /><span>当前桌面版 v{result.current} 已是最新版本。</span></div>}
            {result?.state === 'desktop-update' && <div className="update-state available"><strong>发现桌面版更新：v{result.latest}</strong><span>当前版本 v{result.current}。下载 Windows 安装包并运行即可更新。</span><a href={result.downloadUrl} target="_blank" rel="noreferrer">下载更新安装包 <ArrowSquareOut size={14} aria-hidden="true" /></a><a href={result.releaseUrl} target="_blank" rel="noreferrer">查看更新说明 <ArrowSquareOut size={14} aria-hidden="true" /></a></div>}
            {result?.state === 'current' && <div className="update-state success"><Check size={18} aria-hidden="true" /><span>当前网页对应的提交已是 GitHub main 最新版本。</span></div>}
            {result?.state === 'local-changes' && <div className="update-state available"><strong>本机有尚未提交的修改</strong><span>当前提交与 GitHub main 一致，但工作区有本地改动；请让 Codex 先核对这些改动，再判断是否需要更新。</span></div>}
            {result?.state === 'update' && <div className="update-state available"><strong>GitHub main 有更新</strong><span>最新提交：{result.latest.slice(0, 7)} · {result.message}</span><a href={`${REPOSITORY}/commit/${result.latest}`} target="_blank" rel="noreferrer">查看提交 <ArrowSquareOut size={14} aria-hidden="true" /></a></div>}
            {result?.state === 'update-local-changes' && <div className="update-state available"><strong>远端有更新，本机也有未提交修改</strong><span>最新提交：{result.latest.slice(0, 7)} · {result.message}。复制更新指令后，Codex 会先查看本地修改再处理。</span><a href={`${REPOSITORY}/commit/${result.latest}`} target="_blank" rel="noreferrer">查看提交 <ArrowSquareOut size={14} aria-hidden="true" /></a></div>}
            {result?.state === 'unknown' && <p className="update-state">已查到 GitHub main 最新提交（{result.latest.slice(0, 7)}），但当前运行环境没有本地 Git 提交号，无法自动比较。</p>}
            {result?.state === 'error' && <p className="update-state">{IS_DESKTOP_APP ? '暂时无法连接 GitHub 检查桌面版更新，请稍后重试。' : '暂时无法连接 GitHub。你可以让 Codex 在本机仓库中检查更新。'}</p>}
            <div className="update-help"><p>{IS_DESKTOP_APP ? '安装包更新会保留本机草稿；已有 Obsidian 绑定和有效授权会自动核对恢复；Codex 可协助核对路径并更新研究技能。' : '网页可以检查版本，实际更新需由 Codex 在本机仓库中完成；它会先检查并保留本地修改。'}</p><button className="primary-button compact" type="button" onClick={copyUpdatePrompt}><Copy size={16} aria-hidden="true" />{copied ? '更新指令已复制' : IS_DESKTOP_APP ? '复制更新与路径核对指令' : '复制给 Codex 的更新指令'}</button>{result?.copyFailed && <span className="copy-error">剪贴板不可用，请从部署说明复制更新指令。</span>}</div>
            <a className="update-repo-link" href={IS_DESKTOP_APP ? `${REPOSITORY}/releases` : `${REPOSITORY}/commits/main`} target="_blank" rel="noreferrer">{IS_DESKTOP_APP ? '打开桌面版发布记录' : '打开 GitHub 更新记录'} <ArrowSquareOut size={14} aria-hidden="true" /></a>
          </section>
        </div>
      )}
    </>
  );
}
