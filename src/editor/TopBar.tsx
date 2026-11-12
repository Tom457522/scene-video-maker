/** 上部: プロジェクトの切り替えとメニュー・名前・合計時間・元に戻す・保存・MP4 書き出し */
import type { ReactNode } from 'react';
import { VIDEO } from '../kit/theme';
import { formatSeconds } from '../video/project';
import { api, type RenderJob } from './api';
import { Menu } from './Modal';

type MenuItem = { label: string; onClick: () => void; disabled?: boolean; hint?: string };

type Props = {
  projects: string[];
  name: string;
  title: string;
  totalFrames: number;
  dirty: boolean;
  saving: boolean;
  job: RenderJob | null;
  message: string;
  canUndo: boolean;
  canRedo: boolean;
  projectMenu: MenuItem[];
  toolMenu: MenuItem[];
  /** 書き出しボタンの横に出す追加の操作(書き出し形式の選択など) */
  exportExtra?: ReactNode;
  onUndo: () => void;
  onRedo: () => void;
  onOpen: (name: string) => void;
  onTitle: (title: string) => void;
  onSave: () => void;
  onExport: () => void;
  onCancelExport: () => void;
};

const stageLabel: Record<RenderJob['stage'], string> = {
  bundling: '準備中(バンドル作成)',
  browser: '準備中(ブラウザ)',
  rendering: '書き出し中',
  done: '完了',
};

const formatEta = (sec: number) => (sec < 60 ? `残り約 ${sec} 秒` : `残り約 ${Math.ceil(sec / 60)} 分`);

export const TopBar = (p: Props) => {
  const busy = p.job?.status === 'running';
  return (
    <header className="topbar">
      <div className="brand">🎬 解説動画メーカー</div>
      <select value={p.name} onChange={(e) => p.onOpen(e.target.value)} title="プロジェクトを開く">
        {!p.projects.includes(p.name) && <option value={p.name}>{p.name}(未保存)</option>}
        {p.projects.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <Menu label="プロジェクト" items={p.projectMenu} />
      <Menu label="ツール" items={p.toolMenu} />
      <input type="text" className="title-input" value={p.title} placeholder="動画のタイトル" maxLength={100} onChange={(e) => p.onTitle(e.target.value)} />
      <div className="total" title="合計時間">
        ⏱ {formatSeconds(p.totalFrames / VIDEO.fps)}
      </div>
      <div className="history">
        <button type="button" onClick={p.onUndo} disabled={!p.canUndo} title="元に戻す(Ctrl+Z)" aria-label="元に戻す">
          ↶
        </button>
        <button type="button" onClick={p.onRedo} disabled={!p.canRedo} title="やり直し(Ctrl+Shift+Z / Ctrl+Y)" aria-label="やり直し">
          ↷
        </button>
      </div>
      <div className="spacer" />
      {p.message && <div className="message">{p.message}</div>}
      <button type="button" className={p.dirty ? 'primary' : ''} onClick={p.onSave} disabled={p.saving}>
        {p.saving ? '保存中…' : p.dirty ? '保存 ●' : '保存済み'}
      </button>
      <div className="export">
        {p.exportExtra}
        {busy ? (
          <button type="button" onClick={p.onCancelExport} title="書き出しを中止する">
            中止
          </button>
        ) : (
          <button type="button" className="accent" onClick={p.onExport}>
            MP4 書き出し
          </button>
        )}
        {p.job && (
          <div className={`job job-${p.job.status}`}>
            {p.job.status === 'running' && (
              <>
                <div className="bar">
                  <div style={{ width: `${Math.round(p.job.progress * 100)}%` }} />
                </div>
                <span>
                  {stageLabel[p.job.stage]} {Math.round(p.job.progress * 100)}%
                  {p.job.etaSeconds !== undefined && <span className="eta"> ・ {formatEta(p.job.etaSeconds)}</span>}
                </span>
              </>
            )}
            {p.job.status === 'done' && p.job.file && (
              <a href={api.outputUrl(p.job.file)} download>
                ⬇ {p.job.file}
              </a>
            )}
            {p.job.status === 'cancelled' && <span className="muted">中止しました</span>}
            {p.job.status === 'error' && <span title={p.job.error}>失敗: {p.job.error?.split('\n')[0]}</span>}
          </div>
        )}
      </div>
    </header>
  );
};
