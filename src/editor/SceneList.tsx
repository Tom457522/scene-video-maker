/** 左列: シーンの一覧(選ぶ・ドラッグで並べ替え。コピー・複製・削除は選んだシーンかカーソルを当てたシーンにだけ出す) */
import { Thumbnail } from '@remotion/player';
import { memo, useMemo, useState } from 'react';
import { ProjectVideo } from '../video/ProjectVideo';
import { sceneFrames, type Settings } from '../video/project';
import { getPart, resolveProps } from '../parts/registry';
import { isTooShort, recommendedSeconds } from '../video/reading';
import { VIDEO } from '../kit/theme';
import { formatSeconds, sceneTimeline } from '../video/project';
import { sceneSummary, type EditorScene } from './state';
import { Dropdown, MenuList } from './Modal';
import { UiIcon } from './ui-icons';

/** シーンの見どころ(70% の時点)の縮小画像。シーンか設定が変わったときだけ描き直す */
const SceneThumb = memo(({ scene, settings }: { scene: EditorScene; settings: Settings }) => {
  const project = useMemo(() => ({ title: '', settings, scenes: [scene] }), [scene, settings]);
  const inputProps = useMemo(() => ({ project }), [project]);
  const frames = sceneFrames(scene);
  return (
    <Thumbnail
      component={ProjectVideo}
      inputProps={inputProps}
      compositionWidth={VIDEO.width}
      compositionHeight={VIDEO.height}
      frameToDisplay={Math.floor(frames * 0.7)}
      durationInFrames={frames}
      fps={VIDEO.fps}
      style={{ width: 96, height: 54 }}
    />
  );
});
SceneThumb.displayName = 'SceneThumb';

type Props = {
  settings: Settings;
  scenes: EditorScene[];
  selected: number;
  onSelect: (i: number) => void;
  /** 「シーンを追加」を開く */
  onOpenAdd: () => void;
  onDuplicate: (i: number) => void;
  onCopy: (i: number) => void;
  onCopyAll: () => void;
  onReplace: () => void;
  onDelete: (i: number) => void;
  onMove: (from: number, to: number) => void;
};

export const SceneList = ({ settings, scenes, selected, onSelect, onOpenAdd, onDuplicate, onCopy, onCopyAll, onReplace, onDelete, onMove }: Props) => {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);

  const starts = sceneTimeline({ scenes }).map((t) => t.from / VIDEO.fps);

  const finishDrag = () => {
    if (dragFrom !== null && dropAt !== null) {
      const to = dropAt > dragFrom ? dropAt - 1 : dropAt;
      if (to !== dragFrom) onMove(dragFrom, to);
    }
    setDragFrom(null);
    setDropAt(null);
  };

  return (
    <aside className="col col-left">
      <div className="col-title row">
        <span>
          シーン <span className="muted">{scenes.length}</span>
        </span>
        <Dropdown label="シーンのその他の操作" className="icon-btn" align="right" trigger={<UiIcon name="more" />}>
          {(close) => (
            <MenuList
              close={close}
              items={[
                { label: 'すべてのシーンをコピー', icon: 'copy', onClick: onCopyAll, hint: '別のプロジェクトで Ctrl+V(または「シーンを追加」→「貼り付け」)で貼り付けられます' },
                { label: '文字をまとめて置き換える…', icon: 'replace', onClick: onReplace },
              ]}
            />
          )}
        </Dropdown>
      </div>
      <ol className="scenes" onDragLeave={(e) => e.currentTarget === e.target && setDropAt(null)}>
        {scenes.map((scene, i) => {
          const part = getPart(scene.part);
          const props = part ? resolveProps(part, scene.props).props : scene.props;
          const short = isTooShort(scene.seconds, props);
          return (
            <li
              key={scene.key}
              className={[
                'scene',
                i === selected ? 'selected' : '',
                dragFrom === i ? 'dragging' : '',
                dropAt === i ? 'drop-before' : '',
                dropAt === scenes.length && i === scenes.length - 1 ? 'drop-after' : '',
              ].join(' ')}
              draggable
              onDragStart={(e) => {
                setDragFrom(i);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(i));
              }}
              onDragOver={(e) => {
                if (dragFrom === null) return;
                e.preventDefault();
                const r = e.currentTarget.getBoundingClientRect();
                setDropAt(e.clientY < r.top + r.height / 2 ? i : i + 1);
              }}
              onDrop={(e) => {
                e.preventDefault();
                finishDrag();
              }}
              onDragEnd={finishDrag}
              onClick={() => onSelect(i)}
            >
              <div className="scene-thumb">
                <SceneThumb scene={scene} settings={settings} />
                <div className="scene-no">{i + 1}</div>
              </div>
              <div className="scene-main">
                <div className="scene-part">
                  {part ? <span>{part.meta.name}</span> : <span className="warn">不明な種類: {scene.part}</span>}
                  <span
                    className={short ? 'scene-time short' : 'scene-time'}
                    title={short ? `文字数に対して短めです(読み切る目安: 約 ${recommendedSeconds(props)} 秒)` : undefined}
                  >
                    {short ? '⚠ ' : ''}
                    {scene.seconds}秒
                  </span>
                </div>
                <div className="scene-summary">{sceneSummary(scene) || '(空)'}</div>
                <div className="scene-at">{formatSeconds(starts[i])} から</div>
              </div>
              <div className="scene-tools">
                <button
                  type="button"
                  title="コピー(Ctrl+C。別のプロジェクトにも貼り付けられる)"
                  aria-label="コピー"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCopy(i);
                  }}
                >
                  <UiIcon name="copy" size={14} />
                </button>
                <button
                  type="button"
                  title="複製(Ctrl+D)"
                  aria-label="複製"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate(i);
                  }}
                >
                  <UiIcon name="duplicate" size={14} />
                </button>
                <button
                  type="button"
                  title="削除(Delete。Ctrl+Z で戻せます)"
                  aria-label="削除"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(i);
                  }}
                >
                  <UiIcon name="trash" size={14} />
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="add-scene">
        <button type="button" className="primary wide add-btn" onClick={onOpenAdd}>
          <UiIcon name="plus" />
          シーンを追加
        </button>
        <div className="hint center">種類から選ぶ ・ 文章から作る ・ 貼り付け</div>
      </div>
    </aside>
  );
};
