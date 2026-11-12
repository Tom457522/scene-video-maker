import assert from 'node:assert/strict';
import { test } from 'node:test';
import { historyReducer, type HistoryState } from '../src/editor/history.ts';

const start = (v: number): HistoryState<number> => ({ past: [], present: v, future: [], group: null, at: 0 });
const set = (s: HistoryState<number>, v: number, now: number, group?: string) =>
  historyReducer(s, { type: 'set', update: () => v, now, group });

test('元に戻す・やり直し', () => {
  let s = set(start(0), 1, 1000);
  s = set(s, 2, 5000);
  s = historyReducer(s, { type: 'undo' });
  assert.equal(s.present, 1);
  s = historyReducer(s, { type: 'redo' });
  assert.equal(s.present, 2);
});

test('同じ group で 1 秒以内の変更は 1 回にまとまる', () => {
  let s = set(start(0), 1, 1000, 'title');
  s = set(s, 2, 1500, 'title');
  s = set(s, 3, 2000, 'title');
  assert.equal(s.past.length, 1);
  s = historyReducer(s, { type: 'undo' });
  assert.equal(s.present, 0);
});

test('間が空いたり group が違ったりすると別の操作になる', () => {
  let s = set(start(0), 1, 1000, 'a');
  s = set(s, 2, 5000, 'a');
  s = set(s, 3, 5100, 'b');
  assert.equal(s.past.length, 3);
});

test('新しい変更でやり直しの履歴は消える', () => {
  let s = set(start(0), 1, 1000);
  s = historyReducer(s, { type: 'undo' });
  s = set(s, 5, 9000);
  assert.equal(s.future.length, 0);
});
