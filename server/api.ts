/**
 * エディタ用の API(Vite の開発サーバーに組み込む)。127.0.0.1 からの利用だけを想定している。
 *
 *   GET  /api/projects            プロジェクト名の一覧
 *   GET  /api/projects/:name      読み込み
 *   PUT  /api/projects/:name      保存
 *   POST /api/render              MP4 書き出しを始める { name, project, format? } → { id }(format: 720p / 1080p / vertical)
 *   GET  /api/render/:id          書き出しの進み具合
 *   DELETE /api/projects/:name    削除(projects/.trash/ へ移す)
 *   POST /api/projects/:name/rename  名前の変更 { to }
 *   GET  /api/projects/:name/history       前の版の一覧
 *   GET  /api/projects/:name/history/:id   前の版の中身
 *   POST /api/render/:id/cancel   書き出しの中止
 *   GET  /api/assets              画像の一覧
 *   POST /api/assets              画像を保存 { name, data(base64) } → { name }
 *   POST /api/still               1 シーンを PNG で書き出す { name, project, scene } → { file }
 *   GET  /api/output/:file        書き出した MP4 のダウンロード
 */
import { createReadStream, promises as fs } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import type { Plugin } from 'vite';
import { projectSchema } from '../src/video/project.ts';
import { OUT_DIR, deleteProject, isValidName, listHistory, listProjects, readHistory, readProject, renameProject, writeProject } from './projects.ts';
import type { Stage } from './render.ts';
import { EXPORT_FORMATS, type ExportFormat } from '../src/remotion/composition-id.ts';
import { MAX_ASSET_BYTES, listAssets, saveAsset } from './assets.ts';

type Job = {
  id: string;
  name: string;
  status: 'running' | 'done' | 'error' | 'cancelled';
  stage: Stage;
  progress: number;
  /** 書き出し(rendering)の残り時間の見込み(秒) */
  etaSeconds?: number;
  file?: string;
  error?: string;
};

/** 中止のための関数(JSON には含めない) */
const cancellers = new Map<string, () => void>();

const jobs = new Map<string, Job>();
let running: Job | null = null;
let jobCounter = 0;

const MAX_BODY = 5 * 1024 * 1024;

const send = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
};

const readJson = (req: IncomingMessage, limit = MAX_BODY): Promise<unknown> =>
  new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('データが大きすぎます'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('JSON として読めません'));
      }
    });
    req.on('error', reject);
  });

/** ほかのサイトからの書き込み要求を断る(Origin がこのサーバー自身のときだけ許す) */
const sameOrigin = (req: IncomingMessage): boolean => {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
};

const errorMessage = (e: unknown): string => {
  if (e && typeof e === 'object' && 'issues' in e) {
    const issues = (e as { issues: { path: PropertyKey[]; message: string }[] }).issues;
    return issues.map((i) => `${i.path.join('.') || '(全体)'}: ${i.message}`).join('\n');
  }
  return e instanceof Error ? e.message : String(e);
};

const timestamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

const startRender = (name: string, project: unknown, format: ExportFormat): Job => {
  const parsed = projectSchema.parse(project);
  const id = String(++jobCounter);
  const file = `${name}${format === '720p' ? '' : `-${format}`}-${timestamp()}.mp4`;
  const job: Job = { id, name, status: 'running', stage: 'bundling', progress: 0 };
  jobs.set(id, job);
  running = job;
  void (async () => {
    let cancelled = false;
    let renderStarted = 0;
    try {
      const { renderVideo, makeCancelSignal, RenderCancelled } = await import('./render.ts');
      const { cancelSignal, cancel } = makeCancelSignal();
      cancellers.set(id, () => {
        cancelled = true;
        cancel();
      });
      try {
        await renderVideo(
          parsed,
          path.join(OUT_DIR, file),
          (stage, p) => {
            job.stage = stage;
            job.progress = p;
            if (stage === 'rendering') {
              if (renderStarted === 0) renderStarted = Date.now();
              const elapsed = (Date.now() - renderStarted) / 1000;
              job.etaSeconds = p > 0.03 ? Math.max(0, Math.round((elapsed / p) * (1 - p))) : undefined;
            }
          },
          { cancelSignal, isCancelled: () => cancelled, format },
        );
        job.status = 'done';
        job.file = file;
      } catch (e) {
        if (cancelled || e instanceof RenderCancelled) {
          job.status = 'cancelled';
          await fs.rm(path.join(OUT_DIR, file), { force: true }).catch(() => undefined);
        } else throw e;
      }
    } catch (e) {
      job.status = 'error';
      job.error = errorMessage(e);
      console.error('[書き出し失敗]', e);
    } finally {
      job.etaSeconds = undefined;
      cancellers.delete(id);
      running = null;
    }
  })();
  return job;
};

const handle = async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const method = req.method ?? 'GET';

  if (method !== 'GET' && method !== 'HEAD') {
    if (!sameOrigin(req)) return send(res, 403, { error: '別のサイトからの操作はできません' });
    if (!(req.headers['content-type'] ?? '').startsWith('application/json')) {
      return send(res, 415, { error: 'Content-Type は application/json にしてください' });
    }
  }

  if (parts[0] === 'projects') {
    if (parts.length === 1 && method === 'GET') return send(res, 200, { projects: await listProjects() });
    if (parts.length >= 2 && !isValidName(parts[1])) {
      return send(res, 400, { error: 'プロジェクト名には日本語・英数字・空白・_ - が使えます(60 文字まで)' });
    }
    if (parts.length === 3 && parts[2] === 'history' && method === 'GET') {
      return send(res, 200, { history: await listHistory(parts[1]) });
    }
    if (parts.length === 4 && parts[2] === 'history' && method === 'GET') {
      try {
        return send(res, 200, { project: await readHistory(parts[1], parts[3]) });
      } catch (e) {
        return send(res, 404, { error: errorMessage(e) });
      }
    }
    if (parts.length === 3 && parts[2] === 'rename' && method === 'POST') {
      try {
        const body = (await readJson(req)) as { to?: unknown };
        if (typeof body.to !== 'string' || !isValidName(body.to)) return send(res, 400, { error: '新しい名前が不正です' });
        await renameProject(parts[1], body.to);
        return send(res, 200, { name: body.to });
      } catch (e) {
        return send(res, 400, { error: errorMessage(e) });
      }
    }
    if (parts.length === 2) {
      const name = parts[1];
      if (!isValidName(name)) return send(res, 400, { error: 'プロジェクト名には日本語・英数字・空白・_ - が使えます(60 文字まで)' });
      if (method === 'GET') {
        try {
          return send(res, 200, { project: await readProject(name) });
        } catch (e) {
          const notFound = (e as NodeJS.ErrnoException).code === 'ENOENT';
          return send(res, notFound ? 404 : 400, { error: notFound ? 'プロジェクトが見つかりません' : errorMessage(e) });
        }
      }
      if (method === 'DELETE') {
        try {
          await deleteProject(name);
          return send(res, 200, { deleted: name });
        } catch (e) {
          return send(res, 400, { error: errorMessage(e) });
        }
      }
      if (method === 'PUT') {
        try {
          return send(res, 200, { project: await writeProject(name, await readJson(req)) });
        } catch (e) {
          return send(res, 400, { error: errorMessage(e) });
        }
      }
    }
  }

  if (parts[0] === 'render') {
    if (parts.length === 1 && method === 'POST') {
      if (running) return send(res, 409, { error: '別の書き出しが進行中です' });
      try {
        const body = (await readJson(req)) as { name?: unknown; project?: unknown; format?: unknown };
        const name = typeof body.name === 'string' && isValidName(body.name) ? body.name : 'video';
        const format = typeof body.format === 'string' && body.format in EXPORT_FORMATS ? (body.format as ExportFormat) : '720p';
        const job = startRender(name, body.project, format);
        return send(res, 202, { job });
      } catch (e) {
        return send(res, 400, { error: errorMessage(e) });
      }
    }
    if (parts.length === 3 && parts[2] === 'cancel' && method === 'POST') {
      const cancel = cancellers.get(parts[1]);
      if (!cancel) return send(res, 404, { error: '進行中の書き出しが見つかりません' });
      cancel();
      return send(res, 202, { ok: true });
    }
    if (parts.length === 2 && method === 'GET') {
      const job = jobs.get(parts[1]);
      return job ? send(res, 200, { job }) : send(res, 404, { error: '書き出しが見つかりません' });
    }
  }

  if (parts[0] === 'assets' && parts.length === 1) {
    if (method === 'GET') return send(res, 200, { assets: await listAssets() });
    if (method === 'POST') {
      try {
        // base64 は元の大きさの約 4/3 になる
        const body = (await readJson(req, Math.ceil(MAX_ASSET_BYTES * 1.4) + 1024)) as { name?: unknown; data?: unknown };
        if (typeof body.name !== 'string' || typeof body.data !== 'string') return send(res, 400, { error: 'name と data(base64)が必要です' });
        const name = await saveAsset(body.name, Buffer.from(body.data, 'base64'));
        return send(res, 200, { name });
      } catch (e) {
        return send(res, 400, { error: errorMessage(e) });
      }
    }
  }

  if (parts[0] === 'still' && parts.length === 1 && method === 'POST') {
    try {
      const body = (await readJson(req)) as { name?: unknown; project?: unknown; scene?: unknown };
      const name = typeof body.name === 'string' && isValidName(body.name) ? body.name : 'video';
      const scene = typeof body.scene === 'number' && Number.isInteger(body.scene) ? body.scene : -1;
      const project = projectSchema.parse(body.project);
      if (scene < 0 || scene >= project.scenes.length) return send(res, 400, { error: 'シーンの指定が不正です' });
      const file = `${name}-scene${scene + 1}-${timestamp()}.png`;
      const { renderOneStill } = await import('./render.ts');
      await renderOneStill(project, scene, path.join(OUT_DIR, file));
      return send(res, 200, { file });
    } catch (e) {
      return send(res, 400, { error: errorMessage(e) });
    }
  }

  if (parts[0] === 'output' && parts.length === 2 && method === 'GET') {
    const file = parts[1];
    // out/ 直下の .mp4 と .png だけを返す
    const type = file.endsWith('.mp4') ? 'video/mp4' : file.endsWith('.png') ? 'image/png' : null;
    if (path.basename(file) !== file || !type) return send(res, 400, { error: '不正なファイル名です' });
    const full = path.join(OUT_DIR, file);
    try {
      const stat = await fs.stat(full);
      res.statusCode = 200;
      res.setHeader('Content-Type', type);
      res.setHeader('Content-Length', String(stat.size));
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file)}`);
      createReadStream(full).pipe(res);
      return;
    } catch {
      return send(res, 404, { error: 'ファイルが見つかりません' });
    }
  }

  return send(res, 404, { error: 'API が見つかりません' });
};

export const sceneApi = (): Plugin => ({
  name: 'scene-video-api',
  configureServer(server) {
    // 起動したら、最初の書き出しを待たせないよう裏で準備しておく(SCENE_NO_PREBUNDLE=1 で止められる)
    server.httpServer?.once('listening', () => {
      if (process.env.SCENE_NO_PREBUNDLE) return;
      setTimeout(() => {
        import('./render.ts')
          .then((m) => m.warmUp())
          .then((ms) => server.config.logger.info(`  書き出しの準備ができました(${Math.round(ms / 1000)} 秒)`))
          .catch((e: unknown) => server.config.logger.warn(`  書き出しの準備に失敗しました(書き出すときにもう一度試します): ${errorMessage(e)}`));
      }, 500);
    });
    server.middlewares.use('/api', (req, res) => {
      handle(req, res).catch((e: unknown) => send(res, 500, { error: errorMessage(e) }));
    });
  },
});
