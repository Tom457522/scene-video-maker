/**
 * npm run visual [-- --update]
 * 見本のプロジェクトの静止画を書き出し、test/visual/ の基準の画像と画素単位で比べる。
 * kit や部品を直したときに、ほかの部品の見た目が意図せず変わっていないかを見つける。
 *
 *   --update  今の見た目を新しい基準として保存する(見た目を意図して変えたとき)
 *
 * 基準の画像は半分の大きさ(640×360)で保存・比較する(容量を抑え、文字のふちの細かな差を拾いすぎないため)。
 * 違いが見つかったら、差分の画像を stills/visual-diff/ に書き出し、終了コード 1 で終わる。
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { ROOT, readProjectArg } from '../server/projects.ts';
import { renderSceneStills } from '../server/render.ts';

/** 比べるプロジェクト */
const PROJECTS = ['sample', '部品の見本'];
/** 1 枚のうち、これより多くの画素が違えば「変わった」とする(0.2%) */
const MAX_DIFF_RATIO = 0.002;

const update = process.argv.includes('--update');
const BASE_DIR = path.join(ROOT, 'test', 'visual');
const DIFF_DIR = path.join(ROOT, 'stills', 'visual-diff');

/** 2×2 の画素の平均で半分の大きさにする */
const half = (src: PNG): PNG => {
  const w = Math.floor(src.width / 2);
  const h = Math.floor(src.height / 2);
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let c = 0; c < 4; c++) {
        let sum = 0;
        for (const [dx, dy] of [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ]) {
          sum += src.data[((y * 2 + dy) * src.width + (x * 2 + dx)) * 4 + c];
        }
        out.data[(y * w + x) * 4 + c] = Math.round(sum / 4);
      }
    }
  }
  return out;
};

const readPng = async (file: string) => PNG.sync.read(await fs.readFile(file));

await fs.rm(DIFF_DIR, { recursive: true, force: true });
let failed = 0;
let compared = 0;
for (const name of PROJECTS) {
  const { project } = await readProjectArg(name);
  const outDir = path.join(ROOT, 'stills', 'visual', name);
  const stills = await renderSceneStills(project, outDir, 0.7);
  for (const s of stills) {
    const small = half(await readPng(s.file));
    const base = path.join(BASE_DIR, name, path.basename(s.file));
    if (update) {
      await fs.mkdir(path.dirname(base), { recursive: true });
      await fs.writeFile(base, PNG.sync.write(small));
      continue;
    }
    let ref: PNG;
    try {
      ref = await readPng(base);
    } catch {
      console.log(`  ✗ ${name}/${path.basename(s.file)}: 基準の画像がありません(npm run visual -- --update で作れます)`);
      failed++;
      continue;
    }
    compared++;
    if (ref.width !== small.width || ref.height !== small.height) {
      console.log(`  ✗ ${name}/${path.basename(s.file)}: 大きさが違います`);
      failed++;
      continue;
    }
    const diff = new PNG({ width: ref.width, height: ref.height });
    const n = pixelmatch(ref.data, small.data, diff.data, ref.width, ref.height, { threshold: 0.15 });
    const ratio = n / (ref.width * ref.height);
    const ok = ratio <= MAX_DIFF_RATIO;
    console.log(`  ${ok ? '✓' : '✗'} ${name}/${path.basename(s.file)}  違い ${(ratio * 100).toFixed(2)}%`);
    if (!ok) {
      failed++;
      await fs.mkdir(path.join(DIFF_DIR, name), { recursive: true });
      await fs.writeFile(path.join(DIFF_DIR, name, path.basename(s.file)), PNG.sync.write(diff));
      await fs.writeFile(path.join(DIFF_DIR, name, `now-${path.basename(s.file)}`), PNG.sync.write(small));
    }
  }
}

if (update) {
  console.log(`基準の画像を ${path.relative(process.cwd(), BASE_DIR)} に保存しました。`);
} else if (failed > 0) {
  console.log(`\n${failed} 枚の見た目が基準と違います。差分は ${path.relative(process.cwd(), DIFF_DIR)} にあります。`);
  console.log('意図した変更なら npm run visual -- --update で基準を更新してください。');
  process.exit(1);
} else {
  console.log(`\n${compared} 枚すべて基準どおりでした。`);
}
