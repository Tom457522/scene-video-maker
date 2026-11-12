import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildChapters, chapterLabel, youtubeChapters, youtubeTime } from '../src/video/chapters.ts';

const scene = (seconds: number, props: Record<string, unknown>) => ({ part: 'x', seconds, props });

test('chapterLabel: heading → title → 最初の文字、[[ ]] は外す', () => {
  assert.equal(chapterLabel({ heading: '[[仕組み]]とは', title: 'x' }), '仕組みとは');
  assert.equal(chapterLabel({ title: '表題' }), '表題');
  assert.equal(chapterLabel({ img: 'a.png', text: '本文' }), '本文');
  assert.equal(chapterLabel({ n: 3 }), '');
});

test('buildChapters: 同じ見出しが続くシーンは 1 つにまとめる', () => {
  const c = buildChapters({
    scenes: [scene(4, { title: '表題' }), scene(5, { heading: 'A' }), scene(6, { heading: 'A' }), scene(3, {})],
  });
  assert.deepEqual(
    c.map((x) => [x.label, x.from, x.durationInFrames, x.scenes]),
    [
      ['表題', 0, 120, [0]],
      ['A', 120, 330, [1, 2]],
      ['シーン 4', 450, 90, [3]],
    ],
  );
});

test('youtubeTime', () => {
  assert.equal(youtubeTime(0), '0:00');
  assert.equal(youtubeTime(30 * 65), '1:05');
  assert.equal(youtubeTime(30 * 3725), '1:02:05');
});

test('youtubeChapters: 3 章未満や 10 秒未満の章に注意を出す', () => {
  const ok = youtubeChapters(buildChapters({ scenes: [scene(10, { title: 'a' }), scene(10, { title: 'b' }), scene(10, { title: 'c' })] }));
  assert.equal(ok.text, '0:00 a\n0:10 b\n0:20 c');
  assert.deepEqual(ok.warnings, []);
  const ng = youtubeChapters(buildChapters({ scenes: [scene(4, { title: 'a' }), scene(10, { title: 'b' })] }));
  assert.equal(ng.warnings.length, 2);
});
