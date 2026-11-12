/** 右列: 選択中のシーンの設定(部品の切り替え・入力項目・秒数) */
import type { ReactNode } from 'react';
import { getPart, parts, resolveProps } from '../parts/registry';
import { MAX_SECONDS, MIN_SECONDS } from '../video/project';
import { isTooShort, recommendedSeconds } from '../video/reading';
import { SchemaForm } from './SchemaForm';
import { ReadabilityHint, useSmallestText } from './Readability';
import type { Settings } from '../video/project';
import type { EditorScene } from './state';

type Props = {
  scene: EditorScene | undefined;
  index: number;
  /** field は変更した項目('seconds' / 'props')。続けての入力を 1 回の「元に戻す」にまとめるのに使う */
  onChange: (scene: EditorScene, field: string) => void;
  onSwitchPart: (partId: string) => void;
  onExportStill: () => void;
  stillBusy: boolean;
  /** 右列の上のタブ */
  header: ReactNode;
  settings: Settings;
};

export const SceneSettings = ({ scene, index, onChange, onSwitchPart, onExportStill, stillBusy, header, settings }: Props) => {
  const { smallest, probe } = useSmallestText(scene, settings);
  if (!scene) {
    return (
      <aside className="col col-right">
        {header}
        <p className="muted">左の一覧でシーンを選ぶか、追加してください。</p>
      </aside>
    );
  }
  const part = getPart(scene.part);
  const resolved = part ? resolveProps(part, scene.props) : null;
  return (
    <aside className="col col-right">
      {header}
      <div className="col-title row">
        <span>シーン {index + 1} の設定</span>
        <button type="button" className="small-btn" onClick={onExportStill} disabled={stillBusy} title="このシーンの見どころ(70% の時点)を PNG で書き出す">
          {stillBusy ? '書き出し中…' : '🖼 PNG'}
        </button>
      </div>
      <div className="fields">
        <div className="field">
          <div className="label">部品</div>
          <select value={part ? scene.part : ''} onChange={(e) => onSwitchPart(e.target.value)}>
            {!part && <option value="">(不明: {scene.part})</option>}
            {parts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.meta.name}({p.id})
              </option>
            ))}
          </select>
          {part && <div className="hint">{part.meta.description}</div>}
        </div>
        <div className="field">
          <div className="label">秒数</div>
          <div className="seconds">
            <input
              type="range"
              min={MIN_SECONDS}
              max={20}
              step={0.5}
              value={Math.min(scene.seconds, 20)}
              onChange={(e) => onChange({ ...scene, seconds: Number(e.target.value) }, 'seconds')}
            />
            <input
              type="number"
              min={MIN_SECONDS}
              max={MAX_SECONDS}
              step={0.5}
              value={scene.seconds}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (e.target.value !== '' && Number.isFinite(n)) onChange({ ...scene, seconds: Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, n)) }, 'seconds');
              }}
            />
            <span className="muted">秒</span>
          </div>
          {resolved && (
            <div className={isTooShort(scene.seconds, resolved.props) ? 'hint warn' : 'hint'}>
              {isTooShort(scene.seconds, resolved.props) ? '⚠ 文字数に対して短めです。' : ''}
              読み切る目安: 約 {recommendedSeconds(resolved.props)} 秒
              {scene.seconds !== recommendedSeconds(resolved.props) && (
                <button
                  type="button"
                  className="link"
                  onClick={() => onChange({ ...scene, seconds: Math.min(MAX_SECONDS, recommendedSeconds(resolved.props)) }, 'seconds-auto')}
                >
                  目安に合わせる
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="fields" style={{ marginTop: 14 }}>
        <div className="field">
          <div className="label">章の区切り</div>
          <input
            type="text"
            maxLength={40}
            value={scene.chapter ?? ''}
            placeholder="空欄なら見出しから自動で決める"
            onChange={(e) => {
              const { chapter: _old, ...rest } = scene;
              onChange(e.target.value === '' ? rest : { ...scene, chapter: e.target.value }, 'chapter');
            }}
          />
          <div className="hint">ここに章の名前を書くと、このシーンから新しい章になる(章の表示・YouTube の章・縦長の動画に使う)。どこかで指定すると、指定したシーンだけが章の始まりになる</div>
        </div>
      </div>
      <ReadabilityHint smallest={smallest} />
      {probe}
      <hr />
      {part && resolved ? (
        <>
          {resolved.issues.length > 0 && (
            <div className="issues">
              入力に問題があるため、一部は既定値で表示しています:
              <ul>
                {resolved.issues.map((iss, i) => (
                  <li key={i}>
                    {iss.path.join('.')}: {iss.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <SchemaForm
            key={scene.key + scene.part}
            schema={part.schema}
            value={resolved.props}
            onChange={(props) => onChange({ ...scene, props }, 'props')}
          />
        </>
      ) : (
        <p className="warn">部品「{scene.part}」が見つかりません。上で別の部品を選んでください。</p>
      )}
    </aside>
  );
};
