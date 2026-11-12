/**
 * npm run stills -- <プロジェクト名 または JSON のパス> [割合]
 * 各シーンの見どころ(既定: 開始から 70% の時点)を stills/<名前>/ に PNG で書き出す。
 * 部品を作ったり直したりしたら、これで全シーンの見た目をまとめて確かめる。
 */
import path from 'node:path';
import { ROOT, readProjectArg } from '../server/projects';
import { renderSceneStills } from '../server/render';

const [arg, ratioArg] = process.argv.slice(2);
if (!arg) {
  console.error('使い方: npm run stills -- <プロジェクト名> [割合 0〜1]   (例: npm run stills -- sample)');
  process.exit(1);
}
const ratio = ratioArg === undefined ? 0.7 : Number(ratioArg);
if (!(ratio >= 0 && ratio <= 1)) {
  console.error('割合は 0〜1 の数で指定してください(例: 0.7)');
  process.exit(1);
}
const { name, project } = await readProjectArg(arg);
const outDir = path.join(ROOT, 'stills', name);
const files = await renderSceneStills(project, outDir, ratio, (stage, p) => {
  if (stage === 'bundling') process.stdout.write(`\rバンドル中 ${Math.round(p * 100)}%   `);
});
console.log(`\n${files.length} 枚書き出しました:`);
for (const f of files) console.log(`  ${path.relative(process.cwd(), f)}`);
