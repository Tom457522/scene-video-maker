/**
 * 色・フォント・画面サイズの決まり。部品はここにある値だけを使い、色を独自に定義しない。
 */

export const VIDEO = { width: 1280, height: 720, fps: 30 } as const;

export const colors = {
  /** 背景 */
  bg: '#0E1630',
  /** 本文の文字 */
  text: '#F4F6FB',
  /** 補助の文字(サブタイトル・ラベルなど) */
  sub: '#B9C2E0',
  /** 黄(強調・マーカー) */
  yellow: '#FFC53D',
  /** 青緑 */
  teal: '#4FD1C5',
  /** 朱 */
  coral: '#FF7A59',
} as const;

export type ColorName = keyof typeof colors;

/** 順番に色を変えたいとき(棒グラフ・番号バッジなど)に使う、強調色の並び */
export const accentCycle = [colors.yellow, colors.teal, colors.coral] as const;

/** i 番目の強調色(はみ出したら先頭に戻る) */
export const accent = (i: number): string => accentCycle[((i % accentCycle.length) + accentCycle.length) % accentCycle.length];

/** #RRGGBB に透明度を付けた rgba() を返す。半透明の面や線はこれで作る */
export const alpha = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

/** パネル・カードの面と枠線 */
export const surface = {
  fill: alpha(colors.text, 0.06),
  fillStrong: alpha(colors.text, 0.1),
  border: alpha(colors.sub, 0.28),
} as const;

export const font = {
  family: '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", sans-serif',
  weight: { regular: 400, bold: 700, black: 900 },
  /** 文字サイズの目安(px)。はみ出し対策で自動縮小されるときは、これが上限になる */
  size: { hero: 96, heading: 52, body: 38, small: 28, caption: 30 },
} as const;

/** 画面の余白と配置の目安(px) */
export const layout = {
  padX: 96,
  /** 見出しの上端 */
  headingTop: 64,
  /** 見出しの下から本文を置き始める位置 */
  contentTop: 196,
  /** 本文を置ける下端(字幕の帯の上) */
  contentBottom: 620,
  /** 本文の最大幅 */
  contentWidth: 1280 - 96 * 2,
} as const;
