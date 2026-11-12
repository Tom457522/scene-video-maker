import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

// 置き場所を一時フォルダにしてから読む(順序が大事)
const dir = mkdtempSync(path.join(os.tmpdir(), 'svm-assets-'));
process.env.SCENE_PROJECTS_DIR = dir;
const assets = await import('../server/assets.ts');
const store = await import('../server/projects.ts');

const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');

test('sanitizeAssetName: 使えない文字を _ にし、拡張子を残す', () => {
  assert.equal(assets.sanitizeAssetName('../a/b c?.PNG'), 'b c_.png');
  assert.equal(assets.isValidAssetName('../x.png'), false);
  assert.equal(assets.isValidAssetName('図.svg'), false);
});

test('保存: 画像でない中身は断り、同じ名前は (2) を付ける', async () => {
  await assert.rejects(assets.saveAsset('x.png', Buffer.from('hello')));
  assert.equal(await assets.saveAsset('図.png', PNG), '図.png');
  assert.equal(await assets.saveAsset('図.png', PNG), '図-2.png');
});

test('使っているプロジェクトを数え、削除は .trash へ移す', async () => {
  await store.writeProject('p1', { title: 't', settings: { logo: '図.png' }, scenes: [] });
  await store.writeProject('p2', { title: 't', scenes: [{ part: 'image', seconds: 3, props: { file: '図.png' } }] });
  const usage = await assets.assetUsage();
  assert.deepEqual(usage.find((a) => a.name === '図.png')?.usedBy, ['p1', 'p2']);
  assert.deepEqual(usage.find((a) => a.name === '図-2.png')?.usedBy, []);
  await assets.deleteAsset('図-2.png');
  assert.equal(existsSync(path.join(dir, 'assets', '図-2.png')), false);
  assert.equal(readdirSync(path.join(dir, '.trash')).length, 1);
});
