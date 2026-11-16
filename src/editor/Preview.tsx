/** 中央: プレビュー(再生/停止、シークバー、シーンの区切り。繰り返し・縦長・大きく見るの切り替えは動画の上。動画の中の章表示を隠さないよう、枠の外に置く) */
import { Player, type PlayerRef } from '@remotion/player';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { VIDEO } from '../kit/theme';
import { ProjectVideo } from '../video/ProjectVideo';
import { VERTICAL, VerticalVideo } from '../video/VerticalVideo';
import { cancelPick, finishPick, usePick } from './pick';
import { formatSeconds, sceneTimeline, totalFrames, type Project } from '../video/project';
import { UiIcon } from './ui-icons';

export type PreviewHandle = {
  toggleLoop: () => void;
  seekTo: (frame: number) => void;
  toggle: () => void;
  isPlaying: () => boolean;
  getFrame: () => number;
};

type Props = {
  project: Project;
  selected: number;
  onSelectScene: (i: number) => void;
  onShowKeys: () => void;
  /** プレビューを大きく見ているか */
  wide: boolean;
  onToggleWide: () => void;
};

export const Preview = forwardRef<PreviewHandle, Props>(({ project, selected, onSelectScene, onShowKeys, wide, onToggleWide }, ref) => {
  const player = useRef<PlayerRef>(null);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  /** 選んだシーンだけを繰り返し再生する */
  const [loopScene, setLoopScene] = useState(false);
  /** 縦長(ショート)の見え方で確かめる */
  const [vertical, setVertical] = useState(false);
  const pick = usePick();
  useEffect(() => {
    if (!pick) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && cancelPick();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pick]);
  const total = totalFrames(project);
  const timeline = useMemo(() => sceneTimeline(project), [project]);
  const inputProps = useMemo(() => ({ project }), [project]);

  useImperativeHandle(ref, () => ({
    toggleLoop: () => {
      setLoopScene((v) => !v);
    },
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

  const loopRange = loopScene && timeline[selected] ? { from: timeline[selected].from, to: timeline[selected].from + timeline[selected].durationInFrames - 1 } : null;

  const current = timeline.findIndex((t) => frame >= t.from && frame < t.from + t.durationInFrames);

  return (
    <main className="col col-center">
      <div className={vertical ? 'player-tools vertical' : 'player-tools'}>
        <button
          type="button"
          className={loopScene ? 'on' : ''}
          aria-pressed={loopScene}
          title="選んでいるシーンだけを繰り返し再生(L)"
          onClick={() => {
            const next = !loopScene;
            setLoopScene(next);
            if (next && timeline[selected]) {
              player.current?.seekTo(timeline[selected].from);
              player.current?.play();
            }
          }}
        >
          <UiIcon name="repeat" size={14} />
          繰り返し
        </button>
        <button
          type="button"
          className={vertical ? 'on' : ''}
          aria-pressed={vertical}
          title="縦長(9:16・ショート向け)で書き出したときの見え方に切り替える"
          onClick={() => setVertical((v) => !v)}
        >
          <UiIcon name={vertical ? 'landscape' : 'phone'} size={14} />
          {vertical ? '横長に戻す' : '縦長で見る'}
        </button>
        <button type="button" className={wide ? 'on' : ''} aria-pressed={wide} title="シーン一覧を隠して、プレビューを大きく表示する" onClick={onToggleWide}>
          <UiIcon name={wide ? 'shrink' : 'expand'} size={14} />
          {wide ? '元の大きさ' : '大きく見る'}
        </button>
      </div>
      <div className={vertical ? 'player-wrap vertical' : 'player-wrap'}>
        <Player
          ref={player}
          component={vertical ? VerticalVideo : ProjectVideo}
          inputProps={inputProps}
          durationInFrames={total}
          fps={VIDEO.fps}
          compositionWidth={vertical ? VERTICAL.width : VIDEO.width}
          compositionHeight={vertical ? VERTICAL.height : VIDEO.height}
          style={{ width: '100%' }}
          clickToPlay
          spaceKeyToPlayOrPause={false}
          doubleClickToFullscreen
          acknowledgeRemotionLicense
          loop={loopRange !== null}
          inFrame={loopRange?.from ?? null}
          outFrame={loopRange?.to ?? null}
        />
        {pick && (
          <div
            className="pick-overlay"
            title={`${pick.label}: クリックした所に決まります(Esc でやめる)`}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const cw = vertical ? VERTICAL.width : VIDEO.width;
              const ch = vertical ? VERTICAL.height : VIDEO.height;
              let x = ((e.clientX - r.left) / r.width) * cw;
              let y = ((e.clientY - r.top) / r.height) * ch;
              if (vertical) {
                // 縦長では横長の動画が中央に縮小して置かれているので、横長の座標に直す
                const scale = VERTICAL.width / VIDEO.width;
                const top = Math.round((VERTICAL.height - VIDEO.height * scale) / 2);
                x = x / scale;
                y = (y - top) / scale;
              }
              finishPick(x, y);
            }}
          >
            <span>{pick.label}: 位置をクリック(Esc でやめる)</span>
          </div>
        )}
      </div>

      <div className="transport">
        <button type="button" className="play" onClick={() => player.current?.toggle()} title="再生 / 停止(スペース)" aria-label={playing ? '停止' : '再生'}>
          <UiIcon name={playing ? 'pause' : 'play'} />
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
      <div className="keys-link">
        <button type="button" className="link muted" onClick={onShowKeys}>
          <UiIcon name="help" size={14} /> キー操作の一覧(? キー)
        </button>
      </div>
    </main>
  );
});
Preview.displayName = 'Preview';
