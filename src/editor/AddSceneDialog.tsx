/**
 * シーンを追加する: 種類から選ぶ(見た目の分かる縮小画像つき)/ 文章から作る / コピーしたシーンを貼り付け。
 * mode="change" のときは、選んでいるシーンの種類を変える(種類から選ぶだけ)。
 */
import { Player, Thumbnail } from '@remotion/player';
import { memo, useMemo, useState } from 'react';
import { VIDEO } from '../kit/theme';
import { defaultProps, partErrors, parts, type PartDef } from '../parts/registry';
import { ProjectVideo } from '../video/ProjectVideo';
import { defaultSettings, type Project, type Scene } from '../video/project';
import { OTHER_GROUP, PART_GROUPS, groupOf, sortByGroup } from './guide';
import { Modal } from './Modal';
import { OutlinePanel } from './OutlinePanel';
import { sceneSummary, type EditorScene } from './state';
import { getPart } from '../parts/registry';

export type AddTab = 'kinds' | 'outline' | 'paste';

/** 種類の見本(既定の入力で、見どころの 70% の時点)。カーソルを当てている間は動きを再生する */
const PartPreview = memo(({ part, playing }: { part: PartDef; playing: boolean }) => {
  const frames = Math.round(part.meta.defaultSeconds * VIDEO.fps);
  const inputProps = useMemo(
    (): { project: Project } => ({ project: { title: '', settings: defaultSettings(), scenes: [{ part: part.id, seconds: part.meta.defaultSeconds, props: defaultProps(part) }] } }),
    [part],
  );
  const common = { component: ProjectVideo, inputProps, compositionWidth: VIDEO.width, compositionHeight: VIDEO.height, durationInFrames: frames, fps: VIDEO.fps, style: { width: '100%' } };
  return playing ? (
    // 見本の絵(70% の時点)から動き始め、繰り返しで頭から再生する(最初の何もない場面で止まって見えないように)
    <Player {...common} autoPlay loop controls={false} initialFrame={Math.floor(frames * 0.7)} acknowledgeRemotionLicense />
  ) : (
    <Thumbnail {...common} frameToDisplay={Math.floor(frames * 0.7)} />
  );
});
PartPreview.displayName = 'PartPreview';

/** 種類の一覧(絞り込みつき)。選んだら onPick */
export const PartPicker = ({ onPick, current }: { onPick: (id: string) => void; current?: string }) => {
  const [group, setGroup] = useState('all');
  const [hover, setHover] = useState<string | null>(null);
  const sorted = useMemo(() => sortByGroup(parts), []);
  const groups = [...PART_GROUPS.filter((g) => g.parts.some((id) => parts.some((p) => p.id === id))), ...(sorted.some((p) => groupOf(p.id) === OTHER_GROUP) ? [{ id: OTHER_GROUP, label: 'そのほか', parts: [] }] : [])];
  const shown = sorted.filter((p) => group === 'all' || groupOf(p.id) === group);
  return (
    <div className="part-picker-panel">
      <div className="chips" role="radiogroup" aria-label="伝えたいこと">
        <span className="muted small">伝えたいこと:</span>
        {[{ id: 'all', label: 'すべて' }, ...groups].map((g) => (
          <button key={g.id} type="button" role="radio" aria-checked={group === g.id} className={group === g.id ? 'chip on' : 'chip'} onClick={() => setGroup(g.id)}>
            {g.label}
          </button>
        ))}
      </div>
      <div className="part-grid">
        {shown.map((p) => (
          <button
            key={p.id}
            type="button"
            className={p.id === current ? 'part-card current' : 'part-card'}
            onClick={() => onPick(p.id)}
            onMouseEnter={() => setHover(p.id)}
            onMouseLeave={() => setHover((h) => (h === p.id ? null : h))}
            onFocus={() => setHover(p.id)}
            onBlur={() => setHover((h) => (h === p.id ? null : h))}
          >
            <div className="part-thumb">
              <PartPreview part={p} playing={hover === p.id} />
            </div>
            <b>
              {p.meta.name}
              {p.id === current && <span className="muted small">(今の種類)</span>}
            </b>
            <span className="muted small">{p.meta.description}</span>
          </button>
        ))}
      </div>
      {partErrors.length > 0 && (
        <div className="part-errors">
          <b>読み込めなかった種類</b>
          {partErrors.map((e) => (
            <div key={e.id}>
              {e.id}: {e.message}
            </div>
          ))}
        </div>
      )}
      <p className="muted small">
        カードにカーソルを当てると動きが流れます。
        <a href="/?gallery" target="_blank" rel="noreferrer">
          すべての種類の見本を、いろいろな入力で見る
        </a>
      </p>
    </div>
  );
};

type Props = {
  /** シーンを入れる位置の説明(「シーン 2 の後ろに入ります」など) */
  where: string;
  initialTab?: AddTab;
  hasScenes: boolean;
  copied: Scene[] | null;
  onAdd: (partId: string) => void;
  onOutline: (scenes: EditorScene[], title: string, mode: 'replace' | 'append') => void;
  onPaste: () => void;
  onClose: () => void;
};

export const AddSceneDialog = ({ where, initialTab = 'kinds', hasScenes, copied, onAdd, onOutline, onPaste, onClose }: Props) => {
  const [tab, setTab] = useState<AddTab>(initialTab);
  const tabs: [AddTab, string][] = [
    ['kinds', '種類から選ぶ'],
    ['outline', '文章から作る'],
    ['paste', `コピーしたシーンを貼り付け${copied ? `(${copied.length})` : ''}`],
  ];
  return (
    <Modal title="シーンを追加" subtitle={where} onClose={onClose} size="xwide">
      <div className="tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'kinds' && (
        <PartPicker
          onPick={(id) => {
            onAdd(id);
            onClose();
          }}
        />
      )}
      {tab === 'outline' && (
        <OutlinePanel
          hasScenes={hasScenes}
          onCancel={onClose}
          onApply={(scenes, title, mode) => {
            onOutline(scenes, title, mode);
            onClose();
          }}
        />
      )}
      {tab === 'paste' &&
        (copied ? (
          <div className="paste-panel">
            <p className="muted small">ほかのプロジェクトでコピーしたシーンも貼り付けられます(シーンを選んで Ctrl+C でコピー、Ctrl+V で貼り付けもできます)。</p>
            <ol className="paste-list">
              {copied.map((s, i) => (
                <li key={i}>
                  <b>{getPart(s.part)?.meta.name ?? s.part}</b> <span className="muted">{sceneSummary(s)}</span>
                </li>
              ))}
            </ol>
            <div className="modal-actions">
              <button type="button" onClick={onClose}>
                やめる
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => {
                  onPaste();
                  onClose();
                }}
              >
                {copied.length} シーンを貼り付ける
              </button>
            </div>
          </div>
        ) : (
          <p className="muted">コピーしたシーンはまだありません。シーンの一覧でシーンを選んで Ctrl+C(またはコピーのボタン)でコピーできます。</p>
        ))}
    </Modal>
  );
};

/** 選んでいるシーンの種類を変える */
export const ChangePartDialog = ({ current, onPick, onClose }: { current: string; onPick: (id: string) => void; onClose: () => void }) => (
  <Modal title="シーンの種類を変える" subtitle="入力した文字は、新しい種類にも使える項目だけ引き継ぎます(Ctrl+Z で戻せます)" onClose={onClose} size="xwide">
    <PartPicker
      current={current}
      onPick={(id) => {
        onPick(id);
        onClose();
      }}
    />
  </Modal>
);
