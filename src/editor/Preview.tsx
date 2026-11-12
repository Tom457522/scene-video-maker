/** 中央: プレビュー(再生/停止、シークバー、シーンの区切り) */
import { Player, type PlayerRef } from '@remotion/player';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { VIDEO } from '../kit/theme';
import { ProjectVideo } from '../video/ProjectVideo';
import { formatSeconds, sceneTimeline, totalFrames, type Project } from '../video/project';

export type PreviewHandle = {
  seekTo: (frame: number) => void;
  toggle: () => void;
  isPlaying: () => boolean;
  getFrame: () => number;
};

type Props = { project: Project; selected: number; onSelectScene: (i: number) => void };

export const Preview = forwardRef<PreviewHandle, Props>(({ project, selected, onSelectScene }, ref) => {
  const player = useRef<PlayerRef>(null);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const total = totalFrames(project);
  const timeline = useMemo(() => sceneTimeline(project), [project]);
  const inputProps = useMemo(() => ({ project }), [project]);

  useImperativeHandle(ref, () => ({
    seekTo: (f) => {
      player.current?.seekTo(f);
      setFrame(f);
    },
    toggle: () => player.current?.toggle(),
    isPlaying: () => player.current?.isPlaying() ?? false,
    getFrame: () => player.current?.getCurrentFrame() ?? 0,
  }));

  useEffect(() => {
    const p = player.current;
    if (!p) return;
    const onFrame = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    p.addEventListener('frameupdate', onFrame);
    p.addEventListener('seeked', onFrame);
    p.addEventListener('play', onPlay);
    p.addEventListener('pause', onPause);
    p.addEventListener('ended', onPause);
    return () => {
      p.removeEventListener('frameupdate', onFrame);
      p.removeEventListener('seeked', onFrame);
      p.removeEventListener('play', onPlay);
      p.removeEventListener('pause', onPause);
      p.removeEventListener('ended', onPause);
    };
  }, []);

  // シーンが減って動画が短くなったら、はみ出さないように戻す
  useEffect(() => {
    if (frame > total - 1) player.current?.seekTo(total - 1);
  }, [frame, total]);

  const current = timeline.findIndex((t) => frame >= t.from && frame < t.from + t.durationInFrames);

  return (
    <main className="col col-center">
      <div className="player-wrap">
        <Player
          ref={player}
          component={ProjectVideo}
          inputProps={inputProps}
          durationInFrames={total}
          fps={VIDEO.fps}
          compositionWidth={VIDEO.width}
          compositionHeight={VIDEO.height}
          style={{ width: '100%' }}
          clickToPlay
          spaceKeyToPlayOrPause={false}
          doubleClickToFullscreen
          acknowledgeRemotionLicense
        />
      </div>

      <div className="transport">
        <button type="button" className="play" onClick={() => player.current?.toggle()} title="再生 / 停止(スペース)">
          {playing ? '❚❚' : '▶'}
        </button>
        <div className="seek">
          <div className="seek-scenes">
            {timeline.map((t, i) => (
              <button
                key={i}
                type="button"
                className={['seek-scene', i === selected ? 'selected' : '', i === current ? 'current' : ''].join(' ')}
                style={{ left: `${(t.from / total) * 100}%`, width: `${(t.durationInFrames / total) * 100}%` }}
                title={`シーン ${i + 1} の頭へ`}
                onClick={() => {
                  onSelectScene(i);
                  player.current?.seekTo(t.from);
                }}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <input
            type="range"
            min={0}
            max={total - 1}
            value={Math.min(frame, total - 1)}
            onChange={(e) => {
              const f = Number(e.target.value);
              player.current?.seekTo(f);
              setFrame(f);
            }}
          />
        </div>
        <div className="time">
          {formatSeconds(frame / VIDEO.fps)} / {formatSeconds(total / VIDEO.fps)}
        </div>
      </div>
      <div className="muted small center">
        クリックで再生/停止・ダブルクリックで全画面・スペースで再生/停止・Ctrl+S で保存
      </div>
    </main>
  );
});
Preview.displayName = 'Preview';
