import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkQuality } from '../src/video/quality.ts';
import type { Project } from '../src/video/project.ts';

const s = (part: string, props: Record<string, unknown>, extra: Partial<Project['scenes'][number]> = {}): Project['scenes'][number] => ({ part, seconds: 8, props, ...extra });

test('組み立てのよい動画は警告がない', () => {
  const scenes = [
    s('title', { title: 'テーマ', subtitle: '' }),
    s('number', { heading: '驚きの数字', value: 900, unit: '万戸', label: 'x' }, { source: '調査' }),
    s('bullets', { heading: 'a', items: ['x'] }),
    s('flow', { heading: 'b', steps: ['1', '2'] }),
    s('bars', { heading: 'c', rows: [] }, { source: '調査' }),
    s('icons', { heading: 'd', cards: [] }),
    s('compare', { heading: 'e' }),
    s('summary', { heading: 'まとめ', items: ['x'] }),
  ];
  assert.deepEqual(checkQuality({ scenes }).items, []);
  assert.equal(checkQuality({ scenes }).score, 100);
});

test('単調・つかみなし・まとめなし・出典なし・文字が多い を知らせる', () => {
  const long = 'あ'.repeat(120);
  const scenes = [
    s('title', { title: 'テーマ' }),
    s('bullets', { heading: 'はじめに', items: ['なし'] }),
    s('bullets', { heading: 'b', items: [long] }),
    s('bullets', { heading: 'c', items: ['x'] }),
    s('bars', { heading: 'd', rows: [] }),
    s('flow', { heading: 'e', steps: [] }),
  ];
  const msgs = checkQuality({ scenes }).items.map((q) => `${q.scene}:${q.message}`);
  assert.ok(msgs.some((m) => m.startsWith('2:つかみ')), msgs.join('\n'));
  assert.ok(msgs.some((m) => m.includes('同じ種類')));
  assert.ok(msgs.some((m) => m.includes('まとめ')));
  assert.ok(msgs.some((m) => m.startsWith('5:') && m.includes('出典')));
  assert.ok(msgs.some((m) => m.startsWith('3:') && m.includes('画面の文字')));
  assert.ok(msgs.some((m) => m.includes('箇条書きが')));
});

test('長すぎるナレーションを知らせる', () => {
  const scenes = [s('bullets', { heading: 'a', items: ['x'] }, { narration: 'あ'.repeat(300) })];
  assert.ok(checkQuality({ scenes }).items.some((q) => q.message.includes('ナレーションが約')));
});
