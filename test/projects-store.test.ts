import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isValidName } from '../server/projects.ts';

test('isValidName: 日本語・英数字・空白・_ - は使える', () => {
  for (const ok of ['sample', 'はみ出し確認', 'my video_1', 'a-b']) assert.ok(isValidName(ok), ok);
});

test('isValidName: パスになる文字や前後の空白は使えない', () => {
  for (const ng of ['', '../x', 'a/b', 'a\\b', 'a.b', ' a', 'a ', 'x'.repeat(61), 'a:b']) assert.ok(!isValidName(ng), ng);
});
