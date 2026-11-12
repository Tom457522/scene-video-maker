/**
 * projects/ フォルダの JSON の読み書き。名前はファイル名(拡張子なし)で、フォルダの外は触らない。
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { projectSchema, type Project } from '../src/video/project';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const PROJECTS_DIR = path.join(ROOT, 'projects');
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

export const writeProject = async (name: string, data: unknown): Promise<Project> => {
  const project = projectSchema.parse(data);
  await fs.mkdir(PROJECTS_DIR, { recursive: true });
  const file = fileOf(name);
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(project, null, 2)}\n`, 'utf8');
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
