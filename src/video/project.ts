/**
 * プロジェクト(= 1 本の動画)の形。projects/<名前>.json に保存する。
 */
import { z } from 'zod';
import { VIDEO, themes } from '../kit/theme.ts';
import { field } from '../kit/fields.ts';

export const MIN_SECONDS = 1;
export const MAX_SECONDS = 60;

/** シーンのナレーション音声。file は projects/assets/ からの相対パス */
export const sceneAudioSchema = z.object({
  file: z.string().max(200),
  /** 話し始める時刻(秒) */
  start: z.number().min(0).max(MAX_SECONDS),
  /** 音声の長さ(秒) */
  duration: z.number().min(0).max(MAX_SECONDS),
  /** 画面の項目を出す時刻(秒)。▶ の位置で決まる */
  cues: z.array(z.number().min(0).max(MAX_SECONDS)).max(20).default([]),
  /** 字幕の区切り(読み上げた文と、その開始・終了の秒) */
  lines: z.array(z.object({ text: z.string().max(200), start: z.number(), end: z.number() })).max(60).default([]),
});

export const sceneSchema = z.object({
  part: z.string().min(1),
  seconds: z.number().min(MIN_SECONDS).max(MAX_SECONDS),
  props: z.record(z.string(), z.unknown()).default({}),
  /** このシーンから新しい章にするときの章の名前(省略すると見出しから自動で決める) */
  chapter: z.string().max(40).optional(),
  /** 読み上げる文(▶ の位置で、画面の項目を 1 つずつ出す)。npm run make が音声にする */
  narration: z.string().max(800).optional(),
  /** 画面の下に小さく出す出典 */
  source: z.string().max(120).optional(),
  /** ナレーションの音声(npm run make が作る)。秒数はすべてシーンの先頭から */
  audio: sceneAudioSchema.optional(),
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
  transition: z
    .string()
    .max(20)
    .default('slide')
    .meta({
      title: 'シーンの切り替え',
      options: { slide: '左へ流れる', fade: 'フェード', wipe: 'ワイプ', zoom: 'ズーム', none: '動きなし' },
      description: '各シーンの終わりの消え方(速さは自動で決まる)',
    }),
  subtitles: field.toggle('ナレーションの字幕', true, { description: 'ナレーションの音声があるシーンで、話している文を下に出す' }),
  bgm: z.string().max(200).default('').meta({ title: 'BGM', description: 'projects/assets/ の音声ファイル(npm run make の --bgm で作る)' }),
  bgmVolume: field.number('BGM の音量', 0.1, { min: 0, max: 1, step: 0.05, description: '0〜1。ナレーションの間は自動で下がる' }),
  sfx: field.toggle('効果音', true, { description: 'ナレーションに合わせて項目が出るときに小さな音を鳴らす' }),
});

export const projectSchema = z.object({
  title: z.string().max(100).default(''),
  settings: settingsSchema.prefault({}),
  scenes: z.array(sceneSchema).max(200).default([]),
});

export type SceneAudio = z.output<typeof sceneAudioSchema>;
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
