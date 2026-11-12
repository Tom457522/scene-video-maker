/**
 * プロジェクトを 1 本の動画として描く。エディタのプレビューと MP4 書き出しの両方がこれを使う。
 */
import { Component as ReactComponent, useEffect, useState, type ReactNode } from 'react';
import { Sequence, continueRender, delayRender, getRemotionEnvironment, useCurrentFrame, useVideoConfig } from 'remotion';
import '../kit/fonts';
import { loadFontsFor } from '../kit/fonts';
import { Background, Fill, SceneFrame, Stage } from '../kit/components';
import { colors, font } from '../kit/theme';
import { getPart, resolveProps, type PartDef } from '../parts/registry';
import { sceneTimeline, type Project, type Scene } from './project';

export type ProjectVideoProps = { project: Project };

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

const SceneBody = ({ part, scene }: { part: PartDef; scene: Scene }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const { props } = resolveProps(part, scene.props);
  const C = part.Component;
  return (
    <SceneFrame frame={frame} durationInFrames={durationInFrames}>
      <C props={props} frame={frame} durationInFrames={durationInFrames} fps={fps} />
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

export const ProjectVideo = ({ project }: ProjectVideoProps) => {
  useFontGate(project);
  const timeline = sceneTimeline(project);
  return (
    <Stage>
      <GlobalBackground />
      {project.scenes.length === 0 ? <Notice title="シーンがありません" detail="左の一覧からシーンを追加してください" /> : null}
      {project.scenes.map((scene, i) => {
        const part = getPart(scene.part);
        return (
          <Sequence key={i} from={timeline[i].from} durationInFrames={timeline[i].durationInFrames} name={`${i + 1}. ${scene.part}`}>
            {part ? (
              <PartBoundary partId={scene.part}>
                <SceneBody part={part} scene={scene} />
              </PartBoundary>
            ) : (
              <Notice title={`部品「${scene.part}」が見つかりません`} detail="src/parts/ にフォルダがあるか確かめてください" />
            )}
          </Sequence>
        );
      })}
    </Stage>
  );
};
