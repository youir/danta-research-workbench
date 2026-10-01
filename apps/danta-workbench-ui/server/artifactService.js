import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const TYPES = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
const PREVIEW = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.md', '.txt', '.html', '.htm']);
const TEXT = new Set(['.md', '.txt', '.html', '.htm', '.svg']);
const idPattern = /^[a-zA-Z0-9_-]{8,100}$/;
const token = value => createHash('sha256').update(value).digest('hex');
const clean = (value, max = 160) => String(value ?? '').replace(/[\x00-\x1f\x7f]/g, '').slice(0, max);
const identity = stat => ({ dev: stat.dev, ino: stat.ino, birth: stat.birthtimeMs });
const sameIdentity = (a, b) => a && b && a.dev === b.dev && a.ino === b.ino && Math.abs(a.birth - b.birth) < 1000;
function checkTask(id) { if (typeof id !== 'string' || !idPattern.test(id)) throw new Error('成果任务编号无效。'); return id; }
async function openLocalOriginal(target) {
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer.exe' : 'xdg-open';
  await exec(command, [target], { timeout: 15000 });
}

// No free-form file paths from HTTP clients. Selection uses the native picker.
export async function pickArtifactFile({ preview = false } = {}) {
  const title = preview ? '选择同版本的 PDF 或图片预览' : '选择要关联到本任务的成果原件';
  try {
    if (process.platform === 'darwin') return (await exec('osascript', ['-e', `POSIX path of (choose file with prompt "${title}")`], { timeout: 300_000 })).stdout.trim();
    if (process.platform === 'win32') {
      const script = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.OpenFileDialog; $d.Title = '${title}'; $d.Filter = '科研成果|*.pdf;*.png;*.jpg;*.jpeg;*.webp;*.svg;*.md;*.txt;*.html;*.htm;*.pptx;*.docx'; if ($d.ShowDialog() -eq 'OK') { $d.FileName }`;
      return (await exec('powershell.exe', ['-NoProfile', '-STA', '-Command', script], { timeout: 300_000 })).stdout.trim();
    }
    return (await exec('zenity', ['--file-selection', `--title=${title}`], { timeout: 300_000 })).stdout.trim();
  } catch (error) {
    if (String(error.stderr || '').includes('-128') || (process.platform === 'linux' && error.code === 1 && !error.stderr)) return '';
    throw new Error('文件选择器未能打开，请在正式桌面版操作。');
  }
}

export function createArtifactService({ memoryPath = '', folderPicker, filePicker = pickArtifactFile, openFile = openLocalOriginal } = {}) {
  let grant = null;
  let imports = {};
  let message = '';
  let operation = Promise.resolve();
  let initialized;
  // Serialize selections, imports, revoke and save, including native picker waits.
  const mutate = fn => { const next = operation.then(fn); operation = next.catch(() => {}); return next; };

  async function save(nextGrant, nextImports) {
    if (!memoryPath) return;
    const serialized = JSON.stringify({ version: 1, grant: nextGrant, imports: nextImports });
    if (Buffer.byteLength(serialized) > 2 * 1024 * 1024) throw new Error('已有成果关联记录超过 2 MB，请改用任务成果清单管理新文件。当前关联保留。');
    await fs.mkdir(path.dirname(memoryPath), { recursive: true });
    const tmp = `${memoryPath}.${randomUUID()}.tmp`;
    try {
      const handle = await fs.open(tmp, 'wx', 0o600);
      try { await handle.writeFile(serialized); await handle.sync(); } finally { await handle.close(); }
      await fs.rename(tmp, memoryPath);
    } finally { await fs.rm(tmp, { force: true }); }
  }
  async function validRoot() {
    if (!grant) throw new Error('请在设置中选择成果目录并启用预览。');
    const actual = await fs.realpath(grant.root).catch(() => '');
    const stat = actual ? await fs.stat(actual).catch(() => null) : null;
    if (actual !== grant.root || !stat?.isDirectory() || !sameIdentity(grant.identity, identity(stat))) throw new Error('成果目录已移动、替换或不可用。已保留任务状态，请在设置中核对成果位置。');
    return actual;
  }
  async function initialize() {
    if (initialized) return initialized;
    initialized = (async () => {
      if (!memoryPath) return;
      try {
        const stat = await fs.stat(memoryPath);
        if (stat.size > 2 * 1024 * 1024) throw new Error();
        const saved = JSON.parse(await fs.readFile(memoryPath, 'utf8'));
        if (saved.version !== 1 || (saved.grant && (!path.isAbsolute(saved.grant.root || '') || !idPattern.test(saved.grant.id || '')))) throw new Error();
        grant = saved.grant || null;
        imports = saved.imports && typeof saved.imports === 'object' && !Array.isArray(saved.imports) ? saved.imports : {};
        if (grant) await validRoot();
      } catch (error) {
        if (error.code !== 'ENOENT') message = grant ? '上次成果位置暂不可用；任务与阅读状态已保留。' : '成果连接记录无法读取，请重新选择成果目录。';
      }
    })();
    return initialized;
  }
  async function status() {
    await initialize();
    let connected = false;
    if (grant) { try { await validRoot(); connected = true; message = ''; } catch (error) { message = error.message; } }
    return { connected, selected: Boolean(grant), root: grant?.root || '', name: grant ? path.basename(grant.root) : '', memoryAvailable: Boolean(memoryPath), message };
  }
  async function checkedPath(relative, { directory = false } = {}) {
    const root = await validRoot();
    if (typeof relative !== 'string' || !relative || relative.length > 1600 || path.isAbsolute(relative) || /^[A-Za-z]:/.test(relative) || relative.includes('\\') || relative.includes('\0')) throw new Error('成果清单中的相对路径无效。');
    const parts = relative.split('/');
    if (parts.some(part => !part || part === '..' || part === '.' || part.startsWith('.'))) throw new Error('成果路径不能越界或指向隐藏目录。');
    let target = root;
    let stat;
    for (const part of parts) {
      target = path.join(target, part);
      stat = await fs.lstat(target);
      if (stat.isSymbolicLink()) throw new Error('成果路径包含链接，请选择实际文件。');
    }
    const actual = await fs.realpath(target);
    const inside = path.relative(root, actual);
    if (inside.startsWith(`..${path.sep}`) || inside === '..' || path.isAbsolute(inside) || (directory ? !stat.isDirectory() : !stat.isFile())) throw new Error('成果文件类型或目录范围不匹配。');
    return { target: actual, stat, relative };
  }
  async function selectedPath(chosen) {
    const root = await validRoot();
    if (!chosen) return null;
    const relative = path.relative(root, path.resolve(chosen)).split(path.sep).join('/');
    const file = await checkedPath(relative);
    if (!TYPES[path.extname(file.target).toLowerCase()]) throw new Error('支持 PDF、图片、SVG、Markdown、HTML、PPTX 和 DOCX 成果。');
    return file;
  }
  async function boundedRead(file, max) {
    const handle = await fs.open(file.target, 'r');
    try {
      const before = await handle.stat();
      if (!before.isFile() || !sameIdentity(identity(file.stat), identity(before)) || before.size > max) throw new Error('文件已变化或超过预览大小限制，请刷新或打开原件。');
      const buffer = Buffer.alloc(before.size);
      let offset = 0;
      while (offset < buffer.length) { const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset); if (!bytesRead) break; offset += bytesRead; }
      const after = await handle.stat();
      if (offset !== buffer.length || before.mtimeMs !== after.mtimeMs || before.size !== after.size) throw new Error('文件正在写入，请稍后刷新。');
      return buffer;
    } finally { await handle.close(); }
  }
  const makeKey = (taskId, entry) => token(`${grant.id}|${taskId}|${entry.id}|${entry.version}`);
  async function entries(taskId) {
    checkTask(taskId);
    await initialize();
    await validRoot();
    let generated = [];
    let warning = '';
    try {
      const file = await checkedPath(`${taskId}/danta-artifacts.json`);
      const manifest = JSON.parse((await boundedRead(file, 256 * 1024)).toString('utf8'));
      if (manifest.schemaVersion !== 1 || manifest.taskId !== taskId || !Array.isArray(manifest.artifacts) || manifest.artifacts.length > 100) throw new Error('成果清单格式或任务编号不匹配。');
      const seen = new Set();
      generated = manifest.artifacts.map(item => {
        if (!item || typeof item.id !== 'string' || !/^[\w-]{1,100}$/.test(item.id) || typeof item.version !== 'string' || !/^[\w.-]{1,40}$/.test(item.version) || seen.has(`${item.id}|${item.version}`)) throw new Error('成果清单含无效或重复的成果版本。');
        seen.add(`${item.id}|${item.version}`);
        return { id: item.id, title: clean(item.title || item.id), version: item.version, original: `${taskId}/${item.original}`, preview: item.preview ? `${taskId}/${item.preview}` : '', source: 'generated' };
      });
    } catch (error) { if (error.code !== 'ENOENT') warning = error.message || '成果清单尚未写完，请稍后刷新。'; }
    const existing = Array.isArray(imports[taskId]) ? imports[taskId].slice(0, 100) : [];
    return { rows: [...existing, ...generated], warning };
  }
  async function describe(taskId, entry) {
    const key = makeKey(taskId, entry);
    const base = { key, title: clean(entry.title), version: clean(entry.version, 40), source: entry.source, original: entry.original, preview: entry.preview };
    try {
      const original = await checkedPath(entry.original);
      const originalExt = path.extname(original.target).toLowerCase();
      if (!TYPES[originalExt]) throw new Error('原件类型不支持。');
      const previewPath = entry.preview || (PREVIEW.has(originalExt) ? entry.original : '');
      let preview;
      let previewError = '';
      if (previewPath) { try { preview = await checkedPath(previewPath); if (!PREVIEW.has(path.extname(preview.target).toLowerCase())) throw new Error('预览件类型不支持。'); } catch (error) { previewError = error.code === 'ENOENT' ? '预览件已移走。' : error.message; } }
      const stale = Boolean(entry.preview && preview && preview.stat.mtimeMs + 2000 < original.stat.mtimeMs);
      const ext = preview ? path.extname(preview.target).toLowerCase() : '';
      const tooLarge = preview && preview.stat.size > (TEXT.has(ext) ? 2 * 1024 * 1024 : 40 * 1024 * 1024);
      return { ...base, available: true, ext, originalExt, size: original.stat.size, updatedAt: original.stat.mtimeMs, fingerprint: preview ? token(`${preview.relative}|${preview.stat.ino}|${preview.stat.size}|${preview.stat.mtimeMs}`) : '', canPreview: Boolean(preview && !stale && !tooLarge), previewError: previewError || (stale ? '预览件早于原件，请生成同版本预览。' : tooLarge ? '预览文件过大，请打开原件。' : !preview ? '缺少同版本 PDF 或图片预览。' : '') };
    } catch (error) { return { ...base, available: false, canPreview: false, previewError: error.code === 'ENOENT' ? '原文件已移走或尚未生成。' : error.message }; }
  }
  async function list(taskId) {
    const { rows, warning } = await entries(taskId);
    const artifacts = [];
    for (const entry of rows) artifacts.push(await describe(taskId, entry));
    artifacts.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return { artifacts, warning, outputPath: path.join(grant.root, taskId) };
  }
  async function locate(taskId, key) {
    if (typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key)) throw new Error('成果标识无效。');
    const { rows } = await entries(taskId);
    const entry = rows.find(item => makeKey(taskId, item) === key);
    if (!entry) throw new Error('成果未找到，请刷新或重新关联原文件。');
    return entry;
  }
  async function content({ taskId, key, original = false, fingerprint = '' }) {
    const entry = await locate(taskId, key);
    const meta = await describe(taskId, entry);
    if (!meta.available || (!original && !meta.canPreview)) throw new Error(meta.previewError || '文件暂不可用。');
    if (!original && fingerprint && fingerprint !== meta.fingerprint) throw new Error('成果文件已更新，请刷新后查看新版本。');
    const file = await checkedPath(original ? entry.original : entry.preview || entry.original);
    const ext = path.extname(file.target).toLowerCase();
    const bytes = await boundedRead(file, original ? 100 * 1024 * 1024 : TEXT.has(ext) ? 2 * 1024 * 1024 : 40 * 1024 * 1024);
    return { bytes, type: TYPES[ext], filename: path.basename(file.target) };
  }

  return {
    status, list, content,
    select: body => mutate(async () => {
      await initialize();
      if (body.confirm !== true) throw new Error('请先确认读取所选成果目录。');
      const chosen = await folderPicker({ scopeLabel: '成果输出（只读预览）', title: '选择成果输出文件夹（只读预览）' });
      if (!chosen) return { cancelled: true, status: await status() };
      const root = await fs.realpath(chosen);
      const stat = await fs.stat(root);
      if (!stat.isDirectory()) throw new Error('请选择成果输出文件夹。');
      const next = grant?.root === root && sameIdentity(grant.identity, identity(stat)) ? grant : { id: randomUUID(), root, identity: identity(stat) };
      const nextImports = next === grant ? imports : {};
      await save(next, nextImports); grant = next; imports = nextImports; message = '';
      return { cancelled: false, status: await status() };
    }),
    forget: () => mutate(async () => { await initialize(); await save(null, {}); grant = null; imports = {}; message = ''; return status(); }),
    import: body => mutate(async () => {
      await initialize(); checkTask(body.taskId); await validRoot();
      if (Object.keys(imports).length >= 500 && !imports[body.taskId]) throw new Error('关联任务数量已达上限。');
      const old = Array.isArray(imports[body.taskId]) ? imports[body.taskId] : [];
      if (old.length >= 100) throw new Error('本任务最多关联 100 件已有成果。');
      const file = await selectedPath(await filePicker({ preview: false }));
      if (!file) return { cancelled: true };
      if (old.some(item => item.original === file.relative)) return { cancelled: false, ...(await list(body.taskId)) };
      const entry = { id: randomUUID(), title: path.basename(file.target), version: '导入版', original: file.relative, preview: '', source: 'imported' };
      const next = { ...imports, [body.taskId]: [...old, entry] };
      await save(grant, next); imports = next;
      return { cancelled: false, selectedKey: makeKey(body.taskId, entry), ...(await list(body.taskId)) };
    }),
    attachPreview: body => mutate(async () => {
      const entry = await locate(body.taskId, body.key);
      if (entry.source !== 'imported') throw new Error('自动生成成果请由 Codex 更新清单与同版本预览。');
      const file = await selectedPath(await filePicker({ preview: true }));
      if (!file) return { cancelled: true };
      if (!PREVIEW.has(path.extname(file.target).toLowerCase())) throw new Error('请选择 PDF、图片、SVG、文字或 HTML 预览。');
      const next = { ...imports, [body.taskId]: imports[body.taskId].map(item => item.id === entry.id ? { ...item, preview: file.relative } : item) };
      await save(grant, next); imports = next;
      return { cancelled: false, ...(await list(body.taskId)) };
    }),
    open: async body => {
      const entry = await locate(body.taskId, body.key);
      const meta = await describe(body.taskId, entry);
      if (!meta.available) throw new Error(meta.previewError);
      const file = await checkedPath(entry.original);
      if (!openFile) throw new Error('当前环境无法打开关联程序，请保存副本后打开。');
      await openFile(file.target);
      return { opened: true };
    },
  };
}
