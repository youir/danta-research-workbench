import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const appDirectory = path.dirname(fileURLToPath(import.meta.url));
let appCommit = '';
let appHasLocalChanges = false;

try {
  appCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: appDirectory,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
} catch {
  // A source archive without .git still runs; the update panel will explain that it cannot compare commits.
}

try {
  appHasLocalChanges = Boolean(execFileSync('git', ['status', '--porcelain'], {
    cwd: appDirectory,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim());
} catch {
  // No .git metadata; the update panel will skip the local comparison.
}

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_COMMIT__: JSON.stringify(appCommit),
    __APP_HAS_LOCAL_CHANGES__: JSON.stringify(appHasLocalChanges),
  },
  server: {
    host: '127.0.0.1',
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
  },
  build: {
    target: 'es2020',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          icons: ['@phosphor-icons/react'],
        },
      },
    },
  },
});
