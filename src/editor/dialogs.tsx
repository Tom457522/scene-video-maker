/**
 * ブラウザ標準の confirm / prompt / alert の代わり。ボタンに「何が起きるか」を書けるようにする。
 * どこからでも askConfirm / askText / showAlert を呼べ、画面には <DialogHost /> が出す。
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Modal } from './Modal';

type Request =
  | { kind: 'confirm'; title: string; message: string; ok: string; cancel: string; danger?: boolean; resolve: (v: boolean) => void }
  | { kind: 'text'; title: string; message: string; ok: string; initial: string; validate?: (v: string) => string; resolve: (v: string | null) => void }
  | { kind: 'alert'; title: string; message: string; resolve: () => void };

let queue: Request[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const push = (r: Request) => {
  queue = [...queue, r];
  emit();
};
const pop = () => {
  queue = queue.slice(1);
  emit();
};

/** はい / いいえ を尋ねる。ok・cancel にはボタンの文字を書く */
export const askConfirm = (o: { title: string; message: string; ok: string; cancel?: string; danger?: boolean }) =>
  new Promise<boolean>((resolve) => push({ kind: 'confirm', cancel: 'やめる', ...o, resolve }));

/** 文字を 1 つ入れてもらう。やめたら null。validate はまちがいの説明(なければ空文字)を返す */
export const askText = (o: { title: string; message: string; ok: string; initial?: string; validate?: (v: string) => string }) =>
  new Promise<string | null>((resolve) => push({ kind: 'text', initial: '', ...o, resolve }));

/** 知らせる(エラーなど) */
export const showAlert = (title: string, message: string) => new Promise<void>((resolve) => push({ kind: 'alert', title, message, resolve }));

const TextForm = ({ req }: { req: Extract<Request, { kind: 'text' }> }) => {
  const [value, setValue] = useState(req.initial);
  const input = useRef<HTMLInputElement>(null);
  // 最初の文字(「新しい動画」など)は選んだ状態にして、そのまま打てば置き換わるようにする
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);
  const error = req.validate?.(value.trim()) ?? '';
  const done = (v: string | null) => {
    pop();
    req.resolve(v);
  };
  return (
    <Modal title={req.title} onClose={() => done(null)}>
      <form
        className="fields"
        onSubmit={(e) => {
          e.preventDefault();
          if (!error && value.trim()) done(value.trim());
        }}
      >
        <label className="field">
          <div className="label">{req.message}</div>
          <input ref={input} type="text" autoFocus value={value} maxLength={60} onChange={(e) => setValue(e.target.value)} />
          {error && <div className="hint warn">{error}</div>}
        </label>
        <div className="modal-actions">
          <button type="button" onClick={() => done(null)}>
            やめる
          </button>
          <button type="submit" className="primary" disabled={!!error || !value.trim()}>
            {req.ok}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export const DialogHost = () => {
  const req = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => queue[0],
  );
  // 画面を離れるときに残っていた問いは「やめる」にする
  useEffect(() => () => queue.forEach((r) => (r.kind === 'confirm' ? r.resolve(false) : r.kind === 'text' ? r.resolve(null) : r.resolve())), []);
  if (!req) return null;
  if (req.kind === 'text') return <TextForm key={req.title + req.initial} req={req} />;
  if (req.kind === 'alert') {
    const done = () => {
      pop();
      req.resolve();
    };
    return (
      <Modal title={req.title} onClose={done}>
        <p className="pre-line">{req.message}</p>
        <div className="modal-actions">
          <button type="button" className="primary" autoFocus onClick={done}>
            閉じる
          </button>
        </div>
      </Modal>
    );
  }
  const done = (v: boolean) => {
    pop();
    req.resolve(v);
  };
  return (
    <Modal title={req.title} onClose={() => done(false)}>
      <p className="pre-line">{req.message}</p>
      <div className="modal-actions">
        <button type="button" onClick={() => done(false)}>
          {req.cancel}
        </button>
        <button type="button" className={req.danger ? 'danger-btn' : 'primary'} autoFocus onClick={() => done(true)}>
          {req.ok}
        </button>
      </div>
    </Modal>
  );
};
