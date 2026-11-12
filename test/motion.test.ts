import assert from 'node:assert/strict';
import { test } from 'node:test';
import { countUp, draw, pingPong, progress, settleBy, stagger } from '../src/kit/motion.ts';

test('progress: 範囲の外は 0 と 1 で止まり、同じフレームなら同じ値', () => {
  assert.equal(progress(-10, 0, 10), 0);
  assert.equal(progress(100, 0, 10), 1);
  const a = progress(5, 0, 10);
  assert.ok(a > 0 && a < 1);
  assert.equal(progress(5, 0, 10), a);
});

test('stagger: 最後の要素が until までに始まる', () => {
  for (const n of [1, 2, 6, 20]) {
    const last = stagger(n - 1, n, 10, 40, 30);
    assert.ok(last <= 40, `n=${n} last=${last}`);
  }
  assert.equal(stagger(1, 3, 0, 100, 10), 10);
});

test('settleBy: 短いシーンでも登場 1 回ぶんは確保する', () => {
  assert.ok(settleBy(10) >= 18);
  assert.equal(settleBy(100, 0.5), 50);
});

test('pingPong: 0 → 1 → 0 を繰り返す', () => {
  assert.equal(pingPong(0, 10), 0);
  assert.equal(pingPong(10, 10), 1);
  assert.equal(pingPong(20, 10), 0);
  assert.equal(pingPong(5, 10), 0.5);
  assert.equal(pingPong(15, 10), 0.5);
});

test('draw: 始めは線が見えず、終わると描き切る', () => {
  assert.equal(draw(0, 0, 10).strokeDashoffset, 1);
  assert.equal(draw(10, 0, 10).strokeDashoffset, 0);
});

test('countUp: 桁区切りと小数の桁数', () => {
  assert.equal(countUp(1, 12345), '12,345');
  assert.equal(countUp(1, 3.25, 2), '3.25');
  assert.equal(countUp(0, 100), '0');
});
