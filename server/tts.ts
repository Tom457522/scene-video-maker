/**
 * 音声合成(無料で使えるものだけ)。
 *
 *   voicevox  VOICEVOX(https://voicevox.hiroshiba.jp/)のアプリかエンジンを起動しておくと使える。声が自然。
 *             使った声のクレジット(例: 「VOICEVOX:ずんだもん」)を動画の説明などに書く決まりがある。
 *   openjtalk Open JTalk(コマンド open_jtalk)。Linux なら apt で入る。声は機械的だが、どこでも動く。
 *
 * auto は VOICEVOX が動いていればそれを、なければ Open JTalk を使う。
 */
import { execFile } from 'node:child_process';
import { existsSync, promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

export type Engine = 'voicevox' | 'openjtalk';

export type VoiceOptions = {
  engine: Engine;
  /** VOICEVOX の話者の番号(既定 3: ずんだもん ノーマル) */
  speaker: number;
  /** 話す速さ(1 が標準) */
  speed: number;
};

export type Synth = {
  options: VoiceOptions;
  /** 文を WAV にする */
  say: (text: string) => Promise<Buffer>;
  /** 動画の説明などに書くクレジット(不要なら空) */
  credit: string;
};

export const VOICEVOX_URL = (process.env.VOICEVOX_URL || 'http://127.0.0.1:50021').replace(/\/$/, '');

const OPEN_JTALK_DICS = [
  process.env.OPEN_JTALK_DIC,
  '/var/lib/mecab/dic/open-jtalk/naist-jdic',
  '/usr/share/open_jtalk/dic',
  '/usr/local/share/open_jtalk/dic',
  '/opt/homebrew/opt/open-jtalk/dic',
  '/usr/local/opt/open-jtalk/dic',
];
const OPEN_JTALK_VOICES = [
  process.env.OPEN_JTALK_VOICE,
  '/usr/share/hts-voice/mei/mei_normal.htsvoice',
  '/usr/share/hts-voice/nitech-jp-atr503-m001/nitech_jp_atr503_m001.htsvoice',
  '/usr/local/share/hts-voice/mei/mei_normal.htsvoice',
  '/opt/homebrew/opt/open-jtalk/voice/mei/mei_normal.htsvoice',
  '/usr/local/opt/open-jtalk/voice/mei/mei_normal.htsvoice',
];

const firstExisting = (list: (string | undefined)[]) => list.find((p): p is string => !!p && existsSync(p)) ?? null;

/** VOICEVOX が動いているか(1.5 秒で見切る) */
export const voicevoxAvailable = async (): Promise<boolean> => {
  try {
    const res = await fetch(`${VOICEVOX_URL}/version`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
};

/** Open JTalk のコマンド・辞書・声が揃っているか */
export const openJTalkSetup = async (): Promise<{ bin: string; dic: string; voice: string } | null> => {
  const bin = process.env.OPEN_JTALK || 'open_jtalk';
  const dic = firstExisting(OPEN_JTALK_DICS);
  const voice = firstExisting(OPEN_JTALK_VOICES);
  if (!dic || !voice) return null;
  try {
    // 引数なしで実行すると使い方を出して終わる(終了コードは 0 でないことがある)
    await run(bin, ['-h'], { timeout: 5000 }).catch((e: { code?: string }) => {
      if (e.code === 'ENOENT') throw e;
    });
    return { bin, dic, voice };
  } catch {
    return null;
  }
};

const voicevoxSynth = async (options: VoiceOptions): Promise<Synth> => {
  let credit = 'VOICEVOX';
  try {
    const res = await fetch(`${VOICEVOX_URL}/speakers`, { signal: AbortSignal.timeout(5000) });
    const speakers = (await res.json()) as { name: string; styles: { id: number }[] }[];
    const found = speakers.find((s) => s.styles.some((st) => st.id === options.speaker));
    if (!found) throw new Error(`VOICEVOX に話者 ${options.speaker} がありません(--speaker で番号を選んでください)`);
    credit = `VOICEVOX:${found.name}`;
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('VOICEVOX に話者')) throw e;
  }
  return {
    options,
    credit,
    say: async (text) => {
      const q = await fetch(`${VOICEVOX_URL}/audio_query?speaker=${options.speaker}&text=${encodeURIComponent(text)}`, { method: 'POST' });
      if (!q.ok) throw new Error(`VOICEVOX の audio_query が失敗しました(${q.status})`);
      const query = (await q.json()) as Record<string, unknown>;
      query.speedScale = options.speed;
      query.prePhonemeLength = 0.05;
      query.postPhonemeLength = 0.05;
      const r = await fetch(`${VOICEVOX_URL}/synthesis?speaker=${options.speaker}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query),
      });
      if (!r.ok) throw new Error(`VOICEVOX の synthesis が失敗しました(${r.status})`);
      return Buffer.from(await r.arrayBuffer());
    },
  };
};

const openJTalkSynth = (options: VoiceOptions, setup: { bin: string; dic: string; voice: string }): Synth => ({
  options,
  credit: '',
  say: async (text) => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'scene-tts-'));
    try {
      const input = path.join(tmp, 'in.txt');
      const output = path.join(tmp, 'out.wav');
      await fs.writeFile(input, text);
      await run(setup.bin, ['-x', setup.dic, '-m', setup.voice, '-r', String(options.speed), '-ow', output, input], { timeout: 60_000 });
      return await fs.readFile(output);
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  },
});

const HOW_TO = [
  '音声合成が見つかりません。次のどちらかを用意してください(どちらも無料):',
  '  ・VOICEVOX(https://voicevox.hiroshiba.jp/)をインストールして起動しておく(Windows / Mac / Linux。声が自然でおすすめ)',
  '  ・Open JTalk を入れる(Ubuntu: sudo apt install open-jtalk open-jtalk-mecab-naist-jdic hts-voice-nitech-jp-atr503-m001)',
  'ナレーションなしで作るときは --voice none を付けてください。',
].join('\n');

/** 使う音声合成を決める */
export const createSynth = async (engine: Engine | 'auto', speaker = 3, speed = 1.1): Promise<Synth> => {
  if (engine === 'voicevox' || (engine === 'auto' && (await voicevoxAvailable()))) {
    if (engine === 'voicevox' && !(await voicevoxAvailable())) throw new Error(`VOICEVOX(${VOICEVOX_URL})に接続できません。VOICEVOX を起動してください`);
    return voicevoxSynth({ engine: 'voicevox', speaker, speed });
  }
  const setup = await openJTalkSetup();
  if (setup) return openJTalkSynth({ engine: 'openjtalk', speaker: 0, speed }, setup);
  throw new Error(HOW_TO);
};
