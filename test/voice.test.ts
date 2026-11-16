import assert from 'node:assert/strict';
import { existsSync, mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

// 置き場所を一時フォルダにしてから読む(順序が大事)
const dir = mkdtempSync(path.join(os.tmpdir(), 'svm-voice-'));
process.env.SCENE_PROJECTS_DIR = dir;
const { addNarration, prepareBgm, prepareSfx, AUDIO_DIR } = await import('../server/voice.ts');
const { readWav, writeWav, pcmSeconds, trimSilence, concatPcm, toInt16 } = await import('../server/wav.ts');
const { makeBgm } = await import('../server/music.ts');
const { projectSchema } = await import('../src/video/project.ts');
const { checkQuality } = await import('../src/video/quality.ts');

/** 文字数 × 0.1 秒の音(前後に 0.2 秒の無音)を返す、にせの音声合成 */
const fakeSynth = {
  options: { engine: 'openjtalk' as const, speaker: 0, speed: 1 },
  credit: '',
  calls: [] as string[],
  say: async function (text: string) {
    this.calls.push(text);
    const rate = 8000;
    const voiced = Math.round(Array.from(text).length * 0.1 * rate);
    const pad = Math.round(0.2 * rate);
    const f = new Float32Array(voiced + pad * 2);
    for (let i = 0; i < voiced; i++) f[pad + i] = 0.5 * Math.sin(i / 3);
    return writeWav({ sampleRate: rate, channels: 1, samples: toInt16(f) });
  },
};

test('WAV: 書いて読むと同じ長さ。無音を切ってつなげる', () => {
  const f = new Float32Array(8000);
  for (let i = 2000; i < 6000; i++) f[i] = 0.5;
  const p = readWav(writeWav({ sampleRate: 8000, channels: 1, samples: toInt16(f) }));
  assert.equal(pcmSeconds(p), 1);
  const t = trimSilence(p, 0);
  assert.equal(pcmSeconds(t), 0.5);
  assert.equal(pcmSeconds(concatPcm([t, t], 0.25)), 1.25);
});

test('BGM はループの長さちょうどで、音が入っている', () => {
  const bgm = makeBgm('calm');
  assert.ok(Math.abs(pcmSeconds(bgm) - (60 / 80) * 8 * 4) < 0.01);
  assert.ok(bgm.samples.some((v) => Math.abs(v) > 10000));
});

test('ナレーションを ▶ ごとに音声にし、項目を出す時刻・字幕・秒数を決める', async () => {
  const project = projectSchema.parse({
    title: 't',
    scenes: [
      { part: 'bullets', seconds: 5, props: { heading: 'h', items: ['一つ目', '二つ目'] }, narration: 'はじめに。▶一つ目です。▶二つ目です。' },
      { part: 'bullets', seconds: 5, props: { heading: 'x', items: ['a'] } },
    ],
  });
  fakeSynth.calls = [];
  const r = await addNarration(project, fakeSynth, (i) => project.scenes[i].props);
  assert.deepEqual(fakeSynth.calls, ['はじめに。', '一つ目です。', '二つ目です。']);
  const a = r.project.scenes[0].audio!;
  assert.ok(existsSync(path.join(AUDIO_DIR, path.basename(a.file))));
  assert.equal(a.cues.length, 2);
  assert.ok(a.cues[0] > 0.5 && a.cues[1] > a.cues[0]);
  assert.deepEqual(a.lines.map((l) => l.text), ['はじめに。', '一つ目です。', '二つ目です。']);
  // 秒数は 話し始めの間 + 音声 + 終わりの間
  assert.ok(Math.abs(r.project.scenes[0].seconds - (0.5 + a.duration + 0.9)) < 0.11);
  assert.equal(r.project.scenes[1].audio, undefined);
  // 同じ文なら作り直さない
  fakeSynth.calls = [];
  await addNarration(project, fakeSynth, (i) => project.scenes[i].props);
  assert.deepEqual(fakeSynth.calls, []);
  // ナレーションのないシーンは質の検査で知らせる
  assert.ok(checkQuality(r.project).items.some((q) => q.message.includes('ナレーションのないシーン')));
});

test('音声が 60 秒を超えるシーンは tooLong で知らせる', async () => {
  const project = projectSchema.parse({ title: 't', scenes: [{ part: 'bullets', seconds: 5, props: { heading: 'h', items: ['a'] }, narration: 'あ'.repeat(700) }] });
  const r = await addNarration(project, fakeSynth, (i) => project.scenes[i].props);
  assert.deepEqual(r.tooLong, [1]);
});

test('BGM と効果音のファイルを用意する', async () => {
  const project = projectSchema.parse({ title: 't', scenes: [] });
  const p = await prepareBgm(project, 'calm', 0.2);
  assert.equal(p.settings.bgm, 'audio/bgm-calm.wav');
  assert.equal(p.settings.bgmVolume, 0.2);
  assert.ok(existsSync(path.join(AUDIO_DIR, 'bgm-calm.wav')));
  assert.equal((await prepareBgm(p, 'none')).settings.bgm, '');
  await prepareSfx();
  assert.ok(existsSync(path.join(AUDIO_DIR, 'sfx-pop.wav')));
});
