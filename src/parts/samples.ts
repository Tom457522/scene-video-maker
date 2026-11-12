/**
 * 部品の schema から、確かめ用の入力値を作る。
 *   - worstCase: 文字数・個数・数値をすべて上限にした「いちばん厳しい」入力(はみ出しの検査用)
 *   - minimalCase: 既定値のうえで、リストを最小の個数にした入力
 * 部品を作ったら、手で確認用のデータを用意しなくても `npm run stress` で厳しい入力を試せる。
 */
import { z } from 'zod';

type JS = {
  type?: string | string[];
  default?: unknown;
  enum?: unknown[];
  options?: Record<string, string>;
  multiline?: boolean;
  asset?: string;
  minimum?: number;
  maximum?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  items?: JS;
  properties?: Record<string, JS>;
};

/** 長い文の材料(漢字・かな・英数字を混ぜる) */
const FILLER = '分散型台帳のしくみをAIとBlockchainの例でわかりやすく説明するための長い文章です';
/** 上限を決めていない文字の項目に入れる長さ */
const DEFAULT_MAX = 80;
/** 上限を決めていないリストに入れる個数 */
const DEFAULT_ITEMS = 8;
/** 上限を決めていない数値 */
const DEFAULT_NUMBER = 9_876_543;

const typeOf = (s: JS) => (Array.isArray(s.type) ? s.type[0] : s.type);

const longText = (len: number, multiline: boolean, seed: number): string => {
  let out = '';
  let i = seed % FILLER.length;
  while (Array.from(out).length < len) {
    out += FILLER[i % FILLER.length];
    i++;
    // 複数行の項目は 36 文字ごとに改行を入れる(コードなど)
    if (multiline && Array.from(out).length % 36 === 35) out += '\n';
  }
  return Array.from(out).slice(0, len).join('');
};

const worst = (s: JS, seed: number): unknown => {
  const t = typeOf(s);
  if (s.asset) return '';
  if (s.enum) {
    // 表示名がいちばん長い選択肢
    return [...s.enum].sort((a, b) => String(s.options?.[String(b)] ?? b).length - String(s.options?.[String(a)] ?? a).length)[0];
  }
  if (t === 'string') return longText(s.maxLength ?? DEFAULT_MAX, !!s.multiline, seed);
  if (t === 'number' || t === 'integer') return s.maximum ?? DEFAULT_NUMBER;
  if (t === 'boolean') return true;
  if (t === 'array') {
    const n = s.maxItems ?? DEFAULT_ITEMS;
    return Array.from({ length: n }, (_, i) => worst(s.items ?? {}, seed + i * 7));
  }
  if (t === 'object') {
    return Object.fromEntries(Object.entries(s.properties ?? {}).map(([k, v], i) => [k, worst(v, seed + i * 3)]));
  }
  return s.default ?? null;
};

const toJS = (schema: z.ZodType): JS => z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as JS;

/** すべてを上限にした入力値(schema を満たす) */
export const worstCase = (schema: z.ZodObject): Record<string, unknown> => {
  const props = worst(toJS(schema), 0) as Record<string, unknown>;
  return schema.parse(props) as Record<string, unknown>;
};

/** 既定値のうえで、リストを最小の個数にした入力値 */
export const minimalCase = (schema: z.ZodObject): Record<string, unknown> => {
  const js = toJS(schema);
  const base = schema.parse({}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(js.properties ?? {})) {
    if (typeOf(v) === 'array' && Array.isArray(base[k])) base[k] = (base[k] as unknown[]).slice(0, Math.max(v.minItems ?? 1, 1));
  }
  return schema.parse(base) as Record<string, unknown>;
};
