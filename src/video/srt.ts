/**
 * 字幕ファイル(SRT)。各シーンの「字幕」(caption)に自分で書いた文を、そのシーンの表示時間で並べる。
 * 文を自動で作ることはしない(書いてある文をそのまま使う)。
 */
import { T } from '../kit/motion';
import { stripMarks } from '../kit/text';
import { VIDEO } from '../kit/theme';
import { sceneTimeline, type Project } from './project';

export type Cue = { start: number; end: number; text: string };

/** フレーム数を SRT の時刻(00:01:02,500)にする */
export const srtTime = (frames: number): string => {
  const ms = Math.round((frames / VIDEO.fps) * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(h)}:${p(m)}:${p(s)},${p(ms % 1000, 3)}`;
};

/** 字幕の並び。resolve には各シーンの入力値(既定値で補ったもの)を返す関数を渡す */
export const buildCues = (project: Pick<Project, 'scenes'>, resolve: (i: number) => Record<string, unknown> = (i) => project.scenes[i].props): Cue[] => {
  const timeline = sceneTimeline(project);
  const cues: Cue[] = [];
  project.scenes.forEach((_, i) => {
    const caption = resolve(i).caption;
    if (typeof caption !== 'string' || caption.trim() === '') return;
    const { from, durationInFrames } = timeline[i];
    // 画面の字幕が出てから、シーンの退場が始まるまで
    const start = from + Math.min(T.enter, Math.floor(durationInFrames / 4));
    const end = from + Math.max(Math.floor(durationInFrames / 2), durationInFrames - T.exit);
    cues.push({ start, end, text: stripMarks(caption).trim() });
  });
  return cues;
};

export const toSrt = (cues: Cue[]): string =>
  cues.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join('\n');
