import type { FC } from 'react';
import type { z } from 'zod';

/** 部品の表示情報 */
export type PartMeta = {
  /** 一覧に出す名前 */
  name: string;
  /** どんな場面に使う部品か(1〜2 文) */
  description: string;
  /** シーンを追加したときの秒数 */
  defaultSeconds: number;
  /** 一覧での並び順(小さいほど上。省略すると最後尾でフォルダ名順) */
  order?: number;
  /**
   * 入力項目を変えたときの移行。保存済みのプロジェクトの古い入力値を受け取り、今の schema の形に直して返す。
   * 例: 項目名を title → heading に変えたら (p) => ({ ...p, heading: p.heading ?? p.title })
   */
  migrate?: (props: Record<string, unknown>) => Record<string, unknown>;
};

/** 部品のコンポーネントが受け取るもの */
export type PartProps<T> = {
  /** schema で検証・既定値の補完をした入力値 */
  props: T;
  /** シーンの先頭を 0 とした現在のフレーム */
  frame: number;
  /** シーンの長さ(フレーム数) */
  durationInFrames: number;
  fps: number;
  /**
   * ナレーションに合わせて項目を出すフレーム(i 番目の項目 → cues[i])。ナレーションの音声がないときは undefined。
   * 項目を順に出す部品は stagger(i, n, from, until, gap, cues) のように渡す。
   */
  cues?: readonly number[];
};

/** 部品の schema の型(必ず z.object) */
export type PartSchema = z.ZodObject;

/** schema から決まるコンポーネントの型。 export const Component: PartComponent<typeof schema> = ... と書く */
export type PartComponent<S extends PartSchema> = FC<PartProps<z.output<S>>>;
