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

test('手順が 6 個以上なら縦のステップにする(9 個以上は分ける)', () => {
  const r = parseOutline(`## 手順\n${Array.from({ length: 10 }, (_, i) => `${i + 1}. 手順${i + 1}`).join('\n')}`);
  assert.deepEqual(r.scenes.map((s) => [s.part, (s.props.steps as string[]).length]), [
    ['steps', 8],
    ['steps', 2],
  ]);
  assert.equal(parseOutline('## 手順\n1. a\n2. b\n3. c').scenes[0].part, 'flow');
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

test('新しい部品の書き方', () => {
  const r = parseOutline(`## 年表
2008年: 論文が出る
2009年: 最初のブロック

## 違い
| ふつう | ブロックチェーン |
|---|---|
| 管理者 1 人 | みんなで管理 |
| 書き換えやすい | 改ざんしにくい |

## 図
![ブロックの図](ブロックの図.png)

## コード
\`\`\`js
// ## これは見出しではない
const x = 1;
\`\`\`

## 質問
Q: 本当に安全?
A: 絶対ではありません

## 名言
>> しくみで信頼をつくる
-- だれか

## 数字
!! 約100万件/日 世界の取引の数`);
  assert.deepEqual(
    r.scenes.map((s) => s.part),
    ['timeline', 'compare', 'image', 'code', 'qa', 'quote', 'number'],
  );
  assert.deepEqual(r.scenes[0].props.events, [
    { when: '2008年', what: '論文が出る' },
    { when: '2009年', what: '最初のブロック' },
  ]);
  assert.deepEqual(r.scenes[1].props.leftItems, ['管理者 1 人', '書き換えやすい']);
  assert.equal(r.scenes[1].props.rightTitle, 'ブロックチェーン');
  assert.equal(r.scenes[2].props.file, 'ブロックの図.png');
  assert.equal(r.scenes[3].props.language, 'ts');
  assert.equal(r.scenes[3].props.code, '// ## これは見出しではない\nconst x = 1;');
  assert.deepEqual(r.scenes[4].props, { question: '本当に安全?', answer: '絶対ではありません' });
  assert.deepEqual(r.scenes[5].props, { text: 'しくみで信頼をつくる', source: 'だれか' });
  assert.deepEqual(r.scenes[6].props, { heading: '数字', prefix: '約', value: 100, unit: '万件/日', label: '世界の取引の数', note: '' });
});

test('年号で始まって右が数値なら折れ線、割合なら円グラフ、それ以外は横棒グラフ', () => {
  assert.equal(parseOutline('## 推移\n2019年: 10\n2020年: 25').scenes[0].part, 'line');
  assert.equal(parseOutline('## 利用者\n2019: 10\n2020: 25').scenes[0].part, 'line');
  const pie = parseOutline('## 用途の割合\nお金: 45%\n物流: 25%\nその他: 30%').scenes[0];
  assert.equal(pie.part, 'pie');
  assert.deepEqual(pie.props.slices, [
    { label: 'お金', value: 45 },
    { label: '物流', value: 25 },
    { label: 'その他', value: 30 },
  ]);
  assert.equal(parseOutline('## 人気\nA: 10\nB: 25').scenes[0].part, 'bars');
});

test('3 列以上の表は表の部品にする', () => {
  const r = parseOutline('## 比較\n| 名前 | 年 | 特徴 |\n|---|---|---|\n| A | 2009 | 最初 |\n| B | 2015 | 速い |');
  assert.equal(r.scenes[0].part, 'table');
  assert.deepEqual(r.scenes[0].props.columns, ['名前', '年', '特徴']);
  assert.deepEqual(r.scenes[0].props.rows, ['A | 2009 | 最初', 'B | 2015 | 速い']);
});
