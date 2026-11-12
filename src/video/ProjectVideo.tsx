/**
 * プロジェクトを 1 本の動画として描く。エディタのプレビューと MP4 書き出しの両方がこれを使う。
 */
import { Component as ReactComponent, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Sequence, continueRender, delayRender, getRemotionEnvironment, useCurrentFrame, useVideoConfig } from 'remotion';
import '../kit/fonts';
import { loadFontsFor } from '../kit/fonts';
import { Background, Fill, SceneFrame, Stage } from '../kit/components';
import { colors, font } from '../kit/theme';
import { getPart, resolveProps, type PartDef } from '../parts/registry';
import { LAYOUT_LOG_PREFIX, checkLayout } from './layout-check';
import { buildChapters, type Chapter } from './chapters';
import { ChapterBar, EndCard, TopRight } from './overlays';
import { END_CARD_FRAMES, defaultSettings, scenesFrames, sceneTimeline, type Project, type Scene, type Settings } from './project';

export type ProjectVideoProps = {
  project: Project;
  /** true のとき、書き出し中に文字のはみ出しを調べて console に結果を出す(npm run stills が使う) */
  checkLayout?: boolean;
  /** true のとき、右上の章・チャンネル名と下の進み具合を出さない(縦長の動画に埋め込むとき) */
  embedded?: boolean;
};

const Notice = ({ title, detail }: { title: string; detail?: string }) => (
  <Fill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 80 }}>
    <div style={{ fontSize: 40, color: colors.coral }}>{title}</div>
    {detail ? <div style={{ fontSize: 24, color: colors.sub, fontWeight: font.weight.regular, whiteSpace: 'pre-wrap' }}>{detail}</div> : null}
  </Fill>
);

/** 部品の描画で例外が出ても、その画面にエラーを出して他のシーンは動かし続ける */
class PartBoundary extends ReactComponent<{ partId: string; children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidUpdate(prev: { partId: string; children: ReactNode }) {
    if (this.state.error && prev.children !== this.props.children) this.setState({ error: null });
  }
  render() {
    if (this.state.error) {
      if (getRemotionEnvironment().isRendering) throw this.state.error;
      return <Notice title={`部品「${this.props.partId}」でエラー`} detail={this.state.error.message} />;
    }
    return this.props.children;
  }
}

/** 章の一覧(各シーンの入力値を既定値で補ってから見出しを拾う) */
const useChapters = (project: Project): Chapter[] =>
  useMemo(
    () =>
      buildChapters(project, (i) => {
        const s = project.scenes[i];
        const part = getPart(s.part);
        return part ? resolveProps(part, s.props).props : s.props;
      }),
    [project],
  );

/** フォントを読み終えてから、シーンの中の文字のはみ出しを調べて結果を console に出す */
const useLayoutProbe = (root: React.RefObject<HTMLDivElement | null>, enabled: boolean, sceneIndex: number, text: string) => {
  const [handle] = useState(() => (enabled && getRemotionEnvironment().isRendering ? delayRender('はみ出しの検査') : null));
  useEffect(() => {
    if (handle === null) return;
    loadFontsFor(text)
      .then(() => {
        if (root.current) {
          const issues = checkLayout(root.current);
          console.log(`${LAYOUT_LOG_PREFIX}${JSON.stringify({ scene: sceneIndex, issues })}`);
        }
      })
      .finally(() => continueRender(handle));
  }, [handle, root, sceneIndex, text]);
};

export { useChapters };

const SceneBody = ({ part, scene, index, check }: { part: PartDef; scene: Scene; index: number; check: boolean }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const root = useRef<HTMLDivElement>(null);
  const { props } = resolveProps(part, scene.props);
  useLayoutProbe(root, check, index, JSON.stringify(props));
  const C = part.Component;
  return (
    <SceneFrame frame={frame} durationInFrames={durationInFrames}>
      <div ref={root} style={{ position: 'absolute', inset: 0 }}>
        <C props={props} frame={frame} durationInFrames={durationInFrames} fps={fps} />
      </div>
    </SceneFrame>
  );
};

/** 書き出しのときだけ、使う文字のフォントを読み終えるまで撮影を待つ */
const useFontGate = (project: Project) => {
  const text = JSON.stringify(project);
  const [handle] = useState(() => (getRemotionEnvironment().isRendering ? delayRender('フォントの読み込み') : null));
  useEffect(() => {
    if (handle === null) {
      void loadFontsFor(text);
      return;
    }
    loadFontsFor(text).finally(() => continueRender(handle));
  }, [handle, text]);
};

const GlobalBackground = () => <Background frame={useCurrentFrame()} />;

/** 右上の章・チャンネル名と、下の端の進み具合(エンドカードの間は出さない) */
const Overlays = ({ settings, chapters, total }: { settings: Settings; chapters: Chapter[]; total: number }) => {
  const frame = useCurrentFrame();
  if (frame >= total) return null;
  return (
    <>
      <TopRight frame={frame} chapters={chapters} showChapters={settings.chapters} channelName={settings.channelName} logo={settings.logo} />
      {settings.chapters && chapters.length > 1 && <ChapterBar frame={frame} chapters={chapters} total={total} />}
    </>
  );
};

const EndCardScene = ({ settings }: { settings: Settings }) => (
  <EndCard frame={useCurrentFrame()} message={settings.endCardMessage} channelName={settings.channelName} logo={settings.logo} />
);

export const ProjectVideo = ({ project, checkLayout: check = false, embedded = false }: ProjectVideoProps) => {
  useFontGate(project);
  const timeline = sceneTimeline(project);
  // 古い形のデータ(settings がない)でも動くようにする
  const settings = project.settings ?? defaultSettings();
  const chapters = useChapters(project);
  const scenesEnd = scenesFrames(project);
  return (
    <Stage theme={settings.theme}>
      <GlobalBackground />
      {project.scenes.length === 0 ? <Notice title="シーンがありません" detail="左の一覧からシーンを追加してください" /> : null}
      {project.scenes.map((scene, i) => {
        const part = getPart(scene.part);
        return (
          <Sequence key={i} from={timeline[i].from} durationInFrames={timeline[i].durationInFrames} name={`${i + 1}. ${scene.part}`}>
            {part ? (
              <PartBoundary partId={scene.part}>
                <SceneBody part={part} scene={scene} index={i} check={check} />
              </PartBoundary>
            ) : (
              <Notice title={`部品「${scene.part}」が見つかりません`} detail="src/parts/ にフォルダがあるか確かめてください" />
            )}
          </Sequence>
        );
      })}
      {settings.endCard && (
        <Sequence from={scenesEnd} durationInFrames={END_CARD_FRAMES} name="エンドカード">
          <EndCardScene settings={settings} />
        </Sequence>
      )}
      {!embedded && <Overlays settings={settings} chapters={chapters} total={scenesEnd} />}
    </Stage>
  );
};
