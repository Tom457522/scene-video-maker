/** 文章(アウトライン)からシーンを作る(「シーンを追加」の中の 1 つのタブ) */
import { useMemo, useState } from 'react';
import { getPart } from '../parts/registry';
import { outlineToScenes } from './fromOutline';
import { OUTLINE_EXAMPLE } from './outline';
import { sceneSummary, type EditorScene } from './state';

const RULES = [
  ['# タイトル', 'タイトル(次の行はサブタイトル)'],
  ['## 見出し と - 項目', '箇条書き'],
  ['## 見出し と 1. 手順', '流れ図'],
  ['## 見出し と ラベル: 92%', '横棒グラフ'],
  ['## 〜の割合 と ラベル: 40%', '円グラフ'],
  ['## 〜の推移 と 2020年: 10', '折れ線グラフ'],
  ['1. 〜 が 6 個以上', '縦のステップ'],
  ['| A | B | C |(3 列以上)', '表'],
  ['## まとめ と - 項目', 'まとめ'],
  ['2008年: 出来事', '年表'],
  ['| 左 | 右 |(表)', '比較'],
  ['![説明](ファイル名)', '画像'],
  ['```js 〜 ```', 'コード'],
  ['Q: 〜 / A: 〜', 'Q&A'],
  ['>> 文 / -- 出典', '引用'],
  ['!! 約100万件 説明', '大きな数字'],
  ['> 文', '字幕'],
  ['[[語]]', '強調'],
];

export const OutlinePanel = ({
  onApply,
  onCancel,
  hasScenes,
}: {
  onApply: (scenes: EditorScene[], title: string, mode: 'replace' | 'append') => void;
  onCancel: () => void;
  hasScenes: boolean;
}) => {
  const [text, setText] = useState('');
  const result = useMemo(() => outlineToScenes(text), [text]);
  const apply = (mode: 'replace' | 'append') =>
    onApply(
      result.scenes.map((s) => s.scene),
      result.title,
      mode,
    );
  return (
    <div className="outline-panel">
      <p className="muted small">
        見出し(#)と箇条書き(-)などで書いた文章を、シーンの並びに変えます。
        <button type="button" className="link" onClick={() => setText(OUTLINE_EXAMPLE)}>
          見本を入れてみる
        </button>
      </p>
      <details className="rules">
        <summary>書き方の決まり(どう書くと、どのシーンになるか)</summary>
        <div className="rules-grid">
          {RULES.map(([k, v]) => (
            <div key={k}>
              <code>{k}</code> → {v}
            </div>
          ))}
        </div>
      </details>
      <div className="outline-grid">
        <textarea value={text} placeholder={OUTLINE_EXAMPLE} onChange={(e) => setText(e.target.value)} autoFocus aria-label="文章" />
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
        <button type="button" onClick={onCancel}>
          やめる
        </button>
        {hasScenes && (
          <button type="button" disabled={result.scenes.length === 0} onClick={() => apply('append')}>
            今のシーンの後ろに追加
          </button>
        )}
        <button type="button" className="primary" disabled={result.scenes.length === 0} onClick={() => apply('replace')}>
          {hasScenes ? '今のシーンと置き換える' : 'シーンを作る'}({result.scenes.length})
        </button>
      </div>
    </div>
  );
};
