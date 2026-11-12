/** 右列: 選択中のシーンの設定(部品の切り替え・入力項目・秒数) */
import { getPart, parts, resolveProps } from '../parts/registry';
import { MAX_SECONDS, MIN_SECONDS } from '../video/project';
import { SchemaForm } from './SchemaForm';
import type { EditorScene } from './state';

type Props = {
  scene: EditorScene | undefined;
  index: number;
  /** field は変更した項目('seconds' / 'props')。続けての入力を 1 回の「元に戻す」にまとめるのに使う */
  onChange: (scene: EditorScene, field: string) => void;
  onSwitchPart: (partId: string) => void;
};

export const SceneSettings = ({ scene, index, onChange, onSwitchPart }: Props) => {
  if (!scene) {
    return (
      <aside className="col col-right">
        <div className="col-title">設定</div>
        <p className="muted">左の一覧でシーンを選ぶか、追加してください。</p>
      </aside>
    );
  }
  const part = getPart(scene.part);
  const resolved = part ? resolveProps(part, scene.props) : null;
  return (
    <aside className="col col-right">
      <div className="col-title">シーン {index + 1} の設定</div>
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
        </div>
      </div>
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
