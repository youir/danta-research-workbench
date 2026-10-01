import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import DOMPurify from 'dompurify';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { readArtifact } from './artifactApi.js';

let pdfModule;
function pdfLibrary() {
  pdfModule ||= import('pdfjs-dist/build/pdf.mjs').then(module => { module.GlobalWorkerOptions.workerSrc = workerUrl; return module; });
  return pdfModule;
}
const clampZoom = value => Math.max(0.5, Math.min(2, Number(value) || 1));
const htmlPolicy = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-src 'none'";

function PdfViewer({ bytes, view, onViewChange, onReady, onRenderStart }) {
  const [document, setDocument] = useState(null);
  const [error, setError] = useState('');
  const [rendering, setRendering] = useState(false);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [width, setWidth] = useState(600);
  const readyRef = useRef(onReady); readyRef.current = onReady;
  const startRef = useRef(onRenderStart); startRef.current = onRenderStart;
  const page = Math.max(1, Math.min(document?.numPages || 1, Number(view.page) || 1));
  const zoom = clampZoom(view.zoom);

  useEffect(() => {
    let active = true;
    let loading;
    let timer;
    setError(''); setDocument(null);
    pdfLibrary().then(pdf => {
      if (!active) return;
      loading = pdf.getDocument({ data: new Uint8Array(bytes.slice(0)), isEvalSupported: false, enableXfa: false, cMapUrl: '/pdf-resources/cmaps/', cMapPacked: true, standardFontDataUrl: '/pdf-resources/standard_fonts/', wasmUrl: '/pdf-resources/wasm/' });
      timer = window.setTimeout(() => { if (active) { setError('PDF 解析超时，请打开原件或提供较小的预览。'); void loading.destroy(); } }, 30000);
      return loading.promise.then(doc => { if (active) setDocument(doc); });
    }).catch(error => { if (active) setError(error.name === 'PasswordException' ? 'PDF 有密码保护，请提供可读取的预览。' : 'PDF 无法解析，请打开原件或重新生成预览。'); }).finally(() => window.clearTimeout(timer));
    return () => { active = false; window.clearTimeout(timer); void loading?.destroy(); };
  }, [bytes]);
  useEffect(() => {
    const observer = new ResizeObserver(entries => setWidth(Math.max(200, entries[0].contentRect.width - 28)));
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (document && view.page !== page) onViewChange({ page });
  }, [document, page, view.page]);
  useEffect(() => {
    if (!document) return;
    let active = true;
    let renderingTask;
    let deadline;
    setError(''); setRendering(true);
    startRef.current?.();
    document.getPage(page).then(pdfPage => {
      if (!active || !canvasRef.current) return;
      const unit = pdfPage.getViewport({ scale: 1 });
      const scale = Math.min(width / unit.width * zoom, 4000 / Math.max(unit.width, unit.height), Math.sqrt(8_000_000 / (unit.width * unit.height)));
      const viewport = pdfPage.getViewport({ scale });
      const canvas = canvasRef.current;
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      renderingTask = pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport });
      deadline = window.setTimeout(() => { if (active) { renderingTask.cancel(); setError('本页渲染耗时过长，请打开原件。'); } }, 30000);
      return renderingTask.promise.then(() => { if (active) readyRef.current?.(); });
    }).catch(error => { if (active && error.name !== 'RenderingCancelledException') setError('本页显示失败，请切换页码或打开原件。'); }).finally(() => { window.clearTimeout(deadline); if (active) setRendering(false); });
    return () => { active = false; window.clearTimeout(deadline); renderingTask?.cancel(); };
  }, [document, page, zoom, width]);

  return <div className="pdf-viewer">
    <div className="artifact-viewer-tools">
      <button type="button" disabled={page <= 1 || !document} onClick={() => onViewChange({ page: page - 1, scroll: 0 })}>上一页</button>
      <label>页码 <input aria-label="PDF 页码" type="number" min="1" max={document?.numPages || 1} value={page} disabled={!document} onChange={event => onViewChange({ page: Math.max(1, Math.min(document?.numPages || 1, Number(event.target.value) || 1)), scroll: 0 })} /></label>
      <span>/ {document?.numPages || '…'}</span>
      <button type="button" disabled={!document || page >= document.numPages} onClick={() => onViewChange({ page: page + 1, scroll: 0 })}>下一页</button>
      <Zoom value={zoom} onChange={zoom => onViewChange({ zoom })} />
    </div>
    {error && <p className="artifact-error" role="status">{error}</p>}
    <div ref={containerRef} className="pdf-canvas-wrap" aria-busy={rendering}>
      {!document && !error && <p className="artifact-loading">正在读取 PDF…</p>}
      <canvas ref={canvasRef} aria-label={`PDF 第 ${page} 页`} />
    </div>
    <p className="artifact-small-note">PDF 为视觉预览；原件中的文字和图表可通过“打开原件”查看。</p>
  </div>;
}
function Zoom({ value, onChange }) {
  return <label>缩放 <select aria-label="预览缩放" value={clampZoom(value)} onChange={event => onChange(Number(event.target.value))}>{[0.5, 0.75, 1, 1.25, 1.5, 2].map(value => <option key={value} value={value}>{Math.round(value * 100)}%</option>)}</select></label>;
}

export function ArtifactViewer({ taskId, artifact, view, onViewChange }) {
  const [content, setContent] = useState(null);
  const [error, setError] = useState('');
  const scroller = useRef(null);
  const viewRef = useRef(view); viewRef.current = view;
  const onChangeRef = useRef(onViewChange); onChangeRef.current = onViewChange;
  const scrollTimer = useRef(null);
  const ready = useRef(false);
  const restoreScroll = () => { if (scroller.current) scroller.current.scrollTop = viewRef.current.scroll || 0; ready.current = true; };

  useEffect(() => {
    const controller = new AbortController();
    let url;
    ready.current = false;
    setContent(null); setError('');
    readArtifact(taskId, artifact, controller.signal).then(async response => {
      if (artifact.ext === '.pdf') return { bytes: await response.arrayBuffer() };
      if (['.md', '.txt', '.html', '.htm'].includes(artifact.ext)) {
        const text = await response.text();
        if (['.html', '.htm'].includes(artifact.ext)) {
          const sanitized = DOMPurify.sanitize(text, { WHOLE_DOCUMENT: false, FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'meta', 'link', 'base', 'svg', 'math'], FORBID_ATTR: ['href', 'srcset', 'action', 'formaction', 'target'] });
          return { html: `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${htmlPolicy}"><meta name="referrer" content="no-referrer"><style>body{margin:24px;font:16px/1.7 system-ui;color:#172a43;background:#fff;overflow-wrap:anywhere}img{max-width:100%}</style></head><body>${sanitized}</body></html>` };
        }
        return { text };
      }
      const blob = await response.blob();
      if (controller.signal.aborted) return null;
      url = URL.createObjectURL(blob);
      return { url };
    }).then(result => { if (!controller.signal.aborted) setContent(result); else if (url) URL.revokeObjectURL(url); })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => {
      controller.abort(); if (url) URL.revokeObjectURL(url);
      window.clearTimeout(scrollTimer.current);
      if (ready.current && scroller.current) onChangeRef.current({ scroll: scroller.current.scrollTop });
    };
  }, [taskId, artifact.key, artifact.fingerprint]);
  useEffect(() => {
    if (!scroller.current || !content || content.bytes || content.url) return;
    const frame = requestAnimationFrame(restoreScroll);
    return () => cancelAnimationFrame(frame);
  }, [content]);
  useEffect(() => { if (scroller.current && view.scroll === 0) scroller.current.scrollTop = 0; }, [view.page]);

  return <div ref={scroller} className="artifact-document-scroll" onScroll={event => {
    if (!ready.current) return;
    const scroll = event.currentTarget.scrollTop;
    window.clearTimeout(scrollTimer.current);
    scrollTimer.current = window.setTimeout(() => onChangeRef.current({ scroll }), 180);
  }}>
    {error && <p className="artifact-error" role="status">{error}</p>}
    {!content && !error && <p className="artifact-loading">正在读取本机成果…</p>}
    {content?.bytes && <PdfViewer bytes={content.bytes} view={view} onViewChange={onViewChange} onReady={restoreScroll} onRenderStart={() => { ready.current = false; window.clearTimeout(scrollTimer.current); }} />}
    {content?.url && <><div className="artifact-viewer-tools"><Zoom value={view.zoom} onChange={zoom => onViewChange({ zoom })} /></div><div className="artifact-image-wrap"><img src={content.url} alt={artifact.title} style={{ width: `${clampZoom(view.zoom) * 100}%` }} onLoad={event => { const image = event.currentTarget; if (image.naturalWidth * image.naturalHeight > 30_000_000) { setError('图片像素过大，请打开原件或提供较小预览。'); setContent(null); } else restoreScroll(); }} onError={() => { setError('图片无法显示，请打开原件或提供 PNG 预览。'); setContent(null); }} /></div></>}
    {content?.text !== undefined && (artifact.ext === '.md' ? <article className="artifact-markdown"><ReactMarkdown skipHtml components={{ img: () => <span>［外部或附件图片未加载］</span>, a: ({ children }) => <span>{children}</span> }}>{content.text}</ReactMarkdown></article> : <pre className="artifact-text">{content.text}</pre>)}
    {content?.html && <><p className="artifact-small-note">离线安全预览：脚本、外部图片和交互已禁用，部分排版可能不同。</p><iframe className="artifact-html" title={`${artifact.title} 离线预览`} sandbox="" srcDoc={content.html} /></>}
  </div>;
}
