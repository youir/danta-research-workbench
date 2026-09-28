import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'inject-version',
      buildStart() {
        // 读取 package.json 获取版本号
        const pkg = JSON.parse(
          fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8')
        );
        const version = pkg.version;

        // 写入 version.json 到 public 目录
        const publicDir = path.resolve(__dirname, 'public');
        if (!fs.existsSync(publicDir)) {
          fs.mkdirSync(publicDir, { recursive: true });
        }
        fs.writeFileSync(
          path.resolve(publicDir, 'version.json'),
          JSON.stringify({ version, buildTime: new Date().toISOString() }, null, 2)
        );
      }
    }
  ],
  define: {
    // 将版本号注入到全局变量
    '__APP_VERSION__': JSON.stringify(process.env.npm_package_version || '0.1.0')
  },
  build: {
    target: 'es2020',
    minify: 'esbuild',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          icons: ['@phosphor-icons/react']
        }
      }
    }
  },
  server: {
    port: 5173,
    strictPort: true
  }
});
