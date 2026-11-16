/**
 * 「動画にする」: 書き出す前の確認 → どこで使うか(形式)→ ファイルの大きさ → 書き出しを始める。
 * 書き出したファイルの一覧と、ほかの書き出し(PNG・字幕・YouTube の章・まとめて)もここに置く。
 */
import { VIDEO } from '../kit/theme';
import { EXPORT_FORMATS, type ExportFormat, type Quality } from '../remotion/composition-id';
import { formatSeconds } from '../video/project';
import type { RenderJob } from './api';
import { JobRow } from './ExportsDialog';
import { FORMAT_CHOICES, QUALITY_CHOICES, type Issue } from './guide';
import { Modal } from './Modal';
import { UiIcon } from './ui-icons';

type Props = {
  title: string;
  sceneCount: number;
  totalFrames: number;
  selected: number;
  jobs: RenderJob[];
  issues: Issue[];
  /** 文字の大きさをまだ測っているシーンがある */
  checking: boolean;
  /** 今の内容と同じ書き出し: starting 始めている / running 書き出し中 / done 書き終えた */
  exportState: 'starting' | 'running' | 'done' | null;
  format: ExportFormat;
  quality: Quality;
  onFormat: (f: ExportFormat) => void;
  onQuality: (q: Quality) => void;
  onStart: () => void;
  onIssue: (issue: Issue) => void;
  onFixIssue: (issue: Issue) => void;
  onStill: () => void;
  stillBusy: boolean;
  onSrt: () => void;
  onChapters: () => void;
  onBatch: () => void;
  onClose: () => void;
};

export const ExportDialog = (p: Props) => {
  const gif = EXPORT_FORMATS[p.format].codec === 'gif';
  return (
    <Modal title="動画にする" subtitle={`${p.title || '(タイトルなし)'} ・ ${p.sceneCount} シーン ・ ${formatSeconds(p.totalFrames / VIDEO.fps)}`} onClose={p.onClose} wide>
      <div className="export-dialog">
        <section>
          <div className="section-title">書き出す前の確認</div>
          <div className="check-box">
            {p.issues.length === 0 ? (
              <div className="check-row ok">
                <UiIcon name="check" />
                <span>{p.checking ? '文字の大きさを確かめています…' : '気になるところはありません'}</span>
              </div>
            ) : (
              p.issues.map((iss, i) => (
                <div key={i} className="check-row warn-row">
                  <UiIcon name="alert" />
                  <button type="button" className="issue-go" onClick={() => p.onIssue(iss)}>
                    {iss.message}
                  </button>
                  {iss.fixSeconds !== undefined && (
                    <button type="button" className="small-btn" onClick={() => p.onFixIssue(iss)}>
                      目安に合わせる
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
          <div className="hint">文字の大きさは、シーンを選ぶと右の列で確かめられます。</div>
        </section>

        <section>
          <div className="section-title">どこで使いますか?</div>
          <div className="format-grid" role="radiogroup" aria-label="書き出す形式">
            {FORMAT_CHOICES.map((f) => (
              <label key={f.id} className={p.format === f.id ? 'format-card on' : 'format-card'}>
                <input type="radio" name="export-format" value={f.id} checked={p.format === f.id} onChange={() => p.onFormat(f.id)} />
                <b>{f.name}</b>
                <span className="muted small">{f.id === 'gif' ? `シーン ${p.selected + 1} だけを、くり返し再生` : f.detail}</span>
              </label>
            ))}
          </div>
        </section>

        {!gif && (
          <section className="row-section">
            <div className="section-title">ファイルの大きさ</div>
            <div className="segmented" role="radiogroup" aria-label="ファイルの大きさ">
              {QUALITY_CHOICES.map((q) => (
                <button key={q.id} type="button" role="radio" aria-checked={p.quality === q.id} className={p.quality === q.id ? 'on' : ''} onClick={() => p.onQuality(q.id)}>
                  {q.name}
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="start-row">
          <span className="hint">
            {p.exportState === 'running'
              ? '同じ内容を書き出しています。編集するか、形式を変えると、続けて書き出せます。'
              : '書き出し中も編集を続けられます。続けて押すと順番に書き出します。'}
          </span>
          <button type="button" className="accent big" onClick={p.onStart} disabled={p.exportState === 'starting' || p.exportState === 'running'}>
            <UiIcon name="play" />
            {p.exportState === 'starting' || p.exportState === 'running' ? '書き出し中…' : p.exportState === 'done' ? 'もう 1 本書き出す' : '書き出しを始める'}
          </button>
        </div>

        <section className="jobs-section">
          <div className="section-title">書き出したファイル</div>
          {p.jobs.length === 0 ? (
            <p className="muted small">まだ書き出していません。書き出したファイルは out/ フォルダにも残ります。</p>
          ) : (
            <div className="job-list">
              {p.jobs.map((j) => (
                <JobRow key={j.id} job={j} />
              ))}
            </div>
          )}
        </section>

        <div className="other-exports">
          <span className="muted">ほかの書き出し:</span>
          <button type="button" className="link" onClick={p.onStill} disabled={p.stillBusy}>
            {p.stillBusy ? '画像を書き出し中…' : `シーン ${p.selected + 1} を画像(PNG)で`}
          </button>
          <button type="button" className="link" onClick={p.onSrt}>
            字幕ファイル(SRT)
          </button>
          <button type="button" className="link" onClick={p.onChapters}>
            YouTube の章の時刻
          </button>
          <button type="button" className="link" onClick={p.onBatch}>
            いくつもの動画をまとめて
          </button>
        </div>
      </div>
    </Modal>
  );
};
