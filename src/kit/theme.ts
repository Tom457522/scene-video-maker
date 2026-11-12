/**
 * 色・フォント・画面サイズの決まり。部品はここにある値だけを使い、色を独自に定義しない。
 */

export const VIDEO = { width: 1280, height: 720, fps: 30 } as const;

/** テーマ(色の組み合わせ)。動画全体の設定で選ぶ。部品は colors を通して今のテーマの色を使う */
export type Theme = {
  name: string;
  bg: string;
  text: string;
  sub: string;
  yellow: string;
  teal: string;
  coral: string;
  /** 強調色(黄・青緑・朱)の上に載せる文字の色 */
  onAccent: string;
};

export const themes = {
  navy: {
    name: 'ネイビー(標準)',
    bg: '#0E1630',
    text: '#F4F6FB',
    sub: '#B9C2E0',
    yellow: '#FFC53D',
    teal: '#4FD1C5',
    coral: '#FF7A59',
    onAccent: '#0E1630',
  },
  light: {
    name: 'ライト',
    bg: '#F5F7FC',
    text: '#18213F',
    sub: '#56608A',
    // 明るい背景でも読めるよう、強調色は暗めにする(背景・白い文字とのコントラスト比 3.9 以上)
    yellow: '#A86F00',
    teal: '#0B7F72',
    coral: '#C9432A',
    onAccent: '#FFFFFF',
  },
  black: {
    name: 'ブラック',
    bg: '#0B0B0F',
    text: '#F5F5F7',
    sub: '#A1A1AA',
    yellow: '#FACC15',
    teal: '#2DD4BF',
    coral: '#FB7185',
    onAccent: '#0B0B0F',
  },
  forest: {
    name: 'フォレスト',
    bg: '#0F2A23',
    text: '#F1F7F4',
    sub: '#A9C7BC',
    yellow: '#F2C14E',
    teal: '#6FD3B4',
    coral: '#F28C6B',
    onAccent: '#0F2A23',
  },
} satisfies Record<string, Theme>;

export type ThemeId = keyof typeof themes;

let current: Theme = themes.navy;

/**
 * 今のテーマを切り替える。動画の土台(Stage)が描画のはじめに呼ぶので、部品から呼ぶ必要はない。
 * 同じプロジェクトなら必ず同じテーマになるので、「同じフレームは同じ絵」は保たれる。
 */
export const setTheme = (id: string): void => {
  current = (themes as Record<string, Theme>)[id] ?? themes.navy;
};

/** 今のテーマの色。部品はここにある色だけを使い、色を独自に定義しない */
export const colors = {
  /** 背景 */
  get bg() {
    return current.bg;
  },
  /** 本文の文字 */
  get text() {
    return current.text;
  },
  /** 補助の文字(サブタイトル・ラベルなど) */
  get sub() {
    return current.sub;
  },
  /** 黄(強調・マーカー) */
  get yellow() {
    return current.yellow;
  },
  /** 青緑 */
  get teal() {
    return current.teal;
  },
  /** 朱 */
  get coral() {
    return current.coral;
  },
  /** 強調色の上に載せる文字(番号バッジの数字など) */
  get onAccent() {
    return current.onAccent;
  },
};

export type ColorName = keyof typeof colors;

/** i 番目の強調色(黄 → 青緑 → 朱 の順。はみ出したら先頭に戻る) */
export const accent = (i: number): string => {
  const list = [current.yellow, current.teal, current.coral];
  return list[((i % list.length) + list.length) % list.length];
};

/** #RRGGBB に透明度を付けた rgba() を返す。半透明の面や線はこれで作る */
export const alpha = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

/** パネル・カードの面と枠線 */
export const surface = {
  get fill() {
    return alpha(colors.text, 0.06);
  },
  get fillStrong() {
    return alpha(colors.text, 0.1);
  },
  get border() {
    return alpha(colors.sub, 0.28);
  },
};

export const font = {
  family: '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", sans-serif',
  /** コード用の等幅フォント(日本語は Noto Sans JP で表示) */
  mono: '"JetBrains Mono", "Noto Sans JP", Consolas, monospace',
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
  /** 字幕(Caption、2 行まで)を出すときに本文を置ける下端 */
  contentBottom: 568,
  /** 字幕を出さないときに本文を置ける下端 */
  contentBottomFull: 664,
  /** 本文の最大幅 */
  contentWidth: 1280 - 96 * 2,
} as const;
