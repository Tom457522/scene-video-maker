/**
 * 文章(アウトライン)からシーンの並びを作る。決まった書き方を読み取るだけで、AI は使わない。
 *
 *   # タイトル              → title(次の普通の行はサブタイトル)
 *   ## 見出し + - 項目       → bullets(7 個以上は「(続き)」として分ける)
 *   ## 見出し + 1. 手順      → flow(2〜5 個ずつ)
 *   ## 見出し + ラベル: 92%  → bars(数値の後ろは単位)
 *   ## まとめ + - 項目       → summary(見出しが「まとめ」「要点」「ポイント」で始まるとき)
 *   > 字幕                   → そのシーンの字幕(caption がある部品だけ)
 *   2008年: 出来事(2 行以上)→ timeline(左が数字で始まり、右が文のとき)
 *   | 左 | 右 |(表)          → compare(1 行目が名前、2 行目以降が項目)
 *   ![説明](ファイル名)      → image(ファイルは projects/assets/ に入れておく)
 *   ```言語 〜 ```           → code
 *   Q: 質問 / A: 答え        → qa
 *   >> 文 と -- 出典         → quote
 *   !! 約100万件 説明        → number(数字の前は前置き、直後は単位、空白の後は説明)
 *   [[語]]                   → そのまま強調になる
 */

export type OutlineScene = { part: string; props: Record<string, unknown> };

type Block = { level: 1 | 2; heading: string; lines: string[]; code?: { lang: string; text: string } };

const RE = {
  h1: /^#\s+(.+)$/,
  h2: /^#{2,}\s+(.+)$/,
  bullet: /^\s*(?:[-*+]\s+|[・●]\s*)(.+)$/,
  numbered: /^\s*\d+\s*[.)．、]\s*(.+)$/,
  bar: /^\s*(?:[-*+]\s+|[・●]\s*)?(.+?)\s*[:：]\s*(-?\d[\d,]*(?:\.\d+)?)\s*([^\d\s][^\s]*)?\s*$/,
  caption: /^\s*>(?!>)\s*(.+)$/,
  quote: /^\s*>>\s*(.+)$/,
  source: /^\s*(?:--|——|―+|—)\s*(.+)$/,
  image: /^\s*!\[([^\]]*)\]\(([^)]+)\)\s*$/,
  table: /^\s*\|(.+)\|\s*$/,
  tableRule: /^\s*\|[\s:|-]+\|\s*$/,
  q: /^\s*[QＱ]\s*[:：.．]\s*(.+)$/,
  a: /^\s*[AＡ]\s*[:：.．]\s*(.+)$/,
  number: /^\s*!!\s*([^\d\s-]*)\s*(-?\d[\d,]*(?:\.\d+)?)\s*(\S*)\s*(.*)$/,
  timeline: /^\s*(?:[-*+]\s+|[・●]\s*)?(\d{1,4}[^:：]{0,8}?)\s*[:：]\s*((?=.*[^\d\s.,%])\S.*)$/,
  fence: /^\s*```\s*(\w*)\s*$/,
};

/** コードの言語名を、コード部品の選択肢に合わせる */
const LANG_ALIAS: Record<string, string> = { js: 'ts', javascript: 'ts', typescript: 'ts', tsx: 'ts', jsx: 'ts', py: 'python', sh: 'shell', bash: 'shell', zsh: 'shell', html: 'html', css: 'css', json: 'json' };

const SUMMARY_HEADING = /^(まとめ|要点|ポイント|おさらい)/;

const chunk = <T,>(list: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

const toBlocks = (text: string): Block[] => {
  const blocks: Block[] = [];
  let fence: { lang: string; lines: string[] } | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    // ``` で囲まれた中は見出しなどとして読まず、そのままコードにする
    const f = RE.fence.exec(line);
    if (fence) {
      if (f && f[1] === '') {
        if (blocks.length === 0) blocks.push({ level: 2, heading: '', lines: [] });
        blocks[blocks.length - 1].code = { lang: fence.lang, text: fence.lines.join('\n') };
        fence = null;
      } else fence.lines.push(raw);
      continue;
    }
    if (f) {
      fence = { lang: f[1].toLowerCase(), lines: [] };
      continue;
    }
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

/** 新しい部品(コード・画像・表・Q&A・引用・数字・年表)の書き方を先に調べる。当てはまらなければ null */
const special = (b: Block): OutlineScene[] | null => {
  const heading = b.heading;
  const captions = b.lines.map((l) => RE.caption.exec(l)?.[1].trim()).filter((x): x is string => !!x);
  const caption = captions.join(' ');
  if (b.code) {
    return [{ part: 'code', props: { heading, language: LANG_ALIAS[b.code.lang] ?? 'text', code: b.code.text, highlight: '', caption } }];
  }
  const img = b.lines.map((l) => RE.image.exec(l)).find((m) => m);
  if (img) return [{ part: 'image', props: { heading, file: img[2].trim(), caption: img[1].trim() || caption } }];

  const rows = b.lines.filter((l) => RE.table.test(l) && !RE.tableRule.test(l)).map((l) => RE.table.exec(l)![1].split('|').map((c) => c.trim()));
  if (rows.length >= 2 && rows[0].length >= 2) {
    const [head, ...body] = rows;
    return [
      {
        part: 'compare',
        props: {
          heading,
          leftTitle: head[0],
          rightTitle: head[1],
          leftItems: body.map((r) => r[0]).filter(Boolean),
          rightItems: body.map((r) => r[1] ?? '').filter(Boolean),
        },
      },
    ];
  }

  const qs = b.lines.map((l) => RE.q.exec(l)?.[1].trim()).filter((x): x is string => !!x);
  const as = b.lines.map((l) => RE.a.exec(l)?.[1].trim()).filter((x): x is string => !!x);
  if (qs.length > 0 && as.length > 0) return qs.map((q, i) => ({ part: 'qa', props: { question: q, answer: as[i] ?? '' } }));

  const quotes = b.lines.map((l) => RE.quote.exec(l)?.[1].trim()).filter((x): x is string => !!x);
  if (quotes.length > 0) {
    const source = b.lines.map((l) => RE.source.exec(l)?.[1].trim()).find((x) => x) ?? '';
    return [{ part: 'quote', props: { text: quotes.join(''), source } }];
  }

  const num = b.lines.map((l) => RE.number.exec(l)).find((m) => m);
  if (num) {
    return [
      {
        part: 'number',
        props: { heading, prefix: num[1], value: Number(num[2].replace(/,/g, '')), unit: num[3], label: num[4].trim() || caption, note: '' },
      },
    ];
  }

  const events = b.lines.map((l) => RE.timeline.exec(l)).filter((m): m is RegExpExecArray => !!m);
  if (events.length >= 2 && events.length === b.lines.filter((l) => !RE.caption.test(l)).length) {
    return chunk(events, 6).map((ev, i) => ({
      part: 'timeline',
      props: { heading: i === 0 ? heading : `${heading}(続き)`, events: ev.map((m) => ({ when: m[1].trim(), what: m[2].trim() })), caption },
    }));
  }
  return null;
};

const blockToScenes = (b: Block): OutlineScene[] => {
  if (b.level === 2) {
    const sp = special(b);
    if (sp) return sp;
  }
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
