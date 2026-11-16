/**
 * 部品の schema(zod)から設定フォームを自動で作る。
 * zod → JSON Schema に変換し、type と meta(title / multiline / options など)を見て入力欄を選ぶ。
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { assetUrl, audioUrl, listBgm, prepareMood, uploadAsset, uploadBgm, useAssets, type BgmChoice } from './assets';
import { cancelPick, startPick, usePick } from './pick';
import { Icon, ICON_OPTIONS } from '../kit/icons';
import { showAlert } from './dialogs';

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
  asset?: 'image' | 'audio';
  enabledBy?: string;
  point?: boolean;
  icon?: boolean;
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

/** 選んだ範囲を [[ ]] で囲む(何も選んでいなければ [[]] を入れて中にカーソルを置く) */
export const wrapMarks = (text: string, from: number, to: number): { text: string; from: number; to: number } => {
  const a = Math.min(from, to);
  const b = Math.max(from, to);
  const inner = text.slice(a, b);
  // すでに [[ ]] で囲まれていれば外す
  if (text.slice(a - 2, a) === '[[' && text.slice(b, b + 2) === ']]') {
    return { text: text.slice(0, a - 2) + inner + text.slice(b + 2), from: a - 2, to: b - 2 };
  }
  return { text: `${text.slice(0, a)}[[${inner}]]${text.slice(b)}`, from: a + 2, to: b + 2 };
};

/**
 * wrap: 一覧の 1 項目のように幅が狭い欄では、1 行の入力欄の代わりに折り返して全文が見える欄にする
 * (改行は入れられない。高さは文の長さに合わせて伸びる)
 */
const TextField = ({ schema, value, onChange, wrap }: Omit<FieldProps, 'label'> & { wrap?: boolean }) => {
  const v = typeof value === 'string' ? value : '';
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const grow = wrap && !schema.multiline;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!grow || !el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [grow, v]);
  const emphasize = () => {
    const el = ref.current;
    if (!el) return;
    const r = wrapMarks(v, el.selectionStart ?? v.length, el.selectionEnd ?? v.length);
    if (schema.maxLength !== undefined && r.text.length > schema.maxLength) return;
    onChange(r.text);
    // 値が反映されたあとで、囲んだ語を選んだ状態に戻す
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(r.from, r.to);
    });
  };
  const common = {
    ref,
    value: v,
    maxLength: schema.maxLength,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    onKeyDown: (e: React.KeyboardEvent) => {
      // 折り返す欄でも 1 行の文なので、Enter で改行しない
      if (grow && e.key === 'Enter') e.preventDefault();
      if (schema.marks && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        emphasize();
      }
    },
  };
  const input = schema.multiline ? (
    <textarea rows={3} {...common} />
  ) : grow ? (
    <textarea rows={1} className="wrap-input" {...common} onChange={(e) => onChange(e.target.value.replace(/\r?\n/g, ' '))} />
  ) : (
    <input type="text" {...common} />
  );
  if (!schema.marks) return input;
  return (
    <div className="with-mark">
      {input}
      <button
        type="button"
        className="mark-btn"
        title="選んだ語を [[ ]] で囲んで強調(Ctrl+B)。もう一度押すと外す"
        onMouseDown={(e) => e.preventDefault()}
        onClick={emphasize}
      >
        強調
      </button>
    </div>
  );
};

/** 画像を選ぶ・アップロードする */
/** BGM: 自動で作る曲か、追加した手持ちの曲を選ぶ */
const BgmField = ({ value, onChange }: Omit<FieldProps, 'label' | 'schema'>) => {
  const v = typeof value === 'string' ? value : '';
  const [choices, setChoices] = useState<BgmChoice[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void listBgm().then(setChoices, () => setChoices([]));
  }, []);
  const choose = async (file: string) => {
    const c = choices.find((x) => x.file === file);
    if (!c?.generated) return onChange(file);
    // 自動で作る曲は、選んだときに作る(数秒かかる)
    setBusy(true);
    try {
      onChange(await prepareMood(file));
    } catch (err) {
      void showAlert('曲を用意できませんでした', (err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="asset-field bgm-field">
      <div className="asset-row">
        <select value={v} disabled={busy} onChange={(e) => void choose(e.target.value)} aria-label="BGM">
          <option value="">(なし)</option>
          {v && !choices.some((c) => c.file === v) && <option value={v}>{v.replace(/^audio\//, '')}(見つかりません)</option>}
          {choices.map((c) => (
            <option key={c.file} value={c.file}>
              {c.label}
            </option>
          ))}
        </select>
        <label className={busy ? 'upload busy' : 'upload'}>
          {busy ? '用意中…' : '曲を追加'}
          <input
            type="file"
            accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/ogg,.mp3,.wav,.m4a,.aac,.ogg"
            hidden
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              setBusy(true);
              try {
                const saved = await uploadBgm(file);
                setChoices(await listBgm());
                onChange(saved);
              } catch (err) {
                void showAlert('曲を追加できませんでした', (err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
      </div>
      {v && <audio className="bgm-preview" src={audioUrl(v)} controls preload="none" />}
    </div>
  );
};

const AssetField = ({ value, onChange }: Omit<FieldProps, 'label' | 'schema'>) => {
  const assets = useAssets();
  const v = typeof value === 'string' ? value : '';
  const [busy, setBusy] = useState(false);
  return (
    <div className="asset-field">
      <div className="asset-row">
        <select value={v} onChange={(e) => onChange(e.target.value)}>
          <option value="">(なし)</option>
          {v && !assets.some((a) => a.name === v) && <option value={v}>{v}(見つかりません)</option>}
          {assets.map((a) => (
            <option key={a.name} value={a.name}>
              {a.name}
            </option>
          ))}
        </select>
        <label className={busy ? 'upload busy' : 'upload'}>
          {busy ? '追加中…' : '画像を追加'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            hidden
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              setBusy(true);
              try {
                onChange(await uploadAsset(file));
              } catch (err) {
                void showAlert('画像を追加できませんでした', (err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
      </div>
      {v && <img className="asset-preview" src={assetUrl(v)} alt="" />}
    </div>
  );
};

/** アイコンを選ぶ(field.icon) */
const IconField = ({ value, onChange }: Omit<FieldProps, 'schema' | 'label'>) => {
  const [open, setOpen] = useState(false);
  const v = typeof value === 'string' ? value : '';
  return (
    <div className="icon-field">
      <button type="button" className="icon-current" onClick={() => setOpen((o) => !o)} title="アイコンを選ぶ">
        <Icon name={v} size={22} />
        <span>{(ICON_OPTIONS as Record<string, string>)[v] ?? v}</span>
        <span className="muted">▾</span>
      </button>
      {open && (
        <div className="icon-grid">
          {Object.entries(ICON_OPTIONS).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={id === v ? 'on' : ''}
              title={label}
              onClick={() => {
                onChange(id);
                setOpen(false);
              }}
            >
              <Icon name={id} size={22} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/** 画面の上の位置(field.point)。プレビューをクリックして決めるか、数値で打つ */
const PointField = ({ value, onChange, label }: Omit<FieldProps, 'schema'>) => {
  const pick = usePick();
  const v = value && typeof value === 'object' ? (value as { x?: unknown; y?: unknown }) : {};
  const x = typeof v.x === 'number' ? v.x : 640;
  const y = typeof v.y === 'number' ? v.y : 360;
  const picking = pick?.label === label;
  return (
    <div className="point-field">
      <button
        type="button"
        className={picking ? 'primary' : ''}
        onClick={() => (picking ? cancelPick() : startPick(label, (nx, ny) => onChange({ x: nx, y: ny })))}
      >
        {picking ? 'プレビューをクリック…(Esc でやめる)' : '🎯 プレビューをクリックして決める'}
      </button>
      <label>
        横 <input type="number" min={0} max={1280} value={x} onChange={(e) => e.target.value !== '' && onChange({ x: Number(e.target.value), y })} />
      </label>
      <label>
        縦 <input type="number" min={0} max={720} value={y} onChange={(e) => e.target.value !== '' && onChange({ x, y: Number(e.target.value) })} />
      </label>
    </div>
  );
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
  // [[ ]] の案内はリスト全体に付くので、1 件ずつの入力欄にも引き継ぐ
  const item: JsonSchema = { ...(schema.items ?? {}), marks: schema.items?.marks ?? schema.marks };
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
      {Object.entries(schema.properties ?? {}).map(([key, s]) => {
        const field = <Field key={key} schema={s} label={s.title ?? key} value={obj[key]} onChange={(v) => onChange({ ...obj, [key]: v })} />;
        // オン/オフ(または空欄かどうか)で使わない欄は、入力できないようにする
        const off = s.enabledBy !== undefined && !obj[s.enabledBy];
        if (!off) return field;
        const owner = schema.properties?.[s.enabledBy!]?.title ?? s.enabledBy;
        return (
          <fieldset key={key} className="field-off" disabled title={`「${owner}」を使うときに入力できます`}>
            {field}
          </fieldset>
        );
      })}
    </div>
  );
};

const Field = ({ schema, value, onChange, label, bare }: FieldProps & { bare?: boolean }) => {
  let control;
  const t = typeOf(schema);
  if (schema.asset === 'image') control = <AssetField value={value} onChange={onChange} />;
  else if (schema.asset === 'audio') control = <BgmField value={value} onChange={onChange} />;
  else if (schema.point) control = <PointField value={value} onChange={onChange} label={label} />;
  else if (schema.icon) control = <IconField value={value} onChange={onChange} />;
  else if (schema.enum || (schema.options && t === 'string')) {
    const choices = schema.enum ?? Object.keys(schema.options ?? {});
    control = (
      <select value={String(value)} onChange={(e) => onChange(choices.find((x) => String(x) === e.target.value))}>
        {choices.map((x) => (
          <option key={String(x)} value={String(x)}>
            {schema.options?.[String(x)] ?? String(x)}
          </option>
        ))}
      </select>
    );
  } else if (t === 'string') control = <TextField schema={schema} value={value} onChange={onChange} wrap={bare} />;
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
