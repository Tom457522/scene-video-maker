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
