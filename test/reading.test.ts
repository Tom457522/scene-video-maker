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
  const short = recommendedSeconds({ a: 'あ'.repeat(10) });
  const long = recommendedSeconds({ a: 'あ'.repeat(100) });
  assert.equal(short, 2.5);
  assert.equal(long, 11.5);
  assert.equal((long * 2) % 1, 0);
});

test('isTooShort: 目安の 4 分の 3 未満だけ警告する', () => {
  const props = { a: 'あ'.repeat(100) };
  assert.equal(isTooShort(11.5, props), false);
  assert.equal(isTooShort(9, props), false);
  assert.equal(isTooShort(8, props), true);
});
