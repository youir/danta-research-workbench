import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowClockwise, CheckCircle, DownloadSimple, LockKey, UploadSimple, WarningCircle } from '@phosphor-icons/react';
import { PageBack } from '../../../shared/components/PageBack.jsx';
import { VaultConnection } from '../../vault/components/VaultConnection.jsx';
import { ArtifactSettings } from '../../artifacts/ArtifactSettings.jsx';
import { configureJev, forgetJev, getCodexStatus, getJevStatus, verifyJev } from '../../../shared/utils/localApi.js';
import { flushDesktopState, getDesktopBackups, getDesktopStateHealth, restoreDesktopBackup, subscribeDesktopState } from '../../../shared/utils/desktopState.js';

const SECTIONS = [
  { id: 'workspace', label: 'Codex 工作区' },
  { id: 'vault', label: '知识库与授权' },
  { id: 'artifacts', label: '成果与预览' },
  { id: 'jev', label: 'Jev API Key' },
  { id: 'backup', label: '任务备份' },
];

export function SettingsPage({ section, onSectionChange, defaultProjectId, onDefaultProjectChange, vaultProps, artifactConnection, onBack, taskCount = 0, onExportBackup, onImportBackup }) {
  const [codexStatus, setCodexStatus] = useState({ available: false, projects: [] });
  const [codexBusy, setCodexBusy] = useState(false);
  const [codexMessage, setCodexMessage] = useState('');
  const [jevStatus, setJevStatus] = useState({ supported: false, saved: false, verified: false });
  const [jevKey, setJevKey] = useState('');
  const [jevBusy, setJevBusy] = useState(false);
  const [jevMessage, setJevMessage] = useState('');
  const backupInputRef = useRef(null);
  const [backupMessage, setBackupMessage] = useState('');
  const desktopState = useSyncExternalStore(subscribeDesktopState, getDesktopStateHealth, getDesktopStateHealth);
  const [diskBackups, setDiskBackups] = useState([]);
  const [selectedBackup, setSelectedBackup] = useState('');
  const [backupBusy, setBackupBusy] = useState(false);

  async function refreshBackups() {
    setBackupBusy(true);
    try { const result = await getDesktopBackups(); setDiskBackups(result.backups || []); setSelectedBackup(''); setBackupMessage(result.message || '已刷新本机备份。'); }
    catch (error) { setBackupMessage(error.message || '无法读取本机备份。'); }
    finally { setBackupBusy(false); }
  }

  async function retryDiskSave() {
    setBackupBusy(true);
    try { await flushDesktopState(); setBackupMessage('当前任务和界面状态已保存。'); }
    catch (error) { setBackupMessage(error.message); }
    finally { setBackupBusy(false); }
  }

  async function restoreBackup() {
    if (!selectedBackup || !window.confirm('恢复所选备份中的任务、草稿和界面状态？当前状态会先保留一份备份，恢复后工作台会重新打开。Obsidian 笔记和授权不受影响。')) return;
    setBackupBusy(true);
    try { await restoreDesktopBackup(selectedBackup); }
    catch (error) { setBackupMessage(error.message || '备份恢复失败，当前任务仍保留。'); setBackupBusy(false); }
  }

  useEffect(() => {
    let active = true;
    setCodexBusy(true);
    getCodexStatus().then(result => { if (active) setCodexStatus(result); })
      .catch(error => { if (active) setCodexMessage(error?.message || '暂时无法读取 Codex 工作区。'); })
      .finally(() => { if (active) setCodexBusy(false); });
    getJevStatus().then(result => { if (active) setJevStatus(result); })
      .catch(error => { if (active) setJevMessage(error?.message || '暂时无法读取 Jev 设置。'); });
    return () => { active = false; };
  }, []);

  async function refreshCodex() {
    setCodexBusy(true);
    setCodexMessage('');
    try { setCodexStatus(await getCodexStatus()); }
    catch (error) { setCodexMessage(error?.message || '刷新工作区失败。'); }
    finally { setCodexBusy(false); }
  }

  async function saveJev(event) {
    event.preventDefault();
    if (!jevKey.trim()) return;
    setJevBusy(true);
    setJevMessage('');
    try {
      const result = await configureJev(jevKey);
      setJevKey('');
      setJevStatus(result);
      setJevMessage(result.message || '密钥已保存在本机。');
    } catch (error) { setJevMessage(error?.message || '保存 Jev 密钥失败。'); }
    finally { setJevBusy(false); }
  }

  async function checkJev() {
    setJevBusy(true);
    setJevMessage('');
    try { const result = await verifyJev(); setJevStatus(result); setJevMessage(result.message || '验证已完成。'); }
    catch (error) { setJevMessage(error?.message || '验证 Jev 连接失败。'); }
    finally { setJevBusy(false); }
  }

  async function removeJev() {
    if (!window.confirm('清除这台电脑保存的 Jev 密钥？')) return;
    setJevBusy(true);
    try { setJevStatus(await forgetJev()); setJevKey(''); setJevMessage('已清除这台电脑保存的 Jev 密钥。'); }
    catch (error) { setJevMessage(error?.message || '清除 Jev 密钥失败。'); }
    finally { setJevBusy(false); }
  }

  async function importBackup(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try { setBackupMessage(await onImportBackup(file)); }
    catch (error) { setBackupMessage(error?.message || '读取任务备份失败。'); }
  }

  const selectedProject = codexStatus.projects.find(project => project.id === defaultProjectId);
  const verifiedTime = jevStatus.verifiedAt ? new Date(jevStatus.verifiedAt).toLocaleString('zh-CN') : '';

  return <section className="subpage-view settings-page" aria-labelledby="settings-title">
    <PageBack onBack={onBack} />
    <div className="home-eyebrow">本机配置</div>
    <h1 id="settings-title">设置</h1>
    <p className="subpage-lede">在这里管理 Codex 工作区、知识库、成果预览、Jev 连接和任务备份。</p>
    <div className="settings-tabs" role="tablist" aria-label="设置项目">
      {SECTIONS.map(item => <button key={item.id} type="button" role="tab" aria-selected={section === item.id} className={section === item.id ? 'active' : ''} onClick={() => onSectionChange(item.id)}>{item.id === 'jev' && <span className={`settings-tab-light ${jevStatus.verified ? 'is-green' : 'is-red'}`} aria-hidden="true" />}{item.label}</button>)}
    </div>

    {section === 'workspace' && <section className="settings-card" aria-labelledby="settings-workspace-title">
      <div className="settings-card-heading"><div><span className="panel-kicker">对话交接</span><h2 id="settings-workspace-title">默认 Codex 工作区</h2></div><button className="text-button" type="button" onClick={refreshCodex} disabled={codexBusy}><ArrowClockwise size={16} />刷新</button></div>
      <p>从 Codex 已登记的工作区中选择一个默认位置。创建新对话时会优先选它；单次任务仍可临时更换。</p>
      {codexStatus.projects.length ? <>
        <label className="settings-field">默认工作区<select value={selectedProject ? defaultProjectId : ''} onChange={event => onDefaultProjectChange(event.target.value)}><option value="">每次启动时选择</option>{codexStatus.projects.map(project => <option key={project.id} value={project.id}>{project.name} · {project.rootLabel}</option>)}</select></label>
        {selectedProject && <p className="settings-path"><strong>仓库 / 工作区完整路径</strong><code>{selectedProject.root}</code></p>}
        {!selectedProject && defaultProjectId && <p className="settings-error">原默认工作区已不在 Codex 列表中，请重新选择。</p>}
      </> : <p className="settings-muted">{codexBusy ? '正在读取本机 Codex 工作区…' : codexStatus.message || codexMessage || '没有可选工作区。请先在 Codex 中添加本机工作区，再点刷新。'}</p>}
      <p className="settings-footnote">这里保存的是工作区选择，不会复制仓库，也不会修改 Git 地址。</p>
    </section>}

    {section === 'vault' && <VaultConnection {...vaultProps} embedded />}
    {section === 'artifacts' && <ArtifactSettings connection={artifactConnection} />}

    {section === 'jev' && <section className="settings-card" aria-labelledby="settings-jev-title">
      <div className="settings-card-heading"><div><span className="panel-kicker">TypeSafe · Jev</span><h2 id="settings-jev-title">Jev API Key</h2></div><span className={`settings-light ${jevStatus.verified ? 'is-green' : 'is-red'}`} role="status"><span aria-hidden="true" />{jevStatus.verified ? '绿灯 · 上次验证成功' : '红灯 · 尚未验证成功'}</span></div>
      <p>密钥只在桌面端加密保存，不会显示在页面、任务卡、启动语或 Git 中。保存时会用一条无个人资料的示例请求验证连接，可能消耗少量服务额度。</p>
      {!jevStatus.supported && <p className="settings-error">{jevStatus.message || '当前环境不能安全保存密钥，请打开正式桌面版。'}</p>}
      <form className="settings-key-form" onSubmit={saveJev}>
        <label className="settings-field">{jevStatus.saved ? '更换 API Key' : '输入 API Key'}<input type="password" value={jevKey} onChange={event => setJevKey(event.target.value)} autoComplete="off" spellCheck="false" placeholder="粘贴 TypeSafe API Key" disabled={!jevStatus.supported || jevBusy} /></label>
        <div className="settings-actions"><button className="primary-button compact" type="submit" disabled={!jevStatus.supported || !jevKey.trim() || jevBusy}><LockKey size={16} />{jevBusy ? '正在处理…' : '保存并验证'}</button>{jevStatus.saved && <button className="secondary-button" type="button" onClick={checkJev} disabled={jevBusy}>重新验证</button>}{jevStatus.saved && <button className="text-button" type="button" onClick={removeJev} disabled={jevBusy}>清除密钥</button>}</div>
      </form>
      {jevStatus.saved && <p className="settings-muted">密钥已保存于本机。{verifiedTime ? `上次成功验证：${verifiedTime}。` : '尚未通过连接验证。'}</p>}
      {jevMessage && <p className={jevStatus.verified ? 'settings-success' : 'settings-error'} role="status">{jevStatus.verified ? <CheckCircle size={16} /> : <WarningCircle size={16} />}{jevMessage}</p>}
      <p className="settings-footnote">绿灯只表示 TypeSafe API Key 曾通过实际连接验证；本机网络或额度之后仍可能变化。Codex 内的 Jev MCP 是独立连接，这里的灯不代表 Codex 已加载该工具。</p>
      <a className="settings-link" href="https://console.typesafe.ai/settings/keys" target="_blank" rel="noreferrer">打开 TypeSafe 密钥页面</a>
    </section>}

    {section === 'backup' && <section className="settings-card" aria-labelledby="settings-backup-title">
      <div className="settings-card-heading"><div><span className="panel-kicker">本机保存</span><h2 id="settings-backup-title">研究任务备份</h2></div></div>
      <div className="automatic-backup-panel">
        <strong>{desktopState.supported ? '任务自动备份' : '浏览器预览'}</strong>
        <p role="status">{!desktopState.supported ? '当前使用浏览器存储；正式桌面版会自动保存任务和界面状态，并保留本机历史备份。' : desktopState.error || (desktopState.phase === 'saving' ? '正在保存本次修改…' : desktopState.savedAt ? `已保存 · ${new Date(desktopState.savedAt).toLocaleString('zh-CN')}` : '首次任务备份准备中…')}</p>
        {desktopState.message && <p>{desktopState.message}</p>}
        {desktopState.supported && <>
          <p>保留最近一次状态和最多 10 份历史备份。重开时自动恢复；恢复历史备份可撤回近期修改。</p>
          <div className="settings-actions">
            <button className="secondary-button" type="button" disabled={backupBusy} onClick={refreshBackups}>查看可恢复备份</button>
            {desktopState.error && <button className="secondary-button" type="button" disabled={backupBusy} onClick={retryDiskSave}>重试保存</button>}
          </div>
          {diskBackups.length > 0 && <div className="settings-backup-restore">
            <label className="settings-field">选择恢复时间<select value={selectedBackup} onChange={event => setSelectedBackup(event.target.value)} disabled={backupBusy}><option value="">请选择一份备份</option>{diskBackups.map(item => <option key={item.id} value={item.id}>{new Date(item.savedAt).toLocaleString('zh-CN')}{item.id.startsWith('previous:') ? ' · 最近一次' : ''}</option>)}</select></label>
            <button className="secondary-button" type="button" disabled={!selectedBackup || backupBusy} onClick={restoreBackup}>恢复这份备份</button>
          </div>}
        </>}
      </div>
      <p>当前本机有 {taskCount} 张任务卡。导出包含任务卡、阅读卡与关联、未完成启动语和首页草稿，也包含本人选择的摘录与笔记位置；请私下保管。原文附件、知识库授权和密钥不包含在内，文件不会自动上传。</p>
      <p>导入时只合并新任务；同编号任务与已有阅读进度保留本机版本。阅读卡按稳定标识复用，冲突时停止导入。已有启动语和首页草稿不会被覆盖。</p>
      <div className="settings-actions">
        <button className="secondary-button" type="button" onClick={onExportBackup}><DownloadSimple size={16} aria-hidden="true" />导出备份</button>
        <button className="secondary-button" type="button" onClick={() => backupInputRef.current?.click()}><UploadSimple size={16} aria-hidden="true" />导入备份</button>
        <input ref={backupInputRef} type="file" accept=".json,application/json" className="visually-hidden" aria-label="选择工作台任务备份 JSON 文件" onChange={importBackup} />
      </div>
      {backupMessage && <p className="settings-muted" role="status">{backupMessage}</p>}
    </section>}
  </section>;
}
