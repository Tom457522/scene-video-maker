/** 文章(アウトライン)からエディタのシーンを作る(文章からシーンを作る・ひな形の両方で使う) */
import { getPart } from '../parts/registry';
import { recommendedSeconds } from '../video/reading';
import { fitToSchema } from './fit';
import { parseOutline } from './outline';
import { newKey, type EditorScene } from './state';

export const outlineToScenes = (text: string): { title: string; scenes: { scene: EditorScene; notes: string[] }[] } => {
  const parsed = parseOutline(text);
  const scenes: { scene: EditorScene; notes: string[] }[] = [];
  for (const s of parsed.scenes) {
    const part = getPart(s.part) ?? getPart('bullets');
    if (!part) continue;
    const fitted = fitToSchema(part.schema, s.props);
    const merged = { ...(part.schema.parse({}) as Record<string, unknown>), ...fitted.props };
    scenes.push({
      scene: {
        key: newKey(),
        part: part.id,
        seconds: Math.min(60, Math.max(part.meta.defaultSeconds, recommendedSeconds(merged))),
        props: merged,
      },
      notes: fitted.notes,
    });
  }
  return { title: parsed.title, scenes };
};
