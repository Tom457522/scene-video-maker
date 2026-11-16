/**
 * 見直し用のフォルダを作る(npm run make の --review)。AI や人が、でき上がりを目で見て直すためのもの。
 *
 *   NN-部品.png       各シーンの見どころの静止画
 *   一覧.png          全シーンを縮小して並べた 1 枚(単調さ・色や形の偏りを一目で見る)
 *   見直し.md         シーンごとの画面の文・ナレーション・秒数と、自動の検査の結果、見るべき点
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import type { Project } from '../src/video/project.ts';
import { displayText } from '../src/video/narration.ts';
import { collectText } from '../src/video/reading.ts';
import { describeQuality, type QualityReport } from '../src/video/quality.ts';
import { describeFact, type FactReport } from '../src/video/facts.ts';
import type { SceneStill } from './render.ts';

/** 静止画を縮小して並べた 1 枚を作る(cols 列。縮小は 4×4 の平均) */
export const contactSheet = async (files: string[], out: string, cols = 4): Promise<void> => {
  if (files.length === 0) return;
  const imgs = await Promise.all(files.map(async (f) => PNG.sync.read(await fs.readFile(f))));
  const k = 4;
  const w = Math.floor(imgs[0].width / k);
  const h = Math.floor(imgs[0].height / k);
  const gap = 6;
  const rows = Math.ceil(imgs.length / cols);
  const sheet = new PNG({ width: cols * w + (cols + 1) * gap, height: rows * h + (rows + 1) * gap });
  sheet.data.fill(255);
  imgs.forEach((img, n) => {
    const ox = gap + (n % cols) * (w + gap);
    const oy = gap + Math.floor(n / cols) * (h + gap);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const acc = [0, 0, 0];
        for (let dy = 0; dy < k; dy++) {
          for (let dx = 0; dx < k; dx++) {
            const sx = Math.min(img.width - 1, x * k + dx);
            const sy = Math.min(img.height - 1, y * k + dy);
            const i = (sy * img.width + sx) * 4;
            acc[0] += img.data[i];
            acc[1] += img.data[i + 1];
            acc[2] += img.data[i + 2];
          }
        }
        const o = ((oy + y) * sheet.width + ox + x) * 4;
        sheet.data[o] = acc[0] / (k * k);
        sheet.data[o + 1] = acc[1] / (k * k);
        sheet.data[o + 2] = acc[2] / (k * k);
        sheet.data[o + 3] = 255;
      }
    }
  });
  await fs.writeFile(out, PNG.sync.write(sheet));
};

/** 見直しの観点(AI が静止画を見て採点するときの基準) */
export const REVIEW_CHECKLIST = `## 静止画を見て確かめること(各 1〜5 点で採点し、3 点以下のシーンを直す)

1. **一目で要点が分かるか**: 3 秒見て、そのシーンで言いたいことが分かる。分からなければ、見出しを結論の文にするか、部品を変える。
2. **文字の量**: 画面の文はキーワードと数字だけ。説明の文はナレーションに回す。
3. **形の変化**: 一覧.png で、似た見た目のシーンが 3 つ以上続いていない。続いていたら、間のシーンを図・グラフ・数字・アイコンに変える。
4. **数字の見せ方**: 大事な数字は「大きな数字」かグラフで見せている。文の中に埋もれていない。
5. **話と画面が合っているか**: ナレーションで話している順に、画面の項目が出ている(▶ の位置)。
6. **つかみと締め**: 2 枚目で「この動画で何が分かるか」が伝わり、最後のまとめが本論の 3 点と対応している。`;

/** 見直しのフォルダを作る。stills は renderSceneStills の結果(同じフォルダに書き出しておく) */
export const writeReview = async (
  dir: string,
  project: Project,
  stills: SceneStill[],
  resolve: (i: number) => Record<string, unknown>,
  quality: QualityReport,
  facts: FactReport | null,
): Promise<string> => {
  await contactSheet(
    stills.map((s) => s.file),
    path.join(dir, '一覧.png'),
  );
  const lines: string[] = [`# 見直し: ${project.title}`, '', `- シーン: ${project.scenes.length} 個`, `- 長さ: ${Math.round(project.scenes.reduce((n, s) => n + s.seconds, 0))} 秒`, `- 自動の検査の点数: ${quality.score} / 100`, ''];
  if (quality.items.length > 0) lines.push('## 自動の検査', '', ...quality.items.map((q) => `- ${describeQuality(q)}`), '');
  if (facts) {
    lines.push('## 数字の照合', '', `- 調べた数字: ${facts.checked} 個`);
    lines.push(...(facts.problems.length > 0 ? facts.problems.map((p) => `- シーン ${p.scene}: ${describeFact(p)}`) : ['- すべてレポートと一致しました']), '');
  }
  lines.push(REVIEW_CHECKLIST, '', '## シーンごとの内容', '');
  project.scenes.forEach((s, i) => {
    const still = stills.find((x) => x.scene === i);
    lines.push(`### ${i + 1}. ${s.part}(${s.seconds} 秒)${still ? ` — ${path.basename(still.file)}` : ''}`, '');
    lines.push(`- 画面: ${collectText(resolve(i)).filter(Boolean).join(' / ')}`);
    if (s.narration) lines.push(`- ナレーション: ${displayText(s.narration)}`);
    if (s.source) lines.push(`- 出典: ${s.source}`);
    if (still && still.issues.length > 0) lines.push(`- はみ出し: ${still.issues.length} 件`);
    lines.push('');
  });
  const file = path.join(dir, '見直し.md');
  await fs.writeFile(file, lines.join('\n'));
  return file;
};
