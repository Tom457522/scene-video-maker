/** 全シーンの文字の一括置換 */
import type { EditorProject } from './state';

const mapStrings = (value: unknown, fn: (s: string) => string): unknown => {
  if (typeof value === 'string') return fn(value);
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mapStrings(v, fn)]));
  }
  return value;
};

const countIn = (s: string, find: string): number => (find === '' ? 0 : s.split(find).length - 1);

/** 置換の対象になる文字(タイトル・各シーンの入力値・チャンネル名・エンドカードの文) */
const targets = (p: EditorProject): string[] => {
  const out: string[] = [p.title, p.settings.channelName, p.settings.endCardMessage];
  mapStrings(
    p.scenes.map((s) => s.props),
    (s) => {
      out.push(s);
      return s;
    },
  );
  return out;
};

/** 見つかった数と、見つかったシーンの番号(0 始まり) */
export const findMatches = (p: EditorProject, find: string): { count: number; scenes: number[] } => {
  if (find === '') return { count: 0, scenes: [] };
  const count = targets(p).reduce((n, s) => n + countIn(s, find), 0);
  const scenes = p.scenes.flatMap((s, i) => {
    let n = 0;
    mapStrings(s.props, (x) => {
      n += countIn(x, find);
      return x;
    });
    return n > 0 ? [i] : [];
  });
  return { count, scenes };
};

/** すべて置き換える(部品の種類・秒数・テーマやロゴのファイル名は変えない) */
export const replaceAll = (p: EditorProject, find: string, replacement: string): EditorProject => {
  if (find === '') return p;
  const fn = (s: string) => s.split(find).join(replacement);
  return {
    ...p,
    title: fn(p.title),
    settings: { ...p.settings, channelName: fn(p.settings.channelName), endCardMessage: fn(p.settings.endCardMessage) },
    scenes: p.scenes.map((s) => ({ ...s, props: mapStrings(s.props, fn) as Record<string, unknown> })),
  };
};
