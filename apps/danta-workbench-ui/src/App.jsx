import { useEffect, useMemo, useRef, useState } from 'react';
import { Titlebar } from './shared/components/Titlebar.jsx';
import { Sidebar } from './shared/components/Sidebar.jsx';
import { HomePage } from './features/home/components/HomePage.jsx';
import { WorkflowWorkspace } from './features/workflows/components/WorkflowWorkspace.jsx';
import { MechanismWorkspace } from './features/mechanism/components/MechanismWorkspace.jsx';
import { ResearchRecordsPage } from './features/records/components/ResearchRecordsPage.jsx';
import { LiteraturePage } from './features/literature/components/LiteraturePage.jsx';
import { VaultConnection } from './features/vault/components/VaultConnection.jsx';
import { KickoffModal } from './shared/components/KickoffModal.jsx';
import { Notice } from './shared/components/Notice.jsx';
import { useNotice } from './shared/hooks/useNotice.js';
import { PROMPT_STARTERS } from './shared/constants/workflows.js';
import { makeKickoffPrompt } from './shared/utils/promptBuilder.js';

import quickstartImage from '../../../docs/assets/quickstart.png';
import frameworkImage from '../../../docs/assets/workbench-map.png';

const INITIAL_DRAFTS = Object.fromEntries(PROMPT_STARTERS.map(workflow => [workflow.id, workflow.seed]));
const MECHANISM_SEED = '研究主题 / 核心发现：……\n已有证据或参考文献：……\n使用场景：PPT 汇报 / 论文插图';

export function App() {
  const [activePage, setActivePage] = useState('start');
  const [homeThought, setHomeThought] = useState('');
  const [drafts, setDrafts] = useState(INITIAL_DRAFTS);
  const [taskFocus, setTaskFocus] = useState('自由讨论');
  const [mechanismBrief, setMechanismBrief] = useState(MECHANISM_SEED);
  const [mechanismReturnTo, setMechanismReturnTo] = useState('start');
  const [filesByWorkflow, setFilesByWorkflow] = useState({});
  const [showMechanismProcess, setShowMechanismProcess] = useState(false);
  const [kickoff, setKickoff] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [vaultName, setVaultName] = useState('');

  const [notice, showNotice, hideNotice] = useNotice();
  const pickerRef = useRef(null);
  const dialogRef = useRef(null);
  const copyButtonRef = useRef(null);

  useEffect(() => {
    pickerRef.current?.setAttribute('webkitdirectory', '');
    pickerRef.current?.setAttribute('directory', '');
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activePage]);

  const workflow = useMemo(() => PROMPT_STARTERS.find(item => item.id === activePage), [activePage]);
  const vaultStatus = vaultName ? `已选择名称 · ${vaultName}` : '尚未选择 GY 文件夹';
  const activeNav = ['start', 'records', 'mechanism', 'literature', 'vault'].includes(activePage) ? activePage : 'start';

  function navigate(page) {
    if (page === 'mechanism') setMechanismReturnTo('start');
    if (page === 'start') setTaskFocus('自由讨论');
    setActivePage(page);
  }

  function openWorkflow(item) {
    setTaskFocus(item.focus);
    setActivePage(item.id);
  }

  function beginDiscussion(text, focus) {
    if (!text.trim()) {
      showNotice('先写下一件观察、困惑或正在处理的任务。', 'info');
      return;
    }
    setTaskFocus(focus);
    setKickoff(makeKickoffPrompt(text, focus));
    setCopied(false);
    setModalOpen(true);
  }

  async function copyKickoff() {
    try {
      await navigator.clipboard.writeText(kickoff);
      setCopied(true);
      showNotice('启动语已复制，粘贴到 Codex 后即可继续。', 'success');
    } catch {
      showNotice('无法访问剪贴板，请手动选择启动语复制。', 'error');
    }
  }

  function openMechanism(from = 'start') {
    setMechanismReturnTo(from);
    setShowMechanismProcess(false);
    setActivePage('mechanism');
  }

  function addFiles(workflowId, event) {
    const names = [...(event.target.files || [])].map(file => file.name);
    if (names.length) {
      setFilesByWorkflow(current => ({
        ...current,
        [workflowId]: [...new Set([...(current[workflowId] || []), ...names])],
      }));
      showNotice('已暂存所选文件名；当前页面不会读取文件内容。', 'info');
    }
    event.target.value = '';
  }

  function handleVaultPick(event) {
    const first = event.target.files?.[0];
    if (!first) return;
    const name = first.webkitRelativePath?.split('/')[0] || first.name;
    setVaultName(name);
    showNotice(`已记下文件夹名称“${name}”；尚未连接、扫描或读取内容。`, 'info');
    event.target.value = '';
  }

  function renderContent() {
    if (activePage === 'start') {
      return <HomePage thought={homeThought} setThought={setHomeThought} taskFocus={taskFocus} onBegin={beginDiscussion} onOpenWorkflow={openWorkflow} onOpenRecords={() => navigate('records')} />;
    }
    if (workflow) {
      return <WorkflowWorkspace
        workflow={workflow}
        thought={drafts[workflow.id] || ''}
        setThought={value => setDrafts(current => ({ ...current, [workflow.id]: value }))}
        files={filesByWorkflow[workflow.id] || []}
        onBack={() => navigate('start')}
        onBegin={beginDiscussion}
        onFilesAdded={event => addFiles(workflow.id, event)}
        onRemoveFile={name => setFilesByWorkflow(current => ({ ...current, [workflow.id]: (current[workflow.id] || []).filter(file => file !== name) }))}
        onOpenMechanism={() => openMechanism('ppt')}
      />;
    }
    if (activePage === 'mechanism') {
      return <MechanismWorkspace brief={mechanismBrief} setBrief={setMechanismBrief} showProcess={showMechanismProcess} setShowProcess={setShowMechanismProcess} onBack={() => navigate(mechanismReturnTo)} onBegin={beginDiscussion} />;
    }
    if (activePage === 'records') return <ResearchRecordsPage onOpenVault={() => navigate('vault')} />;
    if (activePage === 'literature') return <LiteraturePage onOpenVault={() => navigate('vault')} />;
    return <section className="subpage-view"><div className="home-eyebrow">本机资料</div><h1>知识库</h1><p className="subpage-lede">先确认龚博士已有的 GY 文件夹。当前网页只记下所选文件夹名称，不扫描或读取研究内容。</p><VaultConnection vaultName={vaultName} vaultStatus={vaultStatus} pickerRef={pickerRef} onPickerChange={handleVaultPick} /></section>;
  }

  return (
    <div className="app-frame">
      <Titlebar guideUrl={quickstartImage} frameworkUrl={frameworkImage} />
      <div className="app-body">
        <Sidebar activePage={activeNav} vaultName={vaultName} onNavigate={navigate} />
        <main className="main-content">{renderContent()}</main>
      </div>
      <KickoffModal isOpen={modalOpen} kickoffPrompt={kickoff} copied={copied} onCopy={copyKickoff} onClose={() => setModalOpen(false)} copyButtonRef={copyButtonRef} dialogRef={dialogRef} />
      <Notice message={notice.message} type={notice.type} onClose={hideNotice} />
    </div>
  );
}
