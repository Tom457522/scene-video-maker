/**
 * 読み切るのに必要な秒数の目安。画面に出る文字数から計算する(AI は使わない)。
 */
import { stripMarks } from '../kit/text';

/** 1 秒に読める文字数の目安(画面の短い文を拾い読みする速さ。1 分 600 字) */
export const CHARS_PER_SECOND = 10;
/** 登場の動き・退場に使う時間の目安(秒) */
const MOTION_SECONDS = 1.5;

/** 入力値に含まれる文字をすべて集める(数値や真偽値は除く。ファイル名らしい値も除く) */
export const collectText = (value: unknown): string[] => {
  if (typeof value === 'string') return /\.(png|jpe?g|gif|webp|svg)$/i.test(value) ? [] : [stripMarks(value)];
  if (Array.isArray(value)) return value.flatMap(collectText);
  if (value && typeof value === 'object') return Object.values(value).flatMap(collectText);
  return [];
};

/** 文字数(空白を除く) */
export const countChars = (props: unknown): number =>
  collectText(props).reduce((n, t) => n + Array.from(t.replace(/\s/g, '')).length, 0);

/** 読み切るまでの目安の秒数(0.5 秒刻みで切り上げ) */
export const recommendedSeconds = (props: unknown): number => {
  const sec = MOTION_SECONDS + countChars(props) / CHARS_PER_SECOND;
  return Math.max(2, Math.ceil(sec * 2) / 2);
};

/** 秒数が目安より明らかに短いか(目安の 4 分の 3 未満で警告。少しの不足では警告しない) */
export const isTooShort = (seconds: number, props: unknown): boolean => seconds < recommendedSeconds(props) * 0.75;
