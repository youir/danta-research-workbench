import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const resourceDir = path.join(appDir, 'node_modules/pdfjs-dist');
const groups = ['cmaps', 'standard_fonts', 'wasm'];

// Vendor assets only; never handles user research paths.
export function pdfResourcesPlugin() {
  let buildDir;
  return {
    name: 'danta-local-pdf-resources',
    configResolved(config) { buildDir = path.resolve(config.root, config.build.outDir); },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/pdf-resources/')) return next();
        const parts = new URL(req.url, 'http://127.0.0.1').pathname.split('/').slice(2);
        if (req.method !== 'GET' || parts.length !== 2 || !groups.includes(parts[0]) || !/^[\w.-]+$/.test(parts[1]) || parts[1].startsWith('.')) { res.writeHead(404).end(); return; }
        try {
          const bytes = await fs.readFile(path.join(resourceDir, ...parts));
          res.writeHead(200, { 'Content-Type': parts[1].endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream' }); res.end(bytes);
        } catch { res.writeHead(404).end(); }
      });
    },
    async closeBundle() {
      if (!buildDir) return;
      for (const group of groups) await fs.cp(path.join(resourceDir, group), path.join(buildDir, 'pdf-resources', group), { recursive: true });
    },
  };
}
