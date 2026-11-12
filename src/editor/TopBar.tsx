/** 上部: プロジェクトの切り替えとメニュー・名前・合計時間・元に戻す・保存・MP4 書き出し */
import type { ReactNode } from 'react';
import { VIDEO } from '../kit/theme';
import { formatSeconds } from '../video/project';
import { api, type RenderJob } from './api';
import { formatEta } from './ExportsDialog';
import { Menu } from './Modal';

type MenuItem = { label: string; onClick: () => void; disabled?: boolean; hint?: string };

type Props = {
  projects: string[];
  name: string;
  title: string;
  totalFrames: number;
  dirty: boolean;
  saving: boolean;
  /** 書き出しの一覧(新しい順) */
  jobs: RenderJob[];
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
  onShowJobs: () => void;
};

export const TopBar = (p: Props) => {
  const running = p.jobs.find((j) => j.status === 'running');
  const waiting = p.jobs.filter((j) => j.status === 'queued').length;
  const latest = p.jobs[0];
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
        <button type="button" className="accent" onClick={p.onExport} title="順番待ちに入れて書き出す(書き出し中でも追加できる)">
          書き出す
        </button>
        <button type="button" className="job" onClick={p.onShowJobs} title="書き出しの一覧">
          {running ? (
            <>
              <span className="bar">
                <span style={{ width: `${Math.round(running.progress * 100)}%` }} />
              </span>
              <span>
                {running.stage === 'rendering' ? '書き出し中' : '準備中'} {Math.round(running.progress * 100)}%
                {running.etaSeconds !== undefined && <span className="eta"> ・ {formatEta(running.etaSeconds)}</span>}
                {waiting > 0 && <span className="eta"> ・ あと {waiting} 件</span>}
              </span>
            </>
          ) : latest?.status === 'done' && latest.file ? (
            <span>✓ 完了(一覧から保存)</span>
          ) : latest?.status === 'error' ? (
            <span className="warn">失敗(一覧で確認)</span>
          ) : (
            <span className="muted">一覧</span>
          )}
        </button>
        {!running && latest?.status === 'done' && latest.file && (
          <a className="dl" href={api.outputUrl(latest.file)} download title={latest.file}>
            ⬇
          </a>
        )}
      </div>
    </header>
  );
};
