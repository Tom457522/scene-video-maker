/**
 * 部品の一覧。フォルダを置くだけで登録され、本体のコードは変更しなくてよい。
 */
import type { FC } from 'react';
import { z } from 'zod';
import type { PartMeta, PartProps } from '../kit/types';
import { partModules } from './modules';

export type PartDef = {
  /** フォルダ名(プロジェクト JSON の "part" に書く値) */
  id: string;
  meta: PartMeta;
  schema: z.ZodObject;
  Component: FC<PartProps<Record<string, unknown>>>;
};

export type PartLoadError = { id: string; message: string };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const load = () => {
  const parts: PartDef[] = [];
  const errors: PartLoadError[] = [];
  for (const [path, mod] of Object.entries(partModules)) {
    const id = path.split('/')[1];
    if (!isObject(mod)) continue;
    const { meta, schema, Component } = mod;
    const problems: string[] = [];
    if (!isObject(meta) || typeof meta.name !== 'string' || typeof meta.defaultSeconds !== 'number') problems.push('meta(name / description / defaultSeconds)');
    if (!(schema instanceof z.ZodObject)) problems.push('schema(z.object(...))');
    if (typeof Component !== 'function') problems.push('Component');
    if (problems.length > 0) {
      errors.push({ id, message: `${problems.join('、')} が export されていません` });
      continue;
    }
    if (!(schema as z.ZodObject).safeParse({}).success) {
      errors.push({ id, message: 'schema のすべての項目に既定値(.default)が必要です' });
      continue;
    }
    parts.push({ id, meta: meta as PartMeta, schema: schema as z.ZodObject, Component: Component as PartDef['Component'] });
  }
  parts.sort((a, b) => a.id.localeCompare(b.id));
  return { parts, errors };
};

const loaded = load();

/** 正しく読み込めた部品(フォルダ名順) */
export const parts: readonly PartDef[] = loaded.parts;
/** 読み込めなかった部品とその理由 */
export const partErrors: readonly PartLoadError[] = loaded.errors;

const byId = new Map(parts.map((p) => [p.id, p]));
export const getPart = (id: string): PartDef | undefined => byId.get(id);

/** schema の既定値だけでできた入力値 */
export const defaultProps = (part: PartDef): Record<string, unknown> => part.schema.parse({}) as Record<string, unknown>;

/**
 * 保存されている入力値を schema で検証し、足りない・不正な項目は既定値で補う。
 * 部品のコンポーネントには必ずこの結果を渡す。
 */
export const resolveProps = (part: PartDef, raw: unknown): { props: Record<string, unknown>; issues: z.core.$ZodIssue[] } => {
  const whole = part.schema.safeParse(raw ?? {});
  if (whole.success) return { props: whole.data as Record<string, unknown>, issues: [] };
  const src = isObject(raw) ? raw : {};
  const props: Record<string, unknown> = {};
  for (const [key, fieldSchema] of Object.entries(part.schema.shape)) {
    const r = (fieldSchema as z.ZodType).safeParse(src[key]);
    props[key] = r.success ? r.data : (fieldSchema as z.ZodType).parse(undefined);
  }
  return { props, issues: whole.error.issues };
};
