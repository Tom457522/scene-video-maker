import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadPartsInNode } from '../server/parts-node.ts';
import { minimalCase, worstCase } from '../src/parts/samples.ts';

test('全部品の最大・最小の入力が schema を満たす', async () => {
  const { parts } = await loadPartsInNode();
  for (const p of parts) {
    assert.ok(p.schema.safeParse(worstCase(p.schema)).success, `${p.id} worst`);
    assert.ok(p.schema.safeParse(minimalCase(p.schema)).success, `${p.id} minimal`);
  }
});

test('worstCase: 文字は上限いっぱい、リストは最大個数', async () => {
  const { parts } = await loadPartsInNode();
  const bullets = parts.find((p) => p.id === 'bullets')!;
  const w = worstCase(bullets.schema);
  assert.equal(Array.from(w.heading as string).length, 40);
  assert.equal((w.items as string[]).length, 6);
  assert.equal(Array.from((w.items as string[])[0]).length, 60);
  assert.equal((minimalCase(bullets.schema).items as string[]).length, 1);
});
