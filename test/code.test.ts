import assert from 'node:assert/strict';
import { test } from 'node:test';
import { highlightCode, monoWidthEm, parseLineSpec } from '../src/kit/code.ts';

const kinds = (code: string, lang: Parameters<typeof highlightCode>[1]) =>
  highlightCode(code, lang).map((line) => line.filter((t) => t.text.trim() !== '').map((t) => `${t.kind}:${t.text.trim()}`));

test('TypeScript: キーワード・関数名・文字列・数値・コメント', () => {
  assert.deepEqual(kinds("const n = add(1, 'a'); // メモ", 'ts'), [
    ['keyword:const', 'plain:n', 'punct:=', 'func:add', 'punct:(', 'number:1', 'punct:,', "string:'a'", 'punct:);', 'comment:// メモ'],
  ]);
});

test('複数行のコメントを次の行に引き継ぐ', () => {
  const r = kinds('/* a\nb */ x', 'ts');
  assert.deepEqual(r, [['comment:/* a'], ['comment:b */', 'plain:x']]);
});

test('Python の # コメントと text は色分けしない', () => {
  assert.deepEqual(kinds('def f(): # c', 'python')[0][0], 'keyword:def');
  assert.deepEqual(kinds('const x', 'text'), [['plain:const x']]);
});

test('parseLineSpec', () => {
  assert.deepEqual([...parseLineSpec('3, 5-7、10')], [3, 5, 6, 7, 10]);
  assert.deepEqual([...parseLineSpec('')], []);
  assert.deepEqual([...parseLineSpec('x, 2〜1')], [1, 2]);
});

test('monoWidthEm', () => {
  assert.equal(monoWidthEm('ab'), 1.2);
  assert.equal(monoWidthEm('あ'), 1);
});
