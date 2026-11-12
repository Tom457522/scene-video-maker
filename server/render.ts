/**
 * @remotion/bundler と @remotion/renderer で MP4・静止画を書き出す。
 * バンドルは src/ が変わったときだけ作り直す。
 */
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition, ensureBrowser, makeCancelSignal } from '@remotion/renderer';

export { makeCancelSignal };
import { COMPOSITION_ID, EXPORT_FORMATS, type ExportFormat } from '../src/remotion/composition-id.ts';
import { sceneTimeline, type Project } from '../src/video/project.ts';
import { LAYOUT_LOG_PREFIX, type LayoutIssue } from '../src/video/layout-check.ts';
import { ROOT } from './projects.ts';
import { ASSETS_DIR } from './assets.ts';

const ENTRY = path.join(ROOT, 'src', 'remotion', 'index.ts');
const SRC = path.join(ROOT, 'src');

/** 環境変数 REMOTION_BROWSER_EXECUTABLE で、ダウンロードせず手元の Chrome / Chromium を使える */
const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || null;

/** 書き出しを途中で止めたとき */
export class RenderCancelled extends Error {
  constructor() {
    super('書き出しを中止しました');
  }
}

export type Stage = 'bundling' | 'browser' | 'rendering' | 'done';
export type ProgressFn = (stage: Stage, progress: number) => void;

const latestMtime = async (dir: string): Promise<number> => {
  let latest = 0;
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) latest = Math.max(latest, await latestMtime(p));
    else latest = Math.max(latest, (await fs.stat(p)).mtimeMs);
  }
  // フォルダの追加・削除も拾う
  return Math.max(latest, (await fs.stat(dir)).mtimeMs);
};

let cached: { key: number; serveUrl: string } | null = null;
let inflight: { key: number; promise: Promise<string> } | null = null;

/**
 * Remotion のバンドルを返す。src/ か projects/assets/(画像)が変わったときだけ作り直す。
 * 同時に呼ばれても(起動時の準備と書き出しが重なっても)バンドルは 1 回だけ作る。
 */
export const getBundle = async (onProgress?: (p: number) => void): Promise<string> => {
  await fs.mkdir(ASSETS_DIR, { recursive: true });
  const key = Math.max(await latestMtime(SRC), await latestMtime(ASSETS_DIR));
  if (cached && cached.key === key) return cached.serveUrl;
  if (inflight && inflight.key === key) return inflight.promise;
  const previous = cached;
  const promise = bundle({
    entryPoint: ENTRY,
    onProgress: (p) => onProgress?.(p / 100),
    outDir: path.join(os.tmpdir(), 'scene-video-maker', `bundle-${Date.now()}`),
    publicDir: ASSETS_DIR,
  }).then(async (serveUrl) => {
    cached = { key, serveUrl };
    inflight = null;
    if (previous) await fs.rm(previous.serveUrl, { recursive: true, force: true }).catch(() => undefined);
    return serveUrl;
  });
  inflight = { key, promise };
  promise.catch(() => {
    inflight = null;
  });
  return promise;
};

let browserReady = false;
const prepareBrowser = async (onProgress?: (p: number) => void) => {
  if (browserReady) return;
  await ensureBrowser({
    browserExecutable,
    onBrowserDownload: () => {
      console.log('Chrome Headless Shell をダウンロードしています(初回のみ)…');
      return { version: null, onProgress: ({ percent }) => onProgress?.(percent) };
    },
  });
  browserReady = true;
};

const prepare = async (project: Project, onProgress: ProgressFn, checkLayout = false, id: string = COMPOSITION_ID) => {
  const serveUrl = await getBundle((p) => onProgress('bundling', p));
  await prepareBrowser((p) => onProgress('browser', p));
  const inputProps = { project, checkLayout };
  const composition = await selectComposition({ serveUrl, id, inputProps, browserExecutable });
  return { serveUrl, inputProps, composition };
};

/** MP4(H.264)を書き出す */
export const renderVideo = async (
  project: Project,
  outputLocation: string,
  onProgress: ProgressFn = () => undefined,
  opts: { cancelSignal?: ReturnType<typeof makeCancelSignal>['cancelSignal']; isCancelled?: () => boolean; format?: ExportFormat } = {},
) => {
  const format = EXPORT_FORMATS[opts.format ?? '720p'];
  const { serveUrl, inputProps, composition } = await prepare(project, onProgress, false, format.composition);
  // バンドル中は止められないので、終わった時点で中止の指示があれば書き出しを始めない
  if (opts.isCancelled?.()) throw new RenderCancelled();
  await fs.mkdir(path.dirname(outputLocation), { recursive: true });
  await renderMedia({
    composition,
    serveUrl,
    inputProps,
    codec: 'h264',
    muted: true,
    // 1080p は 720p の画面を 1.5 倍の解像度で撮る(文字や図形はベクターなのでぼやけない)
    scale: format.scale,
    outputLocation,
    browserExecutable,
    cancelSignal: opts.cancelSignal,
    onProgress: ({ progress }) => onProgress('rendering', progress),
  });
  onProgress('done', 1);
  return outputLocation;
};

export type SceneStill = {
  file: string;
  scene: number;
  part: string;
  frame: number;
  /** はみ出しの検査結果(問題がなければ空) */
  issues: LayoutIssue[];
};

/** 各シーンの見どころ(開始から ratio の時点)を PNG で書き出し、文字のはみ出しも調べる */
export const renderSceneStills = async (
  project: Project,
  outDir: string,
  ratio = 0.7,
  onProgress: ProgressFn = () => undefined,
): Promise<SceneStill[]> => {
  const { serveUrl, inputProps, composition } = await prepare(project, onProgress, true);
  await fs.mkdir(outDir, { recursive: true });
  const timeline = sceneTimeline(project);
  const results: SceneStill[] = [];
  for (const [i, scene] of project.scenes.entries()) {
    const { from, durationInFrames } = timeline[i];
    const frame = from + Math.min(durationInFrames - 1, Math.floor(durationInFrames * ratio));
    const file = path.join(outDir, `${String(i + 1).padStart(2, '0')}-${scene.part}.png`);
    let issues: LayoutIssue[] = [];
    await renderStill({
      composition,
      serveUrl,
      inputProps,
      frame,
      output: file,
      browserExecutable,
      onBrowserLog: (log) => {
        if (!log.text.startsWith(LAYOUT_LOG_PREFIX)) return;
        const data = JSON.parse(log.text.slice(LAYOUT_LOG_PREFIX.length)) as { scene: number; issues: LayoutIssue[] };
        if (data.scene === i) issues = data.issues;
      },
    });
    results.push({ file, scene: i, part: scene.part, frame, issues });
    onProgress('rendering', (i + 1) / project.scenes.length);
  }
  onProgress('done', 1);
  return results;
};

/** 1 つのシーンの見どころ(既定: 70% の時点)を PNG で書き出す(サムネイルや資料に使う) */
export const renderOneStill = async (project: Project, sceneIndex: number, output: string, ratio = 0.7) => {
  const t = sceneTimeline(project)[sceneIndex];
  if (!t) throw new Error(`シーン ${sceneIndex + 1} がありません`);
  const { serveUrl, inputProps, composition } = await prepare(project, () => undefined);
  await fs.mkdir(path.dirname(output), { recursive: true });
  const frame = t.from + Math.min(t.durationInFrames - 1, Math.floor(t.durationInFrames * ratio));
  await renderStill({ composition, serveUrl, inputProps, frame, output, browserExecutable });
  return output;
};

/** 起動直後に、書き出しの準備(バンドル作成とブラウザの用意)を裏で済ませておく */
export const warmUp = async () => {
  const t = Date.now();
  await getBundle();
  await prepareBrowser();
  return Date.now() - t;
};
