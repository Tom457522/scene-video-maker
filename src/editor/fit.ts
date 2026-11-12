/**
 * 入力値を部品の制限(文字数・個数・数値の範囲)に収める。文章から作ったシーンが、
 * 制限を超えて「既定値に置き換わる」のを防ぐ。収めたところは notes で知らせる。
 */
import type { z } from 'zod';
import { toJsonSchema, type JsonSchema } from './SchemaForm';

const typeOf = (s: JsonSchema): string | undefined => (Array.isArray(s.type) ? s.type[0] : s.type);

const fitValue = (s: JsonSchema, v: unknown, label: string, notes: string[]): unknown => {
  const t = typeOf(s);
  if (t === 'string' && typeof v === 'string') {
    if (s.maxLength !== undefined && Array.from(v).length > s.maxLength) {
      notes.push(`${label}: ${s.maxLength} 文字に切り詰めました`);
      return Array.from(v).slice(0, s.maxLength).join('');
    }
    return v;
  }
  if ((t === 'number' || t === 'integer') && typeof v === 'number') {
    if (s.maximum !== undefined && v > s.maximum) return s.maximum;
    if (s.minimum !== undefined && v < s.minimum) return s.minimum;
    return v;
  }
  if (t === 'array' && Array.isArray(v)) {
    let list = v;
    if (s.maxItems !== undefined && list.length > s.maxItems) {
      notes.push(`${label}: ${s.maxItems} 個までにしました`);
      list = list.slice(0, s.maxItems);
    }
    return list.map((x, i) => (s.items ? fitValue(s.items, x, `${label} ${i + 1}`, notes) : x));
  }
  if (t === 'object' && v && typeof v === 'object' && !Array.isArray(v)) {
    const obj = v as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(obj).map(([k, x]) => {
        const sub = s.properties?.[k];
        return [k, sub ? fitValue(sub, x, sub.title ?? k, notes) : x];
      }),
    );
  }
  return v;
};

export const fitToSchema = (schema: z.ZodObject, props: Record<string, unknown>): { props: Record<string, unknown>; notes: string[] } => {
  const notes: string[] = [];
  const out = fitValue(toJsonSchema(schema), props, '', notes) as Record<string, unknown>;
  return { props: out, notes: notes.map((n) => n.replace(/^: /, '')) };
};
