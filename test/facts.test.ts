import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkFacts, findNumbers } from '../src/video/facts.ts';
import type { Project } from '../src/video/project.ts';

const scene = (props: Record<string, unknown>, narration?: string): Project['scenes'][number] => ({ part: 'bullets', seconds: 5, props, ...(narration ? { narration } : {}) });

test('数字を取り出す(万・億・割・全角、数え方の小さな数は除く)', () => {
  const v = (t: string) => findNumbers(t).map((n) => [n.value, n.percent, n.approx]);
  assert.deepEqual(v('約1,200万人'), [[12_000_000, false, true]]);
  assert.deepEqual(v('４割の企業'), [[40, true, false]]);
  assert.deepEqual(v('3つのポイント・第2章'), []);
  assert.deepEqual(v('100社以上'), [[100, false, true]]);
  assert.deepEqual(v('2兆円'), [[2e12, false, false]]);
  assert.deepEqual(v('GPT-4 と chart.png'), []);
});

test('レポートと同じ数(書き方が違っても値が同じ)なら問題なし', () => {
  const report = '空き家は 900 万戸で、空き家率は 13.8% と過去最高。1993年は448万戸だった。';
  const r = checkFacts({ scenes: [scene({ items: ['空き家は[[900万戸]]', '空き家率 13.8%'] }, '1993年の 448 万戸から倍増しました。')] }, report);
  assert.deepEqual(r.problems, []);
  assert.equal(r.checked, 4);
});

test('レポートにない数は missing、近いが違う数は rounded', () => {
  const report = '利用率は 31.5% だった。';
  const r = checkFacts({ scenes: [scene({ items: ['利用率 32%', '満足度 75%'] })] }, report);
  assert.deepEqual(r.problems.map((p) => [p.kind, p.text]), [
    ['rounded', '32%'],
    ['missing', '75%'],
  ]);
});

test('「約」を付けた近い数は認める', () => {
  const r = checkFacts({ scenes: [scene({ items: ['利用率は約32%'] })] }, '利用率は 31.5% だった。');
  assert.deepEqual(r.problems, []);
});

test('グラフの値(数値の入力)も照合する', () => {
  const r = checkFacts({ scenes: [{ part: 'bars', seconds: 5, props: { heading: 'x', rows: [{ label: 'A', value: 42 }], unit: '%' } }] }, 'A は 41% だった');
  assert.equal(r.problems.length, 1);
  assert.equal(r.problems[0].text, '42%');
});

test('割合は割合とだけ比べる(「10%」を「10人」で認めない)', () => {
  const r = checkFacts({ scenes: [scene({ items: ['利用率 10%'] })] }, '参加者は 10人 だった。');
  assert.deepEqual(r.problems.map((p) => [p.kind, p.text]), [['missing', '10%']]);
});
