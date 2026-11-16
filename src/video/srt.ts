/**
 * 字幕ファイル(SRT)。ナレーションの音声があるシーンは話している文を、
 * ないシーンは「字幕」(caption)に自分で書いた文を、そのシーンの表示時間で並べる。
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
  project.scenes.forEach((scene, i) => {
    // ナレーションの音声があるシーンは、話している文をその時刻で並べる
    const a = scene.audio;
    if (a && a.lines.length > 0) {
      const from = timeline[i].from;
      for (const l of a.lines) {
        cues.push({ start: from + Math.round((a.start + l.start) * VIDEO.fps), end: from + Math.round((a.start + l.end) * VIDEO.fps), text: l.text });
      }
      return;
    }
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
