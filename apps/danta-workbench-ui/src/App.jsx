import { useEffect, useMemo, useRef, useState } from 'react';
import { Titlebar } from './shared/components/Titlebar.jsx';
import { Sidebar } from './shared/components/Sidebar.jsx';
import { HomePage } from './features/home/components/HomePage.jsx';
import { WorkflowWorkspace } from './features/workflows/components/WorkflowWorkspace.jsx';
import { MechanismWorkspace } from './features/mechanism/components/MechanismWorkspace.jsx';
import { ResearchRecordsPage } from './features/records/components/ResearchRecordsPage.jsx';
import { LiteraturePage } from './features/literature/components/LiteraturePage.jsx';
import { DailyBriefsPage } from './features/daily-briefs/components/DailyBriefsPage.jsx';
import { ArchivePage } from './features/archive/components/ArchivePage.jsx';
import { VaultConnection } from './features/vault/components/VaultConnection.jsx';
import { KickoffModal } from './shared/components/KickoffModal.jsx';
import { Notice } from './shared/components/Notice.jsx';
import { useNotice } from './shared/hooks/useNotice.js';
import { usePersistentState } from './shared/hooks/usePersistentState.js';
import { PROMPT_STARTERS } from './shared/constants/workflows.js';
import { makeKickoffPrompt } from './shared/utils/promptBuilder.js';
import { authorizeVaultScopes, chooseVault, createCodexThread, disconnectVault, getVaultStatus, inspectVaultStructure, repairVaultStructure } from './shared/utils/localApi.js';

import quickstartImage from '../../../docs/assets/quickstart.png';
import frameworkImage from '../../../docs/assets/workbench-map.png';

const INITIAL_DRAFTS = Object.fromEntries(PROMPT_STARTERS.map(workflow => [workflow.id, workflow.seed]));
const MECHANISM_SEED = '研究主题 / 核心发现：……\n已有证据或参考文献：……\n使用场景：PPT 汇报 / 论文插图';
const PPT_PROMPT_CHOICES = { format: '', purpose: '', audience: '', duration: '' };

function hasUsefulText(value, seed = '') {
  const text = String(value || '').trim();
  return Boolean(text && text !== String(seed || '').trim());
}

function savedTimeLabel(timestamp) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '上次保存';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '上次进度';
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

export function App() {
  const [activePage, setActivePage] = useState('start');
  const [pageHistory, setPageHistory] = useState([]);
  const [homeThought, setHomeThought] = usePersistentState('homeThought', '');
  const [drafts, setDrafts] = usePersistentState('workflowDrafts', INITIAL_DRAFTS);
  const [taskFocus, setTaskFocus] = usePersistentState('taskFocus', '自由讨论');
  const [mechanismBrief, setMechanismBrief] = usePersistentState('mechanismBrief', MECHANISM_SEED);
  const [selectedPptTemplate, setSelectedPptTemplate] = usePersistentState('selectedPptTemplate', null);
  const [selectedPptLogo, setSelectedPptLogo] = usePersistentState('selectedPptLogo', null);
  const [pptPromptChoices, setPptPromptChoices] = usePersistentState('pptPromptChoices', PPT_PROMPT_CHOICES);
  const [filesByWorkflow, setFilesByWorkflow] = usePersistentState('filesByWorkflow', {});
  const [pendingKickoff, setPendingKickoff] = usePersistentState('pendingKickoff', null);
  const [lastCheckpoint, setLastCheckpoint] = usePersistentState('lastCheckpoint', null);
  const [showMechanismProcess, setShowMechanismProcess] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [vaultStatus, setVaultStatus] = useState({ selected: false, connected: false, name: '', scopes: [], scopeOptions: [] });
  const [vaultBusy, setVaultBusy] = useState(false);
  const [vaultStructure, setVaultStructure] = useState(null);

  const [notice, showNotice, hideNotice] = useNotice();
  const dialogRef = useRef(null);
  const copyButtonRef = useRef(null);

  useEffect(() => {
    let active = true;
    getVaultStatus().then(status => { if (active) setVaultStatus(status); })
      .catch(error => { if (active) showNotice(error?.message || '本机知识库服务暂不可用。', 'error'); });
    return () => { active = false; };
  }, [showNotice]);

  useEffect(() => { window.scrollTo(0, 0); }, [activePage]);

  const workflow = useMemo(() => PROMPT_STARTERS.find(item => item.id === activePage), [activePage]);
  const activeNav = ['start', 'records', 'mechanism', 'literature', 'daily-briefs', 'archive', 'vault'].includes(activePage) ? activePage : 'start';
  const kickoffPrompt = pendingKickoff?.prompt || '';

  const recovery = useMemo(() => {
    const candidates = [];
    if (pendingKickoff?.prompt) {
      candidates.push({ kind: 'kickoff', title: `${pendingKickoff.focus || '研究讨论'} · 未完成启动语`, updatedAt: pendingKickoff.updatedAt || pendingKickoff.handoffAt || 0 });
    }
    if (hasUsefulText(homeThought)) candidates.push({ page: 'start', title: '自由讨论 · 未完成填写', updatedAt: lastCheckpoint?.page === 'start' ? lastCheckpoint.updatedAt : 0 });
    for (const [id, value] of Object.entries(drafts)) {
      const item = PROMPT_STARTERS.find(candidate => candidate.id === id);
      if (item && hasUsefulText(value, item.seed)) candidates.push({ page: id, title: `${item.label} · 未完成填写`, updatedAt: lastCheckpoint?.page === id ? lastCheckpoint.updatedAt : 0 });
    }
    if (hasUsefulText(mechanismBrief, MECHANISM_SEED)) candidates.push({ page: 'mechanism', title: '机制图 · 未完成填写', updatedAt: lastCheckpoint?.page === 'mechanism' ? lastCheckpoint.updatedAt : 0 });
    const latest = candidates.sort((a, b) => b.updatedAt - a.updatedAt)[0];
    return latest ? { ...latest, kind: latest.kind || 'draft', timeLabel: savedTimeLabel(latest.updatedAt) } : null;
  }, [pendingKickoff, homeThought, drafts, mechanismBrief, lastCheckpoint]);

  function markCheckpoint(page, label) {
    setLastCheckpoint({ page, label, updatedAt: Date.now() });
  }

  function navigate(page) {
    setPageHistory(current => page === activePage ? current : [...current.slice(-29), activePage]);
    setActivePage(page);
  }

  function goBack() {
    if (!pageHistory.length) { setActivePage('start'); return; }
    setActivePage(pageHistory[pageHistory.length - 1]);
    setPageHistory(current => current.slice(0, -1));
  }

  function openWorkflow(item) {
    setTaskFocus(item.focus);
    navigate(item.id);
  }

  function beginDiscussion(text, focus, template = null, logo = null) {
    if (!text.trim()) {
      showNotice('先写下一件观察、困惑或正在处理的任务。', 'info');
      return;
    }
    setTaskFocus(focus);
    const prompt = makeKickoffPrompt(text, focus, template, logo);
    setPendingKickoff({ prompt, focus, page: activePage, updatedAt: Date.now(), handoffThreadId: '' });
    markCheckpoint(activePage, focus);
    setCopied(false);
    setModalOpen(true);
  }

  async function copyKickoff() {
    try {
      await navigator.clipboard.writeText(kickoffPrompt);
      setCopied(true);
      showNotice('启动语已复制到剪贴板；可粘贴到 Codex 新对话。', 'success');
    } catch {
      showNotice('无法访问剪贴板，请在下方启动语框中手动选择并复制。', 'error');
    }
  }

  async function createCodexHandoff(projectId) {
    let browserCopied = false;
    try { await navigator.clipboard.writeText(kickoffPrompt); browserCopied = true; } catch { /* The local bridge also tries the system clipboard. */ }
    const result = await createCodexThread({ projectId, prompt: kickoffPrompt, workflowLabel: taskFocus });
    setCopied(browserCopied || result.copied);
    setPendingKickoff(current => current ? { ...current, handoffThreadId: result.threadId, handoffAt: Date.now() } : current);
    showNotice(result.opened ? '已创建并打开 Codex 新对话，启动语已复制。' : '新对话已创建，启动语已复制；可在 Codex 最近记录中打开。', 'success');
    return result;
  }

  function openMechanism(from = activePage) {
    setShowMechanismProcess(false);
    markCheckpoint(from, taskFocus);
    navigate('mechanism');
  }

  function addFiles(workflowId, event) {
    const names = [...(event.target.files || [])].map(file => file.name);
    if (names.length) {
      setFilesByWorkflow(current => ({ ...current, [workflowId]: [...new Set([...(current[workflowId] || []), ...names])] }));
      showNotice('已暂存所选文件名；当前页面不会读取这些文件的内容。', 'info');
    }
    event.target.value = '';
  }

  async function selectVault() {
    setVaultBusy(true);
    try {
      const selected = await chooseVault();
      if (selected.cancelled) return;
      setVaultStructure(null);
      setVaultStatus({ selected: true, connected: false, name: selected.name, scopes: [], scopeOptions: selected.scopes || [] });
      showNotice(`已选择“${selected.name}”。尚未读取内容，请勾选范围并确认授权。`, 'info');
    } finally {
      setVaultBusy(false);
    }
  }

  async function authorizeScopes(scopes) {
    setVaultBusy(true);
    try {
      const status = await authorizeVaultScopes(scopes);
      setVaultStatus(status);
      showNotice('本机读取范围已更新。', 'success');
      return status;
    } finally {
      setVaultBusy(false);
    }
  }

  async function clearVault() {
    setVaultBusy(true);
    try {
      const status = await disconnectVault();
      setVaultStatus(status);
      setVaultStructure(null);
      showNotice('知识库路径和读取授权已从本机服务内存中清除。', 'success');
    } finally {
      setVaultBusy(false);
    }
  }

  async function checkVaultStructure() {
    setVaultBusy(true);
    try {
      const report = await inspectVaultStructure();
      setVaultStructure(report);
      return report;
    } finally {
      setVaultBusy(false);
    }
  }

  async function completeVaultStructure() {
    setVaultBusy(true);
    try {
      const report = await repairVaultStructure();
      setVaultStructure(report);
      const status = await getVaultStatus();
      setVaultStatus(status);
      showNotice(`已补齐 ${report.created || 0} 个标准空文件夹；原有文件和笔记未移动或修改。`, 'success');
      return report;
    } finally {
      setVaultBusy(false);
    }
  }

  function resumeWork() {
    if (!recovery) return;
    if (recovery.kind === 'kickoff') {
      setTaskFocus(pendingKickoff.focus || '自由讨论');
      setCopied(false);
      setModalOpen(true);
      return;
    }
    navigate(recovery.page || 'start');
  }

  function restoreKickoff() {
    setTaskFocus(pendingKickoff?.focus || '自由讨论');
    setCopied(false);
    setModalOpen(true);
  }

  function updateWorkflowDraft(id, value) {
    setDrafts(current => ({ ...current, [id]: value }));
    const item = PROMPT_STARTERS.find(candidate => candidate.id === id);
    markCheckpoint(id, item?.label || id);
  }

  function renderContent() {
    if (activePage === 'start') {
      return <HomePage
        thought={homeThought}
        setThought={value => { setHomeThought(value); markCheckpoint('start', '自由讨论'); }}
        taskFocus={taskFocus}
        recovery={recovery}
        vaultConnected={vaultStatus.connected}
        vaultName={vaultStatus.name}
        onBegin={beginDiscussion}
        onOpenWorkflow={openWorkflow}
        onOpenVault={() => navigate('vault')}
        onResume={resumeWork}
        onRestoreKickoff={restoreKickoff}
      />;
    }
    if (workflow) {
      return <WorkflowWorkspace
        workflow={workflow}
        thought={drafts[workflow.id] || ''}
        setThought={value => updateWorkflowDraft(workflow.id, value)}
        files={filesByWorkflow[workflow.id] || []}
        selectedPptTemplate={workflow.id === 'ppt' ? selectedPptTemplate : null}
        selectedPptLogo={workflow.id === 'ppt' ? selectedPptLogo : null}
        pptPromptChoices={pptPromptChoices}
        onPptPromptChoicesChange={value => { setPptPromptChoices(value); markCheckpoint('ppt', '组会 PPT 汇报'); }}
        onSelectPptTemplate={value => { setSelectedPptTemplate(value); markCheckpoint('ppt', '组会 PPT 汇报'); }}
        onSelectPptLogo={value => { setSelectedPptLogo(value); markCheckpoint('ppt', '组会 PPT 汇报'); }}
        onBack={goBack}
        onBegin={beginDiscussion}
        onFilesAdded={event => addFiles(workflow.id, event)}
        onRemoveFile={name => setFilesByWorkflow(current => ({ ...current, [workflow.id]: (current[workflow.id] || []).filter(file => file !== name) }))}
        onOpenMechanism={() => openMechanism('ppt')}
        onViewDailyBriefs={() => navigate('daily-briefs')}
      />;
    }
    if (activePage === 'mechanism') {
      return <MechanismWorkspace brief={mechanismBrief} setBrief={value => { setMechanismBrief(value); markCheckpoint('mechanism', '机制图'); }} showProcess={showMechanismProcess} setShowProcess={setShowMechanismProcess} onBack={goBack} onBegin={beginDiscussion} />;
    }
    if (activePage === 'records') return <ResearchRecordsPage canRead={vaultStatus.scopes.includes('records')} onOpenVault={() => navigate('vault')} onBack={goBack} />;
    if (activePage === 'literature') return <LiteraturePage canReadRss={vaultStatus.scopes.includes('rss')} canReadLiterature={vaultStatus.scopes.includes('literature')} onOpenVault={() => navigate('vault')} onBack={goBack} />;
    if (activePage === 'daily-briefs') return <DailyBriefsPage onBack={goBack} onBegin={beginDiscussion} />;
    if (activePage === 'archive') return <ArchivePage canRead={vaultStatus.scopes.includes('archive-read')} canWrite={vaultStatus.scopes.includes('archive-write')} onOpenVault={() => navigate('vault')} onBack={goBack} onCheckpoint={() => markCheckpoint('archive', '历史归档')} />;
    return <VaultConnection status={vaultStatus} structure={vaultStructure} busy={vaultBusy} onSelect={selectVault} onAuthorize={authorizeScopes} onDisconnect={clearVault} onInspectStructure={checkVaultStructure} onRepairStructure={completeVaultStructure} onBack={goBack} />;
  }

  return (
    <div className="app-frame">
      <Titlebar guideUrl={quickstartImage} frameworkUrl={frameworkImage} />
      <div className="app-body">
        <Sidebar activePage={activeNav} vaultName={vaultStatus.name} vaultConnected={vaultStatus.connected} onNavigate={navigate} />
        <main className="main-content">{renderContent()}</main>
      </div>
      <KickoffModal isOpen={modalOpen} kickoffPrompt={kickoffPrompt} copied={copied} onCopy={copyKickoff} onCreateThread={createCodexHandoff} workflowLabel={taskFocus} onClose={() => setModalOpen(false)} copyButtonRef={copyButtonRef} dialogRef={dialogRef} />
      <Notice message={notice.message} type={notice.type} onClose={hideNotice} />
    </div>
  );
}
