import assert from 'node:assert/strict';
import { test } from 'node:test';
import { wrapMarks } from '../src/editor/SchemaForm.tsx';

test('wrapMarks: 選んだ範囲を [[ ]] で囲み、選択を中身に合わせる', () => {
  assert.deepEqual(wrapMarks('取引をブロックに', 3, 7), { text: '取引を[[ブロック]]に', from: 5, to: 9 });
});

test('wrapMarks: すでに囲まれていれば外す', () => {
  assert.deepEqual(wrapMarks('取引を[[ブロック]]に', 5, 9), { text: '取引をブロックに', from: 3, to: 7 });
});

test('wrapMarks: 何も選んでいなければ [[]] を入れる', () => {
  assert.deepEqual(wrapMarks('ab', 1, 1), { text: 'a[[]]b', from: 3, to: 3 });
});
