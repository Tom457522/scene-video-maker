import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FORMAT_CHOICES, PART_GROUPS, findIssues, groupOf, lostFields, sortByGroup } from '../src/editor/guide.ts';
import { EXPORT_FORMATS } from '../src/remotion/composition-id.ts';
import { loadPartsInNode } from '../server/parts-node.ts';

const { parts } = await loadPartsInNode();
const lookup = (id: string) => parts.find((p) => p.id === id);

test('すべての部品が、どれか 1 つの種類の分け方に入っている', () => {
  const grouped = PART_GROUPS.flatMap((g) => g.parts);
  assert.equal(new Set(grouped).size, grouped.length, '同じ部品が 2 か所に入っている');
  for (const p of parts) assert.notEqual(groupOf(p.id), 'other', `${p.id} がどの分け方にも入っていない`);
  for (const id of grouped) assert.ok(lookup(id), `${id} という部品はない`);
  assert.equal(groupOf('まだない部品'), 'other');
  assert.deepEqual(
    sortByGroup([{ id: 'zzz' }, { id: 'pie' }, { id: 'title' }]).map((p) => p.id),
    ['title', 'pie', 'zzz'],
  );
});

test('確認の一覧: 短すぎる秒数・不明な部品を見つけ、直す秒数を出す', () => {
  const issues = findIssues(
    [
      { part: 'title', seconds: 4, props: {} },
      { part: 'bullets', seconds: 1, props: { heading: 'とても長い見出しです', items: ['一つ目の項目をここに書く', '二つ目の項目をここに書く', '三つ目の項目をここに書く'] } },
      { part: 'nope', seconds: 3, props: {} },
    ],
    lookup,
  );
  assert.deepEqual(
    issues.map((i) => [i.scene, i.kind]),
    [
      [1, 'short'],
      [2, 'unknown'],
    ],
  );
  assert.ok((issues[0].fixSeconds ?? 0) > 1);
});

test('種類を変えて引き継げなかった入力の名前を返す(空の項目は数えない)', () => {
  const lost = lostFields(lookup('bullets'), { heading: '見出し', items: ['a', 'b'] }, { heading: '見出し', steps: [] });
  assert.equal(lost.length, 1);
  assert.notEqual(lost[0], 'heading');
  assert.deepEqual(lostFields(lookup('bullets'), { heading: '', items: [] }, {}), []);
});

test('書き出しの形式は、すべて使う場面の呼び方がある', () => {
  assert.deepEqual(FORMAT_CHOICES.map((f) => f.id).sort(), Object.keys(EXPORT_FORMATS).sort());
});
