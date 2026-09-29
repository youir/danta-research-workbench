import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowClockwise, ArrowDown, ArrowSquareOut, CalendarBlank, FileImage, FolderOpen, ImageSquare, ShareNetwork, UploadSimple, X } from '@phosphor-icons/react';
import { listDailyBriefFiles, loadDirectoryHandle, parseDailyBriefFile, saveDirectoryHandle } from '../utils/dailyBriefFiles.js';
import { renderDailyBriefPoster } from '../utils/renderDailyBriefPoster.js';
import { PageBack } from '../../../shared/components/PageBack.jsx';

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

export function DailyBriefsPage({ onBack }) {
  const [directoryHandle, setDirectoryHandle] = useState(null);
  const [reports, setReports] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [imageBusy, setImageBusy] = useState(false);
  const importRef = useRef(null);
  const objectUrlRef = useRef('');
  const selectedReport = useMemo(() => reports.find(report => report.id === selectedId) || reports[0] || null, [reports, selectedId]);

  const refreshDirectory = useCallback(async (handle, requestPermission = false) => {
    if (!handle) return;
    setBusy(true);
    try {
      let permission = await handle.queryPermission({ mode: 'read' });
      if (permission !== 'granted' && requestPermission) permission = await handle.requestPermission({ mode: 'read' });
      if (permission !== 'granted') {
        setStatus(`已记住“${handle.name}”目录。请在此浏览器中重新授予读取权限后刷新日报。`);
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
      if (active) setStatus('此浏览器暂不支持记住目录；仍可用下方“导入日报文件”临时查看。');
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
      setStatus('当前浏览器不支持直接连接文件夹。可使用“导入日报文件”选择日报 HTML 或 JSON。');
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
      setStatus(`已导入 ${loaded.length} 份日报。刷新网页后需重新导入；如需自动刷新，请连接任务输出目录。`);
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
        <div><h1 id="daily-briefs-title">生物科研日报</h1><p>查看 Codex 定时任务写入的日报，逐条核对来源，并制作可分享的竖版长图。</p></div>
        <span className="daily-local-pill"><span className="status-dot selected" aria-hidden="true" />本机读取</span>
      </div>

      <section className="daily-connect-panel" aria-labelledby="daily-connect-title">
        <div className="daily-connect-copy"><span className="panel-kicker">连接日报归档</span><h2 id="daily-connect-title">选择 Codex 定时任务的输出文件夹</h2><p>可选择存放 `brief-YYYY-MM-DD.html` 日报的文件夹。网页会读取其中可识别的 HTML / JSON 日报，并记住文件夹以便下次刷新；内容不会上传。</p></div>
        <div className="daily-connect-actions">
          <button className="primary-button compact" type="button" onClick={chooseDirectory} disabled={busy}><FolderOpen size={17} aria-hidden="true" />{directoryHandle ? '更换日报文件夹' : '选择日报文件夹'}</button>
          {directoryHandle && <button className="secondary-button" type="button" onClick={() => refreshDirectory(directoryHandle, true)} disabled={busy}><ArrowClockwise size={17} aria-hidden="true" />重新授权并刷新</button>}
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
        <section className="daily-empty-state"><div className="daily-empty-icon"><ImageSquare size={28} aria-hidden="true" /></div><h2>连接后，这里会显示已生成的日报</h2><p>定时任务写出的 HTML / JSON 文件可直接读取。也可以先导入单份文件预览。</p></section>
      )}

      {preview && <div className="daily-poster-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closePreview(); }}><section className="daily-poster-dialog" role="dialog" aria-modal="true" aria-labelledby="daily-poster-title"><header><div><span className="panel-kicker">PNG · 长图预览</span><h2 id="daily-poster-title">{preview.name}</h2></div><button className="icon-button" type="button" aria-label="关闭预览" onClick={closePreview}><X size={20} /></button></header><div className="daily-poster-preview"><img src={preview.url} alt={`${selectedReport?.title || '科研日报'}分享长图预览`} /></div><footer><span>图片包含日报摘要、来源信息与阅读范围。</span><div><button className="secondary-button" type="button" onClick={sharePoster} disabled={!navigator.share}><ShareNetwork size={16} aria-hidden="true" />分享</button><button className="primary-button compact" type="button" onClick={() => fetch(preview.url).then(response => response.blob()).then(blob => saveBlob(blob, preview.name))}><ArrowDown size={16} aria-hidden="true" />保存 PNG</button></div></footer></section></div>}
    </section>
  );
}
