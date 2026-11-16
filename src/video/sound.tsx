/**
 * 音と、音に合わせて出すもの(ナレーションの字幕・出典)。
 * 音声ファイルは npm run make が projects/assets/audio/ に作る。
 */
import { Html5Audio, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { fitFontSize } from '../kit/text';
import { T, mix, progress } from '../kit/motion';
import { alpha, colors, font, VIDEO } from '../kit/theme';
import { END_CARD_FRAMES, sceneTimeline, type Project, type Scene } from './project';
import { cueFrames } from './narration';

import { SFX_FILE } from './sound-files';


/** シーンの中のナレーションと効果音 */
export const SceneSound = ({ scene, sfx }: { scene: Scene; sfx: boolean }) => {
  const a = scene.audio;
  if (!a) return null;
  const cues = sfx ? (cueFrames(scene, VIDEO.fps) ?? []) : [];
  return (
    <>
      <Sequence from={Math.round(a.start * VIDEO.fps)} name="ナレーション">
        <Html5Audio src={staticFile(a.file)} />
      </Sequence>
      {cues.map((c, i) => (
        <Sequence key={i} from={c} durationInFrames={VIDEO.fps} name="効果音">
          <Html5Audio src={staticFile(SFX_FILE)} volume={0.22} />
        </Sequence>
      ))}
    </>
  );
};

/** ナレーションが流れている区間(動画の頭からのフレーム) */
export const speechIntervals = (project: Pick<Project, 'scenes'>): [number, number][] => {
  const tl = sceneTimeline(project);
  return project.scenes.flatMap((s, i) =>
    s.audio ? [[tl[i].from + Math.round(s.audio.start * VIDEO.fps), tl[i].from + Math.round((s.audio.start + s.audio.duration) * VIDEO.fps)] as [number, number]] : [],
  );
};

/** BGM の音量(フレームごと)。話している間は下げ、頭と終わりはなめらかに上げ下げする */
export const bgmVolume = (frame: number, base: number, total: number, speech: [number, number][]): number => {
  const RAMP = 10;
  const fadeIn = Math.min(1, frame / VIDEO.fps);
  const fadeOut = Math.min(1, Math.max(0, (total - frame) / (2 * VIDEO.fps)));
  let duck = 1;
  for (const [a, b] of speech) {
    const d = frame < a ? a - frame : frame > b ? frame - b : 0;
    if (d < RAMP) duck = Math.min(duck, mix(d / RAMP, 0.35, 1));
  }
  return base * fadeIn * fadeOut * duck;
};

export const Bgm = ({ project, total }: { project: Project; total: number }) => {
  const speech = speechIntervals(project);
  const base = project.settings.bgmVolume;
  if (!project.settings.bgm) return null;
  return <Html5Audio src={staticFile(project.settings.bgm)} loop volume={(f) => bgmVolume(f, base, total, speech)} />;
};

/** BGM を流す長さ(エンドカードも含める) */
export const bgmFrames = (project: Project, scenesEnd: number) => scenesEnd + (project.settings.endCard ? END_CARD_FRAMES : 0);

/** 話している文の字幕(画面の下)。シーンの頭からのフレームで決まる */
export const NarrationSubtitle = ({ scene }: { scene: Scene }) => {
  const frame = useCurrentFrame();
  const a = scene.audio;
  if (!a || a.lines.length === 0) return null;
  const t = frame / VIDEO.fps - a.start;
  const line = a.lines.find((l) => t >= l.start && t < l.end) ?? (t >= 0 && t < a.lines[a.lines.length - 1].end + 0.6 ? a.lines[a.lines.length - 1] : null);
  if (!line) return null;
  const size = fitFontSize(line.text, { maxWidth: 1040, max: font.size.caption, min: 20, maxLines: 2 });
  const p = progress(frame, Math.round((a.start + line.start) * VIDEO.fps), 6);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 30, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div
        style={{
          maxWidth: 1080,
          padding: '8px 26px',
          borderRadius: 10,
          background: alpha('#000000', 0.62),
          color: '#ffffff',
          fontSize: size,
          fontWeight: font.weight.bold,
          lineHeight: 1.4,
          textAlign: 'center',
          opacity: mix(p, 0.4, 1),
          wordBreak: 'keep-all',
          overflowWrap: 'anywhere',
        }}
      >
        {line.text}
      </div>
    </div>
  );
};

/** 出典(画面の右下に小さく) */
export const SourceNote = ({ text, subtitles }: { text: string; subtitles: boolean }) => {
  const frame = useCurrentFrame();
  if (text.trim() === '') return null;
  const p = progress(frame, T.enter, T.enter);
  return (
    <div
      style={{
        position: 'absolute',
        right: 24,
        bottom: subtitles ? 4 : 8,
        maxWidth: 640,
        fontSize: 15,
        color: alpha(colors.sub, 0.95),
        fontWeight: font.weight.regular,
        opacity: p,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      出典: {text}
    </div>
  );
};

/** 字幕を出すとき、本文を少し縮めて下に字幕の場所を空ける(縮める割合) */
export const SUBTITLE_SCALE = 0.86;
