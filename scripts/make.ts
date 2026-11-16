/**
 * npm run make -- <原稿.md または プロジェクト.json> [オプション]
 * 画面を開かずに、原稿(台本)から検査済みの MP4 を作る(ほかのアプリやスキルから使う入口)。
 * 使い方は --help か README の「原稿から 1 コマンドで動画にする」。
 */
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { EXPORT_FORMATS, QUALITIES, type ExportFormat, type Quality } from '../src/remotion/composition-id.ts';
import type { LayoutIssue } from '../src/video/layout-check.ts';
import { checkFacts, describeFact, type FactReport } from '../src/video/facts.ts';
import { checkQuality, describeQuality } from '../src/video/quality.ts';
import { buildCues, toSrt } from '../src/video/srt.ts';
import { buildDescription, findBrowser, isTheme, partSpec, prepareImages, readMakeInput, resolverFor, totalSeconds, type MakeNote } from '../server/make.ts';
import { loadPartsInNode } from '../server/parts-node.ts';
import { OUT_DIR } from '../server/projects.ts';
import { renderSceneStills, renderVideo } from '../server/render.ts';
import { writeReview } from '../server/review.ts';
import { createSynth, type Engine } from '../server/tts.ts';
import { addNarration, prepareBgm, prepareSfx } from '../server/voice.ts';

const HELP = `使い方: npm run make -- <原稿.md または プロジェクト.json> [オプション]

  --source <ファイル>    元の調査レポート。台本の数字がレポートにあるかを調べる(ないと終了コード 3)
  --review <フォルダ>    見直し用に、各シーンの静止画・一覧の画像・見直し.md を書き出す
  --images <フォルダ>    画像のシーン(![説明](ファイル名))のファイルを探すフォルダ。SVG は PNG にして使う
  --voice <音声合成>     auto(既定)/ voicevox / openjtalk / none(ナレーションを音声にしない)
  --speaker <番号>       VOICEVOX の話者の番号(既定 3)
  --speed <速さ>         話す速さ(既定 1.1)
  --bgm <BGM>            calm / bright / none / 音声ファイル(既定: ナレーションがあれば calm)
  --bgm-volume <0〜1>    BGM の音量(既定 0.1)
  --sfx <on|off>         項目が出るときの効果音(既定 on)
  --subtitles <on|off>   ナレーションの字幕を画面に出す(既定 on)
  --format <形式>        720p(既定)/ 1080p / vertical(縦長)
  --quality <画質>       light(軽い)/ normal(既定)/ high
  --theme <テーマ>       navy(既定)/ light / black / forest
  --chapters             右上に今の章、下の端に進み具合を出す
  --out <ファイル>       書き出す MP4(既定: out/<原稿の名前>.mp4)。字幕(.srt)と説明文(.txt)も隣に作る
  --project <ファイル>   変換したプロジェクト JSON も保存する(エディタで開き直すとき用)
  --check-only           検査だけして、MP4 は書き出さない(ナレーションの音声は作る)
  --allow-overflow       はみ出しがあっても書き出す
  --allow-unverified     レポートにない数字があっても書き出す
  --spec                 部品ごとの入力の上限を JSON で出して終わる(台本を書く前に読む)
  --json                 結果を JSON 1 行で出す(ほかのプログラムから使うとき)

終了コード: 0 = できた / 1 = エラー / 2 = 文字のはみ出しがある / 3 = レポートにない数字がある`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    source: { type: 'string' },
    review: { type: 'string' },
    images: { type: 'string' },
    voice: { type: 'string', default: 'auto' },
    speaker: { type: 'string', default: '3' },
    speed: { type: 'string', default: '1.1' },
    bgm: { type: 'string' },
    'bgm-volume': { type: 'string' },
    sfx: { type: 'string', default: 'on' },
    subtitles: { type: 'string', default: 'on' },
    format: { type: 'string', default: '720p' },
    quality: { type: 'string', default: 'normal' },
    theme: { type: 'string' },
    chapters: { type: 'boolean', default: false },
    out: { type: 'string' },
    project: { type: 'string' },
    'check-only': { type: 'boolean', default: false },
    'allow-overflow': { type: 'boolean', default: false },
    'allow-unverified': { type: 'boolean', default: false },
    spec: { type: 'boolean', default: false },
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

if (values.spec) {
  const { parts } = await loadPartsInNode();
  console.log(JSON.stringify(partSpec(parts), null, values.json ? undefined : 2));
  process.exit(0);
}
if (values.help || positionals.length !== 1) {
  console.log(HELP);
  process.exit(values.help ? 0 : 1);
}
const input = path.resolve(positionals[0]);
const format = values.format as ExportFormat;
const quality = values.quality as Quality;
const onOff = (name: string, v: string) => (v === 'on' ? true : v === 'off' ? false : fail(`--${name} は on / off のどちらかです(${v})`));
if (!(format in EXPORT_FORMATS) || EXPORT_FORMATS[format].codec === 'gif') fail(`--format は 720p / 1080p / vertical のどれかです(${values.format})`);
if (!(quality in QUALITIES)) fail(`--quality は light / normal / high のどれかです(${values.quality})`);
if (values.theme && !isTheme(values.theme)) fail(`テーマ「${values.theme}」はありません`);
if (!['auto', 'voicevox', 'openjtalk', 'none'].includes(values.voice)) fail(`--voice は auto / voicevox / openjtalk / none のどれかです(${values.voice})`);
const speaker = Number(values.speaker);
const speed = Number(values.speed);
const bgmVolume = values['bgm-volume'] === undefined ? undefined : Number(values['bgm-volume']);
if (!Number.isInteger(speaker) || speaker < 0) fail(`--speaker は 0 以上の整数です(${values.speaker})`);
if (!(speed >= 0.5 && speed <= 2)) fail(`--speed は 0.5〜2 です(${values.speed})`);
if (bgmVolume !== undefined && !(bgmVolume >= 0 && bgmVolume <= 1)) fail(`--bgm-volume は 0〜1 です(${values['bgm-volume']})`);
const sfx = onOff('sfx', values.sfx);
const subtitles = onOff('subtitles', values.subtitles);

const settings: Record<string, unknown> = { sfx, subtitles };
if (values.theme) settings.theme = values.theme;
if (values.chapters) settings.chapters = true;

try {
  const { parts } = await loadPartsInNode();
  const read = await readMakeInput(input, settings);
  const notes: MakeNote[] = [...read.notes];
  let project = read.project;

  // 1. 数字の照合(台本の数字が元のレポートにあるか)
  let facts: FactReport | null = null;
  if (values.source) {
    facts = checkFacts(project, await fs.readFile(path.resolve(values.source), 'utf8'));
    log(`数字の照合: ${facts.checked} 個を調べました`);
    for (const p of facts.problems) log(`  ✗ シーン ${p.scene}: ${describeFact(p)}`);
  }

  // 2. 画像
  const images = values.images ? path.resolve(values.images) : path.dirname(input);
  const prepared = await prepareImages(project, images, async () => findBrowser());
  project = prepared.project;
  if (prepared.copied.length > 0) log(`画像を projects/assets/ に入れました: ${prepared.copied.join('、')}`);

  // 3. ナレーションの音声・BGM・効果音
  let credit = '';
  const narrated = project.scenes.some((s) => s.narration?.trim());
  if (narrated && values.voice !== 'none') {
    const synth = await createSynth(values.voice as Engine | 'auto', speaker, speed);
    credit = synth.credit;
    log(`ナレーションを音声にしています(${synth.options.engine === 'voicevox' ? `VOICEVOX 話者 ${speaker}` : 'Open JTalk'})…`);
    const voiced = await addNarration(project, synth, resolverFor(project, parts), (d, t) => {
      if (!values.json) process.stdout.write(`\r  ${d} / ${t}`);
    });
    if (!values.json) process.stdout.write('\n');
    project = voiced.project;
    notes.push(...voiced.notes);
    if (sfx) await prepareSfx();
  }
  const hasVoice = project.scenes.some((s) => s.audio);
  const bgm = values.bgm ?? (hasVoice ? 'calm' : 'none');
  project = await prepareBgm(project, bgm === 'none' ? 'none' : (['calm', 'bright'].includes(bgm) ? bgm : path.resolve(bgm)), bgmVolume);

  const resolve = resolverFor(project, parts);
  const seconds = totalSeconds(project);
  log(`「${project.title}」: ${project.scenes.length} シーン・${Math.floor(seconds / 60)} 分 ${Math.round(seconds % 60)} 秒`);
  for (const n of notes) log(`  ⚠ シーン ${n.scene}: ${n.message}`);

  // 4. 組み立ての質の検査
  const q = checkQuality(project, resolve);
  log(`質の検査: ${q.score} 点`);
  for (const item of q.items) log(`  ${describeQuality(item)}`);

  if (values.project) {
    await fs.mkdir(path.dirname(path.resolve(values.project)), { recursive: true });
    await fs.writeFile(path.resolve(values.project), `${JSON.stringify(project, null, 2)}\n`);
  }

  // 5. はみ出しの検査(--review なら静止画を残して見直し用のフォルダにする)
  log('はみ出しを調べています…');
  const reviewDir = values.review ? path.resolve(values.review) : null;
  const stillsDir = reviewDir ?? (await fs.mkdtemp(path.join(os.tmpdir(), 'scene-make-')));
  if (reviewDir) {
    await fs.mkdir(reviewDir, { recursive: true });
    for (const f of await fs.readdir(reviewDir)) if (/^\d+-.*\.png$/.test(f)) await fs.rm(path.join(reviewDir, f));
  }
  const stills = await renderSceneStills(project, stillsDir);
  const issues = stills.flatMap((s) => s.issues.map((i) => ({ scene: s.scene + 1, part: s.part, message: describe(i) })));
  for (const i of issues) log(`  ✗ シーン ${i.scene}(${i.part}): ${i.message}`);
  let review: string | undefined;
  if (reviewDir) {
    review = await writeReview(reviewDir, project, stills, resolve, q, facts);
    log(`見直し用のファイル: ${path.relative(process.cwd(), review)}(一覧.png と各シーンの静止画も同じフォルダ)`);
  } else await fs.rm(stillsDir, { recursive: true, force: true });

  const summary = {
    title: project.title,
    scenes: project.scenes.length,
    seconds: Math.round(seconds * 10) / 10,
    notes,
    issues,
    facts,
    quality: q,
    ...(review ? { review } : {}),
    ...(credit ? { credit } : {}),
  };

  if (issues.length > 0 && !values['allow-overflow']) {
    fail(`文字のはみ出しが ${issues.length} 件あります。原稿の文を短くしてからやり直してください`, summary, 2);
  }
  if (facts && facts.problems.length > 0 && !values['allow-unverified']) {
    fail(`レポートと合わない数字が ${facts.problems.length} 個あります。台本の数字を直してからやり直してください`, summary, 3);
  }
  if (values['check-only']) {
    if (values.json) console.log(JSON.stringify({ ok: true, ...summary }));
    else log('検査が済みました(--check-only なので書き出しはしません)');
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
  // 字幕ファイルと、動画の説明(章・出典・クレジット)
  const base = out.replace(/\.mp4$/i, '');
  const cues = buildCues(project, resolve);
  const srt = cues.length > 0 ? `${base}.srt` : undefined;
  if (srt) await fs.writeFile(srt, toSrt(cues));
  const description = `${base}.txt`;
  await fs.writeFile(description, buildDescription(project, resolve, credit));
  if (values.json) console.log(JSON.stringify({ ok: true, out, bytes, ...(srt ? { srt } : {}), description, ...summary }));
  else {
    log(`\n書き出しました: ${path.relative(process.cwd(), out)}(${(bytes / 1024 / 1024).toFixed(1)} MB)`);
    if (srt) log(`字幕: ${path.relative(process.cwd(), srt)}`);
    log(`動画の説明: ${path.relative(process.cwd(), description)}${credit ? `(${credit} のクレジットを含みます。公開するときは説明に必ず書いてください)` : ''}`);
  }
} catch (e) {
  fail(e instanceof Error ? e.message : String(e));
}
