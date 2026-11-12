/**
 * 動きの決まり。すべて「フレーム番号 → 値」の純粋な関数で、同じフレームなら必ず同じ値になる。
 * CSS transition・setTimeout・Math.random などは使わない。
 */
import { Easing, interpolate } from 'remotion';

export type Ease = (t: number) => number;

export const ease = {
  linear: (t: number) => t,
  /** 速く始まりゆっくり止まる(ほとんどの登場に使う) */
  out: Easing.bezier(0.22, 1, 0.36, 1) as Ease,
  /** ゆっくり始まりゆっくり止まる(移動・漂う動き) */
  inOut: Easing.bezier(0.65, 0, 0.35, 1) as Ease,
  /** ゆっくり始まり速く抜ける(退場) */
  in: Easing.bezier(0.55, 0, 1, 0.45) as Ease,
  /** 行き過ぎて戻る(ポンと出る登場) */
  back: Easing.bezier(0.34, 1.56, 0.64, 1) as Ease,
} as const;

/** 動きの長さの目安(フレーム数、30fps) */
export const T = {
  /** 1 つの要素が登場しきるまで */
  enter: 18,
  /** 要素どうしの間隔 */
  beat: 8,
  /** 線を描ききるまで */
  draw: 20,
  /** シーン終わりの退場 */
  exit: 12,
} as const;

/**
 * start フレームから duration フレームかけて 0 → 1 に進む値(範囲外は 0 / 1 で止まる)。
 * すべての動きの基本。
 */
export const progress = (frame: number, start: number, duration: number = T.enter, easing: Ease = ease.out): number => {
  if (duration <= 0) return frame >= start ? 1 : 0;
  return interpolate(frame, [start, start + duration], [0, 1], {
    easing,
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
};

/** 0 → 1 の進み具合 p を from → to の値に変える */
export const mix = (p: number, from: number, to: number): number => from + (to - from) * p;

/** 行き過ぎて戻る登場(0 → 1、途中で 1 を少し超える) */
export const back = (frame: number, start: number, duration: number = T.enter): number => progress(frame, start, duration, ease.back);

/**
 * ポンと一瞬ふくらんで戻る(0 → 1 → 0)。scale に 1 + bump * 0.15 のように足して使う。
 */
export const bump = (frame: number, at: number, duration: number = 10): number => {
  if (frame < at || frame > at + duration) return 0;
  return Math.sin(((frame - at) / duration) * Math.PI);
};

/**
 * 線を描く。SVG の stroke-dasharray / stroke-dashoffset にそのまま渡す値を返す。
 * length は線の長さ(pathLength={1} にしたなら 1)。
 */
export const draw = (frame: number, start: number, duration: number = T.draw, length = 1) => {
  const p = progress(frame, start, duration, ease.inOut);
  return { strokeDasharray: length, strokeDashoffset: length * (1 - p), progress: p };
};

/**
 * n 個の要素を順に出すときの i 番目の開始フレーム。
 * from から始めて、間隔は gap。ただし最後の要素が until までに出るよう間隔を詰める。
 * (シーンを短くしても、見どころの 70% 地点までに全部出そろうようにするため)
 */
export const stagger = (i: number, n: number, from: number, until: number, gap: number = T.beat * 2): number => {
  if (n <= 1) return from;
  const step = Math.min(gap, Math.max(0, until - from) / (n - 1));
  return from + i * step;
};

/** シーンの長さから「ここまでに登場を終える」フレームを決める(既定: 全体の 55%) */
export const settleBy = (durationInFrames: number, ratio = 0.55): number => Math.max(T.enter, Math.floor(durationInFrames * ratio));

/** ゆっくり漂う動き(-1 〜 1)。period はフレーム数、phase は 0〜1 */
export const drift = (frame: number, period: number, phase = 0): number => Math.sin((frame / period + phase) * Math.PI * 2);

/** 0 → 1 → 0 を繰り返す往復(粒の行き来など)。period は片道のフレーム数 */
export const pingPong = (frame: number, period: number): number => {
  const t = (((frame / period) % 2) + 2) % 2;
  return t <= 1 ? t : 2 - t;
};

/** 数字のカウントアップ表示。小数の桁数は decimals で決める */
export const countUp = (p: number, value: number, decimals = 0): string =>
  (value * p).toLocaleString('ja-JP', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/** シーン終わりの退場の進み具合(0 → 1)。SceneFrame が使う */
export const exitProgress = (frame: number, durationInFrames: number): number =>
  progress(frame, durationInFrames - T.exit, T.exit, ease.in);
