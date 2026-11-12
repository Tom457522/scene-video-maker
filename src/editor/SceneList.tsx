/** 左列: シーンの一覧(追加・複製・削除・ドラッグで並べ替え) */
import { useState } from 'react';
import { getPart, partErrors, parts } from '../parts/registry';
import { VIDEO } from '../kit/theme';
import { formatSeconds, sceneTimeline } from '../video/project';
import { sceneSummary, type EditorScene } from './state';

type Props = {
  scenes: EditorScene[];
  selected: number;
  onSelect: (i: number) => void;
  onAdd: (partId: string) => void;
  onDuplicate: (i: number) => void;
  onDelete: (i: number) => void;
  onMove: (from: number, to: number) => void;
};

export const SceneList = ({ scenes, selected, onSelect, onAdd, onDuplicate, onDelete, onMove }: Props) => {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);

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
      <div className="col-title">
        シーン <span className="muted">{scenes.length}</span>
      </div>
      <ol className="scenes" onDragLeave={(e) => e.currentTarget === e.target && setDropAt(null)}>
        {scenes.map((scene, i) => {
          const part = getPart(scene.part);
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
              <div className="scene-no">{i + 1}</div>
              <div className="scene-main">
                <div className="scene-part">
                  {part ? part.meta.name : <span className="warn">不明な部品: {scene.part}</span>}
                  <span className="scene-time">{scene.seconds}秒</span>
                </div>
                <div className="scene-summary">{sceneSummary(scene) || '(空)'}</div>
                <div className="scene-at">{formatSeconds(starts[i])} から</div>
              </div>
              <div className="scene-tools">
                <button
                  type="button"
                  title="複製"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate(i);
                  }}
                >
                  ⧉
                </button>
                <button
                  type="button"
                  title="削除"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(i);
                  }}
                >
                  🗑
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="add-scene">
        <button type="button" className="primary wide" onClick={() => setPicking((v) => !v)}>
          + シーンを追加
        </button>
        {picking && (
          <div className="part-picker">
            {parts.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onAdd(p.id);
                  setPicking(false);
                }}
              >
                <b>{p.meta.name}</b> <span className="muted">{p.id}</span>
                <div className="muted small">{p.meta.description}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {partErrors.length > 0 && (
        <div className="part-errors">
          <b>読み込めなかった部品</b>
          {partErrors.map((e) => (
            <div key={e.id}>
              {e.id}: {e.message}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
};
