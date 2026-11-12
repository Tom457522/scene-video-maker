/**
 * 元に戻す/やり直しの履歴。
 * 文字入力のように細かく続く変更は、同じ group で 1 秒以内なら 1 つの操作にまとめる。
 */
import { useCallback, useReducer } from 'react';

const LIMIT = 100;
const MERGE_MS = 1000;

type State<T> = { past: T[]; present: T; future: T[]; group: string | null; at: number };

type Action<T> =
  | { type: 'set'; update: (prev: T) => T; group?: string; now: number }
  | { type: 'reset'; value: T }
  | { type: 'undo' }
  | { type: 'redo' };

const reducer = <T,>(s: State<T>, a: Action<T>): State<T> => {
  switch (a.type) {
    case 'set': {
      const next = a.update(s.present);
      if (Object.is(next, s.present)) return s;
      const merge = a.group !== undefined && a.group === s.group && a.now - s.at < MERGE_MS;
      if (merge) return { ...s, present: next, at: a.now };
      return {
        past: [...s.past, s.present].slice(-LIMIT),
        present: next,
        future: [],
        group: a.group ?? null,
        at: a.now,
      };
    }
    case 'reset':
      return { past: [], present: a.value, future: [], group: null, at: 0 };
    case 'undo': {
      if (s.past.length === 0) return s;
      return { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future], group: null, at: 0 };
    }
    case 'redo': {
      if (s.future.length === 0) return s;
      return { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1), group: null, at: 0 };
    }
  }
};

export const useHistory = <T,>(initial: T) => {
  const [state, dispatch] = useReducer(reducer<T>, { past: [], present: initial, future: [], group: null, at: 0 });
  /** 変更する。group を渡すと、同じ group の続けての変更を 1 つにまとめる */
  const set = useCallback((update: T | ((prev: T) => T), group?: string) => {
    const fn = typeof update === 'function' ? (update as (prev: T) => T) : () => update;
    dispatch({ type: 'set', update: fn, group, now: Date.now() });
  }, []);
  /** 履歴を消して置き換える(プロジェクトを開いたとき) */
  const reset = useCallback((value: T) => dispatch({ type: 'reset', value }), []);
  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const redo = useCallback(() => dispatch({ type: 'redo' }), []);
  return {
    value: state.present,
    set,
    reset,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
};
