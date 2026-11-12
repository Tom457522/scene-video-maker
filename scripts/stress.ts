/**
 * npm run stress [-- <部品名> ...]
 * 全部品(または指定した部品)について、schema から「文字数・個数・数値をすべて上限にした入力」を作り、
 * 既定の秒数と最短の 3 秒の 2 通りで静止画を書き出して、はみ出しを自動で調べる。
 * 見つかったら終了コード 1 で終わる(CI でも実行する)。
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { loadPartsInNode } from '../server/parts-node.ts';
import { ROOT } from '../server/projects.ts';
import { renderSceneStills } from '../server/render.ts';
import { minimalCase, worstCase } from '../src/parts/samples.ts';
import { projectSchema } from '../src/video/project.ts';

const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const { parts, errors } = await loadPartsInNode();
if (errors.length > 0) {
  for (const e of errors) console.error(`部品「${e.id}」を読み込めません: ${e.message}`);
  process.exit(1);
}
const targets = only.length > 0 ? parts.filter((p) => only.includes(p.id)) : parts;
if (targets.length === 0) {
  console.error(`部品が見つかりません: ${only.join(', ')}(ある部品: ${parts.map((p) => p.id).join(', ')})`);
  process.exit(1);
}

const scenes = targets.flatMap((p) => [
  { part: p.id, seconds: p.meta.defaultSeconds, props: worstCase(p.schema), label: `${p.id}(最大・${p.meta.defaultSeconds}秒)` },
  { part: p.id, seconds: 3, props: worstCase(p.schema), label: `${p.id}(最大・3秒)` },
  { part: p.id, seconds: p.meta.defaultSeconds, props: minimalCase(p.schema), label: `${p.id}(最小)` },
]);
const project = projectSchema.parse({ title: 'はみ出しの自動検査', scenes: scenes.map(({ label: _label, ...s }) => s) });

const outDir = path.join(ROOT, 'stills', 'stress');
await fs.rm(outDir, { recursive: true, force: true });
await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(path.join(outDir, 'project.json'), `${JSON.stringify(project, null, 2)}\n`);
console.log(`${targets.length} 個の部品を ${scenes.length} 通りの入力で調べます…`);

const stills = await renderSceneStills(project, outDir, 0.7, (stage, p) => {
  if (stage === 'bundling') process.stdout.write(`\rバンドル中 ${Math.round(p * 100)}%   `);
});
console.log('');
let problems = 0;
for (const s of stills) {
  const label = scenes[s.scene].label;
  console.log(`  ${s.issues.length === 0 ? '✓' : '✗'} ${label}  ${path.relative(process.cwd(), s.file)}`);
  for (const issue of s.issues) {
    console.log(`      - ${issue.kind === 'overlap' ? `文字が重なっています: 「${issue.text}」と「${issue.other}」` : `${issue.kind === 'outside' ? '画面' : '枠'}の外にはみ出しています: 「${issue.text}」`}`);
  }
  problems += s.issues.length;
}
console.log(`\n入力は ${path.relative(process.cwd(), path.join(outDir, 'project.json'))} に保存しました(エディタで開くには projects/ にコピーしてください)。`);
if (problems > 0) {
  console.log(`はみ出しが ${problems} 件見つかりました。部品の文字サイズの決め方(fitFontSize など)を見直してください。`);
  process.exit(1);
}
console.log('はみ出しは見つかりませんでした。');
