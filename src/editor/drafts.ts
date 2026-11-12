/**
 * 下書きの自動保存。保存していない変更をブラウザ(localStorage)に残し、
 * 次に開いたときに復元できるようにする。保存するか変更がなくなると消す。
 */
import { projectSchema, type Project } from '../video/project';

export type Draft = { project: Project; at: number };

const PREFIX = 'scene-video-maker:draft:';

export const loadDraft = (name: string): Draft | null => {
  try {
    const raw = localStorage.getItem(PREFIX + name);
    if (!raw) return null;
    const data = JSON.parse(raw) as { project?: unknown; at?: unknown };
    const project = projectSchema.safeParse(data.project);
    if (!project.success || typeof data.at !== 'number') return null;
    return { project: project.data, at: data.at };
  } catch {
    return null;
  }
};

export const saveDraft = (name: string, project: Project): void => {
  try {
    localStorage.setItem(PREFIX + name, JSON.stringify({ project, at: Date.now() }));
  } catch {
    /* 容量不足などで残せなくても、編集は続けられる */
  }
};

export const clearDraft = (name: string): void => {
  try {
    localStorage.removeItem(PREFIX + name);
  } catch {
    /* 何もしない */
  }
};

export const formatDraftTime = (at: number): string =>
  new Date(at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
