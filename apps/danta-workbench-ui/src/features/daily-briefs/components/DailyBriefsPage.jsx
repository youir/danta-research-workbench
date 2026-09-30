import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowClockwise, ArrowDown, ArrowSquareOut, CalendarBlank, Clock, FileImage, FolderOpen, ImageSquare, Pause, Play, ShareNetwork, Sparkle, UploadSimple, X } from '@phosphor-icons/react';
import { listDailyBriefFiles, loadDirectoryHandle, parseDailyBriefFile, saveDirectoryHandle } from '../utils/dailyBriefFiles.js';
import { renderDailyBriefPoster } from '../utils/renderDailyBriefPoster.js';
import { PageBack } from '../../../shared/components/PageBack.jsx';
import { usePersistentState } from '../../../shared/hooks/usePersistentState.js';

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function reportLabel(report) {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(`${report.date}T00:00:00`));
}

function fileNameFor(report) {
  return `科研日报_${report.date}_分享长图.png`;
}

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function DailyBriefsPage({ onBack, onBegin }) {
  const [directoryHandle, setDirectoryHandle] = useState(null);
  const [reports, setReports] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [automationTime, setAutomationTime] = usePersistentState('dailyBriefAutomationTime', '');
  const importRef = useRef(null);
  const objectUrlRef = useRef('');
  const selectedReport = useMemo(() => reports.find(report => report.id === selectedId) || reports[0] || null, [reports, selectedId]);
  const today = localDateKey();
  const todayReport = reports.find(report => report.date === today) || null;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '本机时区';

  function startTodayReport() {
    const outputFile = `brief-${today}${todayReport ? '-v2' : ''}.html`;
    const folderNote = directoryHandle
      ? `工作台当前连接的归档文件夹名：${directoryHandle.name}。请检查所选 Codex 工作区是否能访问这个文件夹；浏览器不会把文件夹的完整路径传给 Codex。`
      : '工作台尚未连接日报归档文件夹。请先确认所选 Codex 工作区中的输出位置；若无法确认路径，先询问我，不要猜测。';
    const prompt = [
      `请为 ${today} 制作一份生物科研动态日报。`,
      '调用 $danta-bio-daily-briefing；只围绕我已确认的研究兴趣和明确可访问的信息源检索、筛选与整理。',
      '每条线索标注标题、来源链接、发布日期、证据类型、实际阅读范围、简要内容、与研究兴趣的关联和需要谨慎解释之处。注明检索时间、覆盖范围与未能访问的来源。没有可靠的新线索时，明确写出空结果与检查范围；不要补造文献、研究发现或用户兴趣。',
      folderNote,
      `将文件命名为 ${outputFile}。${todayReport ? '保留已归档版本；若 v2 文件也存在，继续使用下一个未占用的版本号。' : '若目标文件已存在，不要覆盖；先检查并使用下一个未占用的版本号。'}`,
      '完成后告诉我文件的完整保存位置和文件名；我会返回工作台刷新归档。',
    ].join('\n\n');
    onBegin?.(prompt, '生物科研日报');
  }

  function startAutomationSetup() {
    if (!automationTime) {
      setStatus('请先选择自动化运行时间。');
      return;
    }
    const folderNote = directoryHandle
      ? `工作台当前连接的日报归档文件夹名是“${directoryHandle.name}”。请在创建前确认所选 Codex 工作区可以访问它；工作台不会把完整路径传给 Codex。`
      : '工作台尚未连接日报归档文件夹。请先选择并确认 Codex 工作区中的具体输出位置，不要猜测路径。';
    const prompt = [
      '请帮我在 Codex 中设置一项原生的每日科研日报自动化，名称为“生物科研日报”。',
      `每天 ${automationTime}（时区 ${timeZone}）运行。调用 $danta-bio-daily-briefing，只使用我已确认的研究兴趣和明确可访问的信息源。`,
      '日报逐条列出标题、来源链接、发布日期、证据类型、实际阅读范围、关联理由和局限，并记录检索时间、覆盖范围及未能访问的来源。没有可靠的新线索时写明空结果，不得补造文献或研究发现。',
      folderNote,
      `文件按日期命名为 brief-YYYY-MM-DD.html。任务应先确认目标工作区、输出目录和运行时间；同日文件已经存在时不得静默覆盖。`,
      '请先向我展示自动化的名称、运行时间及时区、使用范围、输出位置和覆盖策略；只有我确认后，才在 Codex 中创建或更新自动化。避免重复创建同名任务。',
    ].join('\n\n');
    onBegin?.(prompt, '生物科研日报');
  }

  function startAutomationPause() {
    const prompt = [
      '请在 Codex 中查找名为“生物科研日报”的原生自动化。',
      '如果找到唯一匹配项，请先告诉我它的当前运行状态、时间和时区，再暂停后续运行；保留原配置和已生成日报，不要删除任务。',
      '如果找到多个匹配项，先列出名称和时间并让我选择；如果没有找到，请说明情况，不要新建任务或更改其他自动化。',
      '完成后明确告诉我暂停是否成功。工作台无法读取 Codex 自动化状态，最终状态以 Codex 中显示的结果为准。',
    ].join('\n\n');
    onBegin?.(prompt, '生物科研日报');
  }

  const refreshDirectory = useCallback(async (handle, requestPermission = false) => {
    if (!handle) return;
    setBusy(true);
    try {
      let permission = await handle.queryPermission({ mode: 'read' });
      if (permission !== 'granted' && requestPermission) permission = await handle.requestPermission({ mode: 'read' });
      if (permission !== 'granted') {
        setStatus(`已记住“${handle.name}”目录。请在此工作台重新授予读取权限后刷新日报。`);
        return;
      }
      const nextReports = await listDailyBriefFiles(handle);
      setDirectoryHandle(handle);
      setReports(nextReports);
      setSelectedId(current => nextReports.some(report => report.id === current) ? current : nextReports[0]?.id || '');
      setStatus(nextReports.length ? `已读取 ${nextReports.length} 份日报；内容仅在本机浏览器中处理。` : `已连接“${handle.name}”，还没有找到可识别的日报 HTML 或 JSON 文件。`);
    } catch (error) {
      setStatus(error?.message || '读取目录失败。请重新选择日报归档文件夹。');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    loadDirectoryHandle().then(async handle => {
      if (!active || !handle) return;
      setDirectoryHandle(handle);
      const permission = await handle.queryPermission({ mode: 'read' });
      if (permission === 'granted') await refreshDirectory(handle);
      else setStatus(`上次选择的目录是“${handle.name}”。点击“重新授权并刷新”继续读取。`);
    }).catch(() => {
      if (active) setStatus('当前工作台暂不支持记住目录；仍可用下方“导入日报文件”临时查看。');
    });
    return () => { active = false; };
  }, [refreshDirectory]);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  useEffect(() => {
    if (!preview) return undefined;
    const onKeyDown = event => { if (event.key === 'Escape') setPreview(null); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [preview]);

  async function chooseDirectory() {
    if (!window.showDirectoryPicker) {
      setStatus('当前工作台不支持直接连接文件夹。可使用“导入日报文件”选择日报 HTML 或 JSON。');
      return;
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: 'read' });
      await saveDirectoryHandle(handle);
      await refreshDirectory(handle, true);
    } catch (error) {
      if (error?.name !== 'AbortError') setStatus(error?.message || '无法连接所选文件夹。');
    }
  }

  async function importFiles(event) {
    const files = [...(event.target.files || [])];
    if (!files.length) return;
    setBusy(true);
    const loaded = (await Promise.all(files.map(file => parseDailyBriefFile(file)))).filter(Boolean);
    setReports(current => {
      const byId = new Map(current.map(report => [report.id, report]));
      loaded.forEach(report => byId.set(report.id, report));
      return [...byId.values()].sort((a, b) => b.date.localeCompare(a.date));
    });
    if (loaded.length) {
      setSelectedId(loaded[0].id);
      setStatus(`已导入 ${loaded.length} 份日报。重新打开工作台后需再次导入；如需刷新归档，请连接输出目录。`);
    } else setStatus('没有识别到日报内容。请选用日报 HTML 或 JSON 文件。');
    setBusy(false);
    event.target.value = '';
  }

  async function exportPoster() {
    if (!selectedReport) return;
    setImageBusy(true);
    setStatus('正在排版并生成长图……');
    try {
      const blob = await renderDailyBriefPoster(selectedReport);
      saveBlob(blob, fileNameFor(selectedReport));
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = URL.createObjectURL(blob);
      setPreview({ url: objectUrlRef.current, name: fileNameFor(selectedReport) });
      setStatus('长图已生成并开始下载。可以预览后分享 PNG 文件。');
    } catch (error) {
      setStatus(error?.message || '生成长图失败。');
    } finally {
      setImageBusy(false);
    }
  }

  async function sharePoster() {
    if (!preview || !navigator.share || !navigator.canShare) return;
    try {
      const response = await fetch(preview.url);
      const file = new File([await response.blob()], preview.name, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: selectedReport?.title || '科研日报' });
      else saveBlob(file, preview.name);
    } catch (error) {
      if (error?.name !== 'AbortError') setStatus('分享未完成；可保存 PNG 后通过常用应用分享。');
    }
  }

  function closePreview() {
    setPreview(null);
  }

  return (
    <section className="daily-briefs-page" aria-labelledby="daily-briefs-title">
      <PageBack onBack={onBack} />
      <div className="home-eyebrow">生物科研工作台 · 日报归档</div>
      <div className="daily-briefs-heading">
        <div><h1 id="daily-briefs-title">生物科研日报</h1><p>制作当日研究动态、管理 Codex 自动化，并查看已归档日报和来源。</p></div>
        <span className="daily-local-pill"><span className="status-dot selected" aria-hidden="true" />本机读取</span>
      </div>

      <div className="daily-actions-grid">
        <section className="daily-action-card daily-run-card" aria-labelledby="daily-run-title">
          <div className="daily-action-heading"><div><span className="panel-kicker">今日日报 · {today}</span><h2 id="daily-run-title">{todayReport ? '今天已有日报归档' : '开始制作今天的日报'}</h2></div><span className={`daily-state-pill${todayReport ? ' is-ready' : ''}`}>{todayReport ? '已归档' : '尚未归档'}</span></div>
          <p>{todayReport ? `${todayReport.sections.reduce((count, section) => count + section.items.length, 0)} 条线索 · ${todayReport.fileName}` : '工作台会整理一段任务说明并交给 Codex。你在 Codex 检查、粘贴并提交后，回到这里刷新归档。'}</p>
          <button className="primary-button compact" type="button" onClick={startTodayReport} disabled={!onBegin}><Sparkle size={17} aria-hidden="true" />{todayReport ? '制作新版本' : '制作今日日报'}</button>
        </section>

        <section className="daily-action-card daily-automation-card" aria-labelledby="daily-automation-title">
          <div className="daily-action-heading"><div><span className="panel-kicker">自动化 · 由 Codex 管理</span><h2 id="daily-automation-title">每日自动生成</h2></div><span className="daily-state-pill is-managed">状态需在 Codex 确认</span></div>
          <p>工作台不能读取自动化的开关状态。开启或暂停请求会在 Codex 中确认；这里不会显示未经核实的“已开启”。</p>
          <div className="daily-automation-controls">
            <label className="daily-time-field"><span>每天运行时间</span><span className="daily-time-input"><Clock size={16} aria-hidden="true" /><input type="time" value={automationTime} onChange={event => setAutomationTime(event.target.value)} aria-label="选择每日自动化运行时间" /></span></label>
            <span className="daily-timezone">时区：{timeZone}</span>
          </div>
          <div className="daily-automation-actions">
            <button className="primary-button compact" type="button" onClick={startAutomationSetup} disabled={!onBegin}><Play size={16} aria-hidden="true" />在 Codex 中设置 / 开启</button>
            <button className="secondary-button compact" type="button" onClick={startAutomationPause} disabled={!onBegin}><Pause size={16} aria-hidden="true" />请求暂停</button>
          </div>
          <div className="daily-automation-note" role="note">暂停会保留任务配置和历史日报。请求提交后，请以 Codex 中的确认结果为准。</div>
        </section>
      </div>

      <section className="daily-connect-panel" aria-labelledby="daily-connect-title">
        <div className="daily-connect-copy"><span className="panel-kicker">连接日报归档</span><h2 id="daily-connect-title">选择 Codex 工作区可访问的日报文件夹</h2><p>选择存放 `brief-YYYY-MM-DD.html` 日报的文件夹。工作台只读取这里的 HTML / JSON 文件；创建日报时，还需在 Codex 中确认该工作区能访问同一目录。</p></div>
        <div className="daily-connect-actions">
          <button className="primary-button compact" type="button" onClick={chooseDirectory} disabled={busy}><FolderOpen size={17} aria-hidden="true" />{directoryHandle ? '更换日报文件夹' : '选择日报文件夹'}</button>
          {directoryHandle && <button className="secondary-button" type="button" onClick={() => refreshDirectory(directoryHandle, true)} disabled={busy}><ArrowClockwise size={17} aria-hidden="true" />刷新日报</button>}
          <button className="text-button" type="button" onClick={() => importRef.current?.click()} disabled={busy}><UploadSimple size={16} aria-hidden="true" />导入日报文件</button>
          <input ref={importRef} className="visually-hidden" type="file" accept=".html,.htm,.json,text/html,application/json" multiple onChange={importFiles} aria-label="导入日报 HTML 或 JSON 文件" />
        </div>
        <div className="daily-connect-status" aria-live="polite">{status || '支持主工作台的 brief-日期.html 日报，以及带日期的科研动态日报 HTML。'}</div>
      </section>

      {reports.length ? (
        <div className="daily-briefs-grid">
          <aside className="daily-report-list" aria-label="已读取的日报">
            <div className="daily-list-heading"><h2>日报档案</h2><span>{reports.length} 份</span></div>
            {reports.map(report => (
              <button type="button" key={report.id} className={`daily-report-choice${selectedReport?.id === report.id ? ' is-selected' : ''}`} aria-pressed={selectedReport?.id === report.id} onClick={() => { setSelectedId(report.id); setPreview(null); }}>
                <CalendarBlank size={17} aria-hidden="true" /><span><strong>{reportLabel(report)}</strong><small>{report.title} · {report.sections.reduce((count, section) => count + section.items.length, 0)} 条线索</small></span><ArrowSquareOut size={15} aria-hidden="true" />
              </button>
            ))}
          </aside>

          {selectedReport && <article className="daily-report-detail">
            <header className="daily-report-header"><div><span className="panel-kicker">{reportLabel(selectedReport)}</span><h2>{selectedReport.title}</h2><p>{selectedReport.intro || selectedReport.scope || '本期日报内容'}</p></div><button className="primary-button compact" type="button" onClick={exportPoster} disabled={imageBusy}><FileImage size={18} aria-hidden="true" />{imageBusy ? '正在生成…' : '制作分享长图'}</button></header>
            {selectedReport.coverage && <div className="daily-report-coverage"><strong>覆盖范围</strong><span>{selectedReport.coverage}</span></div>}
            {selectedReport.sections.length ? selectedReport.sections.map((section, sectionIndex) => <section className="daily-report-section" key={`${section.title}-${sectionIndex}`}><h3>{section.title}</h3>{section.items.map((item, index) => <article className="daily-report-item" key={`${item.title}-${index}`}><div className="daily-item-meta">{[item.evidence, item.published, item.readDepth].filter(Boolean).map(label => <span key={label}>{label}</span>)}</div><h4>{item.title}</h4>{item.summary && <p>{item.summary}</p>}{item.relevance && <p className="daily-item-relevance"><strong>为什么可能相关：</strong>{item.relevance}</p>}{item.question && <p className="daily-item-question"><strong>可继续追问：</strong>{item.question}</p>}<div className="daily-item-source">{item.source && <span>{item.source}</span>}{item.url && <a href={item.url} target="_blank" rel="noreferrer">查看来源 <ArrowSquareOut size={13} aria-hidden="true" /></a>}</div></article>)}</section>) : <div className="daily-empty-content"><ImageSquare size={28} aria-hidden="true" /><p>{selectedReport.intro || '这是一份空状态日报，未列出新的研究线索。'}</p></div>}
            {selectedReport.unavailable.length > 0 && <div className="daily-report-unavailable"><strong>未能访问：</strong>{selectedReport.unavailable.join('、')}</div>}
            <footer className="daily-report-footer">日报是研究动态导航；证据等级和阅读范围以原始来源为准。文件：{selectedReport.fileName}</footer>
          </article>}
        </div>
      ) : (
        <section className="daily-empty-state"><div className="daily-empty-icon"><ImageSquare size={28} aria-hidden="true" /></div><h2>连接输出文件夹后，这里会显示已归档的日报</h2><p>可在上方准备今日日报或 Codex 自动化。Codex 完成后返回此页刷新归档；也可以导入单份 HTML / JSON 文件预览。</p></section>
      )}

      {preview && <div className="daily-poster-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closePreview(); }}><section className="daily-poster-dialog" role="dialog" aria-modal="true" aria-labelledby="daily-poster-title"><header><div><span className="panel-kicker">PNG · 长图预览</span><h2 id="daily-poster-title">{preview.name}</h2></div><button className="icon-button" type="button" aria-label="关闭预览" onClick={closePreview}><X size={20} /></button></header><div className="daily-poster-preview"><img src={preview.url} alt={`${selectedReport?.title || '科研日报'}分享长图预览`} /></div><footer><span>图片包含日报摘要、来源信息与阅读范围。</span><div><button className="secondary-button" type="button" onClick={sharePoster} disabled={!navigator.share}><ShareNetwork size={16} aria-hidden="true" />分享</button><button className="primary-button compact" type="button" onClick={() => fetch(preview.url).then(response => response.blob()).then(blob => saveBlob(blob, preview.name))}><ArrowDown size={16} aria-hidden="true" />保存 PNG</button></div></footer></section></div>}
    </section>
  );
}
