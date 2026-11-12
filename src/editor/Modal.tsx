/** 画面中央のダイアログ。Esc か背景のクリックで閉じる */
import { useEffect, type ReactNode } from 'react';

export const Modal = ({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={wide ? 'modal wide' : 'modal'} role="dialog" aria-label={title}>
        <div className="modal-head">
          <b>{title}</b>
          <button type="button" className="ghost" onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
};

/** ボタンを押すと開くメニュー */
export const Menu = ({ label, items }: { label: string; items: { label: string; onClick: () => void; disabled?: boolean; hint?: string }[] }) => (
  <details className="menu">
    <summary>{label} ▾</summary>
    <div className="menu-items">
      {items.map((it) => (
        <button
          key={it.label}
          type="button"
          disabled={it.disabled}
          title={it.hint}
          onClick={(e) => {
            (e.currentTarget.closest('details') as HTMLDetailsElement).open = false;
            it.onClick();
          }}
        >
          {it.label}
        </button>
      ))}
    </div>
  </details>
);
