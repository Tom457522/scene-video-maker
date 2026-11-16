/**
 * 画面で「次に何をすればよいか」を示すための決まりごと(React を使わないので単体テストできる)。
 * - シーンの種類の分け方(シーンを追加するときの絞り込み)
 * - 直したほうがよいところの一覧(上部の「確認 N 件」と、書き出す前の確認)
 * - シーンの種類を変えたときに引き継げなかった入力
 * - 書き出しの形式の、使う場面で選べる呼び方
 */
import { z } from 'zod';
import { getPart, resolveProps, type PartDef } from '../parts/registry';
import { MAX_SECONDS, type Scene } from '../video/project';
import { isTooShort, recommendedSeconds } from '../video/reading';
import type { ExportFormat, Quality } from '../remotion/composition-id';

export type PartGroup = { id: string; label: string; parts: string[] };

/** シーンの種類を、伝えたいことで分ける。ここにない種類(あとから足した部品)は「そのほか」になる */
export const PART_GROUPS: PartGroup[] = [
  { id: 'text', label: '文字で伝える', parts: ['title', 'bullets', 'summary', 'quote', 'qa'] },
  { id: 'flow', label: '手順・流れ', parts: ['flow', 'steps', 'timeline'] },
  { id: 'data', label: '数字・データ', parts: ['number', 'bars', 'line', 'pie', 'table'] },
  { id: 'show', label: '比べる・見せる', parts: ['compare', 'icons', 'image', 'code'] },
];
export const OTHER_GROUP = 'other';

export const groupOf = (partId: string): string => PART_GROUPS.find((g) => g.parts.includes(partId))?.id ?? OTHER_GROUP;

/** 種類を伝えたいことの順に並べる(分けていない種類は最後) */
export const sortByGroup = <T extends { id: string }>(parts: readonly T[]): T[] => {
  const order = PART_GROUPS.flatMap((g) => g.parts);
  const rank = (id: string) => (order.includes(id) ? order.indexOf(id) : order.length);
  return [...parts].sort((a, b) => rank(a.id) - rank(b.id));
};

export type Issue = {
  /** シーンの番号(0 から) */
  scene: number;
  kind: 'short' | 'props' | 'unknown';
  message: string;
  /** 「目安に合わせる」で入れる秒数 */
  fixSeconds?: number;
};

/** 直したほうがよいところの一覧 */
export const findIssues = (scenes: Scene[], lookup: (id: string) => PartDef | undefined = getPart): Issue[] =>
  scenes.flatMap((s, i): Issue[] => {
    const part = lookup(s.part);
    if (!part) return [{ scene: i, kind: 'unknown', message: `シーン ${i + 1}: 種類「${s.part}」が見つかりません` }];
    const r = resolveProps(part, s.props);
    const out: Issue[] = [];
    if (r.issues.length > 0) out.push({ scene: i, kind: 'props', message: `シーン ${i + 1}(${part.meta.name}): 入力の一部が使えないため、既定の値で出しています` });
    if (isTooShort(s.seconds, r.props)) {
      const rec = Math.min(MAX_SECONDS, recommendedSeconds(r.props));
      out.push({
        scene: i,
        kind: 'short',
        message: `シーン ${i + 1}(${part.meta.name})が ${s.seconds} 秒で、読み切るには短めです(目安 ${rec} 秒)`,
        fixSeconds: rec,
      });
    }
    return out;
  });

const filled = (v: unknown): boolean =>
  typeof v === 'string' ? v.trim() !== '' : Array.isArray(v) ? v.some(filled) : v && typeof v === 'object' ? Object.values(v).some(filled) : false;

/**
 * 種類を変えたときに引き継げなかった入力の名前(文字の入っている項目だけ)。
 * before は変える前の入力、after は変えたあとの入力
 */
export const lostFields = (beforePart: PartDef | undefined, before: Record<string, unknown>, after: Record<string, unknown>): string[] => {
  const props = beforePart
    ? ((z.toJSONSchema(beforePart.schema, { io: 'input', unrepresentable: 'any' }) as { properties?: Record<string, { title?: string }> }).properties ?? {})
    : {};
  return Object.entries(before)
    .filter(([k, v]) => filled(v) && JSON.stringify(after[k]) !== JSON.stringify(v))
    .map(([k]) => props[k]?.title ?? k);
};

/** 書き出しの形式を、使う場面で選べる呼び方にする */
export const FORMAT_CHOICES: { id: ExportFormat; name: string; detail: string }[] = [
  { id: '720p', name: 'ふつうの動画', detail: '横長 720p。YouTube や資料に' },
  { id: '1080p', name: 'きれいな動画', detail: '横長 1080p。大きな画面向け' },
  { id: 'vertical', name: 'ショート', detail: '縦長 9:16。スマホ向け' },
  { id: 'gif', name: 'GIF', detail: '選んでいるシーンだけを、くり返し再生' },
];

export const QUALITY_CHOICES: { id: Quality; name: string }[] = [
  { id: 'light', name: '小さめ(共有向け)' },
  { id: 'normal', name: 'ふつう' },
  { id: 'high', name: '大きめ(高画質)' },
];
