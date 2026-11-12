/** 書き出しの一覧(順番待ち・書き出し中・終わったもの)と、まとめて書き出し */
import { useState } from 'react';
import { EXPORT_FORMATS, QUALITIES, type ExportFormat, type Quality } from '../remotion/composition-id';
import type { Project } from '../video/project';
import { api, type RenderJob } from './api';
import { Modal } from './Modal';

const stageLabel: Record<RenderJob['stage'], string> = {
  waiting: '順番待ち',
  bundling: '準備中(バンドル作成)',
  browser: '準備中(ブラウザ)',
  rendering: '書き出し中',
  done: '完了',
};

export const formatEta = (sec: number) => (sec < 60 ? `残り約 ${sec} 秒` : `残り約 ${Math.ceil(sec / 60)} 分`);

export const JobRow = ({ job }: { job: RenderJob }) => (
  <div className={`job-row job-${job.status}`}>
    <div className="job-main">
      <b>{job.name}</b> <span className="muted small">{job.label}</span>
      <div className="small">
        {job.status === 'queued' && <span className="muted">順番待ち</span>}
        {job.status === 'running' && (
          <>
            {stageLabel[job.stage]} {Math.round(job.progress * 100)}%{job.etaSeconds !== undefined && <span className="eta"> ・ {formatEta(job.etaSeconds)}</span>}
          </>
        )}
        {job.status === 'done' && job.file && (
          <a href={api.outputUrl(job.file)} download>
            ⬇ {job.file}
          </a>
        )}
        {job.status === 'cancelled' && <span className="muted">中止しました</span>}
        {job.status === 'error' && <span className="warn">失敗: {job.error?.split('\n')[0]}</span>}
      </div>
      {job.status === 'running' && (
        <div className="bar wide-bar">
          <div style={{ width: `${Math.round(job.progress * 100)}%` }} />
        </div>
      )}
    </div>
    {(job.status === 'queued' || job.status === 'running') && (
      <button type="button" className="small-btn" onClick={() => void api.cancelRender(job.id)}>
        {job.status === 'queued' ? '取り消す' : '中止'}
      </button>
    )}
  </div>
);

export const ExportsDialog = ({ jobs, onClose }: { jobs: RenderJob[]; onClose: () => void }) => (
  <Modal title="書き出しの一覧" onClose={onClose}>
    <p className="muted small">書き出しは 1 つずつ順に行います。終わったファイルは out/ にも保存されています。</p>
    {jobs.length === 0 && <p className="muted">まだ書き出していません。</p>}
    <div className="job-list">
      {jobs.map((j) => (
        <JobRow key={j.id} job={j} />
      ))}
    </div>
  </Modal>
);

/** まとめて書き出し: 複数のプロジェクト × 複数の形式を順番待ちに入れる */
export const BatchDialog = ({
  current,
  currentProject,
  projects,
  onQueued,
  onClose,
}: {
  current: string;
  currentProject: Project;
  projects: string[];
  onQueued: (n: number) => void;
  onClose: () => void;
}) => {
  const all = [...new Set([current, ...projects])];
  const [selected, setSelected] = useState<Set<string>>(new Set([current]));
  const [formats, setFormats] = useState<Set<ExportFormat>>(new Set(['720p']));
  const [quality, setQuality] = useState<Quality>('normal');
  const [busy, setBusy] = useState(false);
  const videoFormats = (Object.keys(EXPORT_FORMATS) as ExportFormat[]).filter((f) => !EXPORT_FORMATS[f].sceneOnly);
  const toggle = <T,>(set: Set<T>, v: T) => {
    const n = new Set(set);
    if (n.has(v)) n.delete(v);
    else n.add(v);
    return n;
  };
  const count = selected.size * formats.size;
  return (
    <Modal title="まとめて書き出し" onClose={onClose}>
      <div className="fields">
        <div className="field">
          <div className="label">プロジェクト</div>
          <div className="check-list">
            {all.map((n) => (
              <label key={n} className="check">
                <input type="checkbox" checked={selected.has(n)} onChange={() => setSelected((s) => toggle(s, n))} />
                {n}
                {n === current && <span className="muted small">(編集中の内容)</span>}
              </label>
            ))}
          </div>
        </div>
        <div className="field">
          <div className="label">形式</div>
          <div className="check-list">
            {videoFormats.map((f) => (
              <label key={f} className="check">
                <input type="checkbox" checked={formats.has(f)} onChange={() => setFormats((s) => toggle(s, f))} />
                {EXPORT_FORMATS[f].label} <span className="muted small">{EXPORT_FORMATS[f].detail}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="field">
          <div className="label">画質</div>
          <select value={quality} onChange={(e) => setQuality(e.target.value as Quality)}>
            {Object.entries(QUALITIES).map(([id, q]) => (
              <option key={id} value={id}>
                {q.label}({q.detail})
              </option>
            ))}
          </select>
        </div>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            やめる
          </button>
          <button
            type="button"
            className="primary"
            disabled={count === 0 || busy}
            onClick={async () => {
              setBusy(true);
              let n = 0;
              try {
                for (const name of all.filter((x) => selected.has(x))) {
                  // 編集中のプロジェクトは今の内容、ほかは保存してある内容を書き出す
                  const project = name === current ? currentProject : await api.load(name);
                  for (const f of videoFormats.filter((x) => formats.has(x))) {
                    await api.startRender(name, project, f, quality);
                    n++;
                  }
                }
              } catch (e) {
                window.alert(`順番待ちに入れられませんでした: ${(e as Error).message}`);
              }
              onQueued(n);
              onClose();
            }}
          >
            {count} 件を順番待ちに入れる
          </button>
        </div>
      </div>
    </Modal>
  );
};
