/**
 * 原稿(文章からシーンを作る書き方の Markdown)またはプロジェクト JSON から、画面を開かずに動画を作る。
 * npm run make から使う。ほかのアプリ(例: Claude Code のスキル)が動画を自動で作るための入口。
 *
 *   1. 原稿をシーンに変換する(部品の上限を超えたところは切り詰めて notes に残す)
 *   2. 画像のシーンが指すファイルを --images のフォルダから projects/assets/ にコピーする
 *      (SVG はスクリプトを書けるのでそのままは使わず、ブラウザで PNG にしてから入れる)
 *   3. 各シーンの見どころを撮って、文字のはみ出しを調べる
 *   4. MP4 を書き出す
 */
import { execFile } from 'node:child_process';
import { existsSync, promises as fs, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { outlineToScenes } from '../src/editor/fromOutline.ts';
import type { PartDef } from '../src/parts/registry.ts';
import { projectSchema, totalFrames, type Project } from '../src/video/project.ts';
import { VIDEO, themes } from '../src/kit/theme.ts';
import { ASSETS_DIR, isValidAssetName, sanitizeAssetName } from './assets.ts';
import { loadPartsInNode } from './parts-node.ts';
import { ROOT } from './projects.ts';

const run = promisify(execFile);

export type MakeNote = { scene: number; message: string };

/** 原稿をプロジェクトにする。scene は 1 始まりの番号 */
export const outlineToProject = (
  text: string,
  parts: readonly PartDef[],
  settings: Record<string, unknown> = {},
): { project: Project; notes: MakeNote[] } => {
  const byId = new Map(parts.map((p) => [p.id, p]));
  const { title, scenes } = outlineToScenes(text, (id) => byId.get(id));
  if (scenes.length === 0) throw new Error('原稿からシーンを 1 つも作れませんでした(# や ## の見出しがあるか確かめてください)');
  const notes: MakeNote[] = [];
  scenes.forEach((s, i) => s.notes.forEach((message) => notes.push({ scene: i + 1, message })));
  const project = projectSchema.parse({
    title: title || '無題',
    settings,
    scenes: scenes.map(({ scene }) => ({ part: scene.part, seconds: scene.seconds, props: scene.props })),
  });
  return { project, notes };
};

/** 画像のシーンが指しているファイル名(ロゴも含む) */
export const imageRefs = (project: Project): { scene: number; file: string }[] => {
  const refs: { scene: number; file: string }[] = [];
  project.scenes.forEach((s, i) => {
    const f = s.props.file;
    if (s.part === 'image' && typeof f === 'string' && f.trim() !== '') refs.push({ scene: i + 1, file: f.trim() });
  });
  if (project.settings.logo) refs.push({ scene: 0, file: project.settings.logo });
  return refs;
};

/** PNG にするときの名前(SVG だけ拡張子を .png に変える。使えない文字は _ にする) */
export const assetNameFor = (file: string): string => {
  const base = path.basename(file);
  return sanitizeAssetName(/\.svg$/i.test(base) ? base.replace(/\.svg$/i, '.png') : base);
};

/** SVG の viewBox(なければ width / height)から縦横比を出す */
export const svgAspect = (svg: string): number => {
  const vb = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(svg);
  if (vb && Number(vb[1]) > 0) return Number(vb[2]) / Number(vb[1]);
  const w = /\swidth\s*=\s*["']([\d.]+)/i.exec(svg);
  const h = /\sheight\s*=\s*["']([\d.]+)/i.exec(svg);
  if (w && h && Number(w[1]) > 0) return Number(h[1]) / Number(w[1]);
  return 9 / 16;
};

/** 書き出しに使う Chrome(環境変数、または Remotion がダウンロードした Chrome Headless Shell) */
export const findBrowser = (): string | null => {
  if (process.env.REMOTION_BROWSER_EXECUTABLE) return process.env.REMOTION_BROWSER_EXECUTABLE;
  const dir = path.join(ROOT, 'node_modules', '.remotion', 'chrome-headless-shell');
  const names = new Set(['chrome-headless-shell', 'chrome-headless-shell.exe']);
  const walk = (d: string, depth: number): string | null => {
    if (depth > 4 || !existsSync(d)) return null;
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isFile() && names.has(e.name)) return p;
      if (e.isDirectory()) {
        const found = walk(p, depth + 1);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(dir, 0);
};

/** SVG を白い背景の PNG にする(幅 1600px。ブラウザで開いて撮るだけで、スクリプトは動かさない) */
export const svgToPng = async (svgFile: string, pngFile: string, browser: string, width = 1600) => {
  const svg = await fs.readFile(svgFile, 'utf8');
  const height = Math.max(1, Math.round(width * svgAspect(svg)));
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'scene-svg-'));
  try {
    const html = path.join(tmp, 'page.html');
    await fs.writeFile(
      html,
      // CSP で script を止める(SVG の中に script があっても動かない)
      `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:">` +
        `<style>html,body{margin:0;background:#fff;overflow:hidden}svg{display:block;width:${width}px;height:${height}px}</style>${svg}`,
    );
    await run(
      browser,
      [
        '--headless',
        '--no-sandbox',
        '--disable-gpu',
        '--hide-scrollbars',
        '--force-device-scale-factor=1',
        `--window-size=${width},${height}`,
        `--screenshot=${pngFile}`,
        pathToFileURL(html).href,
      ],
      { timeout: 60_000 },
    );
    if (!existsSync(pngFile)) throw new Error(`${path.basename(svgFile)} を PNG にできませんでした`);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
};

/**
 * 画像のシーンが指すファイルを images フォルダから projects/assets/ に入れ、プロジェクトの参照を入れた名前に直す。
 * projects/assets/ にすでにあるファイルは、images フォルダに同じ名前がなければそのまま使う。
 */
export const prepareImages = async (
  project: Project,
  imagesDir: string | null,
  browser: () => Promise<string | null>,
): Promise<{ project: Project; copied: string[] }> => {
  const copied: string[] = [];
  const rename = new Map<string, string>();
  await fs.mkdir(ASSETS_DIR, { recursive: true });
  for (const { scene, file } of imageRefs(project)) {
    if (rename.has(file)) continue;
    const src = imagesDir ? path.join(imagesDir, path.basename(file)) : null;
    const name = assetNameFor(file);
    if (!isValidAssetName(name)) throw new Error(`シーン ${scene}: 画像の名前「${file}」は使えません`);
    if (src && existsSync(src)) {
      const dest = path.join(ASSETS_DIR, name);
      if (/\.svg$/i.test(src)) {
        const exe = await browser();
        if (!exe) throw new Error('SVG を PNG にする Chrome が見つかりません(環境変数 REMOTION_BROWSER_EXECUTABLE に Chrome のパスを入れてください)');
        await svgToPng(src, dest, exe);
      } else {
        await fs.copyFile(src, dest);
      }
      copied.push(name);
    } else if (!existsSync(path.join(ASSETS_DIR, name))) {
      throw new Error(`シーン ${scene}: 画像「${file}」が見つかりません${imagesDir ? `(${imagesDir} にも projects/assets/ にもありません)` : '(--images でフォルダを指定してください)'}`);
    }
    rename.set(file, name);
  }
  const scenes = project.scenes.map((s) =>
    s.part === 'image' && typeof s.props.file === 'string' && rename.has(s.props.file.trim())
      ? { ...s, props: { ...s.props, file: rename.get(s.props.file.trim()) } }
      : s,
  );
  const logo = project.settings.logo ? (rename.get(project.settings.logo) ?? project.settings.logo) : project.settings.logo;
  return { project: { ...project, scenes, settings: { ...project.settings, logo } }, copied };
};

/** 入力(原稿 .md / .txt または プロジェクト .json)を読んでプロジェクトにする */
export const readMakeInput = async (
  file: string,
  settings: Record<string, unknown> = {},
): Promise<{ name: string; project: Project; notes: MakeNote[] }> => {
  const text = await fs.readFile(file, 'utf8');
  const name = path.basename(file, path.extname(file));
  if (/\.json$/i.test(file)) {
    const json = JSON.parse(text) as Record<string, unknown>;
    const merged = { ...json, settings: { ...((json.settings as Record<string, unknown>) ?? {}), ...settings } };
    return { name, project: projectSchema.parse(merged), notes: [] };
  }
  const { parts } = await loadPartsInNode();
  return { name, ...outlineToProject(text, parts, settings) };
};

export const totalSeconds = (project: Project): number => totalFrames(project) / VIDEO.fps;

export const isTheme = (id: string): boolean => id in themes;
