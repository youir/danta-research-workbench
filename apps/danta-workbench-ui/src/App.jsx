import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BookOpenText, Check, ClockCounterClockwise, Copy, FolderOpen, House, Notebook } from '@phosphor-icons/react';

const NAV_ITEMS = [
  { id: 'start', label: '开始', Icon: House },
  { id: 'records', label: '研究记录', Icon: Notebook },
  { id: 'literature', label: '文献', Icon: BookOpenText },
  { id: 'vault', label: '知识库', Icon: FolderOpen },
];
const PROMPT_STARTERS = [
  { label: '梳理选题思路', focus: '选题思路', seed: '我目前的研究方向是……想先从研究现象、已有证据和现实条件梳理思路。' },
  { label: '复盘组会 / 做 PPT', focus: '组会复盘', seed: '我想复盘最近一次组会，整理关键讨论、待解决问题和下一步；再判断是否需要做成 PPT。' },
  { label: '开始论文写作', focus: '论文写作', seed: '我准备写或修改论文的……请先帮我确认目标、现有材料和最需要解决的问题。' },
];

function makeKickoffPrompt(thought, focus) {
  return [
    '使用 $danta-proposal-guide，称呼我龚博士。',
    `本次方向：${focus}。`,
    '先陪我把问题想清楚：复述你理解的观察或困惑，区分已知事实、可能解释和待核实之处。',
    '不要替我选题或下结论；先指出最值得继续讨论的一两个问题。最终研究判断由我和导师作出。',
    '',
    `我现在想讨论：${thought.trim()}`,
  ].join('\n');
}

export function App() {
  const [activePage, setActivePage] = useState('start');
  const [thought, setThought] = useState('');
  const [taskFocus, setTaskFocus] = useState('自由讨论');
  const [kickoff, setKickoff] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState('');
  const [vaultName, setVaultName] = useState('');
  const pickerRef = useRef(null);
  const textareaRef = useRef(null);
  const dialogRef = useRef(null);
  const copyButtonRef = useRef(null);
  const noticeTimer = useRef(null);

  useEffect(() => {
    const picker = pickerRef.current;
    picker?.setAttribute('webkitdirectory', '');
    picker?.setAttribute('directory', '');
    return () => window.clearTimeout(noticeTimer.current);
  }, []);

  useEffect(() => {
    if (!modalOpen) return undefined;
    const dialog = dialogRef.current;
    const focusable = () => [...(dialog?.querySelectorAll('button:not([disabled])') || [])];
    copyButtonRef.current?.focus();
    const handleDialogKeydown = event => {
      if (event.key === 'Escape') {
        setModalOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleDialogKeydown);
    return () => {
      window.removeEventListener('keydown', handleDialogKeydown);
      textareaRef.current?.focus();
    };
  }, [modalOpen]);

  const vaultStatus = useMemo(() => (vaultName ? `已选择 · ${vaultName}` : '尚未选择 GY 知识库'), [vaultName]);

  function showNotice(message) {
    setNotice(message);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(''), 3200);
  }

  function beginDiscussion(value = thought, focus = taskFocus) {
    const clean = value.trim();
    if (!clean) {
      showNotice('先写下一件观察、困惑，或正在犹豫的决定。');
      textareaRef.current?.focus();
      return;
    }
    setThought(clean);
    setTaskFocus(focus);
    setKickoff(makeKickoffPrompt(clean, focus));
    setCopied(false);
    setModalOpen(true);
  }

  function selectPrompt({ seed, focus }) {
    setThought(seed);
    setTaskFocus(focus);
    setActivePage('start');
    textareaRef.current?.focus();
  }

  async function copyKickoff() {
    try {
      await navigator.clipboard.writeText(kickoff);
      setCopied(true);
      showNotice('启动语已复制。粘贴到 Codex 后即可继续。');
    } catch {
      showNotice('无法访问剪贴板，请手动复制启动语。');
    }
  }

  function renderPage() {
    if (activePage === 'start') {
      return (
        <section className="home-view" aria-labelledby="home-title">
          <div className="home-eyebrow">龚博士的研究工作台</div>
          <h1 id="home-title">今天，最想弄清楚什么？</h1>
          <form className="thought-form" onSubmit={event => { event.preventDefault(); beginDiscussion(); }}>
            <label className="visually-hidden" htmlFor="research-thought">写下一个研究观察、困惑或正在犹豫的决定</label>
            <textarea
              id="research-thought"
              ref={textareaRef}
              value={thought}
              onChange={event => setThought(event.target.value)}
              onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') beginDiscussion(); }}
              placeholder="写下一个观察、困惑，或正在犹豫的决定…"
              rows={5}
            />
            <button className="primary-button" type="submit">开始梳理 <ArrowRight size={20} weight="bold" aria-hidden="true" /></button>
          </form>
          <div className="quick-start-label">常用工作入口</div>
          <div className="prompt-starters" aria-label="常用科研工作">
            {PROMPT_STARTERS.map(({ label, focus, seed }) => (
              <button key={label} onClick={() => selectPrompt({ seed, focus })} type="button">{label}</button>
            ))}
          </div>
          <div className="resume-row" aria-label="最近研究记录状态">
            <ClockCounterClockwise size={22} weight="regular" aria-hidden="true" />
            <span className="resume-label">最近研究记录</span>
            <span className="resume-divider" aria-hidden="true" />
            <span className="resume-summary">尚未连接 GY；连接后再显示真实记录</span>
            <button className="inline-link" type="button" onClick={() => setActivePage('vault')}>查看连接</button>
          </div>
          <p className="local-note">本机界面 · 未读取 GY 内容 · 研究判断由龚博士和导师作出</p>
        </section>
      );
    }

    if (activePage === 'records') {
      return (
        <section className="subpage-view" aria-labelledby="records-title">
          <div className="home-eyebrow">持续研究</div>
          <h1 id="records-title">研究记录</h1>
          <p className="subpage-lede">重要想法、证据和决定，最后都回到龚博士的知识库中。</p>
          <div className="empty-state">
            <Notebook size={30} weight="light" aria-hidden="true" />
            <h2>尚未连接研究记录</h2>
            <p>本原型不展示虚构记录。正式版需先确认授权范围，再显示真实内容。</p>
            <button className="text-button" onClick={() => setActivePage('vault')} type="button">查看连接方式 <ArrowRight size={16} /></button>
          </div>
          <div className="demo-resume"><span className="demo-label">下一步</span><span>连接 GY 后，这里可展示真实研究记录和待跟进问题。</span></div>
        </section>
      );
    }

    if (activePage === 'literature') {
      return (
        <section className="subpage-view" aria-labelledby="literature-title">
          <div className="home-eyebrow">文献线索</div>
          <h1 id="literature-title">文献与信息源</h1>
          <p className="subpage-lede">RSS 线索会先由龚博士复核，再决定是否进入正式文献记录。</p>
          <div className="empty-state">
            <BookOpenText size={30} weight="light" aria-hidden="true" />
            <h2>还没有连接文献线索</h2>
            <p>当前原型不读取 RSS 缓存。正式版可从 GY 中的科研信息源插件读取待复核条目。</p>
            <button className="text-button" onClick={() => setActivePage('vault')} type="button">查看知识库连接 <ArrowRight size={16} /></button>
          </div>
        </section>
      );
    }

    return (
      <section className="subpage-view" aria-labelledby="vault-title">
        <div className="home-eyebrow">本机资料</div>
        <h1 id="vault-title">知识库连接</h1>
        <p className="subpage-lede">先指定龚博士的 GY 文件夹。此原型只记住所选文件夹名称，不扫描、不读取或上传其中内容。</p>
        <div className="vault-panel">
          <div className={`vault-status-mark ${vaultName ? 'is-selected' : ''}`} aria-hidden="true" />
          <div className="vault-panel-copy">
            <strong>{vaultStatus}</strong>
            <span>{vaultName ? '文件夹名称已选择 · 尚未读取内容' : '选择后可预览连接状态；正式读取须另行确认范围'}</span>
          </div>
          <button className="secondary-button" type="button" onClick={() => pickerRef.current?.click()}><FolderOpen size={18} aria-hidden="true" />{vaultName ? '重新选择' : '选择 GY 文件夹'}</button>
        </div>
        <div className="connection-explainer">
          <h2>连接后计划显示</h2>
          <ul><li>当前研究状态与最近记录</li><li>由龚博士保存到知识库的 RSS 待复核线索</li><li>各工作流的入口和已确认的下一步</li></ul>
          <p>读取研究资料、初始扫描或调用第三方服务，都需要在正式版中单独说明范围并征得龚博士同意。</p>
        </div>
      </section>
    );
  }

  return (
    <div className="app-frame">
      <header className="titlebar"><span className="titlebar-brand">龚博士科研工作台</span><span className="titlebar-caption">思维优先 · 决策在人</span></header>
      <div className="app-body">
        <aside className="sidebar" aria-label="主导航">
          <button className="vault-status" type="button" onClick={() => setActivePage('vault')}>
            <span className={`status-dot ${vaultName ? 'connected' : ''}`} aria-hidden="true" />
            <span className="vault-status-label">{vaultName ? `${vaultName} · 已选择` : 'GY 本机知识库 · 未连接'}</span>
          </button>
          <nav className="primary-nav">
            {NAV_ITEMS.map(({ id, label, Icon }) => (
              <button key={id} className={`nav-item ${activePage === id ? 'active' : ''}`} type="button" aria-current={activePage === id ? 'page' : undefined} onClick={() => setActivePage(id)}>
                <Icon size={21} weight={activePage === id ? 'regular' : 'light'} aria-hidden="true" /><span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-footer"><span>与思考同行</span><span>让好问题生长</span></div>
        </aside>
        <main className="main-content">{renderPage()}</main>
      </div>
      <input ref={pickerRef} className="visually-hidden" type="file" onChange={event => {
        const first = event.target.files?.[0];
        if (!first) return;
        const rootName = first.webkitRelativePath?.split('/')[0] || first.name;
        setVaultName(rootName);
        showNotice(`已记下文件夹名称“${rootName}”；原型没有读取文件内容。`);
        event.target.value = '';
      }} aria-label="选择 GY 知识库文件夹" />
      {notice && <div className="toast" role="status">{notice}</div>}
      {modalOpen && (
        <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setModalOpen(false); }}>
          <section ref={dialogRef} className="kickoff-dialog" role="dialog" aria-modal="true" aria-labelledby="kickoff-title">
            <div className="dialog-heading"><div><div className="home-eyebrow">下一步</div><h2 id="kickoff-title">启动语已整理好</h2></div><button className="dialog-close" type="button" aria-label="关闭" onClick={() => setModalOpen(false)}>×</button></div>
            <p className="dialog-note">复制后粘贴到 Codex，即可从这个问题开始讨论。此原型不会自动启动 Codex，也不会读取 GY。</p>
            <pre className="kickoff-preview">{kickoff}</pre>
            <div className="dialog-actions"><button className="secondary-button" type="button" onClick={() => setModalOpen(false)}>返回修改</button><button ref={copyButtonRef} className="primary-button compact" type="button" onClick={copyKickoff}>{copied ? <Check size={18} weight="bold" /> : <Copy size={18} />}{copied ? '已复制' : '复制启动语'}</button></div>
          </section>
        </div>
      )}
    </div>
  );
}
