/**
 * 右列: 選択中のシーンの設定。いちばん上に文字の入力欄を置き、
 * 秒数・章の区切り・画像の書き出しは「詳しい設定」に折りたたむ(注意があるときだけ上に出す)。
 */
import type { ReactNode } from 'react';
import { getPart, resolveProps } from '../parts/registry';
import { MAX_SECONDS, MIN_SECONDS } from '../video/project';
import { isTooShort, recommendedSeconds } from '../video/reading';
import { SchemaForm } from './SchemaForm';
import { ReadabilityHint, SMALL_TEXT, useSmallestText } from './Readability';
import type { Settings } from '../video/project';
import type { EditorScene } from './state';
import { UiIcon } from './ui-icons';

type Props = {
  scene: EditorScene | undefined;
  index: number;
  /** field は変更した項目('seconds' / 'props')。続けての入力を 1 回の「元に戻す」にまとめるのに使う */
  onChange: (scene: EditorScene, field: string) => void;
  /** 「種類を変える」を開く */
  onChangePart: () => void;
  onExportStill: () => void;
  stillBusy: boolean;
  /** 右列の上のタブ */
  header: ReactNode;
  settings: Settings;
};

export const SceneSettings = ({ scene, index, onChange, onChangePart, onExportStill, stillBusy, header, settings }: Props) => {
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
  const rec = resolved ? Math.min(MAX_SECONDS, recommendedSeconds(resolved.props)) : null;
  const short = resolved ? isTooShort(scene.seconds, resolved.props) : false;
  const small = smallest !== null && Math.round(smallest.size) < SMALL_TEXT;
  const fitSeconds = () => rec !== null && onChange({ ...scene, seconds: rec }, 'seconds-auto');
  return (
    <aside className="col col-right">
      {header}
      <div className="scene-head">
        <div>
          <div className="muted small">シーン {index + 1} の種類</div>
          <b className="scene-kind">{part ? part.meta.name : `不明(${scene.part})`}</b>
        </div>
        <button type="button" onClick={onChangePart}>
          種類を変える
        </button>
      </div>

      {short && rec !== null && (
        <div className="notice warn-notice">
          <UiIcon name="alert" size={16} />
          <span>
            {scene.seconds} 秒では、読み切るには短めです(目安 {rec} 秒)。
          </span>
          <button type="button" className="small-btn" onClick={fitSeconds}>
            目安に合わせる
          </button>
        </div>
      )}
      {small && (
        <div className="notice warn-notice">
          <UiIcon name="alert" size={16} />
          <ReadabilityHint smallest={smallest} />
        </div>
      )}
      {probe}

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
        <p className="warn">種類「{scene.part}」が見つかりません。「種類を変える」で別の種類を選んでください。</p>
      )}

      <details className="more-settings">
        <summary>
          <UiIcon name="chevronRight" size={16} className="chev" />
          <span>
            <span className="more-title">詳しい設定</span>
            <span className="hint">
              長さ {scene.seconds} 秒 ・ 章の区切り{scene.chapter ? `「${scene.chapter}」` : ''} ・ 画像で書き出す
            </span>
          </span>
        </summary>
        <div className="fields">
          <div className="field">
            <div className="label">長さ(秒)</div>
            <div className="seconds">
              <input
                type="range"
                min={MIN_SECONDS}
                max={20}
                step={0.5}
                value={Math.min(scene.seconds, 20)}
                aria-label="長さ(秒)"
                onChange={(e) => onChange({ ...scene, seconds: Number(e.target.value) }, 'seconds')}
              />
              <input
                type="number"
                min={MIN_SECONDS}
                max={MAX_SECONDS}
                step={0.5}
                value={scene.seconds}
                aria-label="長さ(秒)の数字"
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (e.target.value !== '' && Number.isFinite(n)) onChange({ ...scene, seconds: Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, n)) }, 'seconds');
                }}
              />
              <span className="muted">秒</span>
            </div>
            {rec !== null && (
              <div className={short ? 'hint warn' : 'hint'}>
                読み切る目安: 約 {rec} 秒
                {scene.seconds !== rec && (
                  <button type="button" className="link" onClick={fitSeconds}>
                    目安に合わせる
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="field">
            <div className="label">章の区切り</div>
            <input
              type="text"
              maxLength={40}
              value={scene.chapter ?? ''}
              placeholder="空欄なら見出しから自動で決める"
              aria-label="章の区切り"
              onChange={(e) => {
                const { chapter: _old, ...rest } = scene;
                onChange(e.target.value === '' ? rest : { ...scene, chapter: e.target.value }, 'chapter');
              }}
            />
            <div className="hint">章の名前を書くと、このシーンから新しい章になります(章の表示・YouTube の章・縦長の動画に使う)。</div>
          </div>
          {!small && <ReadabilityHint smallest={smallest} />}
          <button type="button" className="still-btn" onClick={onExportStill} disabled={stillBusy} title="このシーンの見どころ(70% の時点)を PNG で書き出す">
            <UiIcon name="image" size={16} />
            {stillBusy ? '書き出し中…' : 'このシーンを画像(PNG)で書き出す'}
          </button>
        </div>
      </details>
    </aside>
  );
};
