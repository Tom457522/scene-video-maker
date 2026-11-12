/** 文章(アウトライン)からシーンを作る */
import { useMemo, useState } from 'react';
import { getPart } from '../parts/registry';
import { recommendedSeconds } from '../video/reading';
import { fitToSchema } from './fit';
import { Modal } from './Modal';
import { OUTLINE_EXAMPLE, parseOutline } from './outline';
import { newKey, sceneSummary, type EditorScene } from './state';

const RULES = [
  ['# タイトル', 'タイトル(次の行はサブタイトル)'],
  ['## 見出し と - 項目', '箇条書き'],
  ['## 見出し と 1. 手順', '流れ図'],
  ['## 見出し と ラベル: 92%', '横棒グラフ'],
  ['## まとめ と - 項目', 'まとめ'],
  ['> 文', '字幕(流れ図・横棒グラフ)'],
  ['[[語]]', '強調'],
];

export const OutlineDialog = ({
  onApply,
  onClose,
  hasScenes,
}: {
  onApply: (scenes: EditorScene[], title: string, mode: 'replace' | 'append') => void;
  onClose: () => void;
  hasScenes: boolean;
}) => {
  const [text, setText] = useState('');
  const result = useMemo(() => {
    const parsed = parseOutline(text);
    const scenes: { scene: EditorScene; notes: string[] }[] = [];
    for (const s of parsed.scenes) {
      const part = getPart(s.part) ?? getPart('bullets');
      if (!part) continue;
      const fitted = fitToSchema(part.schema, s.props);
      const merged = { ...(part.schema.parse({}) as Record<string, unknown>), ...fitted.props };
      scenes.push({
        scene: {
          key: newKey(),
          part: part.id,
          seconds: Math.min(60, Math.max(part.meta.defaultSeconds, recommendedSeconds(merged))),
          props: merged,
        },
        notes: fitted.notes,
      });
    }
    return { title: parsed.title, scenes };
  }, [text]);
  const apply = (mode: 'replace' | 'append') => {
    onApply(
      result.scenes.map((s) => s.scene),
      result.title,
      mode,
    );
    onClose();
  };
  return (
    <Modal title="文章からシーンを作る" onClose={onClose} wide>
      <p className="muted small">
        決まった書き方で書いた文章を、シーンの並びに変えます。
        {RULES.map(([k, v]) => (
          <span key={k} style={{ marginRight: 10, whiteSpace: 'nowrap' }}>
            <code>{k}</code> → {v}
          </span>
        ))}
      </p>
      <div className="outline-grid">
        <div>
          <textarea value={text} placeholder={OUTLINE_EXAMPLE} onChange={(e) => setText(e.target.value)} autoFocus />
          <button type="button" className="link" onClick={() => setText(OUTLINE_EXAMPLE)}>
            見本を入れる
          </button>
        </div>
        <div className="outline-preview">
          {result.scenes.length === 0 && <div className="muted">左に文章を書くと、ここにできるシーンが出ます。</div>}
          {result.scenes.map(({ scene, notes }, i) => (
            <div className="item" key={scene.key}>
              <b>
                {i + 1}. {getPart(scene.part)?.meta.name}
              </b>{' '}
              <span className="muted">{scene.seconds}秒</span>
              <div>{sceneSummary(scene)}</div>
              {notes.length > 0 && <div className="notes">⚠ {notes.join(' / ')}</div>}
            </div>
          ))}
        </div>
      </div>
      <div className="modal-actions">
        <button type="button" onClick={onClose}>
          閉じる
        </button>
        <button type="button" disabled={result.scenes.length === 0 || !hasScenes} onClick={() => apply('append')}>
          今のシーンの後ろに追加
        </button>
        <button type="button" className="primary" disabled={result.scenes.length === 0} onClick={() => apply('replace')}>
          {hasScenes ? '今のシーンと置き換える' : 'シーンを作る'}({result.scenes.length})
        </button>
      </div>
    </Modal>
  );
};
