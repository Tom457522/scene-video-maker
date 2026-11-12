import assert from 'node:assert/strict';
import { test } from 'node:test';
import { estimateLines, fitFontSize, fitFontSizeAll, measureEm, parseMarks, stripMarks } from '../src/kit/text.ts';

test('parseMarks: [[ ]] で囲んだ語だけが強調になる', () => {
  assert.deepEqual(parseMarks('取引を[[ブロック]]に[[まとめる]]'), [
    { text: '取引を', marked: false },
    { text: 'ブロック', marked: true },
    { text: 'に', marked: false },
    { text: 'まとめる', marked: true },
  ]);
  assert.deepEqual(parseMarks('強調なし'), [{ text: '強調なし', marked: false }]);
  assert.deepEqual(parseMarks(''), []);
});

test('stripMarks: 括弧だけを取り除く', () => {
  assert.equal(stripMarks('a[[b]]c[[d]]'), 'abcd');
  assert.equal(stripMarks('[[ 閉じていない'), '[[ 閉じていない');
});

test('measureEm: 全角は 1、半角は 1 未満で数える', () => {
  assert.equal(measureEm('あいう'), 3);
  assert.ok(measureEm('abc') < 3);
  assert.equal(measureEm('[[あ]]'), 1);
});

test('fitFontSize: 長い文ほど小さくなり、下限を下回らない', () => {
  const opts = { maxWidth: 600, max: 60, min: 20, maxLines: 1 };
  const short = fitFontSize('短い', opts);
  const long = fitFontSize('とても長い文章がここに入ってきて一行には収まらない', opts);
  assert.equal(short, 60);
  assert.ok(long < short);
  assert.ok(fitFontSize('あ'.repeat(500), opts) >= 20);
});

test('fitFontSize: 結果のサイズなら指定の行数に収まる見積もりになる', () => {
  const text = 'ブロックチェーンは取引の記録をみんなで共有するしくみです';
  const size = fitFontSize(text, { maxWidth: 500, max: 60, min: 10, maxLines: 2 });
  assert.ok(estimateLines(text, size, 500) <= 2);
});

test('fitFontSizeAll: 一番長い文に合わせてそろえる', () => {
  const opts = { maxWidth: 400, max: 50, min: 10, maxLines: 1 };
  const all = fitFontSizeAll(['短い', 'これはとても長い文章です'], opts);
  assert.equal(all, fitFontSize('これはとても長い文章です', opts));
});
