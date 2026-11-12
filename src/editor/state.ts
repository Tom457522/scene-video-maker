/** エディタが扱うプロジェクトの状態(シーンには並べ替え用の key を付ける。保存時には外す) */
import type { Project, Scene, Settings } from '../video/project';
import { defaultProps, getPart, resolveProps, type PartDef } from '../parts/registry';
import { z } from 'zod';

export type EditorScene = Scene & { key: string };
export type EditorProject = { title: string; settings: Settings; scenes: EditorScene[] };

let keySeed = 0;
export const newKey = () => `s${Date.now().toString(36)}${(keySeed++).toString(36)}`;

export const fromProject = (p: Project): EditorProject => ({
  title: p.title,
  settings: p.settings,
  scenes: p.scenes.map((s) => ({ ...s, key: newKey() })),
});

export const toProject = (p: EditorProject): Project => ({
  title: p.title,
  settings: p.settings,
  scenes: p.scenes.map(({ part, seconds, props }) => ({ part, seconds, props })),
});

export const newScene = (part: PartDef): EditorScene => ({
  key: newKey(),
  part: part.id,
  seconds: part.meta.defaultSeconds,
  props: defaultProps(part),
});

/** 部品を切り替える。同じ名前で新しい部品にも当てはまる入力値は引き継ぐ */
export const switchPart = (scene: EditorScene, next: PartDef): EditorScene => {
  const props: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(next.schema.shape)) {
    const r = (schema as z.ZodType).safeParse(scene.props[key]);
    props[key] = r.success && scene.props[key] !== undefined ? r.data : (schema as z.ZodType).parse(undefined);
  }
  return { ...scene, part: next.id, props };
};

/** 一覧に出す 1 行の要約(最初の文字の入力項目) */
export const sceneSummary = (scene: Scene): string => {
  const part = getPart(scene.part);
  const props = part ? resolveProps(part, scene.props).props : scene.props;
  for (const v of Object.values(props)) {
    if (typeof v === 'string' && v.trim() !== '') return v.replace(/\[\[(.+?)\]\]/g, '$1');
    if (Array.isArray(v) && typeof v[0] === 'string') return String(v[0]).replace(/\[\[(.+?)\]\]/g, '$1');
  }
  return '';
};
