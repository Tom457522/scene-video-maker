/** 画面中央のダイアログと、ボタンを押すと開くメニュー */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { UiIcon, type UiIconName } from './ui-icons';

/** 画面中央のダイアログ。Esc か背景のクリックで閉じる */
export const Modal = ({
  title,
  subtitle,
  onClose,
  children,
  wide,
  size,
}: {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** 幅を広くする(size="wide" と同じ) */
  wide?: boolean;
  size?: 'normal' | 'wide' | 'xwide';
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const s = size ?? (wide ? 'wide' : 'normal');
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${s}`} role="dialog" aria-label={title}>
        <div className="modal-head">
          <div>
            <b>{title}</b>
            {subtitle && <div className="muted small">{subtitle}</div>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="閉じる">
            <UiIcon name="close" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
};

/**
 * ボタンを押すと開く小さな窓。外をクリックするか Esc で閉じる。
 * children は閉じる関数を受け取って中身を返す
 */
export const Dropdown = ({
  trigger,
  label,
  className,
  align = 'left',
  children,
}: {
  /** ボタンの中身 */
  trigger: ReactNode;
  /** ボタンの読み上げ用の名前 */
  label: string;
  className?: string;
  align?: 'left' | 'right';
  children: (close: () => void) => ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);
  return (
    <div className="dropdown" ref={box}>
      <button type="button" className={[className, open ? 'open' : ''].filter(Boolean).join(' ')} aria-label={label} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {trigger}
      </button>
      {open && <div className={`dropdown-panel ${align}`}>{children(() => setOpen(false))}</div>}
    </div>
  );
};

export type MenuEntry =
  | { kind?: 'item'; label: string; onClick: () => void; icon?: UiIconName; disabled?: boolean; hint?: string; danger?: boolean; current?: boolean; note?: string }
  | { kind: 'heading'; label: string }
  | { kind: 'separator' };

/** Dropdown の中に並べる項目 */
export const MenuList = ({ items, close }: { items: MenuEntry[]; close: () => void }) => (
  <div className="menu-list" role="menu">
    {items.map((it, i) => {
      if (it.kind === 'separator') return <div key={i} className="menu-sep" />;
      if (it.kind === 'heading')
        return (
          <div key={i} className="menu-heading">
            {it.label}
          </div>
        );
      return (
        <button
          key={i}
          type="button"
          role="menuitem"
          className={['menu-item', it.danger ? 'danger' : '', it.current ? 'current' : ''].filter(Boolean).join(' ')}
          disabled={it.disabled}
          title={it.hint}
          onClick={() => {
            close();
            it.onClick();
          }}
        >
          <span className="menu-icon">{it.icon ? <UiIcon name={it.icon} size={16} /> : it.current ? <UiIcon name="check" size={16} /> : null}</span>
          <span className="menu-label">{it.label}</span>
          {it.note && <span className="menu-note">{it.note}</span>}
        </button>
      );
    })}
  </div>
);
