/**
 * 入力項目(schema)を書くための zod のひな形。
 * ここで付けた title などの情報から、エディタの設定フォームが自動で作られる。
 * 素の zod(z.string() など)もそのまま使えるが、項目名を出すには .meta({ title }) を付ける。
 */
import { z } from 'zod';

export { z };

/** フォームが読み取る追加情報(z.toJSONSchema の出力に入る) */
export type FieldMeta = {
  /** フォームに出す項目名 */
  title?: string;
  /** 補足説明 */
  description?: string;
  /** 複数行の入力欄にする */
  multiline?: boolean;
  /** [[ ]] で強調できることを案内する */
  marks?: boolean;
  /** 選択肢の表示名(値 → 表示名) */
  options?: Record<string, string>;
  /** 数値入力の刻み */
  step?: number;
  /** リストの 1 件の呼び名(「項目」「行」など) */
  itemTitle?: string;
  /** 'image' なら、画像を選ぶ・アップロードする入力欄にする */
  asset?: 'image';
  /** true なら、プレビューをクリックして位置を決める入力欄にする(field.point) */
  point?: boolean;
};

const MARK_HINT = '[[ ]] で囲んだ語にマーカーが引かれます';

export const field = {
  /** 1 行の文字 */
  text: (title: string, def: string, opts: { max?: number; marks?: boolean; description?: string } = {}) =>
    z
      .string()
      .max(opts.max ?? 80)
      .default(def)
      .meta({ title, marks: opts.marks, description: opts.description ?? (opts.marks ? MARK_HINT : undefined) } satisfies FieldMeta),

  /** 複数行の文字 */
  longText: (title: string, def: string, opts: { max?: number; marks?: boolean; description?: string } = {}) =>
    z
      .string()
      .max(opts.max ?? 200)
      .default(def)
      .meta({
        title,
        multiline: true,
        marks: opts.marks,
        description: opts.description ?? (opts.marks ? MARK_HINT : undefined),
      } satisfies FieldMeta),

  /** 数値 */
  number: (title: string, def: number, opts: { min?: number; max?: number; step?: number; description?: string } = {}) => {
    let s = z.number();
    if (opts.min !== undefined) s = s.min(opts.min);
    if (opts.max !== undefined) s = s.max(opts.max);
    return s.default(def).meta({ title, step: opts.step, description: opts.description } satisfies FieldMeta);
  },

  /** 画像(projects/assets/ のファイル名)。空文字は「画像なし」 */
  image: (title: string, opts: { description?: string } = {}) =>
    z
      .string()
      .max(200)
      .default('')
      .meta({ title, asset: 'image', description: opts.description } satisfies FieldMeta),

  /**
   * 画面の上の位置(x: 0〜1280、y: 0〜720 の px)。エディタではプレビューをクリックして決められる。
   * 部品では props.xxx.x / props.xxx.y をそのまま座標として使う。
   */
  point: (title: string, def: { x: number; y: number }, opts: { description?: string } = {}) =>
    z
      .object({ x: z.number().min(0).max(1280), y: z.number().min(0).max(720) })
      .default(def)
      .meta({ title, point: true, description: opts.description ?? 'プレビューをクリックして決められます' } satisfies FieldMeta),

  /** オン/オフ */
  toggle: (title: string, def: boolean, opts: { description?: string } = {}) =>
    z.boolean().default(def).meta({ title, description: opts.description } satisfies FieldMeta),

  /** 選択肢から 1 つ(options は 値 → 表示名) */
  choice: <const K extends string>(title: string, options: Record<K, string>, def: NoInfer<K>) =>
    z
      .enum(Object.keys(options) as [K, ...K[]])
      .default(def)
      .meta({ title, options } satisfies FieldMeta),

  /** 文字のリスト(箇条書きなど) */
  list: (
    title: string,
    def: string[],
    opts: { min?: number; max?: number; itemMax?: number; itemTitle?: string; marks?: boolean; description?: string } = {},
  ) =>
    z
      .array(z.string().max(opts.itemMax ?? 80))
      .min(opts.min ?? 1)
      .max(opts.max ?? 6)
      .default(def)
      .meta({
        title,
        itemTitle: opts.itemTitle ?? '項目',
        marks: opts.marks,
        description: opts.description ?? (opts.marks ? MARK_HINT : undefined),
      } satisfies FieldMeta),

  /** 複数の入力を持つ行のリスト(棒グラフの「ラベルと値」など) */
  rows: <S extends z.ZodRawShape>(
    title: string,
    shape: S,
    def: z.input<z.ZodObject<S>>[],
    opts: { min?: number; max?: number; itemTitle?: string; description?: string } = {},
  ) =>
    z
      .array(z.object(shape))
      .min(opts.min ?? 1)
      .max(opts.max ?? 6)
      .default(def as z.output<z.ZodObject<S>>[])
      .meta({ title, itemTitle: opts.itemTitle ?? '行', description: opts.description } satisfies FieldMeta),
};
