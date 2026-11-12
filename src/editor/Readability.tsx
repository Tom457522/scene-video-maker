/**
 * 読みやすさの確認: 選んでいるシーンの見どころ(70%)を画面の外で描き、いちばん小さい文字の大きさを測る。
 * 長い文が自動で小さくなりすぎていないかを、設定欄で知らせる。
 */
import { Thumbnail } from '@remotion/player';
import { useEffect, useMemo, useRef, useState } from 'react';
import { VIDEO } from '../kit/theme';
import { measureSmallestText } from '../video/layout-check';
import { ProjectVideo } from '../video/ProjectVideo';
import { sceneFrames, type Scene, type Settings } from '../video/project';

/** これより小さい文字は「小さめ」として知らせる(1280×720 の画面での px) */
export const SMALL_TEXT = 20;
/** これより小さい文字は「読みにくい」として強く知らせる */
export const TINY_TEXT = 14;

export type Smallest = { size: number; text: string } | null;

export const useSmallestText = (scene: Scene | undefined, settings: Settings) => {
  const [result, setResult] = useState<Smallest>(null);
  const box = useRef<HTMLDivElement>(null);
  const inputProps = useMemo(
    () => (scene ? { project: { title: '', settings, scenes: [{ part: scene.part, seconds: scene.seconds, props: scene.props }] } } : null),
    [scene, settings],
  );
  useEffect(() => {
    if (!inputProps) return;
    let alive = true;
    // 描き終わり(フォントの読み込みを含む)を待ってから測る。入力中に何度も測らないよう少し待つ
    const t = window.setTimeout(() => {
      void document.fonts.ready.then(() => {
        requestAnimationFrame(() => {
          const root = box.current?.querySelector<HTMLElement>('[data-probe-root]') ?? box.current;
          if (alive && root) setResult(measureSmallestText(root));
        });
      });
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [inputProps]);

  const probe =
    scene && inputProps ? (
      <div ref={box} aria-hidden style={{ position: 'fixed', left: -20000, top: 0, width: VIDEO.width, height: VIDEO.height, pointerEvents: 'none' }}>
        <div data-probe-root style={{ width: VIDEO.width, height: VIDEO.height }}>
          <Thumbnail
            component={ProjectVideo}
            inputProps={inputProps}
            compositionWidth={VIDEO.width}
            compositionHeight={VIDEO.height}
            durationInFrames={sceneFrames(scene)}
            fps={VIDEO.fps}
            frameToDisplay={Math.floor(sceneFrames(scene) * 0.7)}
            style={{ width: VIDEO.width, height: VIDEO.height }}
          />
        </div>
      </div>
    ) : null;
  return { smallest: result, probe };
};

export const ReadabilityHint = ({ smallest }: { smallest: Smallest }) => {
  if (!smallest) return null;
  const size = Math.round(smallest.size);
  if (size >= SMALL_TEXT) return <div className="hint">文字の大きさ: いちばん小さい文字で {size}px(読みやすい大きさです)</div>;
  return (
    <div className="hint warn">
      ⚠ 文字が{size < TINY_TEXT ? 'とても小さく、読みにくくなっています' : '小さめです'}(いちばん小さい文字で {size}px: 「{smallest.text}」)。
      文を短くするか、項目を減らすと大きくなります。
    </div>
  );
};
