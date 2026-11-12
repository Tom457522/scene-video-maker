import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JobCancelled, createQueue, type RunContext } from '../server/jobs.ts';

const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

test('順番に 1 つずつ書き出し、待っているものは取り消せる', async () => {
  const order: string[] = [];
  let running = 0;
  let maxRunning = 0;
  const q = createQueue<number>(async (job, ms) => {
    running++;
    maxRunning = Math.max(maxRunning, running);
    order.push(job.name);
    await tick(ms);
    running--;
    return `${job.name}.mp4`;
  });
  const a = q.enqueue('a', '', 20);
  const b = q.enqueue('b', '', 5);
  const c = q.enqueue('c', '', 5);
  assert.equal(q.get(b.id)?.status, 'queued');
  assert.equal(q.cancel(c.id), true);
  await tick(60);
  assert.deepEqual(order, ['a', 'b']);
  assert.equal(maxRunning, 1);
  assert.equal(q.get(a.id)?.status, 'done');
  assert.equal(q.get(a.id)?.file, 'a.mp4');
  assert.equal(q.get(c.id)?.status, 'cancelled');
  assert.deepEqual(q.list().map((j) => j.name), ['c', 'b', 'a']);
});

test('書き出し中のものを止める・失敗を記録する', async () => {
  const q = createQueue<string>(async (_job, kind, ctx: RunContext) => {
    if (kind === 'fail') throw new Error('こわれた');
    await new Promise<void>((resolve, reject) => {
      ctx.onCancel(() => reject(new JobCancelled()));
      setTimeout(resolve, 200);
    });
    return 'x.mp4';
  });
  const long = q.enqueue('long', '', 'slow');
  const bad = q.enqueue('bad', '', 'fail');
  await tick();
  assert.equal(q.get(long.id)?.status, 'running');
  q.cancel(long.id);
  await tick(20);
  assert.equal(q.get(long.id)?.status, 'cancelled');
  assert.equal(q.get(bad.id)?.status, 'error');
  assert.equal(q.get(bad.id)?.error, 'こわれた');
  assert.equal(q.cancel(bad.id), false);
});
