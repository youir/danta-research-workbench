import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Titlebar } from './shared/components/Titlebar.jsx';
import { Sidebar } from './shared/components/Sidebar.jsx';
import { HomePage } from './features/home/components/HomePage.jsx';
import { TasksArea, SourcesArea, OutputsArea } from './features/home/components/WorkAreas.jsx';
import { WorkflowWorkspace } from './features/workflows/components/WorkflowWorkspace.jsx';
import { MechanismWorkspace } from './features/mechanism/components/MechanismWorkspace.jsx';
import { ResearchRecordsPage } from './features/records/components/ResearchRecordsPage.jsx';
import { LiteraturePage } from './features/literature/components/LiteraturePage.jsx';
import { DailyBriefsPage } from './features/daily-briefs/components/DailyBriefsPage.jsx';
import { ArchivePage } from './features/archive/components/ArchivePage.jsx';
import { VaultConnection } from './features/vault/components/VaultConnection.jsx';
import { SettingsPage } from './features/settings/components/SettingsPage.jsx';
import { KickoffModal } from './shared/components/KickoffModal.jsx';
import { Notice } from './shared/components/Notice.jsx';
import { ArtifactWorkspace } from './features/artifacts/ArtifactWorkspace.jsx';
import { useArtifactConnection } from './features/artifacts/useArtifactConnection.js';
import { artifactDeliveryPrompt, artifactRevisionPrompt } from './features/artifacts/artifactPrompt.js';
import { useNotice } from './shared/hooks/useNotice.js';
import { usePersistentState, useStorageHealth } from './shared/hooks/usePersistentState.js';
import { MECHANISM_WORKFLOW, PROMPT_STARTERS } from './shared/constants/workflows.js';
import { useResearchTasks } from './features/research-tasks/hooks/useResearchTasks.js';
import { buildTaskArchiveDraft, makeRelatedTaskContext } from './shared/utils/taskRecords.js';
import { makeKickoffPrompt } from './shared/utils/promptBuilder.js';
import { makeTaskBackup, MAX_BACKUP_BYTES, parseTaskBackup } from './shared/utils/taskBackup.js';
import { getDesktopStateHealth, subscribeDesktopState } from './shared/utils/desktopState.js';
import { describeHandoff, getHandoffThreadId, isSameKickoff } from './shared/utils/taskHandoff.js';
import { addVaultScopeFolder, authorizeVaultScopes, chooseVault, createCodexThread, createVaultArchive, disconnectVault, forgetVaultLocation, getVaultStatus, inspectVaultStructure, openCodexThread, rememberVaultLocation, removeVaultScopeFolder, repairVaultStructure, restoreVaultLocation } from './shared/utils/localApi.js';

import quickstartImage from '../../../docs/assets/quickstart.png';
import frameworkImage from '../../../docs/assets/workbench-map.png';

const INITIAL_DRAFTS = Object.fromEntries(PROMPT_STARTERS.map(workflow => [workflow.id, workflow.seed]));
const MECHANISM_SEED = MECHANISM_WORKFLOW.seed;
const PPT_PROMPT_CHOICES = { format: '', purpose: '', audience: '', duration: '' };

function savedTimeLabel(timestamp) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '上次保存';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '上次进度';
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

export function App() {
  const [activePage, setActivePage] = usePersistentState('activePage', 'start');
  const [pageHistory, setPageHistory] = usePersistentState('pageHistory', []);
  const [homeThought, setHomeThought] = usePersistentState('homeThought', '');
  const [drafts] = usePersistentState('workflowDrafts', INITIAL_DRAFTS);
  const [taskFocus, setTaskFocus] = usePersistentState('taskFocus', '自由讨论');
  const [mechanismBrief, setMechanismBrief] = usePersistentState('mechanismBrief', MECHANISM_SEED);
  const [selectedPptTemplate] = usePersistentState('selectedPptTemplate', null);
  const [selectedPptLogo] = usePersistentState('selectedPptLogo', null);
  const [pptPromptChoices] = usePersistentState('pptPromptChoices', PPT_PROMPT_CHOICES);
  const [filesByWorkflow] = usePersistentState('filesByWorkflow', {});
  const [pendingKickoff, setPendingKickoff] = usePersistentState('pendingKickoff', null);
  const pendingKickoffRef = useRef(pendingKickoff);
  pendingKickoffRef.current = pendingKickoff;
  const [defaultCodexProjectId, setDefaultCodexProjectId] = usePersistentState('defaultCodexProjectId', '');
  const [lastCheckpoint, setLastCheckpoint] = usePersistentState('lastCheckpoint', null);
  const storageError = useStorageHealth();
  const desktopState = useSyncExternalStore(subscribeDesktopState, getDesktopStateHealth, getDesktopStateHealth);
  const [showMechanismProcess, setShowMechanismProcess] = usePersistentState('showMechanismProcess', false);
  const [modalOpen, setModalOpen] = usePersistentState('kickoffModalOpen', false);
  const [copied, setCopied] = useState(false);
  const [vaultStatus, setVaultStatus] = useState({ selected: false, connected: false, name: '', scopes: [], scopeOptions: [] });
  const [vaultBusy, setVaultBusy] = useState(false);
  const [vaultStructure, setVaultStructure] = useState(null);
  const [settingsSection, setSettingsSection] = usePersistentState('settingsSection', 'workspace');
  const [archivingTaskId, setArchivingTaskId] = useState('');
  const archiveLockRef = useRef(false);
  const artifactConnection = useArtifactConnection();

  const [notice, showNotice, hideNotice] = useNotice();
  const dialogRef = useRef(null);
  const copyButtonRef = useRef(null);

  const {
    tasks: researchTasks,
    recentTasks: recentResearchTasks,
    activeTask: activeResearchTask,
    activeTaskId,
    setActiveTaskId,
    createTask,
    updateTask,
    patchTask,
    addTaskFiles,
    removeTaskFile,
    linkCodexThread,
    addTaskRecord,
    updateTaskRecord,
    removeTaskRecord,
    recordTaskArchive,
    mergeTaskCards,
  } = useResearchTasks({ drafts, filesByWorkflow, selectedPptTemplate, selectedPptLogo, pptPromptChoices, mechanismBrief, lastCheckpoint });

  function exportTaskBackup() {
    const backup = makeTaskBackup({ tasks: researchTasks, activeTaskId, pendingKickoff, homeThought });
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `龚博士科研任务备份-${new Date().toLocaleDateString('sv-SE')}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showNotice(`已导出 ${researchTasks.length} 张任务卡的本机备份。请把文件保存在自己掌控的位置。`, 'success');
  }

  async function importTaskBackup(file) {
    if (!file || file.size > MAX_BACKUP_BYTES) throw new Error('请选择不超过 12 MB 的工作台任务备份。');
    const backup = parseTaskBackup(await file.text());
    const existing = new Set(researchTasks.map(task => task.id));
    const incoming = backup.tasks.filter(task => !existing.has(task.id));
    if (incoming.length) mergeTaskCards(incoming);
    if (!activeTaskId && incoming.some(task => task.id === backup.activeTaskId)) setActiveTaskId(backup.activeTaskId);
    if (!pendingKickoff && backup.pendingKickoff && (!backup.pendingKickoff.taskId || incoming.some(task => task.id === backup.pendingKickoff.taskId))) setPendingKickoff(backup.pendingKickoff);
    if (!homeThought && backup.homeThought) setHomeThought(backup.homeThought);
    const message = `已合并 ${incoming.length} 张任务卡；${backup.tasks.length - incoming.length} 张同编号任务保留本机现有版本。`;
    showNotice(message, 'success');
    return message;
  }

  useEffect(() => {
    let active = true;
    getVaultStatus().then(status => { if (active) setVaultStatus(status); })
      .catch(error => { if (active) showNotice(error?.message || '本机知识库服务暂不可用。', 'error'); });
    return () => { active = false; };
  }, [showNotice]);

  const firstPageRender = useRef(true);
  useEffect(() => {
    if (firstPageRender.current) { firstPageRender.current = false; return; }
    window.scrollTo(0, 0);
  }, [activePage]);

  const workflow = useMemo(() => PROMPT_STARTERS.find(item => item.id === activePage), [activePage]);
  const activeNav = ['start', 'tasks', 'sources', 'outputs', 'settings'].includes(activePage) ? activePage
    : ['topic', 'writing'].includes(activePage) ? 'tasks'
      : ['records', 'literature', 'daily-briefs', 'archive', 'briefing'].includes(activePage) ? 'sources'
        : ['ppt', 'meeting', 'mechanism'].includes(activePage) ? 'outputs' : 'start';
  const kickoffPrompt = pendingKickoff?.prompt || '';
  const handoffTask = researchTasks.find(task => task.id === pendingKickoff?.taskId);
  const handoffThreadId = getHandoffThreadId(pendingKickoff, handoffTask);
  const taskRecordActions = {
    steps: {
      vaultStatus,
      patch: patch => patchTask(activeTaskId, patch),
      openVault: () => navigate('vault'),
      begin: () => beginDiscussion(activeResearchTask?.content || activeResearchTask?.objective || '接续当前研究步骤', activeResearchTask?.focus || taskFocus, activeResearchTask?.selectedPptTemplate, activeResearchTask?.selectedPptLogo),
    },
    openConversation: threadId => reopenCodexThread({ linkedCodexThreadId: threadId }),
    add: () => addTaskRecord(activeTaskId),
    update: (recordId, field, value) => updateTaskRecord(activeTaskId, recordId, field, value),
    remove: recordId => removeTaskRecord(activeTaskId, recordId),
    archive: archiveActiveTask,
    openVault: () => navigate('vault'),
    canArchive: vaultStatus.scopes.includes('archive-write'),
    busy: Boolean(archivingTaskId),
  };
  useEffect(() => {
    if (desktopState.message) showNotice(desktopState.message, 'info');
  }, [desktopState.message, showNotice]);
  const recovery = useMemo(() => {
    if (!pendingKickoff?.prompt) return null;
    const updatedAt = pendingKickoff.updatedAt || pendingKickoff.handoffAt || 0;
    const handedOff = Boolean(pendingKickoff.handoffThreadId);
    return { title: `${pendingKickoff.taskTitle || pendingKickoff.focus || '研究讨论'} · ${handedOff ? '继续对话' : '待交接'}`, timeLabel: savedTimeLabel(updatedAt), handedOff,
      description: pendingKickoff.handoff?.error ? '上次交接未成功，启动语和已有对话编号已保留。' : handedOff ? '已保留上次交接，可继续原对话或重新复制启动语。' : '启动语已保留，可继续交接。' };
  }, [pendingKickoff]);

  function markCheckpoint(page, label) {
    setLastCheckpoint({ page, label, updatedAt: Date.now() });
  }

  function navigate(page, targetTaskId = activeTaskId) {
    const destination = page === 'vault' ? 'settings' : page;
    if (page === 'vault') setSettingsSection('vault');
    setPageHistory(current => destination === activePage && targetTaskId === activeTaskId ? current : [...current.slice(-29), { page: activePage, taskId: activeTaskId }]);
    setActiveTaskId(targetTaskId || '');
    setActivePage(destination);
  }

  function goBack() {
    if (!pageHistory.length) { setActivePage('start'); setActiveTaskId(''); return; }
    const previous = pageHistory[pageHistory.length - 1];
    setActivePage(typeof previous === 'string' ? previous : previous.page);
    setActiveTaskId(typeof previous === 'string' ? '' : previous.taskId || '');
    setPageHistory(current => current.slice(0, -1));
  }

  function openWorkflow(item) {
    const task = createTask(item);
    setTaskFocus(item.focus);
    navigate(item.id, task.id);
  }

  function resumeResearchTask(task) {
    const item = task.workflowId === MECHANISM_WORKFLOW.id ? MECHANISM_WORKFLOW : PROMPT_STARTERS.find(candidate => candidate.id === task.workflowId);
    if (!item) return;
    setTaskFocus(task.focus || item.focus);
    navigate(item.id, task.id);
  }

  function updateActiveTask(field, value) {
    updateTask(activeTaskId, field, value);
  }

  function patchActiveTask(patch) {
    patchTask(activeTaskId, patch);
  }

  async function archiveActiveTask() {
    if (!activeResearchTask || archiveLockRef.current) return;
    if (!vaultStatus.scopes.includes('archive-write')) {
      navigate('vault');
      return;
    }
    const snapshot = activeResearchTask;
    const vaultName = vaultStatus.name;
    archiveLockRef.current = true;
    setArchivingTaskId(snapshot.id);
    try {
      const result = await createVaultArchive(buildTaskArchiveDraft(snapshot));
      recordTaskArchive(snapshot.id, { ...result, vaultName, savedAt: Date.now(), snapshotUpdatedAt: snapshot.updatedAt });
      showNotice(`已保存阶段记录到 ${vaultName}：${result.path}`, 'success');
    } catch (error) {
      showNotice(error?.message || '阶段记录保存失败，本机任务仍然保留。', 'error');
    } finally {
      archiveLockRef.current = false;
      setArchivingTaskId('');
    }
  }

  function beginDiscussion(text, focus, template = null, logo = null) {
    if (!text.trim()) {
      showNotice('先写下一件观察、困惑或正在处理的任务。', 'info');
      return;
    }
    setTaskFocus(focus);
    const task = activeResearchTask?.workflowId === activePage ? activeResearchTask : null;
    const prompt = makeKickoffPrompt(text, focus, template, logo, task) + artifactDeliveryPrompt(task, artifactConnection.status);
    setPendingKickoff({ id: crypto.randomUUID(), prompt, focus, page: activePage, taskId: task?.id || '', taskTitle: task?.title || '', updatedAt: Date.now(), handoffThreadId: task?.linkedCodexThreadId || '' });
    markCheckpoint(activePage, focus);
    setCopied(false);
    setModalOpen(true);
  }

  function openArtifactSettings() { setSettingsSection('artifacts'); navigate('settings'); }

  function reviseArtifact(task, artifact, view) {
    const prompt = artifactRevisionPrompt(task, artifact, view, artifactConnection.status);
    setTaskFocus(task.focus);
    setPendingKickoff({ id: crypto.randomUUID(), prompt, focus: task.focus, page: activePage, taskId: task.id, taskTitle: task.title, updatedAt: Date.now(), handoffThreadId: task.linkedCodexThreadId || '' });
    setCopied(false); setModalOpen(true);
  }

  function withArtifactPanel(task, content) {
    return <ArtifactWorkspace key={task?.id || 'no-task'} task={task} connection={artifactConnection} onOpenSettings={openArtifactSettings}
      onStateChange={update => patchTask(task.id, current => ({ previewState: typeof update === 'function' ? update(current.previewState) : update }))}
      onRevise={(artifact, view) => reviseArtifact(task, artifact, view)}>{content}</ArtifactWorkspace>;
  }

  async function copyKickoff() {
    try {
      await navigator.clipboard.writeText(kickoffPrompt);
      setCopied(true);
      showNotice('启动语已复制到剪贴板；可在 Codex 对话中粘贴并提交。', 'success');
    } catch {
      showNotice('无法访问剪贴板，请在下方启动语框中手动选择并复制。', 'error');
    }
  }

  async function createCodexHandoff(projectId) {
    const snapshot = pendingKickoff;
    let browserCopied = false;
    try { await navigator.clipboard.writeText(kickoffPrompt); browserCopied = true; } catch { /* The local bridge also tries the system clipboard. */ }
    let result;
    try { result = await createCodexThread({ projectId, prompt: kickoffPrompt, workflowLabel: pendingKickoff?.taskTitle || taskFocus }); }
    catch (error) {
      setPendingKickoff(current => isSameKickoff(current, snapshot) ? { ...current, handoff: { error: error.message, updatedAt: Date.now() } } : current);
      throw error;
    }
    const copiedPrompt = browserCopied || result.copied;
    if (isSameKickoff(pendingKickoffRef.current, snapshot)) setCopied(copiedPrompt);
    setPendingKickoff(current => isSameKickoff(current, snapshot) ? { ...current, handoffThreadId: result.threadId, handoffAt: Date.now(), handoff: { opened: result.opened, copied: copiedPrompt, updatedAt: Date.now() } } : current);
    if (snapshot?.taskId) {
      linkCodexThread(snapshot.taskId, result.threadId);
    }
    showNotice(`Codex 新对话已创建；${result.opened ? '已尝试打开' : '打开未成功，请从 Codex 最近记录进入'}；${copiedPrompt ? '启动语已复制，需自行粘贴并提交' : '剪贴板未复制成功，请在弹窗中手动复制启动语'}。`, copiedPrompt && result.opened ? 'success' : 'info');
    return { ...result, copied: copiedPrompt };
  }

  async function continueCodexHandoff() {
    const snapshot = pendingKickoff;
    if (!handoffThreadId) throw new Error('没有可接续的对话编号。');
    let browserCopied = false;
    try { await navigator.clipboard.writeText(kickoffPrompt); browserCopied = true; } catch { /* The bridge also attempts copying. */ }
    try {
      const result = await openCodexThread(handoffThreadId, kickoffPrompt);
      const handoff = { opened: result.opened, copied: browserCopied || result.copied, updatedAt: Date.now() };
      if (isSameKickoff(pendingKickoffRef.current, snapshot)) setCopied(handoff.copied);
      setPendingKickoff(current => isSameKickoff(current, snapshot) ? { ...current, handoffThreadId, handoffAt: Date.now(), handoff } : current);
      showNotice(describeHandoff(handoff), handoff.opened && handoff.copied ? 'success' : 'info');
      return { ...result, copied: handoff.copied };
    } catch (error) {
      setPendingKickoff(current => isSameKickoff(current, snapshot) ? { ...current, handoff: { error: error.message, updatedAt: Date.now() } } : current);
      throw error;
    }
  }

  async function reopenCodexThread(task) {
    if (!task?.linkedCodexThreadId) return;
    try {
      const result = await openCodexThread(task.linkedCodexThreadId);
      showNotice(result.opened ? '已尝试打开这项任务关联的 Codex 对话。' : '窗口未能打开，对话编号仍保留；请从 Codex 最近记录进入。', result.opened ? 'success' : 'info');
    } catch (error) {
      showNotice(error?.message || '无法打开关联的 Codex 对话，请在 Codex 最近记录中查找。', 'error');
    }
  }

  function openMechanism(from = activePage) {
    setShowMechanismProcess(false);
    markCheckpoint(from, taskFocus);
    const parent = from === 'ppt' && activeResearchTask?.workflowId === 'ppt' ? activeResearchTask : null;
    const task = createTask(MECHANISM_WORKFLOW, parent ? makeRelatedTaskContext(parent, MECHANISM_WORKFLOW) : {});
    setTaskFocus(MECHANISM_WORKFLOW.focus);
    navigate('mechanism', task.id);
  }

  function addFiles(event) {
    const names = [...(event.target.files || [])].map(file => file.name);
    if (names.length && activeTaskId) {
      addTaskFiles(activeTaskId, names);
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
      const status = await getVaultStatus();
      setVaultStatus(status);
      showNotice(status.restoreMessage || `已选择“${selected.name}”。尚未读取内容，请勾选范围并确认授权。`, status.connected ? 'success' : 'info');
    } finally {
      setVaultBusy(false);
    }
  }

  async function authorizeScopes(scopes) {
    setVaultBusy(true);
    try {
      const status = await authorizeVaultScopes(scopes);
      setVaultStatus(status);
      showNotice(status.memoryAvailable ? '已在本机保存授权范围。下次打开桌面版时会自动核对并恢复。' : '本次运行的读取范围已更新。', 'success');
      return status;
    } finally {
      setVaultBusy(false);
    }
  }

  async function addScopeFolder(scopeId) {
    setVaultBusy(true);
    try {
      const result = await addVaultScopeFolder(scopeId);
      if (!result.cancelled) {
        setVaultStatus(result.status);
        showNotice('已关联现有文件夹。请检查范围并重新确认该项读取授权。', 'info');
      }
      return result;
    } finally {
      setVaultBusy(false);
    }
  }

  async function removeScopeFolder(scopeId, relativePath) {
    setVaultBusy(true);
    try {
      const status = await removeVaultScopeFolder(scopeId, relativePath);
      setVaultStatus(status);
      showNotice('已移除文件夹关联，请重新确认该项读取授权。', 'info');
      return status;
    } finally {
      setVaultBusy(false);
    }
  }

  async function rememberVault() {
    setVaultBusy(true);
    try {
      const status = await rememberVaultLocation();
      setVaultStatus(status);
      showNotice('已在本机保存知识库路径、目录关联及当前授权范围。', 'success');
      return status;
    } finally { setVaultBusy(false); }
  }

  async function restoreVault() {
    setVaultBusy(true);
    try {
      const status = await restoreVaultLocation();
      setVaultStatus(status);
      setVaultStructure(null);
      showNotice(status.restoreMessage || '已找回上次的知识库位置，请核对完整路径。', status.connected ? 'success' : 'info');
      return status;
    } finally { setVaultBusy(false); }
  }

  async function forgetVault() {
    setVaultBusy(true);
    try {
      const status = await forgetVaultLocation();
      setVaultStatus(status);
      showNotice('已清除保存的知识库路径；本次已连接的库和授权不受影响。', 'info');
      return status;
    } finally { setVaultBusy(false); }
  }

  async function clearVault() {
    setVaultBusy(true);
    try {
      const status = await disconnectVault();
      setVaultStatus(status);
      setVaultStructure(null);
      showNotice('已断开知识库，并清除本机保存的位置及授权记录。', 'success');
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

  function restoreKickoff() {
    setTaskFocus(pendingKickoff?.focus || '自由讨论');
    if (pendingKickoff?.taskId) setActiveTaskId(pendingKickoff.taskId);
    setCopied(false);
    setModalOpen(true);
  }

  function renderContent() {
    if (activePage === 'start') {
      return <HomePage
        thought={homeThought}
        setThought={value => { setHomeThought(value); markCheckpoint('start', '自由讨论'); }}
        taskFocus="自由讨论"
        recovery={recovery}
        researchTasks={recentResearchTasks}
        onBegin={beginDiscussion}
        onNavigateArea={navigate}
        onResumeTask={resumeResearchTask}
        onOpenCodexThread={reopenCodexThread}
        onRestoreKickoff={restoreKickoff}
      />;
    }
    if (activePage === 'tasks') return <TasksArea tasks={recentResearchTasks} onBack={goBack} onOpenWorkflow={openWorkflow} onResumeTask={resumeResearchTask} onOpenCodexThread={reopenCodexThread} />;
    if (activePage === 'sources') return <SourcesArea onBack={goBack} onNavigate={navigate} onOpenWorkflow={openWorkflow} />;
    if (activePage === 'outputs') return <OutputsArea onBack={goBack} onOpenWorkflow={openWorkflow} onOpenMechanism={() => openMechanism('outputs')} />;
    if (workflow) {
      const task = activeResearchTask?.workflowId === workflow.id ? activeResearchTask : null;
      return withArtifactPanel(task, <WorkflowWorkspace
        workflow={workflow}
        task={task}
        onTaskChange={updateActiveTask}
        recordActions={taskRecordActions}
        thought={task?.content ?? workflow.seed}
        setThought={value => updateActiveTask('content', value)}
        files={task?.files || []}
        selectedPptTemplate={workflow.id === 'ppt' ? task?.selectedPptTemplate || null : null}
        selectedPptLogo={workflow.id === 'ppt' ? task?.selectedPptLogo || null : null}
        pptPromptChoices={task?.pptPromptChoices || PPT_PROMPT_CHOICES}
        onPptPromptChoicesChange={value => patchActiveTask({ pptPromptChoices: typeof value === 'function' ? value(task?.pptPromptChoices || PPT_PROMPT_CHOICES) : value })}
        onSelectPptTemplate={value => patchActiveTask({ selectedPptTemplate: value })}
        onSelectPptLogo={value => patchActiveTask({ selectedPptLogo: value })}
        meetingMode={task?.meetingMode || 'prepare'}
        onMeetingModeChange={value => updateActiveTask('meetingMode', value)}
        onBack={goBack}
        onBegin={beginDiscussion}
        onFilesAdded={addFiles}
        onRemoveFile={name => removeTaskFile(activeTaskId, name)}
        onOpenMechanism={() => openMechanism('ppt')}
        onViewDailyBriefs={() => navigate('daily-briefs')}
      />);
    }
    if (activePage === 'mechanism') {
      const task = activeResearchTask?.workflowId === 'mechanism' ? activeResearchTask : null;
      return withArtifactPanel(task, <MechanismWorkspace task={task} onTaskChange={updateActiveTask} recordActions={taskRecordActions} brief={task?.content ?? mechanismBrief} setBrief={value => task ? updateActiveTask('content', value) : setMechanismBrief(value)} showProcess={showMechanismProcess} setShowProcess={setShowMechanismProcess} onBack={goBack} onBegin={beginDiscussion} />);
    }
    if (activePage === 'records') return <ResearchRecordsPage canRead={vaultStatus.scopes.includes('records')} onOpenVault={() => navigate('vault')} onBack={goBack} />;
    if (activePage === 'literature') return <LiteraturePage canReadRss={vaultStatus.scopes.includes('rss')} canReadLiterature={vaultStatus.scopes.includes('literature')} onOpenVault={() => navigate('vault')} onBack={goBack} />;
    if (activePage === 'daily-briefs') return <DailyBriefsPage onBack={goBack} onBegin={beginDiscussion} />;
    if (activePage === 'archive') return <ArchivePage canRead={vaultStatus.scopes.includes('archive-read')} canWrite={vaultStatus.scopes.includes('archive-write')} onOpenVault={() => navigate('vault')} onBack={goBack} onCheckpoint={() => markCheckpoint('archive', '历史归档')} />;
    if (activePage === 'settings') return <SettingsPage artifactConnection={artifactConnection} section={settingsSection} onSectionChange={setSettingsSection} defaultProjectId={defaultCodexProjectId} onDefaultProjectChange={setDefaultCodexProjectId} onBack={goBack} taskCount={researchTasks.length} onExportBackup={exportTaskBackup} onImportBackup={importTaskBackup} vaultProps={{ status: vaultStatus, structure: vaultStructure, busy: vaultBusy, onSelect: selectVault, onRemember: rememberVault, onRestore: restoreVault, onForget: forgetVault, onAddScopeFolder: addScopeFolder, onRemoveScopeFolder: removeScopeFolder, onAuthorize: authorizeScopes, onDisconnect: clearVault, onInspectStructure: checkVaultStructure, onRepairStructure: completeVaultStructure, onBack: goBack }} />;
    return <VaultConnection status={vaultStatus} structure={vaultStructure} busy={vaultBusy} onSelect={selectVault} onRemember={rememberVault} onRestore={restoreVault} onForget={forgetVault} onAddScopeFolder={addScopeFolder} onRemoveScopeFolder={removeScopeFolder} onAuthorize={authorizeScopes} onDisconnect={clearVault} onInspectStructure={checkVaultStructure} onRepairStructure={completeVaultStructure} onBack={goBack} />;
  }

  return (
    <div className="app-frame">
      <Titlebar guideUrl={quickstartImage} frameworkUrl={frameworkImage} />
      {storageError && <div className="storage-warning" role="alert"><span>{storageError}</span><button type="button" onClick={exportTaskBackup}>立即导出备份</button></div>}
      {desktopState.error && <div className="storage-warning" role="alert"><span>{desktopState.error}</span><button type="button" onClick={exportTaskBackup}>导出当前任务</button></div>}
      <div className="app-body">
        <Sidebar activePage={activeNav} vaultName={vaultStatus.name} vaultConnected={vaultStatus.connected} onNavigate={navigate} />
        <main className="main-content">{renderContent()}</main>
      </div>
      <KickoffModal isOpen={modalOpen && Boolean(kickoffPrompt)} kickoffPrompt={kickoffPrompt} copied={copied} onCopy={copyKickoff} onCreateThread={createCodexHandoff} onContinueThread={continueCodexHandoff} linkedThreadId={handoffThreadId} handoff={pendingKickoff?.handoff} defaultProjectId={defaultCodexProjectId} preferredProjectId={pendingKickoff?.projectId || ''} onProjectChange={projectId => setPendingKickoff(current => current ? { ...current, projectId } : current)} onOpenSettings={() => { setModalOpen(false); setSettingsSection('workspace'); navigate('settings'); }} workflowLabel={pendingKickoff?.taskTitle || taskFocus} onClose={() => setModalOpen(false)} copyButtonRef={copyButtonRef} dialogRef={dialogRef} />
      <Notice message={notice.message} type={notice.type} onClose={hideNotice} />
    </div>
  );
}
