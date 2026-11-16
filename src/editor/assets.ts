/** 画像(projects/assets/)の一覧を、エディタ全体で共有する */
import { useEffect, useSyncExternalStore } from 'react';

export type AssetInfo = { name: string; size: number };

let list: AssetInfo[] = [];
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const refreshAssets = async (): Promise<void> => {
  const res = await fetch('/api/assets');
  const data = (await res.json()) as { assets?: AssetInfo[] };
  list = data.assets ?? [];
  loaded = true;
  emit();
};

export const useAssets = (): AssetInfo[] => {
  const value = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => list,
  );
  useEffect(() => {
    if (!loaded) void refreshAssets();
  }, []);
  return value;
};

/** ファイルを読み込んで保存し、保存した名前を返す */
export const uploadAsset = async (file: File): Promise<string> => {
  const data = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  const res = await fetch('/api/assets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: file.name, data }),
  });
  const body = (await res.json()) as { name?: string; error?: string };
  if (!res.ok || !body.name) throw new Error(body.error ?? `エラー (${res.status})`);
  await refreshAssets();
  return body.name;
};

/** エディタで画像を表示する URL(Vite が projects/assets/ を配信している) */
export const assetUrl = (name: string) => `/${encodeURIComponent(name)}`;

/** BGM の選択肢(server/bgm.ts の listBgm と同じ形) */
export type BgmChoice = { file: string; label: string; generated: boolean };

const postJson = async <T>(url: string, body: unknown): Promise<T> => {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `エラー (${res.status})`);
  return data;
};

export const listBgm = async (): Promise<BgmChoice[]> => {
  const res = await fetch('/api/bgm');
  return ((await res.json()) as { bgm?: BgmChoice[] }).bgm ?? [];
};

/** 自動で作る曲(audio/bgm-calm.wav など)を用意して、ファイルの場所を返す */
export const prepareMood = async (file: string): Promise<string> => {
  const mood = /^audio\/bgm-(\w+)\.wav$/.exec(file)?.[1] ?? '';
  return (await postJson<{ file: string }>('/api/bgm', { mood })).file;
};

/** 手持ちの曲を追加して、ファイルの場所を返す */
export const uploadBgm = async (file: File): Promise<string> => {
  const data = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  return (await postJson<{ file: string }>('/api/bgm/upload', { name: file.name, data })).file;
};

/** audio/ のようにフォルダを含む場所の URL */
export const audioUrl = (file: string) => `/${file.split('/').map(encodeURIComponent).join('/')}`;
