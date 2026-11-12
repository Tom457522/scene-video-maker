/**
 * プレビューをクリックして位置を決める(field.point)。入力欄が待ち受けを始め、プレビューがクリックを受け取る。
 */
import { useSyncExternalStore } from 'react';

type Pick = { label: string; onPick: (x: number, y: number) => void } | null;

let current: Pick = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const startPick = (label: string, onPick: (x: number, y: number) => void) => {
  current = { label, onPick };
  emit();
};

export const cancelPick = () => {
  current = null;
  emit();
};

/** プレビューがクリックされたとき(座標は 1280×720 の画面の px) */
export const finishPick = (x: number, y: number) => {
  const c = current;
  current = null;
  emit();
  c?.onPick(Math.round(Math.max(0, Math.min(1280, x))), Math.round(Math.max(0, Math.min(720, y))));
};

export const usePick = (): Pick =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
