import assert from 'node:assert/strict';
import { test } from 'node:test';
import { autoCues, cueFrames, cueItems, displayText, speechText, splitAtCues, subtitleChunks, timeSegments } from '../src/video/narration.ts';
import { stagger } from '../src/kit/motion.ts';

test('字幕にはよみを外した文、読み上げにはよみを使う', () => {
  const n = '{生成AI|せいせいエーアイ}は[[40%]]の企業が使う。▶次に';
  assert.equal(displayText(n), '生成AIは40%の企業が使う。次に');
  assert.equal(speechText(n), 'せいせいエーアイは40パーセントの企業が使う。次に');
});

test('▶ がなければ、項目の語が出てくる文の頭に置く', () => {
  const n = '特徴は 3 つです。まず、記録を鎖のようにつなぐので安全です。次に、全員で管理します。そして、すぐに届きます。';
  const m = autoCues(n, ['安全', '全員で管理', '速い すぐに届く']);
  assert.deepEqual(splitAtCues(m), ['特徴は 3 つです。', 'まず、記録を鎖のようにつなぐので安全です。', '次に、全員で管理します。', 'そして、すぐに届きます。']);
});

test('同じ文に 2 つの項目があれば、読点の後ろで分ける', () => {
  const m = autoCues('東京は人口が多く、大阪は食べ物がおいしい。', ['東京', '大阪']);
  assert.deepEqual(splitAtCues(m), ['', '東京は人口が多く、', '大阪は食べ物がおいしい。']);
});

test('▶ をすでに書いていれば、そのまま使う', () => {
  assert.equal(autoCues('A です。▶B です。', ['A', 'B']), 'A です。▶B です。');
});

test('部品ごとに、順に出てくる項目を取り出す', () => {
  assert.deepEqual(cueItems('bullets', { items: ['a', 'b'] }), ['a', 'b']);
  assert.deepEqual(cueItems('bars', { rows: [{ label: 'x', value: 1 }] }), ['x']);
  assert.deepEqual(cueItems('quote', { text: 'a' }), []);
});

test('長い文は読点で分けて字幕にする', () => {
  const chunks = subtitleChunks('短い文です。これはとても長い文なので、字幕の 1 行に収まるように、読点のところで分けて表示します。');
  assert.equal(chunks[0], '短い文です。');
  assert.ok(chunks.length >= 3);
  for (const c of chunks) assert.ok(Array.from(c).length <= 40, c);
});

test('区切りの音声の長さから、項目を出す時刻と字幕の時刻を決める', () => {
  const r = timeSegments(['はじめに。', 'まず A です。', '次に B です。'], [1, 2, 2]);
  assert.deepEqual(r.cues, [1, 3]);
  assert.equal(r.lines.length, 3);
  assert.equal(r.lines[0].start, 0);
  assert.ok(Math.abs(r.lines[1].start - 1) < 1e-9);
  assert.equal(r.lines[2].end, 5);
});

test('cues があれば stagger はそのフレームを返す(足りない分は gap ずつ)', () => {
  assert.equal(stagger(0, 3, 10, 50, 10, [40, 80]), 40);
  assert.equal(stagger(1, 3, 10, 50, 10, [40, 80]), 80);
  assert.equal(stagger(2, 3, 10, 50, 10, [40, 80]), 90);
  assert.equal(stagger(1, 3, 10, 50, 10), 20);
});

test('cueFrames: 話し始めの少し前に出す', () => {
  assert.deepEqual(cueFrames({ audio: { file: 'a.wav', start: 0.5, duration: 3, cues: [1], lines: [] } }, 30), [41]);
  assert.equal(cueFrames({}, 30), undefined);
});
