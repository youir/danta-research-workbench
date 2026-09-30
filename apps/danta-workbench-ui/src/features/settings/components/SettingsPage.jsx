import { useEffect, useState } from 'react';
import { ArrowClockwise, CheckCircle, LockKey, WarningCircle } from '@phosphor-icons/react';
import { PageBack } from '../../../shared/components/PageBack.jsx';
import { VaultConnection } from '../../vault/components/VaultConnection.jsx';
import { configureJev, forgetJev, getCodexStatus, getJevStatus, verifyJev } from '../../../shared/utils/localApi.js';

const SECTIONS = [
  { id: 'workspace', label: 'Codex 工作区' },
  { id: 'vault', label: '知识库与授权' },
  { id: 'jev', label: 'Jev API Key' },
];

export function SettingsPage({ section, onSectionChange, defaultProjectId, onDefaultProjectChange, vaultProps, onBack }) {
  const [codexStatus, setCodexStatus] = useState({ available: false, projects: [] });
  const [codexBusy, setCodexBusy] = useState(false);
  const [codexMessage, setCodexMessage] = useState('');
  const [jevStatus, setJevStatus] = useState({ supported: false, saved: false, verified: false });
  const [jevKey, setJevKey] = useState('');
  const [jevBusy, setJevBusy] = useState(false);
  const [jevMessage, setJevMessage] = useState('');

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

  const selectedProject = codexStatus.projects.find(project => project.id === defaultProjectId);
  const verifiedTime = jevStatus.verifiedAt ? new Date(jevStatus.verifiedAt).toLocaleString('zh-CN') : '';

  return <section className="subpage-view settings-page" aria-labelledby="settings-title">
    <PageBack onBack={onBack} />
    <div className="home-eyebrow">本机配置</div>
    <h1 id="settings-title">设置</h1>
    <p className="subpage-lede">工作区、知识库和 Jev 连接集中在这里管理。路径与密钥不会写入 Git。</p>
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
  </section>;
}
