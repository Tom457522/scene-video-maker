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
 *   | 左 | 右 |(表)          → compare(2 列。1 行目が名前、2 行目以降が項目)
 *   | A | B | C |(3 列以上) → table
 *   ## 〜の割合 + ラベル: 値  → pie(見出しに「割合・内訳・シェア・構成」があるとき)
 *   ## 〜の推移 + ラベル: 値  → line(見出しに「推移・変化・伸び」があるか、ラベルがすべて年のとき)
 *   1. 〜 が 6 個以上         → steps(縦のステップ)
 *   ![説明](ファイル名)      → image(ファイルは projects/assets/ に入れておく)
 *   ```言語 〜 ```           → code
 *   Q: 質問 / A: 答え        → qa
 *   >> 文 と -- 出典         → quote
 *   !! 約100万件 説明        → number(数字の前は前置き、直後は単位、空白の後は説明)
 *   [[語]]                   → そのまま強調になる
 *   ナレーション: 文          → 読み上げる文(▶ の位置で画面の項目を 1 つずつ出す)。何行でも書ける
 *   出典: 文                 → 画面の下に小さく出す出典
 *   ## 見出し {part=icons}   → 部品を直接決める(書き方からの推測より優先)
 *   - [shield] 名前: 説明    → icons(アイコン一覧。{part=icons} ならアイコンは文から選ぶ)
 */

import { guessIcon, isIconName } from './icon-guess';

export type OutlineScene = {
  part: string;
  props: Record<string, unknown>;
  narration?: string;
  source?: string;
  /** 変換で気をつけてほしいこと(シーンの notes に足す) */
  notes?: string[];
};

type Block = {
  level: 1 | 2;
  heading: string;
  lines: string[];
  code?: { lang: string; text: string };
  /** コードが lines の何行目の位置にあったか(ほかの書き方と分けるときに使う) */
  codeAt?: number;
  narration: string[];
  source?: string;
  /** {part=...} で決めた部品 */
  force?: string;
};

const RE = {
  h1: /^#\s+(.+)$/,
  h2: /^#{2,}\s+(.+)$/,
  bullet: /^\s*(?:[-*+]\s+|[・●]\s*)(.+)$/,
  numbered: /^\s*\d+\s*[.)．、]\s*(.+)$/,
  // 単位は数字を含まない 6 字まで(「100万〜200万円程度」のような文はグラフにしない)。[アイコン] で始まる行も除く
  bar: /^\s*(?:[-*+]\s+|[・●]\s*)?(?!\[[\w-]+\])(.+?)\s*[:：]\s*(-?\d[\d,]*(?:\.\d+)?)\s*([^\d\s][^\s\d]{0,5})?\s*$/,
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
  narration: /^\s*(?:ナレーション|ナレ|読み上げ)\s*[:：]\s*(.*)$/,
  sceneSource: /^\s*(?:出典|参考|ソース)\s*[:：]\s*(.+)$/,
  force: /\s*\{\s*part\s*=\s*([\w-]+)\s*\}\s*$/,
};

/** コードの言語名を、コード部品の選択肢に合わせる */
const LANG_ALIAS: Record<string, string> = { js: 'ts', javascript: 'ts', typescript: 'ts', tsx: 'ts', jsx: 'ts', py: 'python', sh: 'shell', bash: 'shell', zsh: 'shell', html: 'html', css: 'css', json: 'json' };

const SUMMARY_HEADING = /^(まとめ|要点|ポイント|おさらい)/;

const chunk = <T,>(list: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

const newBlock = (level: 1 | 2, rawHeading: string): Block => {
  const force = RE.force.exec(rawHeading);
  const heading = force ? rawHeading.slice(0, force.index).trim() : rawHeading;
  return { level, heading, lines: [], narration: [], ...(force ? { force: force[1] } : {}) };
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
        if (blocks.length === 0) blocks.push(newBlock(2, ''));
        const target = blocks[blocks.length - 1];
        target.code = { lang: fence.lang, text: fence.lines.join('\n') };
        target.codeAt = target.lines.length;
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
      blocks.push(newBlock(h1 ? 1 : 2, (h1 ?? h2)![1].trim()));
      continue;
    }
    if (line.trim() === '') continue;
    if (blocks.length === 0) blocks.push(newBlock(2, ''));
    const block = blocks[blocks.length - 1];
    // ナレーションと出典は、部品の書き方を調べる前に取り分ける(「ラベル: 数字」などと間違えないため)
    const nar = RE.narration.exec(line);
    if (nar) {
      if (nar[1].trim()) block.narration.push(nar[1].trim());
      continue;
    }
    const src = RE.sceneSource.exec(line);
    if (src) {
      block.source = src[1].trim();
      continue;
    }
    block.lines.push(line);
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
  if (rows.length >= 2 && rows[0].length >= 3) {
    const [head, ...body] = rows;
    return chunk(body, 6).map((part, i) => ({
      part: 'table',
      props: { heading: i === 0 ? heading : `${heading}(続き)`, columns: head.slice(0, 4), rows: part.map((r) => r.slice(0, head.length).join(' | ')), highlight: 0, caption },
    }));
  }
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
  // 右側がすべて「数字 + 単位」なら年表ではなくグラフ(1993年: 448万戸 など)
  const allNumeric = events.every((m) => RE.bar.test(m.input));
  if (events.length >= 2 && !allNumeric && events.length === b.lines.filter((l) => !RE.caption.test(l)).length) {
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
  /** 字幕以外の行を書いた順に(箇条書きにするとき、グラフの行なども落とさないため) */
  const ordered: string[] = [];
  for (const line of b.lines) {
    let m: RegExpExecArray | null;
    if (!RE.caption.test(line)) ordered.push((RE.bullet.exec(line)?.[1] ?? RE.numbered.exec(line)?.[1] ?? line).trim());
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
    // 割合・内訳なら円グラフ、推移なら折れ線グラフ
    if (/割合|内訳|シェア|構成/.test(heading) && bars.length >= 2 && bars.length <= 6) {
      return [{ part: 'pie', props: { heading, slices: bars.map(({ label, value }) => ({ label, value })), centerLabel: '', caption: extra } }];
    }
    const yearLike = bars.every((r) => /^\d{2,4}(年|年度)?$/.test(r.label));
    if ((/推移|変化|伸び|増加|減少|移り変わり/.test(heading) || yearLike) && bars.length >= 2 && bars.length <= 10) {
      return [{ part: 'line', props: { heading, points: bars.map(({ label, value }) => ({ label, value })), unit, caption: extra } }];
    }
    return chunk(bars, 6).map((rows, i) => ({
      part: 'bars',
      props: { heading: i === 0 ? heading : `${heading}(続き)`, rows: rows.map(({ label, value }) => ({ label, value })), unit, max: 0, caption: extra },
    }));
  }

  if (numbered.length >= 6 && bullets.length === 0 && !SUMMARY_HEADING.test(heading)) {
    // 手順が多いときは縦に並べる
    return chunk(numbered, 8).map((steps, i) => ({
      part: 'steps',
      props: { heading: i === 0 ? heading : `${heading}(続き)`, steps, caption: [caption, ...plain].filter(Boolean).join(' ') },
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

  // 「- [shield] 名前: 説明」の形の箇条書きはアイコン一覧にする
  const iconItems = bullets.filter((t) => {
    const m = ICON_ITEM.exec(t);
    return m && isIconName(m[1]);
  });
  if (bullets.length >= 2 && iconItems.length === bullets.length && numbered.length === 0) {
    return chunk(toCards(bullets), 6).map((cards, i) => ({ part: 'icons', props: { heading: i === 0 ? heading : `${heading}(続き)`, cards, caption } }));
  }

  const items = ordered.filter(Boolean);
  if (items.length === 0) return heading ? [{ part: 'title', props: { kicker: '', title: heading, subtitle: caption } }] : [];
  const isSummary = SUMMARY_HEADING.test(heading);
  return chunk(items, isSummary ? 5 : 6).map((it, i) => ({
    part: isSummary ? 'summary' : 'bullets',
    props: { heading: i === 0 ? heading : `${heading}(続き)`, items: it },
  }));
};

/** 行から、箇条書き・番号の印と、ナレーションでない字幕を除いた中身を取り出す */
const itemLines = (b: Block): string[] =>
  b.lines
    .filter((l) => !RE.caption.test(l) && !RE.tableRule.test(l))
    .map((l) => (RE.bullet.exec(l)?.[1] ?? RE.numbered.exec(l)?.[1] ?? l).trim())
    .filter(Boolean);

const captionOf = (b: Block): string =>
  b.lines
    .map((l) => RE.caption.exec(l)?.[1].trim())
    .filter(Boolean)
    .join(' ');

const PAIR = /^(?:\[([\w-]+)\]\s*)?(.+?)\s*[:：]\s*(.+)$/;
const ICON_ITEM = /^\[([\w-]+)\]\s*(.+)$/;

/** アイコン一覧のカード(「[アイコン] 名前: 説明」。アイコンを省くと文から選ぶ) */
const toCards = (items: string[]) => {
  const used = new Set<string>();
  return items.map((item) => {
    const pair = PAIR.exec(item);
    const iconOnly = ICON_ITEM.exec(item);
    const explicit = pair?.[1] ?? iconOnly?.[1];
    const title = pair ? pair[2].trim() : (iconOnly?.[2] ?? item).trim();
    const text = pair ? pair[3].trim() : '';
    const icon = explicit && isIconName(explicit) ? explicit : guessIcon(`${title} ${text}`, used);
    used.add(icon);
    return { icon, title, text };
  });
};

/**
 * {part=...} で決めた部品に作り直す。書き方からの推測と同じならそのまま。
 * 合う書き方がない部品は、見出しと字幕だけを引き継ぐ(notes で知らせる)。
 */
const forcePart = (b: Block, auto: OutlineScene[]): OutlineScene[] => {
  const want = b.force!;
  if (auto.length > 0 && auto.every((s) => s.part === want)) return auto;
  const heading = b.heading;
  const caption = captionOf(b);
  const items = itemLines(b);
  const bars = b.lines.map((l) => RE.bar.exec(l)).filter((m): m is RegExpExecArray => !!m);
  const many = <T,>(list: T[], size: number, make: (part: T[], heading: string) => Record<string, unknown>) =>
    chunk(list, size).map((p, i) => ({ part: want, props: make(p, i === 0 ? heading : `${heading}(続き)`) }));
  switch (want) {
    case 'bullets':
      return many(items, 6, (it, h) => ({ heading: h, items: it }));
    case 'summary':
      return many(items, 5, (it, h) => ({ heading: h, items: it }));
    case 'flow':
      return many(items, 5, (it, h) => ({ heading: h, steps: it, caption }));
    case 'steps':
      return many(items, 8, (it, h) => ({ heading: h, steps: it, caption }));
    case 'icons':
      return many(toCards(items), 6, (cards, h) => ({ heading: h, cards, caption }));
    case 'timeline': {
      const events = items.map((it) => PAIR.exec(it)).filter((m): m is RegExpExecArray => !!m);
      if (events.length >= 2) return many(events, 6, (ev, h) => ({ heading: h, events: ev.map((m) => ({ when: m[2].trim(), what: m[3].trim() })), caption }));
      break;
    }
    case 'bars':
    case 'pie':
    case 'line': {
      if (bars.length < 1) break;
      const rows = bars.map((m) => ({ label: m[1].trim(), value: Number(m[2].replace(/,/g, '')) }));
      const unit = bars.find((m) => m[3])?.[3] ?? '';
      if (want === 'bars') return many(rows, 6, (r, h) => ({ heading: h, rows: r, unit, max: 0, caption }));
      if (want === 'pie') return [{ part: 'pie', props: { heading, slices: rows.slice(0, 6), centerLabel: '', caption } }];
      return [{ part: 'line', props: { heading, points: rows.slice(0, 10), unit, caption } }];
    }
    case 'compare': {
      const pairs = items.map((it) => PAIR.exec(it)).filter((m): m is RegExpExecArray => !!m);
      const names = [...new Set(pairs.map((m) => m[2].trim()))];
      if (names.length === 2) {
        const side = (n: string) => pairs.filter((m) => m[2].trim() === n).map((m) => m[3].trim());
        return [{ part: 'compare', props: { heading, leftTitle: names[0], leftItems: side(names[0]), rightTitle: names[1], rightItems: side(names[1]) } }];
      }
      break;
    }
    case 'title':
      return [{ part: 'title', props: { kicker: '', title: heading, subtitle: items[0] ?? caption } }];
    case 'number': {
      const m = /(-?\d[\d,]*(?:\.\d+)?)\s*(\S*)/.exec(items[0] ?? '');
      if (m) return [{ part: 'number', props: { heading, prefix: '', value: Number(m[1].replace(/,/g, '')), unit: m[2], label: items[1] ?? caption, note: '' } }];
      break;
    }
  }
  const base = auto[0]?.props ?? {};
  return [
    {
      part: want,
      props: { heading, caption, ...('heading' in base ? { heading: base.heading } : {}) },
      notes: [`{part=${want}} に合う書き方が見つからなかったため、見出しだけを引き継ぎました(エディタで中身を入れてください)`],
    },
  ];
};

/** 行の書き方の種類。種類が違う行は 1 つのシーンにまとめられない(字幕は前後のどちらにも付く) */
const lineKind = (line: string, ctx: { qa: boolean; quote: boolean }): string => {
  if (RE.caption.test(line)) return 'caption';
  if (RE.number.test(line)) return 'number';
  // 「A: 1,200件」のような行もあるため、Q と A がそろうときだけ Q&A とみなす(出典の行も引用があるときだけ)
  if (ctx.qa && (RE.q.test(line) || RE.a.test(line))) return 'qa';
  if (RE.quote.test(line) || (ctx.quote && RE.source.test(line))) return 'quote';
  if (RE.image.test(line)) return 'image';
  if (RE.table.test(line)) return 'table';
  return 'list';
};

/**
 * 1 つの見出しの下に種類の違う書き方(数字と Q&A、箇条書きと表など)があるとき、
 * 書いた順にブロックを分ける。分けないと最後の 1 種類しか残らず、ほかの行が黙って消えるため。
 */
const splitBlock = (b: Block): Block[] => {
  if (b.level !== 2 || b.force) return [b];
  type Seg = { kind: string; lines: string[]; code?: Block['code'] };
  const segs: Seg[] = [];
  const pending: string[] = [];
  const push = (kind: string, line?: string, code?: Block['code']) => {
    const last = segs[segs.length - 1];
    if (last && last.kind === kind && !code && !last.code) {
      if (line !== undefined) last.lines.push(line);
      return;
    }
    // 先頭の字幕は、最初のまとまりに付ける
    segs.push({ kind, lines: [...pending.splice(0), ...(line !== undefined ? [line] : [])], ...(code ? { code } : {}) });
  };
  const ctx = { qa: b.lines.some((l) => RE.q.test(l)) && b.lines.some((l) => RE.a.test(l)), quote: b.lines.some((l) => RE.quote.test(l)) };
  b.lines.forEach((line, i) => {
    if (b.code && b.codeAt === i) push('code', undefined, b.code);
    const kind = lineKind(line, ctx);
    if (kind === 'caption') {
      if (segs.length > 0) segs[segs.length - 1].lines.push(line);
      else pending.push(line);
    } else push(kind, line);
  });
  if (b.code && (b.codeAt ?? b.lines.length) >= b.lines.length) push('code', undefined, b.code);
  if (pending.length > 0) {
    if (segs.length === 0) return [b];
    segs[0].lines.unshift(...pending);
  }
  if (segs.length <= 1) return [b];
  return segs.map((seg, i) => {
    const { code: _code, codeAt: _at, ...rest } = b;
    return {
      ...rest,
      lines: seg.lines,
      ...(seg.code ? { code: seg.code } : {}),
      // ナレーションは最初のまとまりにだけ付ける
      narration: i === 0 ? b.narration : [],
    };
  });
};

/** ブロックをシーンにし、部品の指定・ナレーション・出典を付ける */
const blockWithExtras = (b: Block): OutlineScene[] => {
  const parts = splitBlock(b);
  if (parts.length > 1) {
    const scenes = parts.flatMap(blockScenes);
    if (scenes.length > 0) {
      (scenes[0].notes ??= []).push(
        `「${b.heading || '(見出しなし)'}」の中に種類の違う書き方があったため、${scenes.length} シーンに分けました(1 シーン 1 種類にするなら、見出しを分けてください)`,
      );
      if (b.narration.length > 0) {
        (scenes[0].notes ??= []).push(`ナレーションは最初のシーンだけに付きました(ほかのシーンにはエディタで書き足してください)`);
      }
    }
    return scenes;
  }
  return blockScenes(b);
};

const blockScenes = (b: Block): OutlineScene[] => {
  const scenes = b.force ? forcePart(b, blockToScenes(b)) : blockToScenes(b);
  if (scenes.length === 0) return scenes;
  const narration = b.narration.join('');
  if (narration) {
    scenes[0].narration = narration;
    if (scenes.length > 1) {
      (scenes[0].notes ??= []).push(`「${b.heading}」は ${scenes.length} シーンに分かれたため、ナレーションは最初のシーンだけに付きました(項目を減らすか、見出しを分けてください)`);
    }
  }
  if (b.source) for (const s of scenes) s.source = b.source;
  return scenes;
};

/** 文章からシーンの並びを作る。title は最初の「# 見出し」 */
export const parseOutline = (text: string): { title: string; scenes: OutlineScene[] } => {
  const blocks = toBlocks(text);
  return {
    title: blocks.find((b) => b.level === 1)?.heading ?? '',
    scenes: blocks.flatMap(blockWithExtras),
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
