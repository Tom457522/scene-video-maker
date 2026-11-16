/**
 * BGM と効果音を、その場で計算して作る(音源のファイルやライセンスがいらない)。
 * BGM はくり返し再生してつなぎ目が分からないよう、ループの終わりの余韻を頭に重ねている。
 */
import type { Pcm } from './wav.ts';
import { toInt16 } from './wav.ts';

const RATE = 22050;

export type Mood = 'calm' | 'bright';
export const MOODS: Mood[] = ['calm', 'bright'];

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

type Style = {
  bpm: number;
  /** 和音(MIDI の音の番号)。1 つの和音を 2 小節ずつ鳴らす */
  chords: number[][];
  /** 1 拍をいくつに分けて分散和音を弾くか */
  arpPerBeat: number;
  arpGain: number;
  padGain: number;
};

const STYLES: Record<Mood, Style> = {
  // 落ち着いた解説向け(Fmaj7 → G6 → Em7 → Am9)
  calm: {
    bpm: 80,
    chords: [
      [53, 57, 60, 64],
      [55, 59, 62, 64],
      [52, 55, 59, 62],
      [57, 60, 64, 71],
    ],
    arpPerBeat: 1,
    arpGain: 0.16,
    padGain: 0.1,
  },
  // 明るめ(C → G → Am → F)
  bright: {
    bpm: 100,
    chords: [
      [48, 55, 60, 64],
      [43, 55, 59, 62],
      [45, 57, 60, 64],
      [41, 57, 60, 65],
    ],
    arpPerBeat: 2,
    arpGain: 0.14,
    padGain: 0.08,
  },
};

/** 決まった種から作る乱数(同じ曲が毎回同じになるように) */
const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
};

/** BGM を 1 ループ分作る(和音 4 つ × 2 小節) */
export const makeBgm = (mood: Mood = 'calm'): Pcm => {
  const st = STYLES[mood];
  const beat = 60 / st.bpm;
  const chordLen = beat * 8;
  const loop = chordLen * st.chords.length;
  const n = Math.round(loop * RATE);
  const out = new Float32Array(n);
  const add = (start: number, len: number, fn: (t: number) => number) => {
    const s0 = Math.round(start * RATE);
    const m = Math.round(len * RATE);
    for (let i = 0; i < m; i++) out[(s0 + i) % n] += fn(i / RATE);
  };
  const rand = seeded(mood === 'calm' ? 7 : 11);

  st.chords.forEach((chord, k) => {
    const t0 = k * chordLen;
    // パッド: 少しずらした 2 つの正弦波で厚みを出し、ゆっくり立ち上げて次の和音に重ねて消す
    const padLen = chordLen + 1.2;
    for (const note of chord) {
      const f = midi(note + 12);
      add(t0, padLen, (t) => {
        const env = Math.min(1, t / 0.9) * Math.min(1, (padLen - t) / 1.2);
        return st.padGain * env * 0.5 * (Math.sin(2 * Math.PI * (f - 0.4) * t) + Math.sin(2 * Math.PI * (f + 0.4) * t)) * 0.5;
      });
    }
    // ベース: 和音のいちばん下の音を 1 オクターブ下で、小節の頭に柔らかく
    for (let bar = 0; bar < 2; bar++) {
      const f = midi(chord[0] - 12);
      add(t0 + bar * beat * 4, beat * 4, (t) => 0.22 * Math.min(1, t / 0.02) * Math.exp(-t * 0.9) * Math.sin(2 * Math.PI * f * t));
    }
    // 分散和音: エレピ風(倍音を少し足し、すぐ減衰する)
    const steps = 8 * st.arpPerBeat;
    for (let i = 0; i < steps; i++) {
      const pattern = [0, 2, 1, 3, 2, 1, 3, 2];
      const note = chord[pattern[i % pattern.length]] + 24;
      const f = midi(note);
      const vel = st.arpGain * (0.75 + 0.25 * rand()) * (i % st.arpPerBeat === 0 ? 1 : 0.7);
      add(t0 + (i * beat) / st.arpPerBeat, 1.6, (t) => {
        const env = Math.min(1, t / 0.005) * Math.exp(-t * 3.2);
        return vel * env * (Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(4 * Math.PI * f * t) * Math.exp(-t * 6));
      });
    }
  });

  // 高い音を少し丸める(1 次のローパス。ループの頭とつながるよう 2 周回す)
  const a = 0.35;
  let y = 0;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n; i++) {
      y += a * (out[i] - y);
      if (pass === 1) out[i] = y;
    }
  }
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  const g = peak > 0 ? 0.7 / peak : 1;
  for (let i = 0; i < n; i++) out[i] *= g;
  return { sampleRate: RATE, channels: 1, samples: toInt16(out) };
};

/** 項目が出るときの小さな「ポン」 */
export const makePop = (): Pcm => {
  const rate = 44100;
  const len = Math.round(0.14 * rate);
  const out = new Float32Array(len);
  let phase = 0;
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    const f = 620 + 520 * Math.min(1, t / 0.03);
    phase += (2 * Math.PI * f) / rate;
    const env = Math.min(1, t / 0.003) * Math.exp(-t * 32);
    out[i] = 0.6 * env * (Math.sin(phase) + 0.2 * Math.sin(2 * phase));
  }
  return { sampleRate: rate, channels: 1, samples: toInt16(out) };
};
