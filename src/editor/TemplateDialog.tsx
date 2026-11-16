/** ひな形を選んで、今の動画のシーンにする */
import { useMemo, useState } from 'react';
import { getPart } from '../parts/registry';
import { outlineToScenes } from './fromOutline';
import { Modal } from './Modal';
import type { EditorScene } from './state';
import { TEMPLATES } from './templates';

export const TemplateDialog = ({ onApply, onClose }: { onApply: (scenes: EditorScene[], title: string) => void; onClose: () => void }) => {
  const [template, setTemplate] = useState(TEMPLATES[0]?.id ?? '');
  const preview = useMemo(() => {
    const t = TEMPLATES.find((x) => x.id === template);
    return t ? outlineToScenes(t.outline) : null;
  }, [template]);
  return (
    <Modal title="ひな形から作る" onClose={onClose} wide>
      <div className="fields">
        <div className="template-grid">
          {TEMPLATES.map((t) => (
            <button key={t.id} type="button" className={template === t.id ? 'template on' : 'template'} onClick={() => setTemplate(t.id)}>
              <b>{t.name}</b>
              <span className="muted small">{t.description}</span>
            </button>
          ))}
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
            disabled={!preview}
            onClick={() => {
              if (preview)
                onApply(
                  preview.scenes.map((s) => s.scene),
                  preview.title,
                );
              onClose();
            }}
          >
            このひな形で作る
          </button>
        </div>
      </div>
    </Modal>
  );
};
