/**
 * 画像ファイル(ロゴ・図・写真)の置き場所 projects/assets/。
 * エディタでは Vite がこのフォルダを公開フォルダとして配信し、書き出しでは Remotion のバンドルにコピーする。
 * 部品からは kit の Picture / assetSrc で参照する。
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { PROJECTS_DIR } from './projects.ts';

export const ASSETS_DIR = path.join(PROJECTS_DIR, 'assets');
/** 1 ファイルの大きさの上限 */
export const MAX_ASSET_BYTES = 10 * 1024 * 1024;
/** 使える画像の種類(SVG は中にスクリプトを書けるので受け付けない) */
const EXT = /\.(png|jpe?g|gif|webp)$/i;
const NAME_RE = /^[\p{L}\p{N}_\- ]{1,80}\.(png|jpe?g|gif|webp)$/iu;

export const isValidAssetName = (name: string): boolean => NAME_RE.test(name) && path.basename(name) === name;

/** アップロードされた名前を、使える文字だけの名前に直す */
export const sanitizeAssetName = (name: string): string => {
  const ext = (EXT.exec(name)?.[0] ?? '').toLowerCase();
  const base = path
    .basename(name, path.extname(name))
    .replace(/[^\p{L}\p{N}_\- ]/gu, '_')
    .trim()
    .slice(0, 80);
  return `${base || 'image'}${ext}`;
};

export type AssetInfo = { name: string; size: number };

export const listAssets = async (): Promise<AssetInfo[]> => {
  await fs.mkdir(ASSETS_DIR, { recursive: true });
  const out: AssetInfo[] = [];
  for (const name of (await fs.readdir(ASSETS_DIR)).sort((a, b) => a.localeCompare(b, 'ja'))) {
    if (!isValidAssetName(name)) continue;
    out.push({ name, size: (await fs.stat(path.join(ASSETS_DIR, name))).size });
  }
  return out;
};

/** 先頭のバイトで、本当に画像かを確かめる */
const looksLikeImage = (b: Buffer): boolean =>
  (b[0] === 0x89 && b.subarray(1, 4).toString() === 'PNG') ||
  (b[0] === 0xff && b[1] === 0xd8) ||
  b.subarray(0, 4).toString() === 'GIF8' ||
  (b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP');

/** 保存する。同じ名前があれば「名前 (2).png」のように別の名前にする。保存した名前を返す */
export const saveAsset = async (requestedName: string, data: Buffer): Promise<string> => {
  if (data.length > MAX_ASSET_BYTES) throw new Error('画像が大きすぎます(10MB まで)');
  if (!looksLikeImage(data)) throw new Error('PNG / JPEG / GIF / WebP の画像だけを使えます');
  let name = sanitizeAssetName(requestedName);
  if (!isValidAssetName(name)) throw new Error('ファイル名か種類が使えません(PNG / JPEG / GIF / WebP)');
  await fs.mkdir(ASSETS_DIR, { recursive: true });
  const ext = path.extname(name);
  const base = name.slice(0, -ext.length);
  for (let i = 2; await fs.access(path.join(ASSETS_DIR, name)).then(() => true, () => false); i++) name = `${base} (${i})${ext}`;
  await fs.writeFile(path.join(ASSETS_DIR, name), data);
  return name;
};
