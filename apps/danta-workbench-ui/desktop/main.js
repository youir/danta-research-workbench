import { app, BrowserWindow, dialog, shell } from 'electron';
import { createServer } from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLocalBridgeRequestHandler, createLocalBridgeService } from '../server/localBridge.js';

const APP_URL = 'http://127.0.0.1:48921';
const appDirectory = path.dirname(fileURLToPath(import.meta.url));
const rendererDirectory = path.resolve(appDirectory, '../dist');
const iconPath = path.join(appDirectory, 'assets', 'danta-workbench.png');
const appLock = app.requestSingleInstanceLock();

let mainWindow;
let localServer;
let isQuitting = false;

app.setAppUserModelId('org.danta.research-workbench');

if (!appLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    process.chdir(app.getPath('home'));
    await startLocalServer();
    openMainWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) openMainWindow();
    });
  }).catch(async error => {
    await dialog.showMessageBox({
      type: 'error',
      title: '工作台启动失败',
      message: '科研工作台无法启动本机服务。',
      detail: error?.code === 'EADDRINUSE'
        ? '本机端口 48921 正被其他程序占用。请关闭占用此端口的程序后重试。'
        : String(error?.message || error),
      buttons: ['退出'],
    });
    app.quit();
  });

  app.on('before-quit', () => {
    isQuitting = true;
    localServer?.close();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

async function startLocalServer() {
  const bridgeService = createLocalBridgeService({ vaultMemoryPath: path.join(app.getPath('userData'), 'vault-location.json') });
  const handleBridge = createLocalBridgeRequestHandler(bridgeService);
  localServer = createServer(async (req, res) => {
    await handleBridge(req, res);
    if (String(req.url || '').startsWith('/__danta/')) return;
    await serveRendererFile(req, res);
  });

  await new Promise((resolve, reject) => {
    localServer.once('error', reject);
    localServer.listen(48921, '127.0.0.1', () => {
      localServer.off('error', reject);
      resolve();
    });
  });
}

async function serveRendererFile(req, res) {
  const host = String(req.headers.host || '').toLowerCase();
  if (host !== '127.0.0.1:48921' && host !== 'localhost:48921') {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Forbidden');
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  let requestedPath;
  try {
    requestedPath = decodeURIComponent(new URL(req.url || '/', APP_URL).pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (requestedPath.includes('\0')) {
    res.writeHead(400).end();
    return;
  }

  const relativePath = requestedPath === '/' ? 'index.html' : requestedPath.replace(/^[/\\]+/, '');
  let filePath = path.resolve(rendererDirectory, relativePath);
  const relative = path.relative(rendererDirectory, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    res.writeHead(403).end();
    return;
  }

  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');
  } catch {
    filePath = path.join(rendererDirectory, 'index.html');
  }

  let contents;
  try {
    contents = await fs.readFile(filePath);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    return;
  }

  const contentType = mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  const isDocument = path.basename(filePath).toLowerCase() === 'index.html';
  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': isDocument ? 'no-store' : 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    ...(isDocument ? { 'Content-Security-Policy': contentSecurityPolicy } : {}),
  });
  if (req.method === 'HEAD') res.end();
  else res.end(contents);
}

function openMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 980,
    minWidth: 920,
    minHeight: 680,
    show: false,
    title: '龚博士科研工作台',
    icon: iconPath,
    autoHideMenuBar: true,
    backgroundColor: '#f8f8f7',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(`${APP_URL}/`)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 1100,
          height: 850,
          autoHideMenuBar: true,
          webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
        },
      };
    }
    openExternalUrl(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith(`${APP_URL}/`)) return;
    event.preventDefault();
    openExternalUrl(url);
  });
  mainWindow.on('closed', () => { mainWindow = undefined; });
  mainWindow.loadURL(APP_URL);
}

function openExternalUrl(value) {
  try {
    const target = new URL(value);
    if (['https:', 'http:'].includes(target.protocol)) void shell.openExternal(target.href);
  } catch {
    // Invalid or unsupported links stay inside the app and are ignored.
  }
}

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.github.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

process.on('uncaughtException', async error => {
  if (isQuitting) return;
  await dialog.showMessageBox({
    type: 'error',
    title: '工作台遇到错误',
    message: '本机工作台遇到无法继续的错误。',
    detail: String(error?.message || error),
    buttons: ['退出'],
  });
  app.quit();
});
