/**
 * @remotion/bundler と @remotion/renderer で MP4・静止画を書き出す。
 * バンドルは src/ が変わったときだけ作り直す。
 */
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition, ensureBrowser } from '@remotion/renderer';
import { COMPOSITION_ID } from '../src/remotion/composition-id.ts';
import { sceneTimeline, type Project } from '../src/video/project.ts';
import { ROOT } from './projects.ts';

const ENTRY = path.join(ROOT, 'src', 'remotion', 'index.ts');
const SRC = path.join(ROOT, 'src');

/** 環境変数 REMOTION_BROWSER_EXECUTABLE で、ダウンロードせず手元の Chrome / Chromium を使える */
const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || null;

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

export const getBundle = async (onProgress?: (p: number) => void): Promise<string> => {
  const key = await latestMtime(SRC);
  if (cached && cached.key === key) return cached.serveUrl;
  const previous = cached;
  const serveUrl = await bundle({
    entryPoint: ENTRY,
    onProgress: (p) => onProgress?.(p / 100),
    outDir: path.join(os.tmpdir(), 'scene-video-maker', `bundle-${Date.now()}`),
  });
  cached = { key, serveUrl };
  if (previous) await fs.rm(previous.serveUrl, { recursive: true, force: true }).catch(() => undefined);
  return serveUrl;
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

const prepare = async (project: Project, onProgress: ProgressFn) => {
  const serveUrl = await getBundle((p) => onProgress('bundling', p));
  await prepareBrowser((p) => onProgress('browser', p));
  const inputProps = { project };
  const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps, browserExecutable });
  return { serveUrl, inputProps, composition };
};

/** MP4(H.264)を書き出す */
export const renderVideo = async (project: Project, outputLocation: string, onProgress: ProgressFn = () => undefined) => {
  const { serveUrl, inputProps, composition } = await prepare(project, onProgress);
  await fs.mkdir(path.dirname(outputLocation), { recursive: true });
  await renderMedia({
    composition,
    serveUrl,
    inputProps,
    codec: 'h264',
    muted: true,
    outputLocation,
    browserExecutable,
    onProgress: ({ progress }) => onProgress('rendering', progress),
  });
  onProgress('done', 1);
  return outputLocation;
};

/** 各シーンの見どころ(開始から ratio の時点)を PNG で書き出す */
export const renderSceneStills = async (
  project: Project,
  outDir: string,
  ratio = 0.7,
  onProgress: ProgressFn = () => undefined,
): Promise<string[]> => {
  const { serveUrl, inputProps, composition } = await prepare(project, onProgress);
  await fs.mkdir(outDir, { recursive: true });
  const timeline = sceneTimeline(project);
  const files: string[] = [];
  for (const [i, scene] of project.scenes.entries()) {
    const { from, durationInFrames } = timeline[i];
    const frame = from + Math.min(durationInFrames - 1, Math.floor(durationInFrames * ratio));
    const file = path.join(outDir, `${String(i + 1).padStart(2, '0')}-${scene.part}.png`);
    await renderStill({ composition, serveUrl, inputProps, frame, output: file, browserExecutable });
    files.push(file);
    onProgress('rendering', (i + 1) / project.scenes.length);
  }
  onProgress('done', 1);
  return files;
};
