import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

// projects.ts を読む前に、置き場所を一時フォルダにする(順序が大事)
const dir = mkdtempSync(path.join(os.tmpdir(), 'svm-test-'));
process.env.SCENE_PROJECTS_DIR = dir;
const store = await import('../server/projects.ts');

const proj = (title: string) => ({ title, scenes: [{ part: 'title', seconds: 3, props: {} }] });

test('保存のたびに前の版が残り、中身が同じなら増えない', async () => {
  await store.writeProject('a', proj('1'));
  assert.equal((await store.listHistory('a')).length, 0);
  await store.writeProject('a', proj('2'));
  await store.writeProject('a', proj('2'));
  const h = await store.listHistory('a');
  assert.equal(h.length, 1);
  assert.equal(h[0].title, '1');
  assert.equal((await store.readHistory('a', h[0].id)).title, '1');
});

test('名前の変更で履歴も移り、同じ名前があれば断る', async () => {
  await store.writeProject('b', proj('x'));
  await store.renameProject('a', 'c');
  assert.deepEqual(await store.listProjects(), ['b', 'c']);
  assert.equal((await store.listHistory('c')).length, 1);
  await assert.rejects(store.renameProject('c', 'b'));
});

test('削除は .trash へ移す', async () => {
  await store.deleteProject('b');
  assert.deepEqual(await store.listProjects(), ['c']);
  assert.equal(readdirSync(path.join(dir, '.trash')).length, 1);
  assert.ok(existsSync(path.join(dir, '.history')));
});

test('不正な版の指定は断る', async () => {
  await assert.rejects(store.readHistory('c', '../../x'));
});

test('削除で履歴も .trash に移り、同じ名前を作り直して名前を変えても失敗しない', async () => {
  await store.writeProject('d', proj('1'));
  await store.writeProject('d', proj('2'));
  await store.deleteProject('d');
  assert.equal((await store.listHistory('d')).length, 0);
  // 別のプロジェクトを d に改名(以前の d の履歴は .trash にあるのでぶつからない)
  await store.writeProject('e', proj('1'));
  await store.writeProject('e', proj('2'));
  await store.renameProject('e', 'd');
  assert.equal((await store.listHistory('d')).length, 1);
});

test('改名先に履歴フォルダだけが残っていても、まとめて移せる', async () => {
  const { mkdirSync, writeFileSync } = await import('node:fs');
  mkdirSync(path.join(dir, '.history', 'g'), { recursive: true });
  writeFileSync(path.join(dir, '.history', 'g', '20200101-000000-000.json'), JSON.stringify(proj('old')));
  await store.writeProject('f', proj('1'));
  await store.writeProject('f', proj('2'));
  await store.renameProject('f', 'g');
  assert.equal((await store.listHistory('g')).length, 2);
});
