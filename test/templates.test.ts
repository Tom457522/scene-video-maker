import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseOutline } from '../src/editor/outline.ts';
import { TEMPLATES } from '../src/editor/templates.ts';
import { loadPartsInNode } from '../server/parts-node.ts';

test('すべてのひな形が、ある部品だけを使うシーンに変換できる', async () => {
  const { parts } = await loadPartsInNode();
  const ids = new Set(parts.map((p) => p.id));
  assert.ok(TEMPLATES.length >= 4);
  for (const t of TEMPLATES) {
    const r = parseOutline(t.outline);
    assert.ok(r.scenes.length >= 4, `${t.id}: ${r.scenes.length} シーン`);
    for (const s of r.scenes) assert.ok(ids.has(s.part), `${t.id}: 部品 ${s.part}`);
    assert.equal(r.scenes[0].part, 'title', t.id);
  }
});
