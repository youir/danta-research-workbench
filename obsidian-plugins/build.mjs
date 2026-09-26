import { build } from 'esbuild';
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname);
const products = [
  ['danta-rss-collector', 'DantaRssCollector'],
  ['danta-workbench-dashboard', 'DantaWorkbenchDashboard'],
];

for (const [id, source] of products) {
  const target = resolve(root, 'dist', id);
  await mkdir(target, { recursive: true });
  await build({
    entryPoints: [resolve(root, source, 'src/main.js')],
    outfile: resolve(target, 'main.js'),
    bundle: true,
    format: 'cjs',
    platform: 'browser',
    target: 'es2020',
    external: ['obsidian'],
    sourcemap: false,
    minify: true,
    legalComments: 'none',
  });
  await copyFile(resolve(root, source, 'manifest.json'), resolve(target, 'manifest.json'));
  await copyFile(resolve(root, source, 'styles.css'), resolve(target, 'styles.css'));
  const licensePath = source === 'DantaRssCollector'
    ? resolve(root, source, 'LICENSE')
    : resolve(root, 'LICENSE');
  const license = await readFile(licensePath, 'utf8');
  await writeFile(resolve(target, 'LICENSE'), license);
}

console.log(`Built ${products.length} Obsidian plugins into ${resolve(root, 'dist')}`);
