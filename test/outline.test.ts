import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OUTLINE_EXAMPLE, parseOutline } from '../src/editor/outline.ts';

test('見本の文章から 5 種類のシーンができる', () => {
  const r = parseOutline(OUTLINE_EXAMPLE);
  assert.equal(r.title, 'ブロックチェーン');
  assert.deepEqual(
    r.scenes.map((s) => s.part),
    ['title', 'bullets', 'flow', 'bars', 'summary'],
  );
  assert.deepEqual(r.scenes[0].props, { kicker: '', title: 'ブロックチェーン', subtitle: '改ざんしにくい記録のしくみ' });
  assert.deepEqual(r.scenes[1].props.items, ['取引の記録を[[ブロック]]にまとめる', 'ブロックを[[鎖]]のようにつなぐ', 'みんなで同じ記録を[[共有]]する']);
  assert.equal(r.scenes[2].props.caption, '検証が済んだ取引だけがブロックに入ります');
  assert.deepEqual(r.scenes[3].props.rows, [
    { label: 'ビットコイン', value: 92 },
    { label: 'イーサリアム', value: 64 },
    { label: 'リップル', value: 41 },
  ]);
  assert.equal(r.scenes[3].props.unit, '%');
});

test('項目が多いと「(続き)」に分ける', () => {
  const r = parseOutline(`## 多い\n${Array.from({ length: 8 }, (_, i) => `- 項目${i + 1}`).join('\n')}`);
  assert.deepEqual(r.scenes.map((s) => [s.part, s.props.heading, (s.props.items as string[]).length]), [
    ['bullets', '多い', 6],
    ['bullets', '多い(続き)', 2],
  ]);
});

test('手順が 6 個以上なら流れ図を分け、1 個だけ余らせない', () => {
  const r = parseOutline(`## 手順\n${Array.from({ length: 9 }, (_, i) => `${i + 1}. 手順${i + 1}`).join('\n')}`);
  assert.deepEqual(r.scenes.map((s) => (s.props.steps as string[]).length), [4, 5]);
});

test('全角の記号・カンマ付きの数値・・の箇条書きも読める', () => {
  const r = parseOutline('## 数\nA：1,200件\nB：3.5件\n\n## 箇条\n・ひとつ\n・ふたつ');
  assert.deepEqual(r.scenes[0].props.rows, [
    { label: 'A', value: 1200 },
    { label: 'B', value: 3.5 },
  ]);
  assert.equal(r.scenes[0].props.unit, '件');
  assert.deepEqual(r.scenes[1].props.items, ['ひとつ', 'ふたつ']);
});

test('見出しのない文や、見出しだけの行も扱える', () => {
  const r = parseOutline('いきなり本文\nもう一行\n\n## 見出しだけ');
  assert.deepEqual(r.scenes.map((s) => s.part), ['bullets', 'title']);
});

test('空の文章ではシーンができない', () => {
  assert.deepEqual(parseOutline('  \n\n').scenes, []);
});
