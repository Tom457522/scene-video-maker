/**
 * ナレーションを音声にして、シーンに付ける(npm run make が使う)。
 *
 *   1. ▶ のないナレーションは、画面の項目の語を手がかりに ▶ を自動で置く
 *   2. ▶ で区切った文ごとに音声合成し、無音を詰めてつなぐ(区切りの時刻 = 項目を出す時刻が正確に分かる)
 *   3. シーンの秒数を、音声の長さに合わせる
 *   4. BGM と効果音のファイルを用意する
 *
 * 音声は projects/assets/audio/ に、文と声の設定から決まる名前で保存する(同じ文なら作り直さない)。
 */
import { createHash } from 'node:crypto';
import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { MAX_SECONDS, type Project } from '../src/video/project.ts';
import { autoCues, cueItems, speechText, splitAtCues, timeSegments } from '../src/video/narration.ts';
import { SFX_FILE } from '../src/video/sound-files.ts';
import { ASSETS_DIR } from './assets.ts';
import { makeBgm, makePop, MOODS, type Mood } from './music.ts';
import type { Synth } from './tts.ts';
import { concatPcm, normalizePcm, pcmSeconds, readWav, trimSilence, writeWav, type Pcm } from './wav.ts';

export const AUDIO_DIR = path.join(ASSETS_DIR, 'audio');

/** 話し始めるまでの間(見出しが出るのを待つ) */
const LEAD = 0.5;
/** 話し終えてから次のシーンに移るまでの間 */
const TAIL = 0.9;

export type VoiceNote = { scene: number; message: string };

const silence = (like: Pcm, seconds: number): Pcm => ({
  ...like,
  samples: new Int16Array(Math.round(seconds * like.sampleRate) * like.channels),
});

/** 区切りの後の間(文の終わりは長め、読点や途中の区切りは短め) */
const gapAfter = (segment: string): number => (/[。!?!?]\s*$/.test(segment.trim()) ? 0.32 : 0.14);

/** 1 つのナレーションを音声にする。区切りごとの長さ(後ろの間を含む)を返す */
const synthesize = async (synth: Synth, segments: string[]): Promise<{ wav: Buffer; durations: number[] }> => {
  const pieces: (Pcm | null)[] = [];
  for (const seg of segments) {
    const text = speechText(seg);
    pieces.push(text ? trimSilence(readWav(await synth.say(text))) : null);
  }
  const like = pieces.find((p): p is Pcm => !!p);
  if (!like) throw new Error('読み上げる文がありません');
  const parts: Pcm[] = [];
  const durations: number[] = [];
  pieces.forEach((p, i) => {
    if (!p) {
      durations.push(0);
      return;
    }
    const last = i === pieces.length - 1 || pieces.slice(i + 1).every((x) => !x);
    const gap = last ? 0 : gapAfter(segments[i]);
    parts.push(p);
    if (gap > 0) parts.push(silence(p, gap));
    durations.push(pcmSeconds(p) + gap);
  });
  return { wav: writeWav(normalizePcm(concatPcm(parts))), durations };
};

/**
 * ナレーションのあるシーンに音声を付け、秒数を音声に合わせる。
 * resolve(i) には i 番目のシーンの入力値(既定値で補ったもの)を返す関数を渡す。
 */
export const addNarration = async (
  project: Project,
  synth: Synth,
  resolve: (i: number) => Record<string, unknown>,
  onProgress: (done: number, total: number) => void = () => undefined,
): Promise<{ project: Project; notes: VoiceNote[]; tooLong: number[] }> => {
  await fs.mkdir(AUDIO_DIR, { recursive: true });
  const notes: VoiceNote[] = [];
  /** 音声がシーンの上限(60 秒)に収まらないシーンの番号(そのまま書き出すと声が途中で切れる) */
  const tooLong: number[] = [];
  const total = project.scenes.filter((s) => s.narration?.trim()).length;
  let done = 0;
  const scenes = [];
  for (const [i, scene] of project.scenes.entries()) {
    const narration = scene.narration?.trim();
    if (!narration) {
      const { audio: _old, ...rest } = scene;
      scenes.push(rest);
      continue;
    }
    const items = cueItems(scene.part, resolve(i));
    const marked = autoCues(narration, items);
    const segments = splitAtCues(marked);
    const cueCount = segments.length - 1;
    if (items.length > 0 && cueCount > items.length) notes.push({ scene: i + 1, message: `▶ が ${cueCount} 個ありますが、画面の項目は ${items.length} 個です(多い ▶ は使いません)` });
    const { options } = synth;
    const key = createHash('sha1')
      .update(JSON.stringify([2, options.engine, options.speaker, options.speed, segments.map(speechText), segments.map(gapAfter)]))
      .digest('hex')
      .slice(0, 16);
    const file = `audio/voice-${key}.wav`;
    const metaFile = path.join(AUDIO_DIR, `voice-${key}.json`);
    let durations: number[];
    if (existsSync(path.join(ASSETS_DIR, file)) && existsSync(metaFile)) {
      durations = (JSON.parse(await fs.readFile(metaFile, 'utf8')) as { durations: number[] }).durations;
    } else {
      const out = await synthesize(synth, segments);
      durations = out.durations;
      await fs.writeFile(path.join(ASSETS_DIR, file), out.wav);
      await fs.writeFile(metaFile, JSON.stringify({ durations }));
    }
    const duration = durations.reduce((a, b) => a + b, 0);
    const { lines, cues } = timeSegments(segments, durations);
    const lead = scene.part === 'title' ? 0.8 : LEAD;
    let seconds = Math.round((lead + duration + TAIL) * 10) / 10;
    if (seconds > MAX_SECONDS) {
      tooLong.push(i + 1);
      notes.push({ scene: i + 1, message: `ナレーションが長すぎます(${Math.round(duration)} 秒)。シーンは ${MAX_SECONDS} 秒までなので、文を短くするかシーンを分けてください` });
      seconds = MAX_SECONDS;
    }
    const round = (x: number) => Math.round(x * 1000) / 1000;
    scenes.push({
      ...scene,
      seconds: Math.max(2.5, seconds),
      audio: {
        file,
        start: lead,
        duration: round(duration),
        cues: cues.slice(0, items.length || cues.length).map(round),
        lines: lines.filter((l) => l.text).map((l) => ({ text: l.text, start: round(l.start), end: round(l.end) })),
      },
    });
    onProgress(++done, total);
  }
  return { project: { ...project, scenes }, notes, tooLong };
};

/** BGM を用意して設定に入れる。mood か、手持ちの音声ファイルのパス */
export const prepareBgm = async (project: Project, bgm: string, volume?: number): Promise<Project> => {
  if (bgm === 'none' || bgm === '') return { ...project, settings: { ...project.settings, bgm: '' } };
  await fs.mkdir(AUDIO_DIR, { recursive: true });
  let file: string;
  if ((MOODS as string[]).includes(bgm)) {
    file = `audio/bgm-${bgm}.wav`;
    if (!existsSync(path.join(ASSETS_DIR, file))) await fs.writeFile(path.join(ASSETS_DIR, file), writeWav(makeBgm(bgm as Mood)));
  } else {
    if (!/\.(wav|mp3|m4a|aac|ogg)$/i.test(bgm)) throw new Error('--bgm には calm / bright / none か、音声ファイル(wav / mp3 / m4a / aac / ogg)を指定してください');
    if (!existsSync(bgm)) throw new Error(`BGM のファイル「${bgm}」が見つかりません`);
    const name = path.basename(bgm).replace(/[^\p{L}\p{N}_.-]/gu, '_');
    file = `audio/${name}`;
    await fs.copyFile(bgm, path.join(ASSETS_DIR, file));
  }
  return { ...project, settings: { ...project.settings, bgm: file, ...(volume !== undefined ? { bgmVolume: volume } : {}) } };
};

/** 効果音のファイルを用意する */
export const prepareSfx = async (): Promise<void> => {
  const dest = path.join(ASSETS_DIR, SFX_FILE);
  if (existsSync(dest)) return;
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, writeWav(makePop()));
};
