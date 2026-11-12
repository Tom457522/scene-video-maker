/**
 * npm run make -- <原稿.md または プロジェクト.json> [オプション]
 * 画面を開かずに、原稿からはみ出しの検査済みの MP4 を作る(ほかのアプリやスキルから使う入口)。
 * 使い方は --help か README の「原稿から 1 コマンドで動画にする」。
 */
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { EXPORT_FORMATS, QUALITIES, type ExportFormat, type Quality } from '../src/remotion/composition-id.ts';
import type { LayoutIssue } from '../src/video/layout-check.ts';
import { findBrowser, isTheme, prepareImages, readMakeInput, totalSeconds, type MakeNote } from '../server/make.ts';
import { OUT_DIR } from '../server/projects.ts';
import { renderSceneStills, renderVideo } from '../server/render.ts';

const HELP = `使い方: npm run make -- <原稿.md または プロジェクト.json> [オプション]

  --images <フォルダ>   画像のシーン(![説明](ファイル名))のファイルを探すフォルダ。SVG は PNG にして使う
  --format <形式>       720p(既定)/ 1080p / vertical(縦長)
  --quality <画質>      light(軽い)/ normal(既定)/ high
  --theme <テーマ>      navy(既定)/ light / black / forest
  --chapters            右上に今の章、下の端に進み具合を出す
  --out <ファイル>      書き出す MP4(既定: out/<原稿の名前>.mp4)
  --project <ファイル>  変換したプロジェクト JSON も保存する(エディタで開き直すとき用)
  --check-only          はみ出しを調べるだけで、MP4 は書き出さない
  --allow-overflow      はみ出しがあっても書き出す
  --json                結果を JSON 1 行で出す(ほかのプログラムから使うとき)

終了コード: 0 = できた / 1 = エラー / 2 = 文字のはみ出しがある(MP4 は作らない)`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    images: { type: 'string' },
    format: { type: 'string', default: '720p' },
    quality: { type: 'string', default: 'normal' },
    theme: { type: 'string' },
    chapters: { type: 'boolean', default: false },
    out: { type: 'string' },
    project: { type: 'string' },
    'check-only': { type: 'boolean', default: false },
    'allow-overflow': { type: 'boolean', default: false },
    json: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});

const log = (msg: string) => {
  if (!values.json) console.log(msg);
};

const fail = (message: string, extra: Record<string, unknown> = {}, code = 1): never => {
  if (values.json) console.log(JSON.stringify({ ok: false, error: message, ...extra }));
  else console.error(`エラー: ${message}`);
  process.exit(code);
};

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

if (values.help || positionals.length !== 1) {
  console.log(HELP);
  process.exit(values.help ? 0 : 1);
}
const input = path.resolve(positionals[0]);
const format = values.format as ExportFormat;
const quality = values.quality as Quality;
if (!(format in EXPORT_FORMATS) || EXPORT_FORMATS[format].codec === 'gif') fail(`--format は 720p / 1080p / vertical のどれかです(${values.format})`);
if (!(quality in QUALITIES)) fail(`--quality は light / normal / high のどれかです(${values.quality})`);
if (values.theme && !isTheme(values.theme)) fail(`テーマ「${values.theme}」はありません`);

const settings: Record<string, unknown> = {};
if (values.theme) settings.theme = values.theme;
if (values.chapters) settings.chapters = true;

try {
  const read = await readMakeInput(input, settings);
  const notes: MakeNote[] = read.notes;
  const images = values.images ? path.resolve(values.images) : path.dirname(input);
  const { project, copied } = await prepareImages(read.project, images, async () => findBrowser());
  const seconds = totalSeconds(project);
  log(`「${project.title}」: ${project.scenes.length} シーン・${Math.floor(seconds / 60)} 分 ${Math.round(seconds % 60)} 秒`);
  for (const n of notes) log(`  ⚠ シーン ${n.scene}: ${n.message}`);
  if (copied.length > 0) log(`  画像を projects/assets/ に入れました: ${copied.join('、')}`);
  if (values.project) {
    await fs.mkdir(path.dirname(path.resolve(values.project)), { recursive: true });
    await fs.writeFile(path.resolve(values.project), `${JSON.stringify(project, null, 2)}\n`);
  }

  log('はみ出しを調べています…');
  const stillsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scene-make-'));
  const stills = await renderSceneStills(project, stillsDir);
  await fs.rm(stillsDir, { recursive: true, force: true });
  const issues = stills.flatMap((s) => s.issues.map((i) => ({ scene: s.scene + 1, part: s.part, message: describe(i) })));
  for (const i of issues) log(`  ✗ シーン ${i.scene}(${i.part}): ${i.message}`);
  const summary = { title: project.title, scenes: project.scenes.length, seconds: Math.round(seconds * 10) / 10, notes, issues };

  if (issues.length > 0 && !values['allow-overflow']) {
    fail(`文字のはみ出しが ${issues.length} 件あります。原稿の文を短くしてからやり直してください`, summary, 2);
  }
  if (values['check-only']) {
    if (values.json) console.log(JSON.stringify({ ok: true, ...summary }));
    else log('はみ出しはありません(--check-only なので書き出しはしません)');
    process.exit(0);
  }

  const out = path.resolve(values.out ?? path.join(OUT_DIR, `${read.name}.mp4`));
  let last = '';
  await renderVideo(
    project,
    out,
    (stage, p) => {
      if (values.json) return;
      const line = `${stage} ${Math.round(p * 100)}%`;
      if (line !== last) process.stdout.write(`\r${line.padEnd(20)}`);
      last = line;
    },
    { format, quality },
  );
  const bytes = (await fs.stat(out)).size;
  if (values.json) console.log(JSON.stringify({ ok: true, out, bytes, ...summary }));
  else log(`\n書き出しました: ${path.relative(process.cwd(), out)}(${(bytes / 1024 / 1024).toFixed(1)} MB)`);
} catch (e) {
  fail(e instanceof Error ? e.message : String(e));
}
