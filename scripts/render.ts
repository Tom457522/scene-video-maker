/**
 * npm run render -- <プロジェクト名 または JSON のパス>
 * エディタを使わずに MP4 を out/ へ書き出す。
 */
import path from 'node:path';
import { OUT_DIR, readProjectArg } from '../server/projects.ts';
import { renderVideo } from '../server/render.ts';

const arg = process.argv[2];
if (!arg) {
  console.error('使い方: npm run render -- <プロジェクト名>   (例: npm run render -- sample)');
  process.exit(1);
}
const { name, project } = await readProjectArg(arg);
const out = path.join(OUT_DIR, `${name}.mp4`);
let last = '';
await renderVideo(project, out, (stage, p) => {
  const line = `${stage} ${Math.round(p * 100)}%`;
  if (line !== last) process.stdout.write(`\r${line.padEnd(20)}`);
  last = line;
});
console.log(`\n書き出しました: ${path.relative(process.cwd(), out)}`);
