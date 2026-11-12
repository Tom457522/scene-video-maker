/**
 * 部品の schema(zod)から設定フォームを自動で作る。
 * zod → JSON Schema に変換し、type と meta(title / multiline / options など)を見て入力欄を選ぶ。
 */
import { useMemo } from 'react';
import { z } from 'zod';

export type JsonSchema = {
  type?: string | string[];
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  options?: Record<string, string>;
  multiline?: boolean;
  marks?: boolean;
  step?: number;
  itemTitle?: string;
  minimum?: number;
  maximum?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
};

const cache = new WeakMap<z.ZodType, JsonSchema>();
export const toJsonSchema = (schema: z.ZodType): JsonSchema => {
  let js = cache.get(schema);
  if (!js) {
    js = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as JsonSchema;
    cache.set(schema, js);
  }
  return js;
};

const typeOf = (s: JsonSchema): string => (Array.isArray(s.type) ? s.type[0] : (s.type ?? (s.enum ? 'string' : 'unknown')));

/** 新しく 1 件足すときの値 */
const emptyValue = (s: JsonSchema): unknown => {
  if (s.default !== undefined) return structuredClone(s.default);
  if (s.enum) return s.enum[0];
  switch (typeOf(s)) {
    case 'string':
      return '';
    case 'number':
    case 'integer':
      return s.minimum ?? 0;
    case 'boolean':
      return false;
    case 'array':
      return [];
    case 'object':
      return Object.fromEntries(Object.entries(s.properties ?? {}).map(([k, v]) => [k, emptyValue(v)]));
    default:
      return null;
  }
};

const Hint = ({ schema, extra }: { schema: JsonSchema; extra?: string }) =>
  schema.description || extra ? (
    <div className="hint">
      {schema.description}
      {schema.description && extra ? ' / ' : ''}
      {extra}
    </div>
  ) : null;

type FieldProps = { schema: JsonSchema; value: unknown; onChange: (v: unknown) => void; label: string };

const TextField = ({ schema, value, onChange }: Omit<FieldProps, 'label'>) => {
  const v = typeof value === 'string' ? value : '';
  const max = schema.maxLength;
  const common = {
    value: v,
    maxLength: max,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
  };
  return schema.multiline ? <textarea rows={3} {...common} /> : <input type="text" {...common} />;
};

const NumberField = ({ schema, value, onChange }: Omit<FieldProps, 'label'>) => (
  <input
    type="number"
    value={typeof value === 'number' && Number.isFinite(value) ? value : ''}
    min={schema.minimum}
    max={schema.maximum}
    step={schema.step ?? 'any'}
    onChange={(e) => {
      if (e.target.value === '') return;
      const n = Number(e.target.value);
      if (Number.isFinite(n)) onChange(n);
    }}
  />
);

const ListField = ({ schema, value, onChange, label }: FieldProps) => {
  const list = Array.isArray(value) ? value : [];
  const item = schema.items ?? {};
  const min = schema.minItems ?? 0;
  const max = schema.maxItems ?? Infinity;
  const itemTitle = schema.itemTitle ?? '項目';
  const set = (next: unknown[]) => onChange(next);
  const move = (i: number, d: number) => {
    const next = [...list];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x);
    set(next);
  };
  const isObject = typeOf(item) === 'object';
  return (
    <div className="list">
      {list.map((v, i) => (
        <div key={i} className={isObject ? 'list-row card' : 'list-row'}>
          <div className="list-head">
            <span className="list-no">{i + 1}</span>
            {isObject ? <span className="list-title">{itemTitle}</span> : null}
            <span className="list-tools">
              <button type="button" title="上へ" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button type="button" title="下へ" disabled={i === list.length - 1} onClick={() => move(i, 1)}>↓</button>
              <button type="button" title="削除" disabled={list.length <= min} onClick={() => set(list.filter((_, j) => j !== i))}>×</button>
            </span>
          </div>
          <div className="list-body">
            <Field schema={item} value={v} label={`${label} ${i + 1}`} bare onChange={(nv) => set(list.map((x, j) => (j === i ? nv : x)))} />
          </div>
        </div>
      ))}
      <button type="button" className="add" disabled={list.length >= max} onClick={() => set([...list, emptyValue(item)])}>
        + {itemTitle}を追加{Number.isFinite(max) ? `(${list.length}/${max})` : ''}
      </button>
    </div>
  );
};

const ObjectFields = ({ schema, value, onChange }: Omit<FieldProps, 'label'>) => {
  const obj = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return (
    <div className="fields">
      {Object.entries(schema.properties ?? {}).map(([key, s]) => (
        <Field key={key} schema={s} label={s.title ?? key} value={obj[key]} onChange={(v) => onChange({ ...obj, [key]: v })} />
      ))}
    </div>
  );
};

const Field = ({ schema, value, onChange, label, bare }: FieldProps & { bare?: boolean }) => {
  let control;
  const t = typeOf(schema);
  if (schema.enum) {
    control = (
      <select value={String(value)} onChange={(e) => onChange(schema.enum!.find((x) => String(x) === e.target.value))}>
        {schema.enum.map((x) => (
          <option key={String(x)} value={String(x)}>
            {schema.options?.[String(x)] ?? String(x)}
          </option>
        ))}
      </select>
    );
  } else if (t === 'string') control = <TextField schema={schema} value={value} onChange={onChange} />;
  else if (t === 'number' || t === 'integer') control = <NumberField schema={schema} value={value} onChange={onChange} />;
  else if (t === 'boolean')
    control = (
      <label className="check">
        <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} /> {label}
      </label>
    );
  else if (t === 'array') control = <ListField schema={schema} value={value} onChange={onChange} label={label} />;
  else if (t === 'object') control = <ObjectFields schema={schema} value={value} onChange={onChange} />;
  else
    control = (
      <textarea
        rows={4}
        defaultValue={JSON.stringify(value, null, 2)}
        onBlur={(e) => {
          try {
            onChange(JSON.parse(e.target.value));
          } catch {
            /* 読めない JSON は無視 */
          }
        }}
      />
    );

  if (bare) return control;
  const range =
    schema.minimum !== undefined || schema.maximum !== undefined
      ? `${schema.minimum ?? ''}〜${schema.maximum ?? ''}`
      : undefined;
  return (
    <div className="field">
      {t !== 'boolean' && <div className="label">{label}</div>}
      {control}
      <Hint schema={schema} extra={range} />
    </div>
  );
};

/** schema のトップレベル(z.object)の各項目を並べる */
export const SchemaForm = ({
  schema,
  value,
  onChange,
}: {
  schema: z.ZodObject;
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) => {
  const js = useMemo(() => toJsonSchema(schema), [schema]);
  return <ObjectFields schema={js} value={value} onChange={(v) => onChange(v as Record<string, unknown>)} />;
};
