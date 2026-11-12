import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collectText, countChars, isTooShort, recommendedSeconds } from '../src/video/reading.ts';

test('collectText: 入れ子の文字を集め、[[ ]] と画像のファイル名は除く', () => {
  assert.deepEqual(collectText({ a: '[[強調]]です', b: ['x', { c: 'y' }], n: 3, img: 'photo.png' }), ['強調です', 'x', 'y']);
});

test('countChars: 空白は数えない', () => {
  assert.equal(countChars({ a: 'あ い う' }), 3);
});

test('recommendedSeconds: 文字が多いほど長く、0.5 秒刻み', () => {
  const short = recommendedSeconds({ a: 'あ'.repeat(7) });
  const long = recommendedSeconds({ a: 'あ'.repeat(70) });
  assert.equal(short, 3);
  assert.equal(long, 12);
  assert.equal((long * 2) % 1, 0);
});

test('isTooShort: 1 割までの不足は警告しない', () => {
  const props = { a: 'あ'.repeat(70) };
  assert.equal(isTooShort(12, props), false);
  assert.equal(isTooShort(11, props), false);
  assert.equal(isTooShort(8, props), true);
});
