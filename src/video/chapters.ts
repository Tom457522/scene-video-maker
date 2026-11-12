/**
 * 章(チャプター)。各シーンの見出し(heading / title)を章の名前にし、同じ見出しが続くシーンは 1 つの章にまとめる。
 * 動画の中の章の表示と、YouTube の概要欄に貼る「0:00 タイトル」の両方に使う。
 */
import { stripMarks } from '../kit/text';
import { VIDEO } from '../kit/theme';
import { sceneTimeline, type Project } from './project';

export type Chapter = { label: string; from: number; durationInFrames: number; scenes: number[] };

/** シーンの入力値から章の名前を決める(heading → title → 最初の文字の項目) */
export const chapterLabel = (props: Record<string, unknown>): string => {
  for (const key of ['heading', 'title']) {
    const v = props[key];
    if (typeof v === 'string' && v.trim() !== '') return stripMarks(v).trim();
  }
  for (const v of Object.values(props)) {
    if (typeof v === 'string' && v.trim() !== '' && !/\.(png|jpe?g|gif|webp|svg)$/i.test(v)) return stripMarks(v).trim();
  }
  return '';
};

/**
 * 章の一覧。resolve には「シーンの入力値を既定値で補ったもの」を返す関数を渡す
 * (部品の一覧に頼らず、テストでもそのまま使えるようにするため)。
 */
export const buildChapters = (
  project: Pick<Project, 'scenes'>,
  resolve: (i: number) => Record<string, unknown> = (i) => project.scenes[i].props,
): Chapter[] => {
  const timeline = sceneTimeline(project);
  const out: Chapter[] = [];
  project.scenes.forEach((_, i) => {
    const label = chapterLabel(resolve(i)) || `シーン ${i + 1}`;
    const last = out[out.length - 1];
    if (last && last.label === label) {
      last.durationInFrames += timeline[i].durationInFrames;
      last.scenes.push(i);
    } else out.push({ label, from: timeline[i].from, durationInFrames: timeline[i].durationInFrames, scenes: [i] });
  });
  return out;
};

/** YouTube の形式の時刻(1 時間未満は m:ss) */
export const youtubeTime = (frames: number): string => {
  const total = Math.floor(frames / VIDEO.fps);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

/** 概要欄に貼る文と、YouTube の章の条件を満たさないときの注意 */
export const youtubeChapters = (chapters: Chapter[]): { text: string; warnings: string[] } => {
  const text = chapters.map((c) => `${youtubeTime(c.from)} ${c.label}`).join('\n');
  const warnings: string[] = [];
  if (chapters.length < 3) warnings.push('YouTube の章になるには、3 つ以上の章が必要です。');
  const short = chapters.filter((c) => c.durationInFrames < 10 * VIDEO.fps);
  if (short.length > 0) {
    warnings.push(`YouTube の章は 1 つ 10 秒以上が必要です(短い章: ${short.map((c) => `「${c.label}」`).join('、')})。`);
  }
  return { text, warnings };
};
