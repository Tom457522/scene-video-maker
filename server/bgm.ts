/**
 * エディタで選ぶ BGM。projects/assets/audio/ に置く(git には入れない)。
 *   - 自動で作る曲(calm / bright): 選んだときにその場で作る(audio/bgm-calm.wav など)
 *   - 手持ちの曲: エディタから追加する(audio/bgm-file-<名前>.mp3 など)
 */
import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { ASSETS_DIR } from './assets.ts';
import { makeBgm, MOODS, type Mood } from './music.ts';
import { writeWav } from './wav.ts';

const AUDIO_DIR = path.join(ASSETS_DIR, 'audio');
/** 1 ファイルの大きさの上限 */
export const MAX_BGM_BYTES = 20 * 1024 * 1024;
const EXT = /\.(mp3|wav|m4a|aac|ogg)$/i;
const UPLOAD_PREFIX = 'bgm-file-';
const NAME_RE = /^bgm-file-[\p{L}\p{N}_\- ]{1,80}\.(mp3|wav|m4a|aac|ogg)$/iu;

export type BgmChoice = { file: string; label: string; generated: boolean };

export const MOOD_LABELS: Record<Mood, string> = { calm: '落ち着いた曲(自動で作る)', bright: '明るい曲(自動で作る)' };

/** 選べる BGM の一覧。自動で作る曲は、まだ作っていなくても並べる */
export const listBgm = async (): Promise<BgmChoice[]> => {
  const moods = MOODS.map((m) => ({ file: `audio/bgm-${m}.wav`, label: MOOD_LABELS[m], generated: true }));
  let names: string[] = [];
  try {
    names = await fs.readdir(AUDIO_DIR);
  } catch {
    /* まだフォルダがない */
  }
  const uploaded = names
    .filter((n) => NAME_RE.test(n))
    .sort((a, b) => a.localeCompare(b, 'ja'))
    .map((n) => ({ file: `audio/${n}`, label: n.slice(UPLOAD_PREFIX.length), generated: false }));
  return [...moods, ...uploaded];
};

/** 自動で作る曲を用意する(なければ作る)。ファイルの場所を返す */
export const ensureMoodBgm = async (mood: string): Promise<string> => {
  if (!(MOODS as string[]).includes(mood)) throw new Error('曲の種類が不正です');
  const file = `audio/bgm-${mood}.wav`;
  await fs.mkdir(AUDIO_DIR, { recursive: true });
  if (!existsSync(path.join(ASSETS_DIR, file))) await fs.writeFile(path.join(ASSETS_DIR, file), writeWav(makeBgm(mood as Mood)));
  return file;
};

/** 手持ちの曲として保存した名前か(audio/ の中のファイル名) */
export const isUploadedBgmName = (name: string): boolean => NAME_RE.test(name) && path.basename(name) === name;

/** 自動で作る曲の場所なら、その種類(calm など)を返す */
export const moodOf = (file: string): string | null => {
  const m = /^audio\/bgm-(\w+)\.wav$/.exec(file);
  return m && (MOODS as string[]).includes(m[1]) ? m[1] : null;
};

/** 先頭のバイトで、本当に音声かを確かめる(MP3・WAV・M4A/AAC・Ogg) */
export const looksLikeAudio = (b: Buffer): boolean =>
  b.subarray(0, 3).toString('latin1') === 'ID3' ||
  (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) ||
  (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WAVE') ||
  b.subarray(4, 8).toString('latin1') === 'ftyp' ||
  b.subarray(0, 4).toString('latin1') === 'OggS';

/** 手持ちの曲を保存する。同じ名前があれば「名前-2.mp3」のようにする。ファイルの場所を返す */
export const saveBgm = async (requestedName: string, data: Buffer): Promise<string> => {
  if (data.length > MAX_BGM_BYTES) throw new Error('曲のファイルが大きすぎます(20MB まで)');
  const ext = (EXT.exec(requestedName)?.[0] ?? '').toLowerCase();
  if (!ext) throw new Error('MP3 / WAV / M4A / AAC / Ogg の曲だけを使えます');
  if (!looksLikeAudio(data)) throw new Error('音声のファイルとして読めません(MP3 / WAV / M4A / AAC / Ogg)');
  const base =
    path
      .basename(requestedName, path.extname(requestedName))
      .replace(/[^\p{L}\p{N}_\- ]/gu, '_')
      .trim()
      .slice(0, 70) || 'music';
  await fs.mkdir(AUDIO_DIR, { recursive: true });
  let name = `${UPLOAD_PREFIX}${base}${ext}`;
  for (let i = 2; existsSync(path.join(AUDIO_DIR, name)); i++) name = `${UPLOAD_PREFIX}${base}-${i}${ext}`;
  if (!NAME_RE.test(name)) throw new Error('ファイル名が使えません');
  await fs.writeFile(path.join(AUDIO_DIR, name), data);
  return `audio/${name}`;
};
