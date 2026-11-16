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

test('ナレーションと出典の行は、部品の書き方とは別に取り分ける', () => {
  const r = parseOutline(`## 利用者\nA社: 40%\nB社: 25%\nナレーション: 2023年に A 社が 40% を占めました。\nナレーション: ▶続いて B 社です。\n出典: 調査会社 2024`);
  assert.equal(r.scenes.length, 1);
  assert.equal(r.scenes[0].part, 'bars');
  assert.equal((r.scenes[0].props.rows as unknown[]).length, 2);
  assert.equal(r.scenes[0].narration, '2023年に A 社が 40% を占めました。▶続いて B 社です。');
  assert.equal(r.scenes[0].source, '調査会社 2024');
});

test('{part=...} で部品を直接決める(アイコンは文から選ぶ)', () => {
  const r = parseOutline(`## 3 つの利点 {part=icons}\n- 安全: 暗号で守る\n- 速い: すぐ届く\n- 安い: 手数料が少ないコスト`);
  assert.equal(r.scenes[0].part, 'icons');
  assert.equal(r.scenes[0].props.heading, '3 つの利点');
  const cards = r.scenes[0].props.cards as { icon: string; title: string; text: string }[];
  assert.deepEqual(cards.map((c) => c.title), ['安全', '速い', '安い']);
  assert.equal(cards[0].icon, 'shield');
  assert.equal(new Set(cards.map((c) => c.icon)).size, 3);
});

test('「- [アイコン] 名前: 説明」はアイコン一覧になる', () => {
  const r = parseOutline(`## 特徴\n- [lock] 鍵: 暗号で守る\n- [globe] 世界: どこでも使える`);
  assert.equal(r.scenes[0].part, 'icons');
  assert.deepEqual((r.scenes[0].props.cards as { icon: string }[]).map((c) => c.icon), ['lock', 'globe']);
});

test('{part=compare} は「名前: 項目」の 2 つの名前で左右に分ける', () => {
  const r = parseOutline(`## 違い {part=compare}\n- 従来: 人が確認\n- 新方式: 自動で確認\n- 従来: 数日かかる\n- 新方式: 数分で終わる`);
  assert.equal(r.scenes[0].part, 'compare');
  assert.deepEqual(r.scenes[0].props.leftItems, ['人が確認', '数日かかる']);
  assert.deepEqual(r.scenes[0].props.rightItems, ['自動で確認', '数分で終わる']);
});

test('合う書き方がない {part=...} は見出しだけ引き継いで知らせる', () => {
  const r = parseOutline(`## 謎 {part=quote}\n- 何か`);
  assert.equal(r.scenes[0].part, 'quote');
  assert.equal(r.scenes[0].notes?.length, 1);
});

test('分かれたシーンのナレーションは最初のシーンだけに付けて知らせる', () => {
  const r = parseOutline(`## 多い\n${Array.from({ length: 8 }, (_, i) => `- 項目${i + 1}`).join('\n')}\nナレーション: 説明です。`);
  assert.equal(r.scenes.length, 2);
  assert.equal(r.scenes[0].narration, '説明です。');
  assert.equal(r.scenes[1].narration, undefined);
  assert.equal(r.scenes[0].notes?.length, 1);
});
