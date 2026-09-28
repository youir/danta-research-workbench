import { useEffect, useRef, useState } from 'react';
import { Titlebar } from './shared/components/Titlebar.jsx';
import { Sidebar } from './shared/components/Sidebar.jsx';
import { HomePage } from './features/home/components/HomePage.jsx';
import { VaultConnection } from './features/vault/components/VaultConnection.jsx';
import { KickoffModal } from './shared/components/KickoffModal.jsx';
import { Notice } from './shared/components/Notice.jsx';
import { UpdateNotification } from './UpdateNotification.jsx';
import { useNotice } from './shared/hooks/useNotice.js';
import { WORKFLOW_CONFIGS } from './shared/constants/workflows.js';

function makeKickoffPrompt(thought, focus) {
  const taskGuide = {
    '文献证据': '按需调用文献检索工具，标注每条证据来源，区分已核实与待验证。',
    '生信数据': '按需调用生信数据库，记录查询参数，便于结果复现。',
    '论文写作': '按需调用写作工具，依据稿件和已有证据协作，不补造结果。',
    '方法统计': '设计实验方案，进行统计分析，制作数据可视化图表。',
    '组会汇报': '按需调用 PPT 工具，先理清汇报目的和叙事主线，再制作可编辑稿。',
  }[focus];

  return [
    '使用 $danta-proposal-guide，称呼我龚博士。',
    `本次方向：${focus}。`,
    taskGuide || '先陪我把问题想清楚，区分已有事实与待核实之处。',
    '先理解我的目标和已有材料，再决定是提问、梳理还是直接动手。',
    '',
    `我现在想讨论：${thought.trim()}`,
  ].join('\n');
}

export function App() {
  const [activePage, setActivePage] = useState('start');
  const [modalOpen, setModalOpen] = useState(false);
  const [kickoff, setKickoff] = useState('');
  const [copied, setCopied] = useState(false);
  const [vaultName, setVaultName] = useState('');

  const [notice, showNotice, hideNotice] = useNotice();

  const pickerRef = useRef(null);
  const dialogRef = useRef(null);
  const copyButtonRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    const picker = pickerRef.current;
    picker?.setAttribute('webkitdirectory', '');
    picker?.setAttribute('directory', '');

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activePage]);

  const handleOpenWorkflow = (starter) => {
    if (!starter) {
      setActivePage('start');
      return;
    }

    const thought = `关于 ${starter.label}：${starter.detail}`;
    const prompt = makeKickoffPrompt(thought, starter.label);
    setKickoff(prompt);
    setModalOpen(true);
    setCopied(false);
  };

  const handleCopyKickoff = async () => {
    try {
      await navigator.clipboard.writeText(kickoff);
      setCopied(true);
      showNotice('启动语已复制到剪贴板', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      showNotice('复制失败，请手动选择文本复制', 'error');
    }
  };

  const handlePickerChange = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const first = files[0];
    const parts = first.webkitRelativePath?.split('/') || [];
    const folder = parts[0] || '未知知识库';
    setVaultName(folder);
    showNotice(`已连接知识库：${folder}`, 'success');
  };

  const vaultStatus = vaultName ? '已连接' : '未连接';

  return (
    <div className="app-frame">
      <Titlebar />

      <div className="app-body">
        <Sidebar activePage={activePage} onNavigate={setActivePage} />

        <main className="main-content">
          {activePage === 'start' && (
            <HomePage onOpenWorkflow={handleOpenWorkflow} />
          )}

          {activePage === 'workflows' && (
            <section className="workflows-page">
              <h1>工作流配置</h1>
              <div className="workflow-cards">
                {Object.entries(WORKFLOW_CONFIGS).map(([key, config]) => (
                  <div key={key} className="workflow-card">
                    <h3>{config.title}</h3>
                    <p>{config.description}</p>
                    <div className="workflow-agents">
                      {config.agents.map((agent, i) => (
                        <span key={i} className="agent-tag">{agent}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activePage === 'settings' && (
            <section className="settings-page">
              <h1>设置</h1>
              <VaultConnection
                vaultName={vaultName}
                vaultStatus={vaultStatus}
                onPickerChange={handlePickerChange}
                pickerRef={pickerRef}
              />
            </section>
          )}
        </main>
      </div>

      <KickoffModal
        isOpen={modalOpen}
        kickoffPrompt={kickoff}
        copied={copied}
        onCopy={handleCopyKickoff}
        onClose={() => setModalOpen(false)}
        copyButtonRef={copyButtonRef}
        dialogRef={dialogRef}
      />

      <Notice
        message={notice.message}
        type={notice.type}
        onClose={hideNotice}
      />

      <UpdateNotification />
    </div>
  );
}
