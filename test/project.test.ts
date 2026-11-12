import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatSeconds, projectSchema, sceneTimeline, totalFrames } from '../src/video/project.ts';

test('projectSchema: 設定のない古い JSON も既定の設定で読める', () => {
  const p = projectSchema.parse({ title: 'x', scenes: [{ part: 'title', seconds: 3, props: {} }] });
  assert.equal(p.settings.theme, 'navy');
  assert.equal(p.settings.endCard, false);
});

test('projectSchema: 秒数の範囲外は受け付けない', () => {
  assert.equal(projectSchema.safeParse({ scenes: [{ part: 'title', seconds: 0.5 }] }).success, false);
  assert.equal(projectSchema.safeParse({ scenes: [{ part: 'title', seconds: 61 }] }).success, false);
});

test('sceneTimeline / totalFrames: 秒数 × 30 フレームで並ぶ', () => {
  const p = projectSchema.parse({ scenes: [{ part: 'a', seconds: 2 }, { part: 'b', seconds: 1.5 }] });
  assert.deepEqual(sceneTimeline(p), [
    { from: 0, durationInFrames: 60 },
    { from: 60, durationInFrames: 45 },
  ]);
  assert.equal(totalFrames(p), 105);
  assert.equal(totalFrames(projectSchema.parse({})), 1);
});

test('formatSeconds', () => {
  assert.equal(formatSeconds(0), '0:00.0');
  assert.equal(formatSeconds(65.5), '1:05.5');
});
