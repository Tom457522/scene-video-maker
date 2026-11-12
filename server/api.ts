/**
 * エディタ用の API(Vite の開発サーバーに組み込む)。127.0.0.1 からの利用だけを想定している。
 *
 *   GET  /api/projects            プロジェクト名の一覧
 *   GET  /api/projects/:name      読み込み
 *   PUT  /api/projects/:name      保存
 *   POST /api/render              MP4 書き出しを始める { name, project } → { id }
 *   GET  /api/render/:id          書き出しの進み具合
 *   GET  /api/output/:file        書き出した MP4 のダウンロード
 */
import { createReadStream, promises as fs } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import type { Plugin } from 'vite';
import { projectSchema } from '../src/video/project.ts';
import { OUT_DIR, isValidName, listProjects, readProject, writeProject } from './projects.ts';
import type { Stage } from './render.ts';

type Job = {
  id: string;
  name: string;
  status: 'running' | 'done' | 'error';
  stage: Stage;
  progress: number;
  file?: string;
  error?: string;
};

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

const readJson = (req: IncomingMessage): Promise<unknown> =>
  new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
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

const startRender = (name: string, project: unknown): Job => {
  const parsed = projectSchema.parse(project);
  const id = String(++jobCounter);
  const file = `${name}-${timestamp()}.mp4`;
  const job: Job = { id, name, status: 'running', stage: 'bundling', progress: 0 };
  jobs.set(id, job);
  running = job;
  void (async () => {
    try {
      const { renderVideo } = await import('./render.ts');
      await renderVideo(parsed, path.join(OUT_DIR, file), (stage, p) => {
        job.stage = stage;
        job.progress = p;
      });
      job.status = 'done';
      job.file = file;
    } catch (e) {
      job.status = 'error';
      job.error = errorMessage(e);
      console.error('[書き出し失敗]', e);
    } finally {
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
        const body = (await readJson(req)) as { name?: unknown; project?: unknown };
        const name = typeof body.name === 'string' && isValidName(body.name) ? body.name : 'video';
        const job = startRender(name, body.project);
        return send(res, 202, { job });
      } catch (e) {
        return send(res, 400, { error: errorMessage(e) });
      }
    }
    if (parts.length === 2 && method === 'GET') {
      const job = jobs.get(parts[1]);
      return job ? send(res, 200, { job }) : send(res, 404, { error: '書き出しが見つかりません' });
    }
  }

  if (parts[0] === 'output' && parts.length === 2 && method === 'GET') {
    const file = parts[1];
    // out/ 直下の .mp4 だけを返す
    if (path.basename(file) !== file || !file.endsWith('.mp4')) return send(res, 400, { error: '不正なファイル名です' });
    const full = path.join(OUT_DIR, file);
    try {
      const stat = await fs.stat(full);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'video/mp4');
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
    server.middlewares.use('/api', (req, res) => {
      handle(req, res).catch((e: unknown) => send(res, 500, { error: errorMessage(e) }));
    });
  },
});
