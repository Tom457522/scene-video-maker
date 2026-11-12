/**
 * プロジェクト(= 1 本の動画)の形。projects/<名前>.json に保存する。
 */
import { z } from 'zod';
import { VIDEO, themes } from '../kit/theme.ts';
import { field } from '../kit/fields.ts';

export const MIN_SECONDS = 1;
export const MAX_SECONDS = 60;

export const sceneSchema = z.object({
  part: z.string().min(1),
  seconds: z.number().min(MIN_SECONDS).max(MAX_SECONDS),
  props: z.record(z.string(), z.unknown()).default({}),
});

/** 動画全体の設定(テーマ・章の表示・チャンネル名とロゴ・エンドカード) */
export const settingsSchema = z.object({
  theme: z
    .string()
    .max(40)
    .default('navy')
    .meta({ title: 'テーマ', options: Object.fromEntries(Object.entries(themes).map(([id, t]) => [id, t.name])) }),
  chapters: field.toggle('章の表示', false, { description: '右上に今の章(見出し)、下の端に進み具合を出す' }),
  channelName: field.text('チャンネル名', '', { max: 40, description: '右上とエンドカードに出す。空欄なら出さない' }),
  logo: field.image('ロゴ画像', { description: '右上とエンドカードに出す' }),
  endCard: field.toggle('エンドカード', false, { description: '最後に 4 秒の締めの画面を付ける' }),
  endCardMessage: field.text('エンドカードの文', 'ご視聴ありがとうございました', { max: 60 }),
});

export const projectSchema = z.object({
  title: z.string().max(100).default(''),
  settings: settingsSchema.prefault({}),
  scenes: z.array(sceneSchema).max(200).default([]),
});

export type Scene = z.output<typeof sceneSchema>;
export type Project = z.output<typeof projectSchema>;
export type Settings = z.output<typeof settingsSchema>;

/** 既定の設定 */
export const defaultSettings = (): Settings => settingsSchema.parse({});

export const sceneFrames = (scene: Pick<Scene, 'seconds'>): number => Math.max(1, Math.round(scene.seconds * VIDEO.fps));

/** 各シーンの開始フレームと長さ */
export const sceneTimeline = (project: Pick<Project, 'scenes'>): { from: number; durationInFrames: number }[] => {
  let from = 0;
  return project.scenes.map((s) => {
    const durationInFrames = sceneFrames(s);
    const item = { from, durationInFrames };
    from += durationInFrames;
    return item;
  });
};

/** シーンだけのフレーム数 */
export const scenesFrames = (project: Pick<Project, 'scenes'>): number => project.scenes.reduce((sum, s) => sum + sceneFrames(s), 0);

/** エンドカードの長さ(フレーム) */
export const END_CARD_FRAMES = 4 * VIDEO.fps;

/** 動画全体のフレーム数(エンドカードを含む。シーンが無いときも 1 フレームは作る) */
export const totalFrames = (project: Pick<Project, 'scenes'> & { settings?: Pick<Settings, 'endCard'> }): number =>
  Math.max(1, scenesFrames(project) + (project.settings?.endCard ? END_CARD_FRAMES : 0));

/** 秒数を "1:05.5" の形で表す */
export const formatSeconds = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  const ss = (Math.round(s * 10) / 10).toFixed(1).padStart(4, '0');
  return `${m}:${ss}`;
};
