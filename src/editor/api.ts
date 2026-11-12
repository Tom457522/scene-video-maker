/** エディタから本体の API を呼ぶ */
import type { Project } from '../video/project';

export type RenderJob = {
  id: string;
  name: string;
  status: 'running' | 'done' | 'error';
  stage: 'bundling' | 'browser' | 'rendering' | 'done';
  progress: number;
  file?: string;
  error?: string;
};

const call = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `エラー (${res.status})`);
  return data;
};

const enc = encodeURIComponent;

export const api = {
  list: () => call<{ projects: string[] }>('/api/projects').then((r) => r.projects),
  load: (name: string) => call<{ project: Project }>(`/api/projects/${enc(name)}`).then((r) => r.project),
  save: (name: string, project: Project) =>
    call<{ project: Project }>(`/api/projects/${enc(name)}`, { method: 'PUT', body: JSON.stringify(project) }).then((r) => r.project),
  startRender: (name: string, project: Project) =>
    call<{ job: RenderJob }>('/api/render', { method: 'POST', body: JSON.stringify({ name, project }) }).then((r) => r.job),
  renderStatus: (id: string) => call<{ job: RenderJob }>(`/api/render/${enc(id)}`).then((r) => r.job),
  outputUrl: (file: string) => `/api/output/${enc(file)}`,
};
