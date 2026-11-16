/**
 * 読みやすさの確認: シーンの見どころ(70%)を画面の外で描き、いちばん小さい文字の大きさを測る。
 * 長い文が自動で小さくなりすぎていないかを、設定欄と「確認 N 件」・書き出す前の確認で知らせる。
 *
 * 結果はシーンの中身(種類・秒数・入力・動画の設定)ごとに覚えておき、まだ測っていないシーンを 1 つずつ測る。
 * 中身と結果を対にしておくので、別のシーンの文字を指すことはない。
 */
import { Thumbnail } from '@remotion/player';
import { useEffect, useMemo, useRef, useState } from 'react';
import { VIDEO } from '../kit/theme';
import { measureSmallestText } from '../video/layout-check';
import { ProjectVideo } from '../video/ProjectVideo';
import { sceneFrames, type Scene, type Settings } from '../video/project';
import type { Issue } from './guide';

/** これより小さい文字は「小さめ」として知らせる(1280×720 の画面での px) */
export const SMALL_TEXT = 20;
/** これより小さい文字は「読みにくい」として強く知らせる */
export const TINY_TEXT = 14;

export type Smallest = { size: number; text: string } | null;

/** 測った結果を見分けるための、シーンの中身の印 */
const signatureOf = (scene: Scene, settings: Settings) => JSON.stringify([scene.part, scene.seconds, scene.props, settings]);

/** 描き終わり(フォントの読み込みを含む)を待つ。2 回の描画を待って、新しい中身が画面に出てから測る */
const afterPaint = () => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())));

/**
 * すべてのシーンの、いちばん小さい文字を測る。選んでいるシーンを先に測る。
 * byScene[i] は測り終えていなければ undefined(文字がないシーンは null)
 */
export const useReadability = (scenes: Scene[], settings: Settings, selected: number) => {
  const [results, setResults] = useState<Record<string, Smallest>>({});
  const box = useRef<HTMLDivElement>(null);
  const sigs = useMemo(() => scenes.map((s) => signatureOf(s, settings)), [scenes, settings]);
  const byScene = useMemo(() => sigs.map((sig) => (sig in results ? results[sig] : undefined)), [sigs, results]);

  // 次に測るシーン(選んでいるシーン → 先頭から順に)
  const order = selected >= 0 && selected < scenes.length ? [selected, ...scenes.keys()] : [...scenes.keys()];
  const target = order.find((i) => !(sigs[i] in results));
  const scene = target === undefined ? undefined : scenes[target];
  const sig = target === undefined ? '' : sigs[target];

  const inputProps = useMemo(
    () => (scene ? { project: { title: '', settings, scenes: [{ part: scene.part, seconds: scene.seconds, props: scene.props }] } } : null),
    // sig が同じなら中身も同じ
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sig],
  );

  useEffect(() => {
    if (!inputProps) return;
    let alive = true;
    // 入力中に何度も測らないよう少し待つ
    const t = window.setTimeout(() => {
      void document.fonts.ready.then(afterPaint).then(() => {
        if (!alive) return;
        const root = box.current?.querySelector<HTMLElement>('[data-probe-root]');
        if (!root || root.dataset.sig !== sig) return;
        const measured = measureSmallestText(root);
        setResults((prev) => {
          // 今のシーンにない古い結果は捨てる(増え続けないように)
          const keep = new Set(sigs);
          const next: Record<string, Smallest> = {};
          for (const [k, v] of Object.entries(prev)) if (keep.has(k)) next[k] = v;
          next[sig] = measured;
          return next;
        });
      });
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [inputProps, sig, sigs]);

  const probe =
    scene && inputProps ? (
      <div ref={box} aria-hidden style={{ position: 'fixed', left: -20000, top: 0, width: VIDEO.width, height: VIDEO.height, pointerEvents: 'none' }}>
        {/* key で作り直し、前のシーンの文字が残らないようにする */}
        <div key={sig} data-probe-root data-sig={sig} style={{ width: VIDEO.width, height: VIDEO.height }}>
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
  return { byScene, probe };
};

/** 文字が小さいシーンを「直したほうがよいところ」にする */
export const smallTextIssues = (byScene: (Smallest | undefined)[], partName: (i: number) => string): Issue[] =>
  byScene.flatMap((s, i): Issue[] => {
    if (!s || Math.round(s.size) >= SMALL_TEXT) return [];
    const size = Math.round(s.size);
    return [
      {
        scene: i,
        kind: 'small',
        message: `シーン ${i + 1}(${partName(i)})の文字が${size < TINY_TEXT ? 'とても小さく、読みにくくなっています' : '小さめです'}(いちばん小さい文字で ${size}px: 「${s.text}」)`,
      },
    ];
  });

export const ReadabilityHint = ({ smallest }: { smallest: Smallest | undefined }) => {
  if (!smallest) return null;
  const size = Math.round(smallest.size);
  if (size >= SMALL_TEXT) return <div className="hint">文字の大きさ: いちばん小さい文字で {size}px(読みやすい大きさです)</div>;
  return (
    <div className="hint warn">
      文字が{size < TINY_TEXT ? 'とても小さく、読みにくくなっています' : '小さめです'}(いちばん小さい文字で {size}px: 「{smallest.text}」)。
      文を短くするか、項目を減らすと大きくなります。
    </div>
  );
};
