/** 全シーンの一括置換 */
import { useState } from 'react';
import { Modal } from './Modal';
import { findMatches } from './replace';
import type { EditorProject } from './state';

export const ReplaceDialog = ({
  project,
  onReplace,
  onClose,
}: {
  project: EditorProject;
  onReplace: (find: string, replacement: string) => void;
  onClose: () => void;
}) => {
  const [find, setFind] = useState('');
  const [repl, setRepl] = useState('');
  const m = findMatches(project, find);
  return (
    <Modal title="全シーンの一括置換" onClose={onClose}>
      <div className="fields">
        <div className="field">
          <div className="label">探す文字</div>
          <input type="text" autoFocus value={find} onChange={(e) => setFind(e.target.value)} />
        </div>
        <div className="field">
          <div className="label">置き換える文字</div>
          <input type="text" value={repl} onChange={(e) => setRepl(e.target.value)} />
        </div>
        <div className="muted small">
          {find === ''
            ? 'タイトル・各シーンの入力・チャンネル名・エンドカードの文が対象です。'
            : `${m.count} か所(シーン ${m.scenes.map((i) => i + 1).join('、') || 'なし'})`}
        </div>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            閉じる
          </button>
          <button
            type="button"
            className="primary"
            disabled={m.count === 0}
            onClick={() => {
              onReplace(find, repl);
              onClose();
            }}
          >
            すべて置換({m.count})
          </button>
        </div>
      </div>
    </Modal>
  );
};
