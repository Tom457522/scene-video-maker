/**
 * 文章(アウトライン)からシーンの並びを作る。決まった書き方を読み取るだけで、AI は使わない。
 *
 *   # タイトル              → title(次の普通の行はサブタイトル)
 *   ## 見出し + - 項目       → bullets(7 個以上は「(続き)」として分ける)
 *   ## 見出し + 1. 手順      → flow(2〜5 個ずつ)
 *   ## 見出し + ラベル: 92%  → bars(数値の後ろは単位)
 *   ## まとめ + - 項目       → summary(見出しが「まとめ」「要点」「ポイント」で始まるとき)
 *   > 字幕                   → そのシーンの字幕(caption がある部品だけ)
 *   [[語]]                   → そのまま強調になる
 */

export type OutlineScene = { part: string; props: Record<string, unknown> };

type Block = { level: 1 | 2; heading: string; lines: string[] };

const RE = {
  h1: /^#\s+(.+)$/,
  h2: /^#{2,}\s+(.+)$/,
  bullet: /^\s*(?:[-*+]\s+|[・●]\s*)(.+)$/,
  numbered: /^\s*\d+\s*[.)．、]\s*(.+)$/,
  bar: /^\s*(?:[-*+]\s+|[・●]\s*)?(.+?)\s*[:：]\s*(-?\d[\d,]*(?:\.\d+)?)\s*([^\d\s][^\s]*)?\s*$/,
  caption: /^\s*>\s*(.+)$/,
};

const SUMMARY_HEADING = /^(まとめ|要点|ポイント|おさらい)/;

const chunk = <T,>(list: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

const toBlocks = (text: string): Block[] => {
  const blocks: Block[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const h2 = RE.h2.exec(line);
    const h1 = h2 ? null : RE.h1.exec(line);
    if (h1 || h2) {
      blocks.push({ level: h1 ? 1 : 2, heading: (h1 ?? h2)![1].trim(), lines: [] });
      continue;
    }
    if (line.trim() === '') continue;
    if (blocks.length === 0) blocks.push({ level: 2, heading: '', lines: [] });
    blocks[blocks.length - 1].lines.push(line);
  }
  return blocks;
};

const blockToScenes = (b: Block): OutlineScene[] => {
  const captions: string[] = [];
  const bullets: string[] = [];
  const numbered: string[] = [];
  const bars: { label: string; value: number; unit: string }[] = [];
  const plain: string[] = [];
  for (const line of b.lines) {
    let m: RegExpExecArray | null;
    if ((m = RE.caption.exec(line))) captions.push(m[1].trim());
    else if ((m = RE.bar.exec(line)) && !RE.numbered.test(line)) {
      bars.push({ label: m[1].trim(), value: Number(m[2].replace(/,/g, '')), unit: m[3] ?? '' });
    } else if ((m = RE.numbered.exec(line))) numbered.push(m[1].trim());
    else if ((m = RE.bullet.exec(line))) bullets.push(m[1].trim());
    else plain.push(line.trim());
  }
  const caption = captions.join(' ');
  const heading = b.heading;

  if (b.level === 1) {
    const [subtitle = '', ...rest] = plain;
    const scenes: OutlineScene[] = [{ part: 'title', props: { kicker: '', title: heading, subtitle } }];
    const items = [...bullets, ...numbered, ...rest];
    if (items.length > 0) scenes.push(...chunk(items, 6).map((it, i) => ({ part: 'bullets', props: { heading: i === 0 ? heading : `${heading}(続き)`, items: it } })));
    return scenes;
  }

  if (bars.length > 0 && bullets.length === 0 && numbered.length === 0) {
    const unit = bars.find((r) => r.unit)?.unit ?? '';
    const extra = [caption, ...plain].filter(Boolean).join(' ');
    return chunk(bars, 6).map((rows, i) => ({
      part: 'bars',
      props: { heading: i === 0 ? heading : `${heading}(続き)`, rows: rows.map(({ label, value }) => ({ label, value })), unit, max: 0, caption: extra },
    }));
  }

  if (numbered.length >= 2 && bullets.length === 0 && !SUMMARY_HEADING.test(heading)) {
    const extra = [caption, ...plain].filter(Boolean).join(' ');
    const groups = numbered.length <= 5 ? [numbered] : chunk(numbered, 4);
    // 最後のまとまりが 1 個だけにならないようにする(流れ図は 2 個以上)
    if (groups.length > 1 && groups[groups.length - 1].length === 1) groups[groups.length - 2].push(...groups.pop()!);
    return groups.map((steps, i) => ({
      part: 'flow',
      props: { heading: i === 0 ? heading : `${heading}(続き)`, steps, caption: extra },
    }));
  }

  const items = [...bullets, ...numbered, ...plain];
  if (items.length === 0) return heading ? [{ part: 'title', props: { kicker: '', title: heading, subtitle: caption } }] : [];
  const isSummary = SUMMARY_HEADING.test(heading);
  return chunk(items, isSummary ? 5 : 6).map((it, i) => ({
    part: isSummary ? 'summary' : 'bullets',
    props: { heading: i === 0 ? heading : `${heading}(続き)`, items: it },
  }));
};

/** 文章からシーンの並びを作る。title は最初の「# 見出し」 */
export const parseOutline = (text: string): { title: string; scenes: OutlineScene[] } => {
  const blocks = toBlocks(text);
  return {
    title: blocks.find((b) => b.level === 1)?.heading ?? '',
    scenes: blocks.flatMap(blockToScenes),
  };
};

export const OUTLINE_EXAMPLE = `# ブロックチェーン
改ざんしにくい記録のしくみ

## ブロックチェーンとは
- 取引の記録を[[ブロック]]にまとめる
- ブロックを[[鎖]]のようにつなぐ
- みんなで同じ記録を[[共有]]する

## 取引が記録されるまで
1. 取引する
2. みんなで検証
3. ブロックにまとめる
4. チェーンにつなぐ
> 検証が済んだ取引だけがブロックに入ります

## 例: 知っている仮想通貨
ビットコイン: 92%
イーサリアム: 64%
リップル: 41%

## まとめ
- 記録を[[ブロック]]にまとめて鎖のようにつなぐ
- みんなで同じ記録を持つので[[改ざんしにくい]]`;
