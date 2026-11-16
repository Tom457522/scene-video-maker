/**
 * ナレーションの文の扱い(音声合成の前後で使う、AI を使わない決まった処理)。
 *
 *   ▶            ここで画面の次の項目を出す(読み上げない)
 *   {表記|よみ}  画面と字幕には「表記」、読み上げには「よみ」を使う(例: {生成AI|せいせいエーアイ})
 *   [[語]]       強調の印は読み上げ・字幕では外す
 */
import { stripMarks } from '../kit/text';
import type { Scene } from './project';

export const CUE_MARK = '▶';

const RUBY = /\{([^{}|]+)\|([^{}|]+)\}/g;

/** 字幕に出す文(よみを外し、▶ と強調の印を消す) */
export const displayText = (narration: string): string =>
  stripMarks(narration.replace(RUBY, '$1')).replace(new RegExp(CUE_MARK, 'g'), '').replace(/\s+/g, ' ').trim();

/** 読み上げる文(よみに置き換え、▶ と強調の印を消し、記号を読みやすくする) */
export const speechText = (narration: string): string =>
  stripMarks(narration.replace(RUBY, '$2'))
    .replace(new RegExp(CUE_MARK, 'g'), '')
    .normalize('NFKC')
    .replace(/(\d)\s*%/g, '$1パーセント')
    .replace(/[「」『』()()【】"“”]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** ▶ の位置で区切る。最初の区切りは、最初の項目が出る前に話す文 */
export const splitAtCues = (narration: string): string[] => narration.split(CUE_MARK);

/** シーンの部品で、順に出てくる項目の文(▶ を自動で置くときの手がかり) */
export const cueItems = (part: string, props: Record<string, unknown>): string[] => {
  const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const rows = (v: unknown, key: string) =>
    Array.isArray(v) ? v.map((r) => (r && typeof r === 'object' ? String((r as Record<string, unknown>)[key] ?? '') : '')) : [];
  switch (part) {
    case 'bullets':
    case 'summary':
      return strs(props.items);
    case 'flow':
    case 'steps':
      return strs(props.steps);
    case 'timeline':
      return rows(props.events, 'what').map((what, i) => `${rows(props.events, 'when')[i]} ${what}`);
    case 'icons':
      return rows(props.cards, 'title').map((t, i) => `${t} ${rows(props.cards, 'text')[i]}`);
    case 'bars':
      return rows(props.rows, 'label');
    case 'table':
      return strs(props.rows).map((r) => r.split('|')[0]);
    default:
      return [];
  }
};

/** 項目の文から、ナレーションの中で探す手がかりの語(強調した語、なければ漢字・カタカナ・英数字の長い並び) */
const keywords = (item: string): string[] => {
  const marked = [...item.matchAll(/\[\[(.+?)\]\]/g)].map((m) => m[1]);
  const words = (stripMarks(item).normalize('NFKC').match(/[\p{Script=Han}\p{Script=Katakana}ーA-Za-z0-9.%]{2,}/gu) ?? []).sort((a, b) => b.length - a.length);
  // 漢字 1 字とかなの組み合わせ(「すぐに届く」など)も拾えるよう、4 字・3 字の切れ端も手がかりにする
  const plain = stripMarks(item).normalize('NFKC').replace(/\s+/g, '');
  const pieces: string[] = [];
  for (const len of [4, 3]) {
    for (let i = 0; i + len <= plain.length; i++) {
      const p = plain.slice(i, i + len);
      if (!/^[\p{Script=Hiragana}、。]+$/u.test(p)) pieces.push(p);
    }
  }
  return [...marked, ...words, ...pieces];
};

/**
 * ▶ がないナレーションに、項目ごとの ▶ を置く。項目の語がナレーションに出てくる文(読点・句点で区切った所)の頭に置く。
 * 見つからない項目には置かない(あとで前後の項目の間に均等に出す)。
 */
export const autoCues = (narration: string, items: string[]): string => {
  if (narration.includes(CUE_MARK) || items.length === 0) return narration;
  const text = narration;
  const norm = text.normalize('NFKC');
  const marks: number[] = [];
  let from = 0;
  for (const item of items) {
    let at = -1;
    for (const w of keywords(item)) {
      const i = norm.indexOf(w, from);
      if (i >= 0) {
        at = i;
        break;
      }
    }
    if (at < 0) continue;
    // その語を含む文の頭(直前の 。! ? の後ろ)に戻す。前の ▶ を越えてしまうなら、読点(、)の後ろまでにする
    const prev = marks.length > 0 ? marks[marks.length - 1] : -1;
    const back = (stops: RegExp) => {
      let i = at;
      while (i > 0 && !stops.test(norm[i - 1])) i--;
      return i;
    };
    let start = back(/[。!?!?\n]/);
    if (start <= prev) start = back(/[、。!?!?\n]/);
    if (start <= prev) start = Math.max(at, prev + 1);
    marks.push(start);
    from = at + 1;
  }
  if (marks.length === 0) return narration;
  // NFKC で長さが変わる文字はほとんど無いが、念のため元の文の位置として使える範囲に収める
  let out = '';
  let last = 0;
  for (const m of marks) {
    const pos = Math.min(m, text.length);
    out += text.slice(last, pos) + CUE_MARK;
    last = pos;
  }
  return out + text.slice(last);
};

/** 字幕の 1 行にする長さの目安(1 行 26 字前後、2 行まで) */
const LINE_MAX = 32;

/** 字幕にするため、文を句点で区切り、長い文は読点で分ける */
export const subtitleChunks = (text: string): string[] => {
  const sentences = text.match(/[^。!?!?]+[。!?!?]?/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
  const out: string[] = [];
  for (const s of sentences) {
    if (Array.from(s).length <= LINE_MAX) {
      out.push(s);
      continue;
    }
    let cur = '';
    for (const part of s.match(/[^、,]+[、,]?/g) ?? [s]) {
      if (cur && Array.from(cur + part).length > LINE_MAX) {
        out.push(cur);
        cur = '';
      }
      cur += part;
    }
    if (cur) out.push(cur);
  }
  return out;
};

export type Timed = { text: string; start: number; end: number };

/**
 * 区切りごとの音声の長さから、字幕の行と項目を出す時刻を決める(秒、音声の頭から)。
 * 区切りの中では、文字数に比例して時間を割り振る。
 */
export const timeSegments = (segments: string[], durations: number[]): { lines: Timed[]; cues: number[] } => {
  // 区切りごとの文字の範囲と時間。文字の位置 → 時刻は、区切りの中で文字数に比例させる
  const texts = segments.map(displayText);
  const ranges: { a: number; b: number; t0: number; d: number }[] = [];
  const cues: number[] = [];
  let pos = 0;
  let t = 0;
  texts.forEach((txt, i) => {
    const d = durations[i] ?? 0;
    if (i > 0) cues.push(t);
    const len = Array.from(txt).length;
    ranges.push({ a: pos, b: pos + len, t0: t, d });
    pos += len;
    t += d;
  });
  const timeAt = (c: number): number => {
    for (const r of ranges) {
      if (c < r.b || r === ranges[ranges.length - 1]) return r.t0 + (r.b > r.a ? (r.d * Math.min(1, Math.max(0, (c - r.a) / (r.b - r.a)))) : 0);
    }
    return t;
  };
  // 字幕は区切りに関係なく、全体の文を句点・読点で分けて作る(「まず、」だけの行ができないように)
  const full = Array.from(texts.join(''));
  const lines: Timed[] = [];
  let cursor = 0;
  for (const chunk of subtitleChunks(texts.join(''))) {
    const chars = Array.from(chunk);
    // full の中で chunk が始まる位置を探す(空白の違いは読み飛ばす)
    let start = cursor;
    while (start < full.length && full[start] !== chars[0]) start++;
    const end = Math.min(full.length, start + chars.length);
    lines.push({ text: chunk, start: timeAt(start), end: timeAt(end) });
    cursor = end;
  }
  // 行の間に隙間ができないよう、次の行の頭まで伸ばす
  for (let i = 0; i < lines.length - 1; i++) lines[i].end = lines[i + 1].start;
  if (lines.length > 0) lines[lines.length - 1].end = t;
  return { lines, cues };
};

/** 画面の項目を出すフレーム(シーンの頭から)。音声がなければ undefined(部品の既定の間隔で出す) */
export const cueFrames = (scene: Pick<Scene, 'audio'>, fps: number): number[] | undefined => {
  const a = scene.audio;
  if (!a || a.cues.length === 0) return undefined;
  // 話し始めるより少しだけ先に出す(目が先、耳が後のほうが自然に見える)
  return a.cues.map((c) => Math.max(0, Math.round((a.start + c) * fps) - 4));
};
