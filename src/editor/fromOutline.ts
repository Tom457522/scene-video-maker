/** 文章(アウトライン)からエディタのシーンを作る(文章からシーンを作る・ひな形の両方で使う) */
import { getPart, type PartDef } from '../parts/registry';
import { recommendedSeconds } from '../video/reading';
import { fitToSchema } from './fit';
import { parseOutline } from './outline';
import { newKey, type EditorScene } from './state';

/**
 * lookup: 部品を名前で探す関数。エディタでは登録済みの部品(既定)、Node のコマンドでは
 * server/parts-node.ts で読んだ部品を渡す(Node では自動登録が働かないため)。
 */
export const outlineToScenes = (
  text: string,
  lookup: (id: string) => PartDef | undefined = getPart,
): { title: string; scenes: { scene: EditorScene; notes: string[] }[] } => {
  const parsed = parseOutline(text);
  const scenes: { scene: EditorScene; notes: string[] }[] = [];
  for (const s of parsed.scenes) {
    const found = lookup(s.part);
    const part = found ?? lookup('bullets');
    if (!part) continue;
    const extra = [...(s.notes ?? []), ...(found ? [] : [`部品「${s.part}」はないため、箇条書きにしました`])];
    const fitted = fitToSchema(part.schema, s.props);
    const merged = { ...(part.schema.parse({}) as Record<string, unknown>), ...fitted.props };
    scenes.push({
      scene: {
        key: newKey(),
        part: part.id,
        seconds: Math.min(60, Math.max(part.meta.defaultSeconds, recommendedSeconds(merged))),
        props: merged,
        ...(s.narration ? { narration: s.narration } : {}),
        ...(s.source ? { source: s.source } : {}),
      },
      notes: [...extra, ...fitted.notes],
    });
  }
  return { title: parsed.title, scenes };
};
