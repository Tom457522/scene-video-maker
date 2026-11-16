/**
 * 上部: プロジェクトのメニュー・動画のタイトル・長さ・元に戻す・保存の状態・確認・「動画にする」。
 * いつも見えるのは毎回使うものだけにし、ほかはメニューや「動画にする」の中に置く。
 */
import { VIDEO } from '../kit/theme';
import { formatSeconds } from '../video/project';
import type { RenderJob } from './api';
import { formatEta } from './ExportsDialog';
import type { Issue } from './guide';
import { Dropdown, MenuList, type MenuEntry } from './Modal';
import { UiIcon } from './ui-icons';

export type SaveState = 'saved' | 'pending' | 'saving' | 'error';

type Props = {
  name: string;
  title: string;
  sceneCount: number;
  totalFrames: number;
  saveState: SaveState;
  jobs: RenderJob[];
  message: string;
  issues: Issue[];
  canUndo: boolean;
  canRedo: boolean;
  projectMenu: MenuEntry[];
  onUndo: () => void;
  onRedo: () => void;
  onTitle: (title: string) => void;
  onSave: () => void;
  onIssue: (issue: Issue) => void;
  onFixIssue: (issue: Issue) => void;
  onExport: () => void;
};

const saveLabel: Record<SaveState, string> = {
  saved: '自動で保存済み',
  pending: '保存します…',
  saving: '保存中…',
  error: '保存できませんでした(押すともう一度)',
};

export const TopBar = (p: Props) => {
  const running = p.jobs.find((j) => j.status === 'running');
  const waiting = p.jobs.filter((j) => j.status === 'queued').length;
  return (
    <header className="topbar">
      <Dropdown
        label="プロジェクトのメニュー"
        className="project-btn"
        trigger={
          <>
            <UiIcon name="menu" />
            <span className="project-name">{p.name}</span>
            <UiIcon name="chevronDown" size={14} className="muted" />
          </>
        }
      >
        {(close) => <MenuList items={p.projectMenu} close={close} />}
      </Dropdown>
      <input
        type="text"
        className="title-input"
        value={p.title}
        placeholder="動画のタイトルを入力"
        aria-label="動画のタイトル"
        title="動画のタイトル(クリックして書き換える)"
        maxLength={100}
        onChange={(e) => p.onTitle(e.target.value)}
      />
      <div className="total" title="シーンの数と動画の長さ">
        {p.sceneCount} シーン ・ {formatSeconds(p.totalFrames / VIDEO.fps)}
      </div>
      <div className="spacer" />
      {p.message && (
        <div className="message" role="status">
          {p.message}
        </div>
      )}
      <div className="history">
        <button type="button" className="icon-btn" onClick={p.onUndo} disabled={!p.canUndo} title="元に戻す(Ctrl+Z)" aria-label="元に戻す">
          <UiIcon name="undo" />
        </button>
        <button type="button" className="icon-btn" onClick={p.onRedo} disabled={!p.canRedo} title="やり直し(Ctrl+Y)" aria-label="やり直し">
          <UiIcon name="redo" />
        </button>
      </div>
      <button
        type="button"
        className={`save-state ${p.saveState}`}
        onClick={p.onSave}
        title="変更は自動で保存されます。Ctrl+S ですぐに保存し、前の版として残します"
      >
        {p.saveState === 'saved' && <UiIcon name="check" size={16} />}
        {p.saveState === 'error' && <UiIcon name="alert" size={16} />}
        {saveLabel[p.saveState]}
      </button>
      {p.issues.length > 0 && (
        <Dropdown
          label={`確認 ${p.issues.length} 件`}
          className="issues-btn"
          align="right"
          trigger={
            <>
              <UiIcon name="alert" />
              確認 {p.issues.length} 件
            </>
          }
        >
          {(close) => (
            <div className="issue-list">
              <div className="menu-heading">直したほうがよいところ</div>
              {p.issues.map((iss, i) => (
                <div key={i} className="issue-row">
                  <button
                    type="button"
                    className="issue-go"
                    onClick={() => {
                      close();
                      p.onIssue(iss);
                    }}
                  >
                    {iss.message}
                  </button>
                  {iss.fixSeconds !== undefined && (
                    <button type="button" className="small-btn" onClick={() => p.onFixIssue(iss)}>
                      目安に合わせる
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Dropdown>
      )}
      {running && (
        <button type="button" className="job-mini" onClick={p.onExport} title="書き出しの進み具合(押すと一覧)">
          <span className="bar">
            <span style={{ width: `${Math.round(running.progress * 100)}%` }} />
          </span>
          書き出し中 {Math.round(running.progress * 100)}%
          {running.etaSeconds !== undefined && <span className="eta"> ・ {formatEta(running.etaSeconds)}</span>}
          {waiting > 0 && <span className="eta"> ・ あと {waiting} 件</span>}
        </button>
      )}
      <button type="button" className="accent export-btn" onClick={p.onExport} disabled={p.sceneCount === 0}>
        <UiIcon name="play" />
        動画にする
      </button>
    </header>
  );
};
