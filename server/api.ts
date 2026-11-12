/**
 * エディタ用の API(Vite の開発サーバーに組み込む)。127.0.0.1 からの利用だけを想定している。
 *
 *   GET  /api/projects            プロジェクト名の一覧
 *   GET  /api/projects/:name      読み込み
 *   PUT  /api/projects/:name      保存
 *   GET  /api/render              書き出しの一覧(順番待ち・書き出し中・終わったもの)
 *   POST /api/render              書き出しを順番待ちに入れる { name, project, format?, quality?, scene? } → { job }
 *                                 (format: 720p / 1080p / vertical / gif、quality: light / normal / high)
 *   GET  /api/render/:id          書き出しの進み具合
 *   DELETE /api/projects/:name    削除(projects/.trash/ へ移す)
 *   POST /api/projects/:name/rename  名前の変更 { to }
 *   GET  /api/projects/:name/history       前の版の一覧
 *   GET  /api/projects/:name/history/:id   前の版の中身
 *   POST /api/render/:id/cancel   書き出しの中止(待っているものは取り消し)
 *   GET  /api/assets[?usage]      画像の一覧(usage を付けると、使っているプロジェクトも返す)
 *   DELETE /api/assets/:name      画像の削除(projects/.trash/ へ移す)
 *   POST /api/assets              画像を保存 { name, data(base64) } → { name }
 *   POST /api/archive             プロジェクトと使っている画像を zip にまとめる { name, project } → zip
 *   POST /api/archive/import      zip から読み込む { name, data(base64) } → { name, renamed }
 *   POST /api/still               1 シーンを PNG で書き出す { name, project, scene } → { file }
 *   GET  /api/output/:file        書き出したファイル(MP4 / GIF / PNG)のダウンロード
 */
import { createReadStream, promises as fs } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import type { Plugin } from 'vite';
import { projectSchema, type Project } from '../src/video/project.ts';
import { OUT_DIR, deleteProject, isValidName, listHistory, listProjects, readHistory, readProject, renameProject, writeProject } from './projects.ts';
import { EXPORT_FORMATS, QUALITIES, type ExportFormat, type Quality } from '../src/remotion/composition-id.ts';
import { JobCancelled, createQueue } from './jobs.ts';
import { exportArchive, importArchive } from './archive.ts';
import { MAX_ASSET_BYTES, assetUsage, deleteAsset, isValidAssetName, listAssets, saveAsset } from './assets.ts';

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

type RenderPayload = { project: Project; format: ExportFormat; quality: Quality; scene: number };

/** 書き出しの順番待ち(1 つずつ順に書き出す) */
const queue = createQueue<RenderPayload>(async (job, { project, format, quality, scene }, ctx) => {
  const f = EXPORT_FORMATS[format];
  const suffix = [format === '720p' ? '' : format, quality === 'normal' || f.codec === 'gif' ? '' : quality, f.sceneOnly ? `scene${scene + 1}` : '']
    .filter(Boolean)
    .join('-');
  const file = `${job.name}${suffix ? `-${suffix}` : ''}-${timestamp()}.${f.ext}`;
  const { renderVideo, makeCancelSignal, RenderCancelled } = await import('./render.ts');
  const { cancelSignal, cancel } = makeCancelSignal();
  ctx.onCancel(cancel);
  try {
    await renderVideo(project, path.join(OUT_DIR, file), (stage, p) => ctx.onProgress(stage, p), {
      cancelSignal,
      isCancelled: ctx.isCancelled,
      format,
      quality,
      scene,
    });
    return file;
  } catch (e) {
    await fs.rm(path.join(OUT_DIR, file), { force: true }).catch(() => undefined);
    if (ctx.isCancelled() || e instanceof RenderCancelled) throw new JobCancelled();
    console.error('[書き出し失敗]', e);
    throw e;
  }
});

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
    if (parts.length === 1 && method === 'GET') return send(res, 200, { jobs: queue.list() });
    if (parts.length === 1 && method === 'POST') {
      try {
        const body = (await readJson(req)) as { name?: unknown; project?: unknown; format?: unknown; quality?: unknown; scene?: unknown };
        const name = typeof body.name === 'string' && isValidName(body.name) ? body.name : 'video';
        const format = typeof body.format === 'string' && body.format in EXPORT_FORMATS ? (body.format as ExportFormat) : '720p';
        const quality = typeof body.quality === 'string' && body.quality in QUALITIES ? (body.quality as Quality) : 'normal';
        const project = projectSchema.parse(body.project);
        const scene = typeof body.scene === 'number' && Number.isInteger(body.scene) ? body.scene : 0;
        if (EXPORT_FORMATS[format].sceneOnly && (scene < 0 || scene >= project.scenes.length)) return send(res, 400, { error: 'シーンの指定が不正です' });
        const f = EXPORT_FORMATS[format];
        const label = [f.label, f.codec === 'gif' ? `シーン ${scene + 1}` : QUALITIES[quality].label].join('・');
        const job = queue.enqueue(name, label, { project, format, quality, scene });
        return send(res, 202, { job });
      } catch (e) {
        return send(res, 400, { error: errorMessage(e) });
      }
    }
    if (parts.length === 3 && parts[2] === 'cancel' && method === 'POST') {
      return queue.cancel(parts[1]) ? send(res, 202, { ok: true }) : send(res, 404, { error: '待っている・書き出し中の書き出しが見つかりません' });
    }
    if (parts.length === 2 && method === 'GET') {
      const job = queue.get(parts[1]);
      return job ? send(res, 200, { job }) : send(res, 404, { error: '書き出しが見つかりません' });
    }
  }

  if (parts[0] === 'assets' && parts.length === 2 && method === 'DELETE') {
    if (!isValidAssetName(parts[1])) return send(res, 400, { error: 'ファイル名が不正です' });
    try {
      await deleteAsset(parts[1]);
      return send(res, 200, { deleted: parts[1] });
    } catch (e) {
      return send(res, 400, { error: errorMessage(e) });
    }
  }

  if (parts[0] === 'assets' && parts.length === 1) {
    if (method === 'GET') return send(res, 200, { assets: url.searchParams.has('usage') ? await assetUsage() : await listAssets() });
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

  if (parts[0] === 'archive' && parts.length === 1 && method === 'POST') {
    try {
      const body = (await readJson(req)) as { name?: unknown; project?: unknown };
      const name = typeof body.name === 'string' && isValidName(body.name) ? body.name : 'video';
      const zip = await exportArchive(body.project);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Length', String(zip.length));
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`${name}.zip`)}`);
      res.end(Buffer.from(zip));
      return;
    } catch (e) {
      return send(res, 400, { error: errorMessage(e) });
    }
  }

  if (parts[0] === 'archive' && parts[1] === 'import' && parts.length === 2 && method === 'POST') {
    try {
      const body = (await readJson(req, 140 * 1024 * 1024)) as { name?: unknown; data?: unknown };
      if (typeof body.data !== 'string') return send(res, 400, { error: 'data(base64)が必要です' });
      const result = await importArchive(new Uint8Array(Buffer.from(body.data, 'base64')), typeof body.name === 'string' ? body.name : '');
      return send(res, 200, result);
    } catch (e) {
      return send(res, 400, { error: errorMessage(e) });
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
    // out/ 直下の .mp4 / .gif / .png だけを返す
    const type = file.endsWith('.mp4') ? 'video/mp4' : file.endsWith('.gif') ? 'image/gif' : file.endsWith('.png') ? 'image/png' : null;
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
