/**
 * npm run stills -- <プロジェクト名 または JSON のパス> [割合]
 * 各シーンの見どころ(既定: 開始から 70% の時点)を stills/<名前>/ に PNG で書き出し、
 * 文字のはみ出し(画面の外・枠の外・文字どうしの重なり)を自動で調べる。
 * はみ出しが見つかったら終了コード 1 で終わる(CI でも使う)。
 */
import path from 'node:path';
import type { LayoutIssue } from '../src/video/layout-check.ts';
import { ROOT, readProjectArg } from '../server/projects.ts';
import { renderSceneStills } from '../server/render.ts';

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

const describe = (issue: LayoutIssue): string => {
  switch (issue.kind) {
    case 'outside':
      return `画面の外にはみ出しています: 「${issue.text}」`;
    case 'box':
      return `枠の外にはみ出しています: 「${issue.text}」`;
    case 'overlap':
      return `文字が重なっています: 「${issue.text}」と「${issue.other}」`;
  }
};

const { name, project } = await readProjectArg(arg);
const outDir = path.join(ROOT, 'stills', name);
const stills = await renderSceneStills(project, outDir, ratio, (stage, p) => {
  if (stage === 'bundling') process.stdout.write(`\rバンドル中 ${Math.round(p * 100)}%   `);
});

console.log(`\n${stills.length} 枚書き出しました(各シーンの ${Math.round(ratio * 100)}% 地点):`);
let problems = 0;
for (const s of stills) {
  const mark = s.issues.length === 0 ? '✓' : '✗';
  console.log(`  ${mark} ${path.relative(process.cwd(), s.file)}`);
  for (const issue of s.issues) console.log(`      - ${describe(issue)}`);
  problems += s.issues.length;
}
if (problems > 0) {
  console.log(`\nはみ出しが ${problems} 件見つかりました。画像を開いて確かめ、部品(src/parts/)か文字を直してください。`);
  process.exit(1);
}
console.log('\nはみ出しは見つかりませんでした。');
