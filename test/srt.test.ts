import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildCues, srtTime, toSrt } from '../src/video/srt.ts';
import { buildChapters } from '../src/video/chapters.ts';

const scene = (seconds: number, props: Record<string, unknown>, chapter?: string) => ({ part: 'x', seconds, props, ...(chapter ? { chapter } : {}) });

test('srtTime', () => {
  assert.equal(srtTime(0), '00:00:00,000');
  assert.equal(srtTime(30 * 62 + 15), '00:01:02,500');
  assert.equal(srtTime(30 * 3600), '01:00:00,000');
});

test('字幕のあるシーンだけを、そのシーンの時間に並べる([[ ]] は外す)', () => {
  const cues = buildCues({ scenes: [scene(4, { caption: '' }), scene(6, { caption: '[[検証]]が済んだ取引' }), scene(3, {})] });
  assert.equal(cues.length, 1);
  assert.equal(cues[0].text, '検証が済んだ取引');
  assert.ok(cues[0].start > 120 && cues[0].end < 300 && cues[0].end > cues[0].start);
  assert.match(toSrt(cues), /^1\n00:00:04,600 --> 00:00:09,600\n検証が済んだ取引\n$/);
});

test('章を指定したシーンだけが章の始まりになる', () => {
  const c = buildChapters({
    scenes: [scene(4, { title: '表題' }), scene(5, { heading: 'A' }, '前半'), scene(5, { heading: 'B' }), scene(5, { heading: 'C' }, '後半')],
  });
  assert.deepEqual(
    c.map((x) => [x.label, x.scenes]),
    [
      ['表題', [0]],
      ['前半', [1, 2]],
      ['後半', [3]],
    ],
  );
});
