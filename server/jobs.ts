/**
 * 書き出しの順番待ち。書き出しは重いので 1 つずつ順に行い、待っているものは取り消せる。
 * 実際の書き出しは runner(api.ts から渡す)が行う。テストでは偽物の runner を渡せる。
 */
export type JobStatus = 'queued' | 'running' | 'done' | 'error' | 'cancelled';
export type JobStage = 'waiting' | 'bundling' | 'browser' | 'rendering' | 'done';

export type Job = {
  id: string;
  /** プロジェクト名 */
  name: string;
  /** 一覧に出す説明(形式・画質など) */
  label: string;
  status: JobStatus;
  stage: JobStage;
  progress: number;
  /** 書き出し中の残り時間の見込み(秒) */
  etaSeconds?: number;
  file?: string;
  error?: string;
  createdAt: number;
};

export type RunContext = {
  onProgress: (stage: JobStage, progress: number) => void;
  /** 中止されたら true */
  isCancelled: () => boolean;
  /** 中止されたときに呼ばれる関数を登録する(書き出しを途中で止めるため) */
  onCancel: (fn: () => void) => void;
};

/** 中止で止まったときに runner が投げる */
export class JobCancelled extends Error {
  constructor() {
    super('中止しました');
  }
}

/** 一覧に残す件数 */
const KEEP = 50;

export const createQueue = <T,>(runner: (job: Job, payload: T, ctx: RunContext) => Promise<string>) => {
  const jobs: Job[] = [];
  const payloads = new Map<string, T>();
  const cancelHooks = new Map<string, () => void>();
  const cancelled = new Set<string>();
  let counter = 0;
  let busy = false;

  const pump = async () => {
    if (busy) return;
    const job = jobs.find((j) => j.status === 'queued');
    if (!job) return;
    busy = true;
    job.status = 'running';
    job.stage = 'bundling';
    let renderStarted = 0;
    try {
      job.file = await runner(job, payloads.get(job.id) as T, {
        onProgress: (stage, p) => {
          job.stage = stage;
          job.progress = p;
          if (stage === 'rendering') {
            if (renderStarted === 0) renderStarted = Date.now();
            const elapsed = (Date.now() - renderStarted) / 1000;
            job.etaSeconds = p > 0.03 ? Math.max(0, Math.round((elapsed / p) * (1 - p))) : undefined;
          }
        },
        isCancelled: () => cancelled.has(job.id),
        onCancel: (fn) => cancelHooks.set(job.id, fn),
      });
      job.status = 'done';
      job.stage = 'done';
      job.progress = 1;
    } catch (e) {
      if (cancelled.has(job.id) || e instanceof JobCancelled) job.status = 'cancelled';
      else {
        job.status = 'error';
        job.error = e instanceof Error ? e.message : String(e);
      }
    } finally {
      job.etaSeconds = undefined;
      payloads.delete(job.id);
      cancelHooks.delete(job.id);
      busy = false;
      // 古い記録を消す(終わったものだけ)
      while (jobs.length > KEEP && jobs[0].status !== 'queued' && jobs[0].status !== 'running') jobs.shift();
      void pump();
    }
  };

  return {
    /** 順番待ちに入れる。前のものが終わったら自動で始まる */
    enqueue: (name: string, label: string, payload: T): Job => {
      const job: Job = { id: String(++counter), name, label, status: 'queued', stage: 'waiting', progress: 0, createdAt: Date.now() };
      jobs.push(job);
      payloads.set(job.id, payload);
      void pump();
      return job;
    },
    list: (): Job[] => [...jobs].reverse(),
    get: (id: string): Job | undefined => jobs.find((j) => j.id === id),
    /** 待っているものは取り消し、書き出し中のものは止める */
    cancel: (id: string): boolean => {
      const job = jobs.find((j) => j.id === id);
      if (!job || (job.status !== 'queued' && job.status !== 'running')) return false;
      cancelled.add(id);
      if (job.status === 'queued') {
        job.status = 'cancelled';
        payloads.delete(id);
      } else cancelHooks.get(id)?.();
      return true;
    },
  };
};
