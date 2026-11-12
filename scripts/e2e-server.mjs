/**
 * 自動操作テスト(npm run e2e)用のエディタの起動。
 * projects/ の見本を一時フォルダにコピーし、そこを使ってエディタを別のポートで起動する(本物の projects/ は変えない)。
 */
import { spawn } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const E2E_PROJECTS_DIR = path.join(os.tmpdir(), 'scene-video-maker-e2e', 'projects');
const port = process.env.E2E_PORT ?? '5180';

rmSync(E2E_PROJECTS_DIR, { recursive: true, force: true });
mkdirSync(path.join(E2E_PROJECTS_DIR, 'assets'), { recursive: true });
for (const f of ['sample.json', 'assets/ブロックの図.png']) cpSync(path.join(root, 'projects', f), path.join(E2E_PROJECTS_DIR, f));

const child = spawn('npx', ['vite', '--port', port, '--strictPort', '--open', 'false'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, SCENE_PROJECTS_DIR: E2E_PROJECTS_DIR, BROWSER: 'none' },
});
const stop = () => child.kill();
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
child.on('exit', (code) => process.exit(code ?? 0));
