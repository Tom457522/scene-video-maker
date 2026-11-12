import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import { loadPartsInNode } from '../server/parts-node.ts';
import { defaultProps, resolveProps, type PartDef } from '../src/parts/registry.ts';

test('すべての部品が読み込めて、既定値だけで schema を満たす', async () => {
  const { parts, errors } = await loadPartsInNode();
  assert.deepEqual(errors, []);
  assert.ok(parts.length >= 5);
  for (const p of parts) {
    assert.ok(p.meta.name && p.meta.description, p.id);
    assert.ok(p.meta.defaultSeconds >= 1 && p.meta.defaultSeconds <= 60, p.id);
    assert.ok(p.schema.safeParse(defaultProps(p)).success, p.id);
  }
});

const fake: PartDef = {
  id: 'fake',
  meta: {
    name: 'fake',
    description: '',
    defaultSeconds: 3,
    migrate: (p) => ({ ...p, heading: p.heading ?? p.title }),
  },
  schema: z.object({ heading: z.string().max(10).default('既定'), n: z.number().max(5).default(1) }),
  Component: () => null,
};

test('resolveProps: meta.migrate で古い項目名を引き継ぐ', () => {
  assert.equal(resolveProps(fake, { title: '古い見出し' }).props.heading, '古い見出し');
});

test('resolveProps: 不正な項目だけ既定値で補い、問題を返す', () => {
  const r = resolveProps(fake, { heading: 'OK', n: 99 });
  assert.equal(r.props.heading, 'OK');
  assert.equal(r.props.n, 1);
  assert.equal(r.issues.length, 1);
});
