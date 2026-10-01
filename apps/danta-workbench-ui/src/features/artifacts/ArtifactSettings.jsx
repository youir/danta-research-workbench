import { FolderOpen, ArrowClockwise } from '@phosphor-icons/react';

export function ArtifactSettings({ connection }) {
  const { status, busy, error, select, forget, refresh } = connection;
  return <section className="settings-card" aria-labelledby="artifact-settings-title">
    <div className="settings-card-heading"><div><span className="panel-kicker">本机成果 · 只读预览</span><h2 id="artifact-settings-title">成果与预览</h2></div><span className="connection-pill">{status.connected ? '已连接' : '未连接'}</span></div>
    <p>选择保存 PPT、论文、机制图和报告的成果输出文件夹。工作台只读取其中按任务登记或由你选定的成果，不扫描整个知识库。目录内的原件不会因预览而被修改或上传。</p>
    {status.root && <p className="settings-path"><strong>成果目录</strong><code>{status.root}</code></p>}
    <div className="settings-actions">
      <button className="primary-button compact" type="button" onClick={select} disabled={busy}><FolderOpen size={16} />{busy ? '正在处理…' : status.selected ? '更换成果目录' : '选择成果目录并启用预览'}</button>
      {status.selected && <button className="text-button" type="button" disabled={busy} onClick={refresh}><ArrowClockwise size={16} />核对连接</button>}
      {status.selected && <button className="text-button" type="button" disabled={busy} onClick={() => { if (window.confirm('断开成果目录并清除已有文件关联？任务与意见草稿保留，原文件不删除。')) forget(); }}>断开成果目录</button>}
    </div>
    {(error || status.message) && <p role="status" className="settings-error">{error || status.message}</p>}
    <p className="settings-footnote">{status.memoryAvailable ? '目录与授权保存在这台电脑。再次打开时自动核对并恢复；不用每次重新选择。' : '浏览器开发预览只保留本次服务运行的目录连接；正式桌面版会记住目录与授权。'} 更换为其他目录会清除原目录的文件关联，不会删除文件。</p>
    <p className="settings-footnote">连接后，每次任务启动语会带上专属输出位置。Codex 保存原件、预览件与清单后，回到任务即可查看；Office 原件需要配套 PDF 或图片预览。</p>
  </section>;
}
