/**
 * projects/ フォルダの JSON の読み書き。名前はファイル名(拡張子なし)で、フォルダの外は触らない。
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectSchema, type Project } from '../src/video/project.ts';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
/** プロジェクトの置き場所(テストでは環境変数 SCENE_PROJECTS_DIR で一時フォルダにする) */
export const PROJECTS_DIR = process.env.SCENE_PROJECTS_DIR ? path.resolve(process.env.SCENE_PROJECTS_DIR) : path.join(ROOT, 'projects');
/** 保存のたびに前の版を残す場所 */
export const HISTORY_DIR = path.join(PROJECTS_DIR, '.history');
/** 削除したプロジェクトを移す場所 */
export const TRASH_DIR = path.join(PROJECTS_DIR, '.trash');
/** 1 つのプロジェクトについて残す前の版の数 */
export const HISTORY_LIMIT = 30;
export const OUT_DIR = path.join(ROOT, 'out');

/** 使える名前: 日本語・英数字・空白・_ - のみ、60 文字まで(パスの区切りやドットは不可) */
const NAME_RE = /^[\p{L}\p{N}_\- ]{1,60}$/u;

export const isValidName = (name: string): boolean => NAME_RE.test(name) && name.trim() === name;

const fileOf = (name: string): string => {
  if (!isValidName(name)) throw new Error(`プロジェクト名に使えない文字があります: ${name}`);
  return path.join(PROJECTS_DIR, `${name}.json`);
};

export const listProjects = async (): Promise<string[]> => {
  await fs.mkdir(PROJECTS_DIR, { recursive: true });
  const files = await fs.readdir(PROJECTS_DIR);
  return files
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -5))
    .filter(isValidName)
    .sort((a, b) => a.localeCompare(b, 'ja'));
};

export const readProject = async (name: string): Promise<Project> => {
  const json: unknown = JSON.parse(await fs.readFile(fileOf(name), 'utf8'));
  return projectSchema.parse(json);
};

const stamp = (d = new Date()) => {
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${p(d.getMilliseconds(), 3)}`;
};

const exists = (file: string) =>
  fs.access(file).then(
    () => true,
    () => false,
  );

/** 保存の前に、今のファイルを .history/<名前>/<日時>.json に残す(古いものから消して HISTORY_LIMIT 件まで) */
const keepHistory = async (name: string) => {
  const file = fileOf(name);
  if (!(await exists(file))) return;
  const dir = path.join(HISTORY_DIR, name);
  await fs.mkdir(dir, { recursive: true });
  await fs.copyFile(file, path.join(dir, `${stamp()}.json`));
  const versions = (await fs.readdir(dir)).filter((f) => f.endsWith('.json')).sort();
  for (const old of versions.slice(0, Math.max(0, versions.length - HISTORY_LIMIT))) {
    await fs.rm(path.join(dir, old), { force: true });
  }
};

export type HistoryEntry = { id: string; savedAt: string; scenes: number; title: string };

/** 前の版の一覧(新しい順) */
export const listHistory = async (name: string): Promise<HistoryEntry[]> => {
  fileOf(name);
  const dir = path.join(HISTORY_DIR, name);
  if (!(await exists(dir))) return [];
  const files = (await fs.readdir(dir)).filter((f) => /^\d{8}-\d{6}-\d{3}\.json$/.test(f)).sort().reverse();
  const out: HistoryEntry[] = [];
  for (const f of files) {
    const id = f.slice(0, -5);
    const [d, t] = id.split('-');
    const savedAt = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)} ${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}`;
    try {
      const p = projectSchema.parse(JSON.parse(await fs.readFile(path.join(dir, f), 'utf8')));
      out.push({ id, savedAt, scenes: p.scenes.length, title: p.title });
    } catch {
      /* 読めない版は一覧に出さない */
    }
  }
  return out;
};

export const readHistory = async (name: string, id: string): Promise<Project> => {
  fileOf(name);
  if (!/^\d{8}-\d{6}-\d{3}$/.test(id)) throw new Error('版の指定が不正です');
  return projectSchema.parse(JSON.parse(await fs.readFile(path.join(HISTORY_DIR, name, `${id}.json`), 'utf8')));
};

/** 削除: 消さずに .trash/ へ移す(誤って消しても手で戻せる)。前の版の履歴も一緒に移す */
export const deleteProject = async (name: string): Promise<void> => {
  const file = fileOf(name);
  const at = stamp();
  await fs.mkdir(TRASH_DIR, { recursive: true });
  await fs.rename(file, path.join(TRASH_DIR, `${name}-${at}.json`));
  const hist = path.join(HISTORY_DIR, name);
  if (await exists(hist)) await fs.rename(hist, path.join(TRASH_DIR, `${name}-${at}.history`));
};

/** フォルダ src の中身を dst へ移す(dst がすでにあっても、中のファイルを 1 つずつ移して合わせる) */
const moveDirMerge = async (src: string, dst: string) => {
  if (!(await exists(dst))) {
    await fs.mkdir(path.dirname(dst), { recursive: true });
    await fs.rename(src, dst);
    return;
  }
  for (const f of await fs.readdir(src)) await fs.rename(path.join(src, f), path.join(dst, f));
  await fs.rm(src, { recursive: true, force: true });
};

/** 名前の変更(前の版の履歴も一緒に移す) */
export const renameProject = async (from: string, to: string): Promise<void> => {
  const src = fileOf(from);
  const dst = fileOf(to);
  if (await exists(dst)) throw new Error(`「${to}」はすでにあります`);
  await fs.rename(src, dst);
  const hFrom = path.join(HISTORY_DIR, from);
  if (await exists(hFrom)) await moveDirMerge(hFrom, path.join(HISTORY_DIR, to));
};

export const writeProject = async (name: string, data: unknown): Promise<Project> => {
  const project = projectSchema.parse(data);
  await fs.mkdir(PROJECTS_DIR, { recursive: true });
  const file = fileOf(name);
  // 中身が変わらない保存では履歴を増やさない
  const before = (await exists(file)) ? await fs.readFile(file, 'utf8') : null;
  const next = `${JSON.stringify(project, null, 2)}\n`;
  if (before === next) return project;
  await keepHistory(name);
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, next, 'utf8');
  await fs.rename(tmp, file);
  return project;
};

/** "sample" でも "projects/sample.json" でも "C:\\...\\x.json" でも読めるようにする(コマンド用) */
export const readProjectArg = async (arg: string): Promise<{ name: string; project: Project }> => {
  if (arg.endsWith('.json')) {
    const json: unknown = JSON.parse(await fs.readFile(path.resolve(arg), 'utf8'));
    return { name: path.basename(arg, '.json'), project: projectSchema.parse(json) };
  }
  return { name: arg, project: await readProject(arg) };
};
