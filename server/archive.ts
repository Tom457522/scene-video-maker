/**
 * プロジェクトを 1 つの zip にまとめる・zip から読み込む(別の PC に移す・人に渡すため)。
 * zip の中身: project.json と、使っている画像 assets/<ファイル名>。
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { strFromU8, strToU8, unzipSync, zipSync, type Unzipped } from 'fflate';
import { projectSchema, type Project } from '../src/video/project.ts';
import { ASSETS_DIR, MAX_ASSET_BYTES, isValidAssetName, listAssets, saveAsset } from './assets.ts';
import { isValidName, listProjects, writeProject } from './projects.ts';

/** 読み込める zip の中身の合計の上限 */
const MAX_TOTAL = 100 * 1024 * 1024;
const MAX_ENTRIES = 300;

const strings = (v: unknown): string[] =>
  typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : [];

/** 入力値の中の、ある文字とまったく同じ値だけを置き換える(画像のファイル名を付け直すとき) */
const replaceExact = (v: unknown, from: string, to: string): unknown =>
  v === from ? to : Array.isArray(v) ? v.map((x) => replaceExact(x, from, to)) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, replaceExact(x, from, to)])) : v;

/** zip にまとめる。使っている画像(入力値に同じファイル名がある画像)だけを入れる */
export const exportArchive = async (project: unknown): Promise<Uint8Array> => {
  const p = projectSchema.parse(project);
  const used = new Set(strings({ settings: p.settings, scenes: p.scenes.map((s) => s.props) }));
  const files: Record<string, Uint8Array> = { 'project.json': strToU8(`${JSON.stringify(p, null, 2)}\n`) };
  for (const a of await listAssets()) {
    if (used.has(a.name)) files[`assets/${a.name}`] = new Uint8Array(await fs.readFile(path.join(ASSETS_DIR, a.name)));
  }
  return zipSync(files, { level: 6 });
};

/** 名前がぶつかるときは「名前-2」のようにする */
const uniqueName = async (base: string): Promise<string> => {
  const existing = new Set(await listProjects());
  if (!existing.has(base)) return base;
  for (let i = 2; ; i++) {
    const n = `${base.slice(0, 55)}-${i}`;
    if (!existing.has(n)) return n;
  }
};

/** zip から読み込んで保存する。保存したプロジェクト名と、名前を付け直した画像を返す */
export const importArchive = async (data: Uint8Array, requestedName: string): Promise<{ name: string; renamed: Record<string, string> }> => {
  let total = 0;
  let count = 0;
  let unzipped: Unzipped;
  try {
    unzipped = unzipSync(data, {
      // 読む前に中身を確かめ、決まったファイルだけを展開する(大きすぎる zip や想定外の場所を読まない)
      filter: (f) => {
        count++;
        total += f.originalSize;
        if (count > MAX_ENTRIES || total > MAX_TOTAL) throw new Error('zip の中身が多すぎるか大きすぎます');
        if (f.name === 'project.json') return f.originalSize <= 5 * 1024 * 1024;
        const m = /^assets\/([^/]+)$/.exec(f.name);
        return !!m && isValidAssetName(m[1]) && f.originalSize <= MAX_ASSET_BYTES;
      },
    });
  } catch (e) {
    throw new Error(`zip を読めませんでした: ${e instanceof Error ? e.message : String(e)}`, { cause: e });
  }
  if (!unzipped['project.json']) throw new Error('zip の中に project.json がありません(このアプリで書き出した zip を選んでください)');
  let project: Project = projectSchema.parse(JSON.parse(strFromU8(unzipped['project.json'])));

  const renamed: Record<string, string> = {};
  for (const [entry, bytes] of Object.entries(unzipped)) {
    const m = /^assets\/([^/]+)$/.exec(entry);
    if (!m) continue;
    const name = m[1];
    const existing = await fs.readFile(path.join(ASSETS_DIR, name)).catch(() => null);
    if (existing && Buffer.compare(existing, Buffer.from(bytes)) === 0) continue; // 同じ画像がもうある
    const saved = await saveAsset(name, Buffer.from(bytes));
    if (saved !== name) {
      renamed[name] = saved;
      project = projectSchema.parse(replaceExact(project, name, saved));
    }
  }
  const base = isValidName(requestedName) ? requestedName : 'よみこんだ動画';
  const name = await uniqueName(base);
  await writeProject(name, project);
  return { name, renamed };
};
