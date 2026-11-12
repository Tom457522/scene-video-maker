/**
 * npm test: test/*.test.ts を tsx 経由の node:test で実行する。
 * (Node 20 は --test にファイルのパターンを渡せないので、ここでファイルを集めて渡す)
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = readdirSync(path.join(root, 'test'))
  .filter((f) => f.endsWith('.test.ts'))
  .map((f) => path.join('test', f));
const r = spawnSync('npx', ['tsx', '--test', ...files], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
process.exit(r.status ?? 1);
