/**
 * start.bat から呼ばれる起動スクリプト(Windows 用)。依存パッケージがなければ入れてからエディタを起動する。
 * npm install の前に動く必要があるので、TypeScript ではなく素の JavaScript で書き、外部パッケージを使わない。
 *
 *   node scripts/start.mjs           起動
 *   node scripts/start.mjs --check   起動の手前まで確かめて終わる(CI 用)
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');

/** Vite 8 が動く Node.js のバージョン(20.19 以上、または 22.12 以上) */
const [major, minor] = process.versions.node.split('.').map(Number);
const nodeOk = major >= 23 || (major === 22 && minor >= 12) || (major === 20 && minor >= 19);
if (!nodeOk) {
  console.error(`Node.js ${process.versions.node} では動きません(20.19 以上か 22.12 以上が必要)。https://nodejs.org/ から LTS 版を入れてください。`);
  process.exit(1);
}

/** Windows では npm は npm.cmd なので、シェル経由で呼ぶ */
const npm = (args) => spawnSync('npm', args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });

if (!existsSync(path.join(root, 'node_modules'))) {
  console.log('初回の準備をしています(npm install)。数分かかります…');
  const r = npm(['install']);
  if (r.status !== 0) {
    console.error('npm install に失敗しました。上のメッセージを確認してください。');
    process.exit(1);
  }
}

if (check) {
  console.log('start.bat の確認: OK');
  process.exit(0);
}

console.log('エディタを起動します。ブラウザが開かなければ http://127.0.0.1:5173 を開いてください。');
console.log('終わるときはこの画面で Ctrl+C を押すか、画面を閉じてください。');
const r = npm(['run', 'dev']);
process.exit(r.status ?? 0);
