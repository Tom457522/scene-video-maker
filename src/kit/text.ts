/**
 * 文字のはみ出し対策と [[ ]] 強調の解析。
 * 実際の DOM を測らず文字の種類から幅を見積もるので、同じ入力なら必ず同じサイズになる。
 */

export type Segment = { text: string; marked: boolean };

/** "取引を[[ブロック]]にまとめる" → 強調の有無で区切った配列 */
export const parseMarks = (input: string): Segment[] => {
  const out: Segment[] = [];
  const re = /\[\[(.+?)\]\]/g;
  let last = 0;
  for (const m of input.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: input.slice(last, i), marked: false });
    out.push({ text: m[1], marked: true });
    last = i + m[0].length;
  }
  if (last < input.length) out.push({ text: input.slice(last), marked: false });
  return out;
};

/** [[ ]] を取り除いた文字列 */
export const stripMarks = (input: string): string => input.replace(/\[\[(.+?)\]\]/g, '$1');

/** 1 文字の幅の見積もり(em) */
const charWidth = (ch: string): number => {
  const c = ch.codePointAt(0) ?? 0;
  if (ch === ' ') return 0.3;
  if (c < 0x80) {
    if (/[A-Z0-9]/.test(ch)) return 0.66;
    if (/[il.,:;'!|]/.test(ch)) return 0.3;
    return 0.56;
  }
  // 半角カナ
  if (c >= 0xff61 && c <= 0xff9f) return 0.5;
  return 1;
};

/** 文字列の幅の見積もり(em) */
export const measureEm = (text: string): number => {
  let w = 0;
  for (const ch of stripMarks(text)) w += charWidth(ch);
  return w;
};

export type FitOptions = {
  /** 置ける幅(px) */
  maxWidth: number;
  /** 文字サイズの上限(px) */
  max: number;
  /** 文字サイズの下限(px)。これでも入らなければ maxLines を超えて折り返す */
  min?: number;
  /** 何行までに収めたいか */
  maxLines?: number;
  /** 文字間(em)。letter-spacing を付けるときに合わせる */
  letterSpacing?: number;
};

/** 指定した文字サイズで何行になるかの見積もり */
export const estimateLines = (text: string, fontSize: number, maxWidth: number, letterSpacing = 0): number => {
  const chars = Array.from(stripMarks(text)).length;
  const width = (measureEm(text) + letterSpacing * chars) * fontSize;
  // 文節で折り返すと行末に 1 文字ぶんほどの余りが出るので、1 行に使える幅を少し狭く見積もる
  const usable = Math.max(maxWidth * 0.6, maxWidth - fontSize * 1.2);
  return Math.max(1, Math.ceil((width * 1.04) / usable));
};

/**
 * 幅と行数に収まる最大の文字サイズを返す(2px 刻み)。
 * 長い文は自動で小さくなり、それでも入らないときは min のまま折り返す。
 */
export const fitFontSize = (text: string, opts: FitOptions): number => {
  const { maxWidth, max, min = Math.round(max * 0.5), maxLines = 1, letterSpacing = 0 } = opts;
  for (let size = max; size > min; size -= 2) {
    if (estimateLines(text, size, maxWidth, letterSpacing) <= maxLines) return size;
  }
  return min;
};

/** 複数の文を同じサイズでそろえたいとき(箇条書きなど)に、全部が収まるサイズを返す */
export const fitFontSizeAll = (texts: readonly string[], opts: FitOptions): number =>
  texts.reduce((size, t) => Math.min(size, fitFontSize(t, opts)), opts.max);

/**
 * 幅だけでなく高さにも収まる最大の文字サイズ(2px 刻み)。複数の文を同じサイズにそろえるときに使う。
 * 箱(行の高さ・枠)が決まっている所では、fitFontSize ではなくこちらを使うと、長い文でも枠からはみ出さない。
 */
export const fitFontSizeToBox = (
  texts: readonly string[],
  opts: { maxWidth: number; maxHeight: number; max: number; min?: number; lineHeight?: number; letterSpacing?: number },
): number => {
  const { maxWidth, maxHeight, max, min = 12, lineHeight = 1.4, letterSpacing = 0 } = opts;
  const fits = (size: number) => texts.every((t) => estimateLines(t, size, maxWidth, letterSpacing) * size * lineHeight <= maxHeight);
  for (let size = max; size > min; size -= 2) if (fits(size)) return size;
  return min;
};
