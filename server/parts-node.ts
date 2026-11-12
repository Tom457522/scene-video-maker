/**
 * Node(コマンドやテスト)で src/parts/ の部品を読む。
 * ブラウザ側は import.meta.glob / require.context で読むが、Node ではフォルダを見て import する。
 */
import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadParts } from '../src/parts/registry.ts';
import { ROOT } from './projects.ts';

export const loadPartsInNode = async () => {
  const dir = path.join(ROOT, 'src', 'parts');
  const modules: Record<string, unknown> = {};
  for (const name of readdirSync(dir).sort()) {
    const file = path.join(dir, name, 'index.tsx');
    if (!existsSync(file)) continue;
    modules[`./${name}/index.tsx`] = await import(pathToFileURL(file).href);
  }
  return loadParts(modules);
};
