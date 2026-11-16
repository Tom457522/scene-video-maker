/**
 * WAV(16 ビット PCM)を読み書きする小さな道具。音声合成の結果をつなぎ、長さを測り、BGM を作るのに使う。
 */

export type Pcm = { sampleRate: number; channels: number; samples: Int16Array };

/** WAV を読む(16 ビット PCM だけ) */
export const readWav = (buf: Buffer): Pcm => {
  if (buf.subarray(0, 4).toString('ascii') !== 'RIFF' || buf.subarray(8, 12).toString('ascii') !== 'WAVE') throw new Error('WAV ではありません');
  let offset = 12;
  let sampleRate = 0;
  let channels = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.subarray(offset, offset + 4).toString('ascii');
    // ヘッダーの長さが壊れている(0xFFFFFFFF のような)WAV もあるので、残りの長さで抑える
    const size = Math.min(buf.readUInt32LE(offset + 4), buf.length - offset - 8);
    const body = offset + 8;
    if (id === 'fmt ') {
      const format = buf.readUInt16LE(body);
      channels = buf.readUInt16LE(body + 2);
      sampleRate = buf.readUInt32LE(body + 4);
      const bits = buf.readUInt16LE(body + 14);
      if (format !== 1 || bits !== 16) throw new Error('16 ビット PCM の WAV だけを使えます');
    } else if (id === 'data') {
      if (!sampleRate) throw new Error('WAV の fmt が data より後ろにあります');
      const data = buf.subarray(body, body + size - (size % 2));
      const samples = new Int16Array(data.length / 2);
      for (let i = 0; i < samples.length; i++) samples[i] = data.readInt16LE(i * 2);
      return { sampleRate, channels, samples };
    }
    offset = body + size + (size % 2);
  }
  throw new Error('WAV に音のデータがありません');
};

export const writeWav = ({ sampleRate, channels, samples }: Pcm): Buffer => {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) data.writeInt16LE(samples[i], i * 2);
  const head = Buffer.alloc(44);
  head.write('RIFF', 0, 'ascii');
  head.writeUInt32LE(36 + data.length, 4);
  head.write('WAVE', 8, 'ascii');
  head.write('fmt ', 12, 'ascii');
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(channels, 22);
  head.writeUInt32LE(sampleRate, 24);
  head.writeUInt32LE(sampleRate * channels * 2, 28);
  head.writeUInt16LE(channels * 2, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36, 'ascii');
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
};

/** 長さ(秒) */
export const pcmSeconds = (p: Pcm): number => p.samples.length / p.channels / p.sampleRate;

/** -1〜1 の小数の並びを 16 ビットにする(はみ出しは切る) */
export const toInt16 = (f: Float32Array): Int16Array => {
  const out = new Int16Array(f.length);
  for (let i = 0; i < f.length; i++) out[i] = Math.round(Math.max(-1, Math.min(1, f[i])) * 32767);
  return out;
};

/** 前後の無音を切る(区切りの間が空きすぎないように)。keep 秒だけは残す */
export const trimSilence = (p: Pcm, keep = 0.06, threshold = 400): Pcm => {
  const { samples, channels, sampleRate } = p;
  const frames = samples.length / channels;
  const loud = (f: number) => {
    for (let c = 0; c < channels; c++) if (Math.abs(samples[f * channels + c]) > threshold) return true;
    return false;
  };
  let a = 0;
  while (a < frames && !loud(a)) a++;
  let b = frames - 1;
  while (b > a && !loud(b)) b--;
  if (a >= frames) return { ...p, samples: new Int16Array(0) };
  const pad = Math.round(keep * sampleRate);
  a = Math.max(0, a - pad);
  b = Math.min(frames - 1, b + pad);
  return { ...p, samples: samples.slice(a * channels, (b + 1) * channels) };
};

/** 同じ形式の音をつなぐ。間に gap 秒の無音を入れる */
export const concatPcm = (parts: Pcm[], gap = 0): Pcm => {
  if (parts.length === 0) throw new Error('つなぐ音がありません');
  const { sampleRate, channels } = parts[0];
  for (const p of parts) if (p.sampleRate !== sampleRate || p.channels !== channels) throw new Error('形式の違う音はつなげません');
  const gapLen = Math.round(gap * sampleRate) * channels;
  const total = parts.reduce((n, p) => n + p.samples.length, 0) + gapLen * Math.max(0, parts.length - 1);
  const out = new Int16Array(total);
  let o = 0;
  parts.forEach((p, i) => {
    out.set(p.samples, o);
    o += p.samples.length + (i < parts.length - 1 ? gapLen : 0);
  });
  return { sampleRate, channels, samples: out };
};

/** いちばん大きい所が peak(0〜1)になるよう音量をそろえる(声の大きさを音声合成の種類によらずそろえる) */
export const normalizePcm = (p: Pcm, peak = 0.89): Pcm => {
  let max = 0;
  for (const v of p.samples) max = Math.max(max, Math.abs(v));
  if (max === 0) return p;
  const g = (peak * 32767) / max;
  const samples = new Int16Array(p.samples.length);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.round(Math.max(-32768, Math.min(32767, p.samples[i] * g)));
  return { ...p, samples };
};
