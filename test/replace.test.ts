import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findMatches, replaceAll } from '../src/editor/replace.ts';
import type { EditorProject } from '../src/editor/state.ts';
import { defaultSettings } from '../src/video/project.ts';

const p: EditorProject = {
  title: '仮想通貨の話',
  settings: { ...defaultSettings(), logo: '仮想通貨.png' },
  scenes: [
    { key: 'a', part: 'bullets', seconds: 3, props: { heading: '仮想通貨とは', items: ['[[仮想通貨]]は', 'ほか'] } },
    { key: 'b', part: 'bars', seconds: 3, props: { rows: [{ label: 'x', value: 3 }] } },
  ],
};

test('findMatches: 数と、見つかったシーン', () => {
  assert.deepEqual(findMatches(p, '仮想通貨'), { count: 3, scenes: [0] });
  assert.deepEqual(findMatches(p, ''), { count: 0, scenes: [] });
});

test('replaceAll: 文字だけを置き換え、数値・部品・ロゴのファイル名は変えない', () => {
  const r = replaceAll(p, '仮想通貨', '暗号資産');
  assert.equal(r.title, '暗号資産の話');
  assert.deepEqual(r.scenes[0].props, { heading: '暗号資産とは', items: ['[[暗号資産]]は', 'ほか'] });
  assert.deepEqual(r.scenes[1].props, { rows: [{ label: 'x', value: 3 }] });
  assert.equal(r.settings.logo, '仮想通貨.png');
  assert.equal(r.scenes[0].part, 'bullets');
});
