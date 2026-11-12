/** 保存の履歴(前の版)から開く */
import { useEffect, useState } from 'react';
import type { Project } from '../video/project';
import { api, type HistoryEntry } from './api';
import { Modal } from './Modal';

export const HistoryDialog = ({ name, onOpen, onClose }: { name: string; onOpen: (p: Project, label: string) => void; onClose: () => void }) => {
  const [list, setList] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.history(name).then(setList, (e: Error) => setError(e.message));
  }, [name]);
  return (
    <Modal title={`「${name}」の保存の履歴`} onClose={onClose}>
      <p className="muted small">
        保存するたびに、その前の版が projects/.history/ に残ります(最新 30 件)。開くと編集中の内容がその版に置き換わります(保存するまでファイルは変わりません。Ctrl+Z で戻せます)。
      </p>
      {error && <p className="warn">{error}</p>}
      {list === null && !error && <p className="muted">読み込み中…</p>}
      {list?.length === 0 && <p className="muted">まだ前の版はありません。</p>}
      <ul className="history-list">
        {list?.map((h) => (
          <li key={h.id}>
            <span className="mono">{h.savedAt}</span>
            <span className="muted">
              {h.title || '(無題)'} ・ {h.scenes} シーン
            </span>
            <button
              type="button"
              onClick={() => api.historyVersion(name, h.id).then((p) => onOpen(p, h.savedAt), (e: Error) => setError(e.message))}
            >
              この版を開く
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
};
