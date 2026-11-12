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

test('fitToSchema: 文字数・個数を制限に収め、知らせる', async () => {
  const { z } = await import('zod');
  const { fitToSchema } = await import('../src/editor/fit.ts');
  const schema = z.object({
    heading: z.string().max(5).default('').meta({ title: '見出し' }),
    items: z.array(z.string().max(3)).max(2).default([]).meta({ title: '項目' }),
    n: z.number().max(10).default(0),
  });
  const r = fitToSchema(schema, { heading: 'あいうえおかき', items: ['abcd', 'x', 'y'], n: 99 });
  assert.deepEqual(r.props, { heading: 'あいうえお', items: ['abc', 'x'], n: 10 });
  assert.equal(r.notes.length, 3);
  assert.ok(schema.safeParse(r.props).success);
});
