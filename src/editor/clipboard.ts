/**
 * シーンのコピーと貼り付け。ブラウザ(localStorage)に入れておくので、別のプロジェクトを開いても貼り付けられる。
 */
import { useSyncExternalStore } from 'react';
import { z } from 'zod';
import { sceneSchema, type Scene } from '../video/project';

const KEY = 'scene-video-maker:clipboard';
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

let cache: { raw: string | null; scenes: Scene[] | null } = { raw: null, scenes: null };

const getRaw = (): string | null => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

const parse = (raw: string | null): Scene[] | null => {
  try {
    const r = z.object({ scenes: z.array(sceneSchema).min(1) }).safeParse(JSON.parse(raw ?? 'null'));
    return r.success ? r.data.scenes : null;
  } catch {
    return null;
  }
};

/** 同じ中身なら同じ配列を返す(useSyncExternalStore が無駄に描き直さないように) */
const read = (): Scene[] | null => {
  const raw = getRaw();
  if (raw !== cache.raw) cache = { raw, scenes: parse(raw) };
  return cache.scenes;
};

export const copyScenes = (scenes: Scene[]): void => {
  const data = JSON.stringify({ scenes: scenes.map(({ part, seconds, props, chapter }) => ({ part, seconds, props, ...(chapter ? { chapter } : {}) })) });
  try {
    localStorage.setItem(KEY, data);
  } catch {
    /* 入れられなくても編集は続けられる */
  }
  emit();
};

export const readCopiedScenes = read;

/** コピーしてあるシーン(なければ null)。別のタブでコピーしたときも反映する */
export const useCopiedScenes = (): Scene[] | null =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      window.addEventListener('storage', l);
      return () => {
        listeners.delete(l);
        window.removeEventListener('storage', l);
      };
    },
    read,
  );
