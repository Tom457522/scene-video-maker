/** 新しいプロジェクト: 名前と、出発点(空 または ひな形)を選ぶ */
import { useMemo, useState } from 'react';
import { getPart } from '../parts/registry';
import { outlineToScenes } from './fromOutline';
import { Modal } from './Modal';
import type { EditorScene } from './state';
import { TEMPLATES } from './templates';

const NAME_RE = /^[\p{L}\p{N}_\- ]{1,60}$/u;

export const NewProjectDialog = ({
  existing,
  onCreate,
  onClose,
}: {
  existing: string[];
  /** scenes が null なら空のプロジェクト */
  onCreate: (name: string, scenes: EditorScene[] | null) => void;
  onClose: () => void;
}) => {
  const [name, setName] = useState('新しい動画');
  const [template, setTemplate] = useState<string>('');
  const preview = useMemo(() => {
    const t = TEMPLATES.find((x) => x.id === template);
    return t ? outlineToScenes(t.outline) : null;
  }, [template]);
  const error = !NAME_RE.test(name.trim()) ? '日本語・英数字・空白・_ - が使えます(60 文字まで)' : existing.includes(name.trim()) ? '同じ名前のプロジェクトがあります' : '';
  return (
    <Modal title="新しいプロジェクト" onClose={onClose} wide>
      <div className="fields">
        <div className="field">
          <div className="label">プロジェクト名(ファイル名)</div>
          <input type="text" autoFocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
          {error && <div className="hint warn">{error}</div>}
        </div>
        <div className="field">
          <div className="label">出発点</div>
          <div className="template-grid">
            <button type="button" className={template === '' ? 'template on' : 'template'} onClick={() => setTemplate('')}>
              <b>空のプロジェクト</b>
              <span className="muted small">タイトルのシーンが 1 つだけ</span>
            </button>
            {TEMPLATES.map((t) => (
              <button key={t.id} type="button" className={template === t.id ? 'template on' : 'template'} onClick={() => setTemplate(t.id)}>
                <b>{t.name}</b>
                <span className="muted small">{t.description}</span>
              </button>
            ))}
          </div>
        </div>
        {preview && (
          <div className="muted small">
            {preview.scenes.length} シーン: {preview.scenes.map((s) => getPart(s.scene.part)?.meta.name).join(' → ')}
            <br />( ) の中の文字を、自分の内容に書き換えて使ってください。
          </div>
        )}
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            やめる
          </button>
          <button
            type="button"
            className="primary"
            disabled={error !== ''}
            onClick={() => {
              onCreate(name.trim(), preview ? preview.scenes.map((s) => s.scene) : null);
              onClose();
            }}
          >
            作る
          </button>
        </div>
      </div>
    </Modal>
  );
};
