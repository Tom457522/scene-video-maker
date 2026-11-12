import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { strToU8, unzipSync, zipSync } from 'fflate';

// 置き場所を一時フォルダにしてから読む(順序が大事)
const dir = mkdtempSync(path.join(os.tmpdir(), 'svm-archive-'));
process.env.SCENE_PROJECTS_DIR = dir;
const archive = await import('../server/archive.ts');
const assets = await import('../server/assets.ts');
const store = await import('../server/projects.ts');

const png = (n: number) => Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.from([n])]);

test('使っている画像だけを zip に入れ、読み込むと同じ内容のプロジェクトになる', async () => {
  await assets.saveAsset('ロゴ.png', png(1));
  await assets.saveAsset('使わない.png', png(2));
  const project = { title: 't', settings: { logo: 'ロゴ.png' }, scenes: [{ part: 'title', seconds: 3, props: { title: 'x' } }] };
  const zip = await archive.exportArchive(project);
  assert.deepEqual(Object.keys(unzipSync(zip)).sort(), ['assets/ロゴ.png', 'project.json']);

  const r = await archive.importArchive(zip, '移した動画');
  assert.equal(r.name, '移した動画');
  assert.deepEqual(r.renamed, {});
  assert.equal((await store.readProject('移した動画')).settings.logo, 'ロゴ.png');
  // 同じ名前でもう一度読み込むと名前を変える
  assert.equal((await archive.importArchive(zip, '移した動画')).name, '移した動画-2');
});

test('同じ名前で中身の違う画像は名前を付け直し、プロジェクトの参照も直す', async () => {
  const zip = zipSync({
    'project.json': strToU8(JSON.stringify({ title: 't', settings: { logo: 'ロゴ.png' }, scenes: [] })),
    'assets/ロゴ.png': png(9),
  });
  const r = await archive.importArchive(zip, '別のロゴ');
  assert.deepEqual(r.renamed, { 'ロゴ.png': 'ロゴ-2.png' });
  assert.equal((await store.readProject('別のロゴ')).settings.logo, 'ロゴ-2.png');
  assert.deepEqual([...readFileSync(path.join(dir, 'assets', 'ロゴ.png'))], [...png(1)]);
});

test('想定外のファイルは展開せず、project.json がない zip は断る', async () => {
  const evil = zipSync({ '../../evil.txt': strToU8('x'), 'assets/../x.png': png(3), 'project.json': strToU8(JSON.stringify({ scenes: [] })) });
  const r = await archive.importArchive(evil, 'あやしい');
  assert.equal(r.name, 'あやしい');
  await assert.rejects(archive.importArchive(zipSync({ 'a.txt': strToU8('x') }), 'x'), /project.json/);
  await assert.rejects(archive.importArchive(new Uint8Array([1, 2, 3]), 'x'), /zip を読めません/);
});
