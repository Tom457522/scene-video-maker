import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

// 置き場所を一時フォルダにしてから読む(順序が大事)
const dir = mkdtempSync(path.join(os.tmpdir(), 'svm-make-'));
process.env.SCENE_PROJECTS_DIR = dir;
const make = await import('../server/make.ts');
const { loadPartsInNode } = await import('../server/parts-node.ts');

const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');

const OUTLINE = `# テーブルの基本
行・列・主キー

## 主キー
- 値が[[重複しない]]
- 空欄がない
> 1 行を見分ける目印

## 列と行
![列は縦、行は横](L002-1.svg)

## まとめ
- 主キーは重複なし・空欄なし`;

test('outlineToProject: 原稿から部品・秒数・設定の入ったプロジェクトを作る', async () => {
  const { parts } = await loadPartsInNode();
  const { project, notes } = make.outlineToProject(OUTLINE, parts, { theme: 'light' });
  assert.equal(project.title, 'テーブルの基本');
  assert.deepEqual(
    project.scenes.map((s) => s.part),
    ['title', 'bullets', 'image', 'summary'],
  );
  assert.equal(project.settings.theme, 'light');
  assert.equal(project.scenes[2].props.file, 'L002-1.svg');
  for (const s of project.scenes) assert.ok(s.seconds >= 1 && s.seconds <= 60);
  assert.deepEqual(notes, []);
  assert.ok(make.totalSeconds(project) > 5);
});

test('outlineToProject: 上限を超えたところはシーンの番号つきで知らせ、空の原稿は断る', async () => {
  const { parts } = await loadPartsInNode();
  const long = `## 見出し\n- ${'あ'.repeat(300)}`;
  const { notes } = make.outlineToProject(long, parts);
  assert.ok(notes.length > 0);
  assert.equal(notes[0].scene, 1);
  assert.throws(() => make.outlineToProject('  \n', parts));
});

test('assetNameFor / svgAspect: SVG は .png の名前にし、縦横比を viewBox から出す', () => {
  assert.equal(make.assetNameFor('dir/L002-1.svg'), 'L002-1.png');
  assert.equal(make.assetNameFor('写真.JPG'), '写真.jpg');
  assert.equal(make.svgAspect('<svg viewBox="0 0 400 256">'), 256 / 400);
  assert.equal(make.svgAspect('<svg width="200" height="100">'), 0.5);
  assert.equal(make.svgAspect('<svg>'), 9 / 16);
});

test('prepareImages: --images のフォルダから assets/ にコピーし、見つからなければ断る', async () => {
  const { parts } = await loadPartsInNode();
  const images = mkdtempSync(path.join(os.tmpdir(), 'svm-images-'));
  writeFileSync(path.join(images, 'L002-1.png'), PNG);
  const { project } = make.outlineToProject(OUTLINE.replace('L002-1.svg', 'L002-1.png'), parts);
  const r = await make.prepareImages(project, images, async () => null);
  assert.deepEqual(r.copied, ['L002-1.png']);
  assert.ok(existsSync(path.join(dir, 'assets', 'L002-1.png')));

  // SVG を PNG にする Chrome がなければ、理由を付けて断る
  writeFileSync(path.join(images, 'L002-1.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"/>');
  const svgProject = make.outlineToProject(OUTLINE, parts).project;
  await assert.rejects(make.prepareImages(svgProject, images, async () => null), /Chrome/);

  const missing = make.outlineToProject(OUTLINE.replace('L002-1.svg', 'ない.png'), parts).project;
  await assert.rejects(make.prepareImages(missing, images, async () => null), /見つかりません/);
});

test('buildDescription: 目次・出典・クレジットを並べる', async () => {
  const { parts } = await loadPartsInNode();
  const { project } = make.outlineToProject(
    `# 題\n\n## A\n- x\n出典: 調査 A\n\n## B\n- y\n出典: 調査 A\n\n## C\n- z\n出典: 調査 C`,
    parts,
  );
  const scenes = project.scenes.map((s) => ({ ...s, seconds: 12 }));
  const text = make.buildDescription({ ...project, scenes }, make.resolverFor({ ...project, scenes }, parts), 'VOICEVOX:ずんだもん');
  assert.match(text, /■ 目次\n0:00 題\n0:12 A/);
  assert.match(text, /■ 出典\n・調査 A\n・調査 C\n/);
  assert.match(text, /VOICEVOX:ずんだもん/);
});

test('partSpec: 部品ごとの入力の上限を JSON Schema で出す', async () => {
  const { parts } = await loadPartsInNode();
  const spec = make.partSpec(parts);
  const bullets = spec.find((p) => p.id === 'bullets')!;
  const items = (bullets.props as { properties: Record<string, { maxItems?: number; items?: { maxLength?: number } }> }).properties.items;
  assert.equal(items.maxItems, 6);
  assert.equal(items.items?.maxLength, 60);
});

test('見本の台本(examples/空き家)は、数字がレポートと合い、質の検査も通る', async () => {
  const { readFileSync } = await import('node:fs');
  const { checkFacts } = await import('../src/video/facts.ts');
  const { checkQuality } = await import('../src/video/quality.ts');
  const { parts } = await loadPartsInNode();
  const root = path.join(import.meta.dirname, '..', 'examples', '空き家');
  const { project, notes } = make.outlineToProject(readFileSync(path.join(root, '台本.md'), 'utf8'), parts);
  assert.deepEqual(notes, []);
  assert.ok(project.scenes.length >= 8 && project.scenes.length <= 14);
  assert.ok(project.scenes.every((s) => s.narration));
  assert.deepEqual(checkFacts(project, readFileSync(path.join(root, 'レポート.md'), 'utf8')).problems, []);
  const q = checkQuality(project, make.resolverFor(project, parts));
  assert.ok(q.score >= 90, JSON.stringify(q.items));
});

test('buildDescription: 引用の出典も「出典」に入れる', async () => {
  const { parts } = await loadPartsInNode();
  const { project } = make.outlineToProject(`# 題\n\n## 名言\n>> 知は力なり\n-- フランシス・ベーコン`, parts);
  assert.match(make.buildDescription(project, make.resolverFor(project, parts), ''), /■ 出典\n・フランシス・ベーコン/);
});
