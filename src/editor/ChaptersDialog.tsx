/** YouTube の概要欄に貼る章の時刻 */
import { useState } from 'react';
import { getPart, resolveProps } from '../parts/registry';
import { buildChapters, youtubeChapters } from '../video/chapters';
import type { Project } from '../video/project';
import { Modal } from './Modal';

export const ChaptersDialog = ({ project, onClose }: { project: Project; onClose: () => void }) => {
  const chapters = buildChapters(project, (i) => {
    const s = project.scenes[i];
    const part = getPart(s.part);
    return part ? resolveProps(part, s.props).props : s.props;
  });
  const { text, warnings } = youtubeChapters(chapters);
  const [copied, setCopied] = useState(false);
  return (
    <Modal title="YouTube の章の時刻" onClose={onClose}>
      <p className="muted small">各シーンの見出しと開始時刻から作りました。同じ見出しが続くシーンは 1 つの章にまとめています。動画の概要欄に貼ると章になります。</p>
      <textarea className="chapters-text" readOnly value={text} onFocus={(e) => e.currentTarget.select()} />
      {warnings.map((w) => (
        <div key={w} className="hint warn">
          ⚠ {w}
        </div>
      ))}
      <div className="modal-actions">
        <button type="button" onClick={onClose}>
          閉じる
        </button>
        <button
          type="button"
          className="primary"
          onClick={() =>
            navigator.clipboard.writeText(text).then(
              () => setCopied(true),
              () => window.alert('コピーできませんでした。文字を選んで Ctrl+C でコピーしてください。'),
            )
          }
        >
          {copied ? 'コピーしました' : 'コピー'}
        </button>
      </div>
    </Modal>
  );
};
