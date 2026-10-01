import { execFile, spawn } from 'node:child_process';
import { accessSync, constants as fsConstants, statSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { createArtifactService } from './artifactService.js';

const execFileAsync = promisify(execFile);
const API_PREFIX = '/__danta/';
const MAX_REQUEST_BYTES = 96 * 1024;
const MAX_MARKDOWN_BYTES = 256 * 1024;
const MAX_TOTAL_MARKDOWN_BYTES = 12 * 1024 * 1024;
const MAX_MARKDOWN_FILES = 1200;
const MAX_SCAN_DEPTH = 5;

const SCOPE_INFO = {
  records: {
    label: '研究记录',
    description: '只读 Markdown：05_课题项目_Projects/ 与 10_日志复盘_Journal/。用于显示课题进展和组会记录。',
    paths: ['05_课题项目_Projects', '10_日志复盘_Journal'],
    mode: 'read',
  },
  literature: {
    label: '文献证据',
    description: '只读 Markdown：03_文献证据_Literature-Evidence/。用于查看已有阅读笔记。',
    paths: ['03_文献证据_Literature-Evidence'],
    mode: 'read',
  },
  rss: {
    label: 'RSS 线索',
    description: '只读 .obsidian/plugins/danta-rss-collector/data.json 与 01_收件箱_Inbox/02_RSS_动态线索/ 下的 Markdown。只展示插件已缓存的标题、摘要和链接，不刷新网络订阅。',
    paths: ['.obsidian/plugins/danta-rss-collector/data.json', '01_收件箱_Inbox/02_RSS_动态线索'],
    mode: 'read',
  },
  'archive-read': {
    label: '查看历史归档',
    description: '只读 Markdown：14_历史归档_Archive/。用于显示历史归档条目。',
    paths: ['14_历史归档_Archive'],
    mode: 'read',
  },
  'archive-write': {
    label: '新建归档',
    description: '仅允许在 14_历史归档_Archive/工作台归档/ 新建 Markdown 文件；不会覆盖或删除已有文件。',
    paths: ['14_历史归档_Archive/工作台归档'],
    mode: 'write',
  },
};

const KNOWN_HIDDEN_DIRECTORIES = new Set(['.git', '.trash', '.obsidian']);
// Kept in sync with the research-vault template. This check reads names only.
const VAULT_STRUCTURE_DIRECTORIES = [
  '00_系统_System',
  '01_收件箱_Inbox', '01_收件箱_Inbox/02_RSS_动态线索',
  '02_原始资料_Sources', '02_原始资料_Sources/00_来源登记_Source-Register',
  '03_文献证据_Literature-Evidence', '03_文献证据_Literature-Evidence/00_阅读笔记_Reading-Notes', '03_文献证据_Literature-Evidence/01_检索与证据_Registers',
  '04_知识百科_Wiki', '04_知识百科_Wiki/00_概念_Concepts', '04_知识百科_Wiki/01_实体_Entities', '04_知识百科_Wiki/02_主题_Topics',
  '05_课题项目_Projects', '05_课题项目_Projects/00_主课题_Main-Project', '05_课题项目_Projects/00_主课题_Main-Project/00_研究背景_Context', '05_课题项目_Projects/00_主课题_Main-Project/01_思考过程_Thinking', '05_课题项目_Projects/00_主课题_Main-Project/02_候选课题_Candidates', '05_课题项目_Projects/00_主课题_Main-Project/03_研究方案_Design', '05_课题项目_Projects/00_主课题_Main-Project/04_开题答辩_Proposal-Defense', '05_课题项目_Projects/00_主课题_Main-Project/05_决策记录_Decisions', '05_课题项目_Projects/00_主课题_Main-Project/06_协作记录_Collaboration',
  '06_方法流程_Methods', '06_方法流程_Methods/00_标准流程_SOPs', '06_方法流程_Methods/01_分析计划_Analysis-Plans',
  '07_数据分析_Data-Analysis', '07_数据分析_Data-Analysis/00_数据登记_Data-Registry', '07_数据分析_Data-Analysis/01_实验记录_Experiments', '07_数据分析_Data-Analysis/02_分析运行_Analysis-Runs', '07_数据分析_Data-Analysis/03_质量检查_Quality-Control',
  '08_成果输出_Outputs', '08_成果输出_Outputs/00_开题_Proposal', '08_成果输出_Outputs/01_论文_Manuscripts', '08_成果输出_Outputs/02_报告_Reports', '08_成果输出_Outputs/03_图表_Figures', '08_成果输出_Outputs/04_科研汇报与答辩_Presentations', '08_成果输出_Outputs/05_科研日报_Research-Digest',
  '09_专家顾问_Advisors', '09_专家顾问_Advisors/00_顾问登记_Registry', '09_专家顾问_Advisors/01_顾问包_Profiles',
  '10_日志复盘_Journal', '10_日志复盘_Journal/00_日常_Daily', '10_日志复盘_Journal/01_会议_Meetings', '10_日志复盘_Journal/02_复盘_Reviews', '10_日志复盘_Journal/03_组会_Lab-Meetings',
  '11_长期记忆_Memory',
  '12_笔记模板_Templates',
  '13_附件资源_Attachments', '13_附件资源_Attachments/00_文献_Papers', '13_附件资源_Attachments/01_图片_Images', '13_附件资源_Attachments/02_补充材料_Supplements',
  '14_历史归档_Archive',
].sort((left, right) => left.split('/').length - right.split('/').length || left.localeCompare(right, 'zh-CN'));

function resolveCodexBinary() {
  if (process.platform === 'win32') {
    const explicit = process.env.CODEX_CLI_PATH?.replace(/^"|"$/g, '');
    const directories = [
      ...(explicit && path.dirname(explicit) !== '.' ? [path.dirname(explicit)] : []),
      ...(process.env.PATH || '').split(path.delimiter),
      process.env.APPDATA ? path.join(process.env.APPDATA, 'npm') : '',
    ].filter(Boolean);
    const names = explicit
      ? [path.basename(explicit), ...(['.exe', '.cmd', '.bat'].map(extension => `${explicit}${extension}`)).map(candidate => path.basename(candidate))]
      : ['codex.exe', 'codex.cmd', 'codex.bat', 'codex'];
    for (const directory of directories) {
      for (const name of names) {
        const candidate = path.isAbsolute(name) ? name : path.join(directory, name);
        try { if (statSync(candidate).isFile()) return candidate; } catch { /* Try the next PATH entry. */ }
      }
    }
    return explicit || 'codex';
  }
  const candidates = [
    process.env.CODEX_CLI_PATH,
    '/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex',
    '/Applications/Codex.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex',
    'codex',
  ].filter(Boolean);
  return candidates.find(candidate => {
    if (!candidate.includes(path.sep)) return Boolean(process.env.PATH?.split(path.delimiter).some(directory => {
      try { accessSync(path.join(directory, candidate), fsConstants.X_OK); return true; } catch { return false; }
    }));
    try { accessSync(candidate, fsConstants.X_OK); return true; } catch { return false; }
  }) || 'codex';
}

function safeText(value, maxLength = 1000) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, maxLength);
}

function localAddress(hostHeader = '') {
  try {
    const host = new URL(`http://${hostHeader}`).hostname.toLowerCase();
    return ['127.0.0.1', 'localhost', '::1'].includes(host);
  } catch {
    return false;
  }
}

function originMatchesRequest(req) {
  const source = req.headers.origin || req.headers.referer;
  if (!source) return req.method === 'GET' && req.headers['sec-fetch-site'] === 'same-origin';
  try {
    const origin = new URL(source);
    const host = new URL(`http://${req.headers.host}`);
    return origin.protocol === 'http:' && origin.host === host.host;
  } catch {
    return false;
  }
}

function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req, limit = MAX_REQUEST_BYTES) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('请求内容过大。'), { statusCode: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('请求格式无效。'), { statusCode: 400 });
  }
}

function getCodexProjects(result) {
  const rows = result?.data || result?.projects || [];
  return rows.flatMap(project => {
    const roots = Array.isArray(project.roots) ? project.roots : [];
    const firstRoot = roots.find(root => typeof root?.path === 'string' && path.isAbsolute(root.path));
    if (!project.id || !firstRoot) return [];
    return [{
      id: String(project.id),
      name: safeText(project.name || path.basename(firstRoot.path), 120),
      root: firstRoot.path,
      rootLabel: path.basename(firstRoot.path) || safeText(project.name || '工作区', 80),
    }];
  });
}

class CodexRpcClient {
  constructor(binary = resolveCodexBinary()) {
    this.binary = binary;
    this.child = null;
    this.sequence = 0;
    this.pending = new Map();
    this.buffer = '';
    this.stderr = '';
    this.spawnError = null;
  }

  async start() {
    const command = process.platform === 'win32' && /\.(cmd|bat)$/i.test(this.binary) ? (process.env.ComSpec || 'cmd.exe') : this.binary;
    const args = command === this.binary
      ? ['app-server', '--stdio']
      : ['/d', '/s', '/c', `""${this.binary}" app-server --stdio"`];
    this.child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    this.child.stdout.setEncoding('utf8');
    this.child.stderr.setEncoding('utf8');
    this.child.stdout.on('data', chunk => this.onData(chunk));
    this.child.stderr.on('data', chunk => { this.stderr = (this.stderr + chunk).slice(-6000); });
    this.child.on('error', error => {
      this.spawnError = error;
      for (const pending of this.pending.values()) pending.reject(error);
      this.pending.clear();
    });
    this.child.on('exit', code => {
      const error = new Error(code === 0 ? 'Codex 本机服务已关闭。' : '无法连接 Codex 本机服务。');
      for (const pending of this.pending.values()) pending.reject(error);
      this.pending.clear();
    });
    await this.request('initialize', {
      clientInfo: { name: 'danta-research-workbench', version: '0.1.0' },
      capabilities: { experimentalApi: true },
    });
    this.notify('initialized', {});
  }

  onData(chunk) {
    this.buffer += chunk;
    let newline;
    while ((newline = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!line) continue;
      let message;
      try { message = JSON.parse(line); } catch { continue; }
      if (message.id === undefined) continue;
      const pending = this.pending.get(message.id);
      if (!pending) continue;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(safeText(message.error.message || 'Codex 请求失败', 240)));
      else pending.resolve(message.result);
    }
  }

  request(method, params = {}) {
    if (this.spawnError) return Promise.reject(this.spawnError);
    if (!this.child || this.child.stdin.destroyed) return Promise.reject(new Error('Codex 本机服务不可用。'));
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('等待 Codex 响应超时，请稍后重试。'));
      }, 20_000);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(`${JSON.stringify({ id, method, params })}\n`, error => {
        if (!error) return;
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      });
    });
  }

  notify(method, params = {}) {
    this.child?.stdin.write(`${JSON.stringify({ method, params })}\n`);
  }

  close() {
    if (this.child && !this.child.killed) this.child.kill('SIGTERM');
  }
}

async function withCodexClient(callback, binary) {
  const client = new CodexRpcClient(binary);
  try {
    await client.start();
    return await callback(client);
  } finally {
    client.close();
  }
}

async function chooseVaultFolder({ scopeLabel = '', initialPath = '', title = '' } = {}) {
  const prompt = title || (scopeLabel ? `选择“${scopeLabel}”现有笔记所在的文件夹` : '选择要连接的 Obsidian 知识库');
  if (process.platform === 'darwin') {
    const { stdout } = await execFileAsync('osascript', ['-e', `POSIX path of (choose folder with prompt "${prompt}")`], { timeout: 300_000 });
    return stdout.trim();
  }
  if (process.platform === 'win32') {
    const initial = initialPath ? `$dialog.SelectedPath = '${initialPath.replace(/'/g, "''")}'; ` : '';
    const script = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Add-Type -AssemblyName System.Windows.Forms; $dialog = New-Object System.Windows.Forms.FolderBrowserDialog; $dialog.Description = "${prompt}"; $dialog.ShowNewFolderButton = $false; ${initial}if ($dialog.ShowDialog() -eq "OK") { $dialog.SelectedPath }`;
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-STA', '-Command', script], { timeout: 300_000 });
    return stdout.trim();
  }
  try {
    const { stdout } = await execFileAsync('zenity', ['--file-selection', '--directory', `--title=${prompt}`], { timeout: 300_000 });
    return stdout.trim();
  } catch {
    const { stdout } = await execFileAsync('kdialog', ['--getexistingdirectory', '.', prompt], { timeout: 300_000 });
    return stdout.trim();
  }
}

async function selectClipboardTarget(text) {
  const writeTo = (command, args) => new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'ignore', 'ignore'], windowsHide: true });
    child.stdin.end(text);
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error('无法写入系统剪贴板。')));
  });
  if (process.platform === 'darwin') return writeTo('pbcopy', []);
  if (process.platform === 'win32') return writeTo('clip.exe', []);
  const command = ['wl-copy', 'xclip', 'xsel'].find(name => process.env.PATH?.split(path.delimiter).some(dir => {
    try { accessSync(path.join(dir, name), fsConstants.X_OK); return true; } catch { return false; }
  }));
  if (!command) throw new Error('没有找到系统剪贴板工具。');
  const args = command === 'xclip' ? ['-selection', 'clipboard'] : command === 'xsel' ? ['--clipboard', '--input'] : [];
  return writeTo(command, args);
}

async function openCodexThread(threadId) {
  if (!/^[a-zA-Z0-9-]{12,80}$/.test(threadId)) throw new Error('Codex 返回了无效的对话编号。');
  const url = `codex://threads/${threadId}`;
  if (process.platform === 'darwin') await execFileAsync('open', [url], { timeout: 8000 });
  else if (process.platform === 'win32') await execFileAsync('powershell.exe', ['-NoProfile', '-Command', `Start-Process -LiteralPath '${url}'`], { timeout: 8000 });
  else await execFileAsync('xdg-open', [url], { timeout: 8000 });
  return true;
}

async function pathExists(root, relativePath, expectFile = false) {
  try {
    const rootStat = await fs.lstat(root);
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) return false;
    const parts = String(relativePath).split(/[\\/]/).filter(Boolean);
    if (!parts.length || parts.some(part => part === '.' || part === '..')) return false;
    let current = root;
    let stat = rootStat;
    for (const [index, part] of parts.entries()) {
      current = path.join(current, part);
      stat = await fs.lstat(current);
      if (stat.isSymbolicLink()) return false;
      if (index < parts.length - 1 && !stat.isDirectory()) return false;
    }
    return expectFile ? stat.isFile() : stat.isDirectory();
  } catch {
    return false;
  }
}

async function inspectVaultStructure(root) {
  const listings = new Map();
  async function listDirectories(relativeParent) {
    if (listings.has(relativeParent)) return listings.get(relativeParent);
    const absoluteParent = relativeParent ? path.join(root, ...relativeParent.split('/')) : root;
    if (relativeParent && !await pathExists(root, relativeParent)) return [];
    let entries = [];
    try { entries = await fs.readdir(absoluteParent, { withFileTypes: true }); } catch { /* Report inaccessible expected paths as missing. */ }
    const directories = entries.filter(entry => entry.isDirectory() && !entry.isSymbolicLink()).map(entry => entry.name);
    listings.set(relativeParent, directories);
    return directories;
  }

  const missing = [];
  const conflicts = [];
  const mismatchMap = new Map();
  let present = 0;
  for (const expectedPath of VAULT_STRUCTURE_DIRECTORIES) {
    const expectedParts = expectedPath.split('/');
    let actualParent = '';
    let exact = true;
    let blocked = false;
    for (let index = 0; index < expectedParts.length; index += 1) {
      const expectedName = expectedParts[index];
      const expectedPrefix = expectedParts.slice(0, index + 1).join('/');
      const directories = await listDirectories(actualParent);
      if (directories.includes(expectedName)) {
        actualParent = actualParent ? `${actualParent}/${expectedName}` : expectedName;
        continue;
      }

      exact = false;
      const expectedAbsolute = path.join(root, ...expectedPrefix.split('/'));
      const entry = await fs.lstat(expectedAbsolute).catch(() => null);
      if (entry && !entry.isDirectory()) {
        conflicts.push(expectedPrefix);
        blocked = true;
        break;
      }

      const ordinal = expectedName.match(/^(\d{2})[_\s-]/)?.[1];
      const similar = ordinal
        ? directories.filter(name => name !== expectedName && name.match(/^(\d{2})[_\s-]/)?.[1] === ordinal)
        : [];
      if (similar.length === 1) {
        const actualPrefix = actualParent ? `${actualParent}/${similar[0]}` : similar[0];
        const ancestorMismatch = [...mismatchMap.keys()].some(target => expectedPrefix.startsWith(`${target}/`));
        if (!ancestorMismatch) mismatchMap.set(expectedPrefix, actualPrefix);
        actualParent = actualPrefix;
      } else {
        blocked = true;
        break;
      }
    }
    if (exact && !blocked) present += 1;
    else missing.push(expectedPath);
  }

  const hasObsidianConfig = await pathExists(root, '.obsidian');
  const hasVaultMarker = await pathExists(root, '.danta-vault.json', true);
  const isLikelyVault = hasObsidianConfig || hasVaultMarker || present > 0 || mismatchMap.size > 0;
  const blockedRoots = [...conflicts, ...mismatchMap.keys()];
  const repairableCount = missing.filter(directory => !blockedRoots.some(blocked => directory === blocked || directory.startsWith(`${blocked}/`))).length;
  return {
    total: VAULT_STRUCTURE_DIRECTORIES.length,
    present,
    missing,
    conflicts: [...new Set(conflicts)],
    mismatches: [...mismatchMap].map(([expected, actual]) => ({ expected, actual })),
    otherTopLevelDirectories: (await listDirectories(''))
      .filter(name => !name.startsWith('.') && !VAULT_STRUCTURE_DIRECTORIES.includes(name))
      .slice(0, 60),
    isLikelyVault,
    repairableCount,
  };
}

async function createExpectedDirectory(root, relativePath) {
  const rootStat = await fs.lstat(root);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) throw new Error('所选知识库路径不安全或已不可用。');
  let current = root;
  for (const part of relativePath.split('/')) {
    current = path.join(current, part);
    let stat = await fs.lstat(current).catch(() => null);
    if (!stat) {
      try { await fs.mkdir(current); } catch (error) { if (error.code !== 'EEXIST') throw error; }
      stat = await fs.lstat(current);
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`目标路径中存在同名文件或链接：${relativePath}`);
  }
}

function scopePaths(id, mappings = {}) {
  const paths = SCOPE_INFO[id].paths;
  return SCOPE_INFO[id].mode === 'read' ? [...new Set([...paths, ...(mappings[id] || [])])] : paths;
}

async function availableScopes(root, mappings = {}) {
  const entries = await Promise.all(Object.entries(SCOPE_INFO).map(async ([id, scope]) => {
    const paths = scopePaths(id, mappings);
    const exists = await Promise.all(paths.map(item => pathExists(root, item, item.endsWith('.json'))));
    const available = scope.mode === 'write'
      ? true
      : exists.some(Boolean);
    return { id, label: scope.label, description: scope.description, paths, fullPaths: paths.map(item => path.join(root, item)), mappedPaths: mappings[id] || [], mode: scope.mode, available };
  }));
  return entries;
}

function unquoteYaml(value) {
  const text = value.trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) return text.slice(1, -1).replace(/\\"/g, '"');
  return text;
}

function parseMarkdown(markdown, relativePath, mtime) {
  const source = String(markdown || '').replace(/^\uFEFF/, '');
  const frontmatter = source.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
  let title = '';
  let date = '';
  if (frontmatter) {
    for (const line of frontmatter[1].split(/\r?\n/)) {
      const match = line.match(/^\s*(title|date|created|updated|published)\s*:\s*(.*?)\s*$/i);
      if (!match) continue;
      const key = match[1].toLowerCase();
      const value = unquoteYaml(match[2]).slice(0, 300);
      if (key === 'title' && !title) title = value;
      if (['date', 'created', 'updated', 'published'].includes(key) && !date) date = value;
    }
  }
  const body = frontmatter ? source.slice(frontmatter[0].length) : source;
  if (!title) title = body.match(/^\s*#\s+(.+)$/m)?.[1]?.trim() || path.basename(relativePath, path.extname(relativePath));
  const excerpt = body
    .replace(/^\s*```[\s\S]*?^\s*```\s*$/gm, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/[*_`>]/g, '')
    .replace(/\s+/g, ' ').trim().slice(0, 420);
  const parsedTime = Date.parse(date);
  return { title: safeText(title, 240), date: Number.isFinite(parsedTime) ? new Date(parsedTime).toISOString() : mtime.toISOString(), excerpt: safeText(excerpt, 420), path: relativePath };
}

async function collectMarkdown(root, prefixes, { maxFiles = MAX_MARKDOWN_FILES, maxBytes = MAX_TOTAL_MARKDOWN_BYTES, maxDepth = MAX_SCAN_DEPTH } = {}) {
  const found = [];
  const seenFiles = new Set();
  let bytesRead = 0;
  let truncated = false;

  async function visit(relativeDirectory, depth) {
    if (depth > maxDepth || found.length >= maxFiles || bytesRead >= maxBytes) { truncated = true; return; }
    const absoluteDirectory = path.join(root, relativeDirectory);
    let entries;
    try { entries = await fs.readdir(absoluteDirectory, { withFileTypes: true }); } catch { return; }
    entries.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    for (const entry of entries) {
      if (found.length >= maxFiles || bytesRead >= maxBytes) { truncated = true; break; }
      if (entry.isSymbolicLink()) continue;
      const relativePath = path.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) {
        if (KNOWN_HIDDEN_DIRECTORIES.has(entry.name) || entry.name.startsWith('.')) continue;
        await visit(relativePath, depth + 1);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        if (seenFiles.has(relativePath)) continue;
        if (!await pathExists(root, relativePath, true)) continue;
        let fileStat;
        try { fileStat = await fs.lstat(path.join(root, relativePath)); } catch { continue; }
        if (!fileStat.isFile() || fileStat.isSymbolicLink()) continue;
        if (fileStat.size > MAX_MARKDOWN_BYTES || bytesRead + fileStat.size > maxBytes) { truncated = true; continue; }
        let text;
        try { text = await fs.readFile(path.join(root, relativePath), 'utf8'); } catch { continue; }
        bytesRead += fileStat.size;
        seenFiles.add(relativePath);
        found.push({ ...parseMarkdown(text, relativePath, fileStat.mtime), path: relativePath.split(path.sep).join('/'), mtime: fileStat.mtime.getTime() });
      }
    }
  }

  for (const prefix of prefixes) {
    if (found.length >= maxFiles || bytesRead >= maxBytes) { truncated = true; break; }
    if (!await pathExists(root, prefix, false)) continue;
    await visit(prefix, 0);
  }
  found.sort((a, b) => b.mtime - a.mtime);
  return { files: found.map(({ mtime, ...item }) => item), truncated, total: found.length };
}

function normalizeHttpUrl(value) {
  try {
    const url = new URL(String(value || ''));
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    return url.href.slice(0, 1800);
  } catch { return ''; }
}

async function readRssData(root, notePaths = ['01_收件箱_Inbox/02_RSS_动态线索']) {
  const dataPath = path.join(root, '.obsidian/plugins/danta-rss-collector/data.json');
  let data = {};
  try {
    if (!await pathExists(root, '.obsidian/plugins/danta-rss-collector/data.json', true)) throw Object.assign(new Error('RSS 缓存不存在。'), { code: 'ENOENT' });
    const stat = await fs.lstat(dataPath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 6 * 1024 * 1024) throw new Error('RSS 缓存格式无效。');
    data = JSON.parse(await fs.readFile(dataPath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const feeds = Array.isArray(data.feeds) ? data.feeds.slice(0, 100).map(feed => ({
    name: safeText(feed.name || '', 120),
    group: safeText(feed.group || '未分组', 80),
    enabled: feed.enabled !== false,
    lastError: safeText(feed.lastError || '', 160),
  })) : [];
  const items = Array.isArray(data.items) ? data.items.slice(0, 1200).flatMap(item => {
    const url = normalizeHttpUrl(item.url);
    if (!url) return [];
    return [{
      id: safeText(item.id || '', 180),
      source: safeText(item.source || '', 120),
      title: safeText(item.title || '（无标题）', 260),
      url,
      publishedAt: safeText(item.publishedAt || item.fetchedAt || '', 60),
      excerpt: safeText(item.excerpt || '', 480),
      read: Boolean(item.read),
      favorite: Boolean(item.favorite),
      savedPath: typeof item.savedPath === 'string' && item.savedPath.startsWith('01_收件箱_Inbox/02_RSS_动态线索/') ? safeText(item.savedPath, 300) : '',
    }];
  }).sort((a, b) => Date.parse(b.publishedAt || '') - Date.parse(a.publishedAt || '')).slice(0, 120) : [];
  const notes = await collectMarkdown(root, notePaths.filter(item => !item.endsWith('.json')), { maxFiles: 300, maxBytes: 3 * 1024 * 1024, maxDepth: 3 });
  return { feeds, items, savedNotes: notes.files, truncated: notes.truncated, lastFetchedAt: safeText(data.lastFetchedAt || '', 60) };
}

function escapeYaml(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ')}"`;
}

function archiveSlug(value) {
  return String(value || '未命名记录').normalize('NFKC').replace(/[\\/:*?"<>|#^[\]]/g, '-').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/g, '').slice(0, 72) || '未命名记录';
}

async function ensureNoSymlinkAndCreate(root, relativeDirectory) {
  const parts = relativeDirectory.split(/[\\/]/).filter(Boolean);
  let current = root;
  for (const part of parts) {
    current = path.join(current, part);
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('归档目录包含不安全路径，已停止写入。');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await fs.mkdir(current);
    }
  }
  const actualRoot = await fs.realpath(root);
  const actualDirectory = await fs.realpath(current);
  if (actualDirectory !== actualRoot && !actualDirectory.startsWith(`${actualRoot}${path.sep}`)) throw new Error('归档位置超出当前知识库，已停止写入。');
  return current;
}

export function createLocalBridgeService({
  folderPicker = chooseVaultFolder,
  codexBinary = resolveCodexBinary(),
  projectFetcher,
  openThread = openCodexThread,
  copyText = selectClipboardTarget,
  vaultMemoryPath = '',
  jevCredentialStore = null,
  workbenchStateStore = null,
  artifactMemoryPath = '',
  artifactFilePicker,
  artifactOpenFile,
} = {}) {
  const artifacts = createArtifactService({ memoryPath: artifactMemoryPath, folderPicker, filePicker: artifactFilePicker, openFile: artifactOpenFile });
  let vaultRoot = '';
  let vaultName = '';
  let scopes = new Set();
  let scopeMappings = {};
  let restoreMessage = '';

  async function vaultIdentity(root) {
    const stat = await fs.stat(root);
    return { dev: stat.dev, ino: stat.ino, birthtimeMs: stat.birthtimeMs };
  }

  function sameVaultIdentity(saved, current) {
    if (!saved || !current) return false;
    if (saved.dev !== current.dev || saved.ino !== current.ino) return false;
    return Math.abs(saved.birthtimeMs - current.birthtimeMs) < 1000;
  }

  async function targetIdentity(root, relativePath) {
    if (!await pathExists(root, relativePath, relativePath.endsWith('.json'))) return null;
    return vaultIdentity(path.join(root, relativePath));
  }

  async function saveVaultMemory(root = vaultRoot, mappings = scopeMappings, granted = scopes) {
    if (!vaultMemoryPath) return;
    const grants = Object.fromEntries(await Promise.all([...granted].map(async id => {
      const paths = scopePaths(id, mappings);
      const targets = SCOPE_INFO[id].mode === 'read' ? await Promise.all(paths.map(item => targetIdentity(root, item))) : null;
      return [id, { paths, targets }];
    })));
    const snapshot = JSON.stringify({ version: 2, path: root, identity: await vaultIdentity(root), mappings, grants });
    await fs.mkdir(path.dirname(vaultMemoryPath), { recursive: true });
    const temporary = `${vaultMemoryPath}.${process.pid}.tmp`;
    try {
      await fs.writeFile(temporary, snapshot, { flag: 'w', mode: 0o600 });
      await fs.rename(temporary, vaultMemoryPath);
    } finally {
      await fs.rm(temporary, { force: true }).catch(() => {});
    }
  }

  async function readVaultMemory() {
    if (!vaultMemoryPath) return null;
    try {
      const stat = await fs.stat(vaultMemoryPath);
      if (!stat.isFile() || stat.size > 16_384) return null;
      const saved = JSON.parse(await fs.readFile(vaultMemoryPath, 'utf8'));
      if (![1, 2].includes(saved?.version) || typeof saved.path !== 'string' || !path.isAbsolute(saved.path)) return null;
      return {
        version: saved.version,
        name: path.basename(saved.path) || 'Obsidian 知识库',
        path: saved.path,
        mappings: saved.mappings && typeof saved.mappings === 'object' ? saved.mappings : {},
        identity: saved.version === 2 ? saved.identity : null,
        grants: saved.version === 2 && saved.grants && typeof saved.grants === 'object' ? saved.grants : {},
      };
    } catch { return null; }
  }

  const service = {
    artifacts,
    async loadWorkbenchState() {
      return workbenchStateStore?.load() || { supported: false, values: null, backups: [] };
    },
    async workbenchStateStatus() {
      return workbenchStateStore?.status() || { supported: false, backups: [] };
    },
    async saveWorkbenchState({ values }) {
      if (!workbenchStateStore) throw new Error('任务自动备份仅在桌面版可用。');
      return workbenchStateStore.save(values);
    },
    async restoreWorkbenchState({ id }) {
      if (!workbenchStateStore || typeof id !== 'string') throw new Error('请选择桌面版中的本机备份。');
      return workbenchStateStore.restore(id);
    },
    async initializeVault() {
      if (!vaultMemoryPath) return;
      if (!await readVaultMemory()) {
        if (await fs.stat(vaultMemoryPath).catch(() => null)) {
          restoreMessage = '本机保存的知识库记录无法读取。请重新选择知识库并确认授权；原有笔记不会被改动。';
        }
        return;
      }
      try {
        await service.restoreRememberedVault();
      } catch (error) {
        restoreMessage = error?.message || '上次的知识库暂时无法恢复，请检查路径和授权目录。';
      }
    },

    async jevStatus() {
      return jevCredentialStore?.status() || { supported: false, saved: false, verified: false, verifiedAt: null, message: 'Jev 密钥仅能在桌面版安全保存。' };
    },

    async configureJev({ apiKey }) {
      if (!jevCredentialStore) throw new Error('请在桌面版设置 Jev 密钥。');
      await jevCredentialStore.save(apiKey);
      return jevCredentialStore.verify();
    },

    async verifyJev() {
      if (!jevCredentialStore) throw new Error('请在桌面版验证 Jev 连接。');
      return jevCredentialStore.verify();
    },

    async forgetJev() {
      if (!jevCredentialStore) throw new Error('请在桌面版管理 Jev 密钥。');
      return jevCredentialStore.forget();
    },

    async codexStatus() {
      try {
        const projects = projectFetcher
          ? await projectFetcher()
          : await withCodexClient(async client => getCodexProjects(await client.request('project/list', {})), codexBinary);
        return { available: true, projects: projects.map(({ id, name, root, rootLabel }) => ({ id, name, root, rootLabel })) };
      } catch {
        return { available: false, projects: [], message: '暂时无法连接本机 Codex。' };
      }
    },

    async chooseVault() {
      const chosen = await folderPicker();
      if (!chosen) return { cancelled: true };
      const realPath = await fs.realpath(chosen);
      const stat = await fs.stat(realPath);
      if (!stat.isDirectory()) throw new Error('请选择一个 Obsidian 知识库文件夹。');
      const remembered = await readVaultMemory();
      if (remembered?.path === realPath) {
        try {
          const restored = await service.restoreRememberedVault();
          return { cancelled: false, name: restored.name, path: restored.path, scopes: restored.scopeOptions };
        } catch { /* A changed folder requires fresh confirmation below. */ }
      }
      vaultRoot = realPath;
      vaultName = path.basename(realPath) || 'Obsidian 知识库';
      scopes = new Set();
      scopeMappings = {};
      restoreMessage = '';
      return { cancelled: false, name: vaultName, path: vaultRoot, scopes: await availableScopes(vaultRoot, scopeMappings) };
    },

    async vaultStatus() {
      return {
        selected: Boolean(vaultRoot),
        connected: Boolean(vaultRoot && scopes.size),
        name: vaultName,
        path: vaultRoot,
        scopes: [...scopes],
        scopeOptions: vaultRoot ? await availableScopes(vaultRoot, scopeMappings) : [],
        memoryAvailable: Boolean(vaultMemoryPath),
        remembered: await readVaultMemory(),
        restoreMessage,
      };
    },

    async rememberVault() {
      if (!vaultRoot || !vaultMemoryPath) throw new Error('本机桌面版尚未提供知识库位置记忆。');
      await saveVaultMemory();
      return service.vaultStatus();
    },

    async restoreRememberedVault() {
      const remembered = await readVaultMemory();
      if (!remembered) throw new Error('没有找到已保存的知识库路径，请重新选择文件夹。');
      const realPath = await fs.realpath(remembered.path).catch(() => null);
      const stat = realPath ? await fs.stat(realPath).catch(() => null) : null;
      if (!stat?.isDirectory()) throw new Error('上次使用的知识库路径已不可用，请重新选择。');
      if (realPath !== remembered.path) throw new Error('上次知识库的实际路径已变化，请重新选择并核对。');
      if (remembered.version === 2 && !sameVaultIdentity(remembered.identity, await vaultIdentity(realPath))) {
        throw new Error('知识库文件夹已被替换或移动，请重新选择并核对授权范围。');
      }
      const restoredMappings = {};
      const invalidMappings = new Set();
      for (const id of ['records', 'literature', 'rss', 'archive-read']) {
        const candidates = Array.isArray(remembered.mappings[id]) ? remembered.mappings[id].slice(0, 5) : [];
        restoredMappings[id] = [];
        for (const candidate of candidates) {
          if (typeof candidate !== 'string' || !candidate || path.isAbsolute(candidate) || candidate.split(/[\\/]/).some(part => !part || part === '..' || part.startsWith('.'))) { invalidMappings.add(id); continue; }
          if (await pathExists(realPath, candidate)) restoredMappings[id].push(candidate);
          else invalidMappings.add(id);
        }
      }
      const options = await availableScopes(realPath, restoredMappings);
      const available = new Set(options.filter(option => option.available).map(option => option.id));
      const restoredGrants = (await Promise.all(Object.entries(remembered.grants).map(async ([id, savedGrant]) => {
        if (!Object.hasOwn(SCOPE_INFO, id) || invalidMappings.has(id) || !available.has(id)) return null;
        const paths = scopePaths(id, restoredMappings);
        if (!savedGrant || JSON.stringify(savedGrant.paths) !== JSON.stringify(paths)) return null;
        if (SCOPE_INFO[id].mode === 'read') {
          if (!Array.isArray(savedGrant.targets)) return null;
          const targets = await Promise.all(paths.map(item => targetIdentity(realPath, item)));
          if (JSON.stringify(savedGrant.targets) !== JSON.stringify(targets)) return null;
        }
        return id;
      }))).filter(Boolean);
      vaultRoot = realPath;
      vaultName = path.basename(realPath) || 'Obsidian 知识库';
      scopeMappings = restoredMappings;
      scopes = new Set(restoredGrants);
      const savedCount = Object.keys(remembered.grants).length;
      restoreMessage = remembered.version === 1
        ? '旧版仅保存了知识库位置，未保存授权范围。本次确认后，今后可直接恢复。'
        : savedCount === restoredGrants.length
          ? `已核对知识库路径及目录，恢复 ${restoredGrants.length} 项已授权范围。`
          : `已恢复 ${restoredGrants.length} 项授权；${savedCount - restoredGrants.length} 项因目录变化或不可用已暂停，请核对并修复。`;
      return service.vaultStatus();
    },

    async forgetRememberedVault() {
      if (vaultMemoryPath) await fs.rm(vaultMemoryPath, { force: true });
      return service.vaultStatus();
    },

    async addScopeFolder({ scopeId } = {}) {
      if (!vaultRoot) throw new Error('请先选择 Obsidian 知识库。');
      if (!['records', 'literature', 'rss', 'archive-read'].includes(scopeId)) throw new Error('该范围不支持映射现有文件夹。');
      const chosen = await folderPicker({ scopeLabel: SCOPE_INFO[scopeId].label, initialPath: vaultRoot });
      if (!chosen) return { cancelled: true, status: await service.vaultStatus() };
      const actual = await fs.realpath(chosen);
      const relative = path.relative(vaultRoot, actual);
      if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        throw new Error('请选择当前知识库里面的一个具体笔记文件夹，不能选知识库根目录或库外目录。');
      }
      const relativePath = relative.split(path.sep).join('/');
      if (relativePath.split('/').some(part => part.startsWith('.')) || !await pathExists(vaultRoot, relativePath)) {
        throw new Error('请选择知识库内的普通文件夹，不能使用隐藏目录或链接。');
      }
      const current = scopeMappings[scopeId] || [];
      if (current.includes(relativePath)) return { cancelled: false, status: await service.vaultStatus() };
      if (current.length >= 5) throw new Error('每个范围最多添加五个已有文件夹。');
      const nextMappings = { ...scopeMappings, [scopeId]: [...current, relativePath] };
      const nextScopes = new Set(scopes);
      nextScopes.delete(scopeId);
      await saveVaultMemory(vaultRoot, nextMappings, nextScopes);
      scopeMappings = nextMappings;
      scopes = nextScopes;
      restoreMessage = '';
      return { cancelled: false, status: await service.vaultStatus() };
    },

    async removeScopeFolder({ scopeId, relativePath } = {}) {
      if (!vaultRoot || !['records', 'literature', 'rss', 'archive-read'].includes(scopeId)) throw new Error('映射范围无效。');
      if (typeof relativePath !== 'string' || !(scopeMappings[scopeId] || []).includes(relativePath)) throw new Error('未找到这项文件夹映射。');
      const nextMappings = { ...scopeMappings, [scopeId]: scopeMappings[scopeId].filter(item => item !== relativePath) };
      const nextScopes = new Set(scopes);
      nextScopes.delete(scopeId);
      await saveVaultMemory(vaultRoot, nextMappings, nextScopes);
      scopeMappings = nextMappings;
      scopes = nextScopes;
      restoreMessage = '';
      return service.vaultStatus();
    },

    async inspectVaultStructure() {
      if (!vaultRoot) throw new Error('请先选择一个 Obsidian 知识库文件夹。');
      return inspectVaultStructure(vaultRoot);
    },

    async repairVaultStructure({ confirm } = {}) {
      if (!vaultRoot) throw new Error('请先选择一个 Obsidian 知识库文件夹。');
      if (confirm !== true) throw new Error('请先明确确认创建缺失的标准空文件夹。');
      const before = await inspectVaultStructure(vaultRoot);
      if (!before.isLikelyVault) throw new Error('所选文件夹不像 Obsidian 知识库。请先重新选择正确的 vault，不要在这里创建标准目录。');
      const blockedRoots = [...before.conflicts, ...before.mismatches.map(item => item.expected)];
      let created = 0;
      for (const directory of VAULT_STRUCTURE_DIRECTORIES) {
        if (blockedRoots.some(conflict => directory === conflict || directory.startsWith(`${conflict}/`))) continue;
        if (await pathExists(vaultRoot, directory)) continue;
        await createExpectedDirectory(vaultRoot, directory);
        created += 1;
      }
      return { ...(await inspectVaultStructure(vaultRoot)), created };
    },

    async authorizeScopes(scopeIds) {
      if (!vaultRoot) throw new Error('请先选择 Obsidian 知识库文件夹。');
      if (!Array.isArray(scopeIds) || scopeIds.length === 0) throw new Error('至少选择一个读取或归档范围。');
      const allowed = new Set(Object.keys(SCOPE_INFO));
      if (scopeIds.some(id => typeof id !== 'string' || !allowed.has(id))) throw new Error('授权范围无效。');
      const options = await availableScopes(vaultRoot, scopeMappings);
      const optionById = new Map(options.map(option => [option.id, option]));
      const unavailable = scopeIds.find(id => !optionById.get(id)?.available);
      if (unavailable) throw new Error(`所选范围“${SCOPE_INFO[unavailable].label}”在此知识库中不可用。`);
      const nextScopes = new Set(scopeIds);
      await saveVaultMemory(vaultRoot, scopeMappings, nextScopes);
      scopes = nextScopes;
      restoreMessage = '';
      return service.vaultStatus();
    },

    async disconnectVault() {
      if (vaultMemoryPath) await fs.rm(vaultMemoryPath, { force: true });
      vaultRoot = '';
      vaultName = '';
      scopes = new Set();
      scopeMappings = {};
      restoreMessage = '';
      return service.vaultStatus();
    },

    async vaultData(section) {
      if (!vaultRoot) throw new Error('请先选择并授权一个知识库。');
      if (section === 'records') {
        if (!scopes.has('records')) throw new Error('当前没有“研究记录”读取授权。');
        return collectMarkdown(vaultRoot, scopePaths('records', scopeMappings));
      }
      if (section === 'literature') {
        if (!scopes.has('literature')) throw new Error('当前没有“文献证据”读取授权。');
        return collectMarkdown(vaultRoot, scopePaths('literature', scopeMappings));
      }
      if (section === 'rss') {
        if (!scopes.has('rss')) throw new Error('当前没有“RSS 线索”读取授权。');
        return readRssData(vaultRoot, scopePaths('rss', scopeMappings));
      }
      if (section === 'archive') {
        if (!scopes.has('archive-read')) throw new Error('当前没有“查看历史归档”读取授权。');
        return collectMarkdown(vaultRoot, scopePaths('archive-read', scopeMappings), { maxFiles: 400, maxBytes: 4 * 1024 * 1024, maxDepth: 4 });
      }
      throw new Error('数据类别无效。');
    },

    async createArchive({ title, body, category = '研究记录' }) {
      if (!vaultRoot || !scopes.has('archive-write')) throw new Error('请先为“新建归档”明确授权。');
      if (typeof body !== 'string' || body.length > 60_000) throw new Error('归档正文须为文字且不超过 60000 字符，请拆分内容后再保存。');
      const safeTitle = safeText(title, 240).trim();
      const safeBody = safeText(body, 60_000).trim();
      if (!safeTitle || !safeBody) throw new Error('请填写归档标题和内容。');
      const directory = await ensureNoSymlinkAndCreate(vaultRoot, '14_历史归档_Archive/工作台归档');
      const date = new Date().toLocaleDateString('sv-SE');
      const stem = `${date}_${archiveSlug(safeTitle)}`;
      const contents = [
        '---',
        `title: ${escapeYaml(safeTitle)}`,
        `date: ${date}`,
        `source: "danta-workbench"`,
        `category: ${escapeYaml(safeText(category, 80))}`,
        'status: archived',
        '---',
        '',
        `# ${safeTitle.replace(/[\r\n]+/g, ' ')}`,
        '',
        safeBody,
        '',
      ].join('\n');
      for (let index = 1; index <= 100; index++) {
        const suffix = index === 1 ? '' : `-${index}`;
        const filename = `${stem}${suffix}.md`;
        const target = path.join(directory, filename);
        try {
          await fs.writeFile(target, contents, { flag: 'wx', mode: 0o600 });
          return { title: safeTitle, path: path.posix.join('14_历史归档_Archive/工作台归档', filename) };
        } catch (error) {
          if (error.code !== 'EEXIST') throw error;
        }
      }
      throw new Error('今天同名归档过多，请换一个标题后重试。');
    },

    async createCodexThread({ projectId, prompt, workflowLabel }) {
      if (typeof projectId !== 'string' || projectId.length > 120) throw new Error('请选择 Codex 工作区。');
      const projects = projectFetcher
        ? await projectFetcher()
        : await withCodexClient(async client => getCodexProjects(await client.request('project/list', {})), codexBinary);
      const project = projects.find(item => item.id === projectId);
      if (!project || !path.isAbsolute(project.root)) throw new Error('所选工作区已不存在，请刷新工作区列表。');
      const rootStat = await fs.stat(project.root).catch(() => null);
      if (!rootStat?.isDirectory()) throw new Error('所选工作区文件夹当前不可用。');
      if (typeof prompt !== 'string' || prompt.length > 50_000) throw new Error('启动语须为文字且不超过 50000 字符，请缩短或拆分任务内容。');
      const kickoff = safeText(prompt, 50_000).trim();
      if (!kickoff) throw new Error('启动语为空。');
      const label = safeText(workflowLabel || '研究讨论', 48).trim() || '研究讨论';
      const title = `工作台 · ${label} · ${new Date().toLocaleDateString('sv-SE')}`;
      const result = await withCodexClient(async client => {
        const started = await client.request('thread/start', { cwd: project.root, projectId: project.id, sessionStartSource: 'startup' });
        const threadId = String(started?.thread?.id || started?.threadId || '');
        if (!threadId) throw new Error('Codex 没有返回新对话编号。');
        try { await client.request('thread/name/set', { threadId, name: title }); } catch { /* Thread naming is optional across CLI versions. */ }
        return threadId;
      }, codexBinary);
      const threadId = result;
      let copied = false;
      let opened = false;
      try { await copyText(kickoff); copied = true; } catch { /* Browser clipboard may already contain the prompt. */ }
      try { opened = await openThread(threadId); } catch { /* The new conversation can still be reached from Codex Recents. */ }
      return { threadId, title, workspaceName: project.name, rootLabel: project.rootLabel, copied, opened };
    },

    async openCodexThread({ threadId, prompt = '' }) {
      if (typeof threadId !== 'string' || !/^[a-zA-Z0-9-]{12,80}$/.test(threadId)) throw new Error('任务卡中的 Codex 对话编号无效。');
      if (typeof prompt !== 'string' || prompt.length > 50_000) throw new Error('启动语须为文字且不超过 50000 字符。');
      let copied = false;
      if (prompt) { try { await copyText(prompt); copied = true; } catch { /* The renderer can offer manual copy. */ } }
      let opened = false;
      try { opened = Boolean(await openThread(threadId)); } catch { /* Retain the existing thread for a retry. */ }
      return { threadId, opened, copied };
    },
  };
  return service;
}

export function createLocalBridgeRequestHandler(service) {
  return async (req, res, next = () => {}) => {
    const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
    if (!requestUrl.pathname.startsWith(API_PREFIX)) return next();
    if (!localAddress(req.headers.host)) return json(res, 403, { error: '本机功能只接受来自本地工作台的请求。' });
    if (!originMatchesRequest(req)) return json(res, 403, { error: '请求来源无效，请从本机工作台操作。' });
    try {
      if (req.method === 'GET' && requestUrl.pathname === `${API_PREFIX}artifacts/status`) return json(res, 200, await service.artifacts.status());
      if (req.method === 'GET' && requestUrl.pathname === `${API_PREFIX}artifacts/list`) return json(res, 200, await service.artifacts.list(requestUrl.searchParams.get('taskId')));
      if (req.method === 'GET' && requestUrl.pathname === `${API_PREFIX}artifacts/content`) {
        const download = requestUrl.searchParams.get('download') === '1';
        const file = await service.artifacts.content({ taskId: requestUrl.searchParams.get('taskId'), key: requestUrl.searchParams.get('key'), fingerprint: requestUrl.searchParams.get('fingerprint') || '', original: download });
        res.writeHead(200, {
          'Content-Type': file.type, 'Content-Length': file.bytes.length,
          'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
          'Content-Security-Policy': "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'",
          ...(download ? { 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.filename).replace(/'/g, '%27')}` } : {}),
        });
        return res.end(file.bytes);
      }
      if (req.method === 'GET' && requestUrl.pathname === `${API_PREFIX}state`) return json(res, 200, await service.loadWorkbenchState());
      if (req.method === 'GET' && requestUrl.pathname === `${API_PREFIX}state/status`) return json(res, 200, await service.workbenchStateStatus());
      if (req.method === 'GET' && requestUrl.pathname === `${API_PREFIX}codex/status`) return json(res, 200, await service.codexStatus());
      if (req.method === 'GET' && requestUrl.pathname === `${API_PREFIX}jev/status`) return json(res, 200, await service.jevStatus());
      if (req.method === 'GET' && requestUrl.pathname === `${API_PREFIX}vault/status`) return json(res, 200, await service.vaultStatus());
      if (req.method === 'GET' && requestUrl.pathname === `${API_PREFIX}vault/structure`) return json(res, 200, await service.inspectVaultStructure());
      if (req.method === 'GET' && requestUrl.pathname === `${API_PREFIX}vault/data`) return json(res, 200, await service.vaultData(requestUrl.searchParams.get('section')));
      if (req.method !== 'POST') return json(res, 405, { error: '不支持此请求。' });
      if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) return json(res, 415, { error: '请求格式无效。' });
      const body = await readJsonBody(req, requestUrl.pathname === `${API_PREFIX}state/save` ? 12 * 1024 * 1024 + 4096 : MAX_REQUEST_BYTES);
      if (requestUrl.pathname === `${API_PREFIX}artifacts/select`) return json(res, 200, await service.artifacts.select(body));
      if (requestUrl.pathname === `${API_PREFIX}artifacts/forget`) return json(res, 200, await service.artifacts.forget());
      if (requestUrl.pathname === `${API_PREFIX}artifacts/import`) return json(res, 200, await service.artifacts.import(body));
      if (requestUrl.pathname === `${API_PREFIX}artifacts/attach-preview`) return json(res, 200, await service.artifacts.attachPreview(body));
      if (requestUrl.pathname === `${API_PREFIX}artifacts/open`) return json(res, 200, await service.artifacts.open(body));
      if (requestUrl.pathname === `${API_PREFIX}state/save`) return json(res, 200, await service.saveWorkbenchState(body));
      if (requestUrl.pathname === `${API_PREFIX}state/restore`) return json(res, 200, await service.restoreWorkbenchState(body));
      if (requestUrl.pathname === `${API_PREFIX}jev/configure`) return json(res, 200, await service.configureJev(body));
      if (requestUrl.pathname === `${API_PREFIX}jev/verify`) return json(res, 200, await service.verifyJev());
      if (requestUrl.pathname === `${API_PREFIX}jev/forget`) return json(res, 200, await service.forgetJev());
      if (requestUrl.pathname === `${API_PREFIX}vault/select`) return json(res, 200, await service.chooseVault());
      if (requestUrl.pathname === `${API_PREFIX}vault/remember`) return json(res, 200, await service.rememberVault());
      if (requestUrl.pathname === `${API_PREFIX}vault/restore`) return json(res, 200, await service.restoreRememberedVault());
      if (requestUrl.pathname === `${API_PREFIX}vault/forget`) return json(res, 200, await service.forgetRememberedVault());
      if (requestUrl.pathname === `${API_PREFIX}vault/scope-folder/add`) return json(res, 200, await service.addScopeFolder(body));
      if (requestUrl.pathname === `${API_PREFIX}vault/scope-folder/remove`) return json(res, 200, await service.removeScopeFolder(body));
      if (requestUrl.pathname === `${API_PREFIX}vault/authorize`) return json(res, 200, await service.authorizeScopes(body.scopes));
      if (requestUrl.pathname === `${API_PREFIX}vault/structure/repair`) return json(res, 200, await service.repairVaultStructure(body));
      if (requestUrl.pathname === `${API_PREFIX}vault/disconnect`) return json(res, 200, await service.disconnectVault());
      if (requestUrl.pathname === `${API_PREFIX}vault/archive`) return json(res, 201, await service.createArchive(body));
      if (requestUrl.pathname === `${API_PREFIX}codex/new-thread`) return json(res, 201, await service.createCodexThread(body));
      if (requestUrl.pathname === `${API_PREFIX}codex/open-thread`) return json(res, 200, await service.openCodexThread(body));
      return json(res, 404, { error: '没有这个本机功能。' });
    } catch (error) {
      const status = Number(error?.statusCode) || 400;
      const message = safeText(error?.message || '本机操作失败。', 300);
      return json(res, status, { error: message });
    }
  };
}

export function createLocalBridgePlugin(options = {}) {
  const service = options.service || createLocalBridgeService(options);
  const handleRequest = createLocalBridgeRequestHandler(service);
  return {
    name: 'danta-local-workbench-bridge',
    configureServer(server) {
      server.middlewares.use(handleRequest);
    },
  };
}
