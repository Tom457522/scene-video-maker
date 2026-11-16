/**
 * エディタ画面(上部バー + 3 列: シーン一覧 / プレビュー / 設定)。シーンが 1 つもないときは最初の画面を出す。
 * 変更は少し待ってから自動で保存する(Ctrl+S ですぐに保存し、前の版として残す)。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getPart, resolveProps } from '../parts/registry';
import { defaultSettings, sceneTimeline, totalFrames, type Project } from '../video/project';
import { api, type RenderJob } from './api';
import { clearDraft, formatDraftTime, loadDraft, saveDraft } from './drafts';
import { useHistory } from './history';
import { Preview, type PreviewHandle } from './Preview';
import { SceneList } from './SceneList';
import { SceneSettings } from './SceneSettings';
import { TopBar, type SaveState } from './TopBar';
import { EXPORT_FORMATS, QUALITIES, type ExportFormat, type Quality } from '../remotion/composition-id';
import { BatchDialog } from './ExportsDialog';
import { ExportDialog } from './ExportDialog';
import { VideoSettings } from './VideoSettings';
import { HistoryDialog } from './HistoryDialog';
import { ReplaceDialog } from './ReplaceDialog';
import { ChaptersDialog } from './ChaptersDialog';
import { AssetsDialog } from './AssetsDialog';
import { AddSceneDialog, ChangePartDialog, type AddTab } from './AddSceneDialog';
import { TemplateDialog } from './TemplateDialog';
import { KeysDialog } from './KeysDialog';
import { StartPanel } from './StartPanel';
import { DialogHost, askConfirm, askText, showAlert } from './dialogs';
import { findIssues, lostFields, type Issue } from './guide';
import type { MenuEntry } from './Modal';
import { copyScenes, readCopiedScenes, useCopiedScenes } from './clipboard';
import { replaceAll } from './replace';
import { buildCues, toSrt } from '../video/srt';
import { fromProject, newKey, newScene, switchPart, toProject, type EditorProject, type EditorScene } from './state';

const LAST_KEY = 'scene-video-maker:last';
const FORMAT_KEY = 'scene-video-maker:format';
const QUALITY_KEY = 'scene-video-maker:quality';
const NAME_RE = /^[\p{L}\p{N}_\- ]{1,60}$/u;
/** 最後の変更からこの時間(ミリ秒)たったら下書きを残す */
const DRAFT_DELAY = 800;
/** 最後の変更からこの時間(ミリ秒)たったら自動で保存する */
const AUTO_SAVE_DELAY = 1500;

const safeStorage = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* 保存できなくても動作には影響しない */
    }
  },
};

/** 名前を尋ねる(使えない文字・同じ名前は、その場で知らせる) */
const askName = (title: string, ok: string, initial: string, taken: string[]) =>
  askText({
    title,
    message: '名前(日本語・英数字・空白・_ - が使えます。60 文字まで)',
    ok,
    initial,
    validate: (v) => (v === '' ? '' : !NAME_RE.test(v) ? '使えない文字が含まれています' : taken.includes(v) ? '同じ名前の動画があります' : ''),
  });

/**
 * 保存できなかった変更の下書きが残っていれば、復元するか尋ねる。
 * 復元するならその内容、しないなら null(下書きは消す)
 */
const askRestore = async (name: string, saved: Project | null): Promise<Project | null> => {
  const draft = loadDraft(name);
  if (!draft) return null;
  if (saved && JSON.stringify(draft.project) === JSON.stringify(saved)) {
    clearDraft(name);
    return null;
  }
  const ok = await askConfirm({
    title: '保存されていない変更があります',
    message: `「${name}」に、保存されていない変更の下書きが残っています(${formatDraftTime(draft.at)})。`,
    ok: '下書きを復元する',
    cancel: '下書きを捨てる',
  });
  if (ok) return draft.project;
  clearDraft(name);
  return null;
};

/** 入力値の中の文字をすべて集める(画像のファイル名を探すため) */
const allStrings = (v: unknown): string[] =>
  typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(allStrings) : v && typeof v === 'object' ? Object.values(v).flatMap(allStrings) : [];

const emptyProject = (title: string): EditorProject => ({ title, settings: defaultSettings(), scenes: [] });

/** シーンの見どころ(70% の時点)のフレーム。シーンの頭は登場前で何も映っていないことが多いため */
const highlightFrame = (scenes: EditorScene[], i: number) => {
  const t = sceneTimeline({ scenes })[i];
  return t ? t.from + Math.floor(t.durationInFrames * 0.7) : 0;
};

type Dialog =
  | null
  | { kind: 'add'; tab: AddTab }
  | { kind: 'change' | 'template' | 'keys' | 'export' | 'history' | 'replace' | 'chapters' | 'assets' | 'batch' };

export const App = () => {
  const [projects, setProjects] = useState<string[]>([]);
  const [name, setName] = useState('');
  const history = useHistory<EditorProject>({ title: '', settings: defaultSettings(), scenes: [] });
  const doc = history.value;
  /** サーバーに保存してある内容(JSON)。まだ一度も保存していなければ '' */
  const [saved, setSaved] = useState<string>('');
  const [selectedRaw, setSelected] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [jobs, setJobs] = useState<RenderJob[]>([]);
  const [message, setMessage] = useState('');
  const preview = useRef<PreviewHandle>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [stillBusy, setStillBusy] = useState(false);
  /** 右列のタブ: 選んだシーンの設定 / 動画全体の設定 */
  const [rightTab, setRightTab] = useState<'scene' | 'video'>('scene');
  const [format, setFormatRaw] = useState<ExportFormat>(() => {
    const f = safeStorage.get(FORMAT_KEY);
    return f && f in EXPORT_FORMATS ? (f as ExportFormat) : '720p';
  });
  const [quality, setQualityRaw] = useState<Quality>(() => {
    const q = safeStorage.get(QUALITY_KEY);
    return q && q in QUALITIES ? (q as Quality) : 'normal';
  });
  const setFormat = (f: ExportFormat) => {
    setFormatRaw(f);
    safeStorage.set(FORMAT_KEY, f);
  };
  const setQuality = (q: Quality) => {
    setQualityRaw(q);
    safeStorage.set(QUALITY_KEY, q);
  };
  const copied = useCopiedScenes();
  /** 読み込んだあと、プレビューが新しい内容になってから移る位置 */
  const seekAfterLoad = useRef<number | null>(null);

  // 元に戻したときにシーンが減っていても、選択がはみ出さないようにする
  const selected = Math.min(selectedRaw, Math.max(0, doc.scenes.length - 1));

  const project = useMemo(() => toProject(doc), [doc]);
  const snapshot = useMemo(() => JSON.stringify(project), [project]);
  const dirty = loaded && snapshot !== saved;
  const timeline = useMemo(() => sceneTimeline(project), [project]);
  const issues = useMemo(() => findIssues(project.scenes), [project]);
  const saveState: SaveState = saving ? 'saving' : saveError ? 'error' : dirty ? 'pending' : 'saved';

  useEffect(() => {
    if (seekAfterLoad.current === null || !preview.current) return;
    preview.current.seekTo(seekAfterLoad.current);
    seekAfterLoad.current = null;
  }, [project]);

  const flash = useCallback((text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage((m) => (m === text ? '' : m)), 3500);
  }, []);

  const { reset } = history;
  /** 内容を入れ替えて、最初のシーンの見どころを映す */
  const load = useCallback(
    (n: string, p: Project, savedJson: string) => {
      const ed = fromProject(p);
      setName(n);
      reset(ed);
      setSaved(savedJson);
      setSaveError(false);
      setSelected(0);
      setLoaded(true);
      seekAfterLoad.current = highlightFrame(ed.scenes, 0);
      safeStorage.set(LAST_KEY, n);
    },
    [reset],
  );

  const open = useCallback(
    async (n: string) => {
      try {
        const p = await api.load(n);
        const restored = await askRestore(n, p);
        load(n, restored ?? p, JSON.stringify(p));
        if (restored) setMessage('下書きを復元しました');
      } catch (e) {
        void showAlert('読み込めませんでした', (e as Error).message);
      }
    },
    [load],
  );

  // 起動時: 前回のプロジェクト → sample → 先頭 の順に開く。
  // 前回が一度も保存していない新規プロジェクトで、下書きが残っていれば復元を尋ねる
  useEffect(() => {
    void (async () => {
      const list = await api.list();
      setProjects(list);
      const last = safeStorage.get(LAST_KEY);
      if (last && !list.includes(last)) {
        const restored = await askRestore(last, null);
        if (restored) {
          load(last, restored, '');
          setMessage('下書きを復元しました');
          return;
        }
      }
      const first = last && list.includes(last) ? last : list.includes('sample') ? 'sample' : list[0];
      if (first) await open(first);
      else load('新しい動画', toProject(emptyProject('')), '');
    })();
  }, [open, load]);

  /** 今の内容を保存する。auto は自動保存(前の版を残す間隔をあける) */
  const saveNow = useCallback(
    async (opts: { auto?: boolean; as?: string } = {}): Promise<boolean> => {
      const target = opts.as ?? name;
      if (!target) return false;
      setSaving(true);
      try {
        const p = await api.save(target, project, opts.auto);
        setSaved(JSON.stringify(p));
        setSaveError(false);
        if (target !== name) clearDraft(name);
        clearDraft(target);
        if (target !== name) {
          setName(target);
          safeStorage.set(LAST_KEY, target);
        }
        if (!projects.includes(target)) setProjects(await api.list());
        return true;
      } catch (e) {
        setSaveError(true);
        if (!opts.auto) void showAlert('保存できませんでした', (e as Error).message);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [name, project, projects],
  );

  // 自動保存: 変更が止まって少したったら保存する(保存できなかったときは下書きが残る)
  useEffect(() => {
    if (!dirty || saving || saveError || !name) return;
    const t = window.setTimeout(() => void saveNow({ auto: true }), AUTO_SAVE_DELAY);
    return () => window.clearTimeout(t);
  }, [dirty, saving, saveError, name, saveNow, snapshot]);

  // 下書き: 保存できていない変更をブラウザの中にも残す(保存できたら消す)
  useEffect(() => {
    if (!name) return;
    if (!dirty) {
      clearDraft(name);
      return;
    }
    const t = window.setTimeout(() => saveDraft(name, project), DRAFT_DELAY);
    return () => window.clearTimeout(t);
  }, [name, project, dirty]);

  // ページを閉じるときは、待たずにすぐ下書きを残す
  const latest = useRef({ name, project, dirty });
  useEffect(() => {
    latest.current = { name, project, dirty };
  });
  useEffect(() => {
    const flush = () => {
      const l = latest.current;
      if (l.name && l.dirty) saveDraft(l.name, l.project);
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      flush();
      if (latest.current.dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', onLeave);
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('beforeunload', onLeave);
      window.removeEventListener('pagehide', flush);
    };
  }, []);

  /** 別の動画に移る前に、今の変更を保存する。保存できなければ、捨ててよいか尋ねる */
  const leaveCurrent = async (): Promise<boolean> => {
    if (!dirty) return true;
    if (await saveNow({ auto: true })) return true;
    const ok = await askConfirm({ title: '保存できませんでした', message: '今の変更を保存できませんでした。変更を捨てて移りますか?', ok: '変更を捨てる', danger: true });
    if (ok) clearDraft(name);
    return ok;
  };

  /** 手で保存する(Ctrl+S)。前の版として残る */
  const save = async () => {
    if (await saveNow()) flash('保存しました(前の版としても残ります)');
  };

  /** 選んでいるシーンの見どころへ移る(止まっているとき。すでに後半を見ているなら動かさない) */
  const revealScene = (i: number, scenes: EditorScene[]) => {
    if (preview.current?.isPlaying()) return;
    const t = sceneTimeline({ scenes })[i];
    if (!t) return;
    const f = preview.current?.getFrame() ?? 0;
    const inSecondHalf = f >= t.from + t.durationInFrames * 0.5 && f < t.from + t.durationInFrames;
    if (!inSecondHalf) preview.current?.seekTo(t.from + Math.floor(t.durationInFrames * 0.7));
  };

  /** シーンの並びを変える。group を渡すと続けての変更(文字入力など)を 1 回の「元に戻す」にまとめる */
  const updateScenes = (scenes: EditorScene[], group?: string) => history.set((d) => ({ ...d, scenes }), group);

  /** シーンの並びが新しくなったあとに、i 番目のシーンを選んで見どころを映す */
  const showScene = (scenes: EditorScene[], i: number) => {
    setSelected(i);
    setRightTab('scene');
    seekAfterLoad.current = highlightFrame(scenes, i);
  };

  const select = (i: number) => {
    setSelected(i);
    setRightTab('scene');
    const t = timeline[i];
    if (t) preview.current?.seekTo(t.from + Math.floor(t.durationInFrames * 0.7));
  };

  const changeScene = (i: number, scene: EditorScene, group?: string) => {
    const scenes = doc.scenes.map((s, j) => (j === i ? scene : s));
    updateScenes(scenes, group);
    revealScene(i, scenes);
  };

  /** シーンを入れる位置(選んでいるシーンの後ろ) */
  const insertAt = doc.scenes.length === 0 ? 0 : selected + 1;

  const addScene = (partId: string) => {
    const part = getPart(partId);
    if (!part) return;
    const scenes = [...doc.scenes.slice(0, insertAt), newScene(part), ...doc.scenes.slice(insertAt)];
    updateScenes(scenes);
    showScene(scenes, insertAt);
  };

  const duplicate = (i: number) => {
    const copy = { ...structuredClone(doc.scenes[i]), key: newKey() };
    updateScenes([...doc.scenes.slice(0, i + 1), copy, ...doc.scenes.slice(i + 1)]);
    setSelected(i + 1);
  };

  const remove = (i: number) => {
    updateScenes(doc.scenes.filter((_, j) => j !== i));
    setSelected((s) => Math.max(0, Math.min(s > i ? s - 1 : s, doc.scenes.length - 2)));
    flash(`シーン ${i + 1} を削除しました(Ctrl+Z で戻せます)`);
  };

  const copyScene = (i: number) => {
    const s = doc.scenes[i];
    if (!s) return;
    copyScenes([s]);
    flash(`シーン ${i + 1} をコピーしました(別の動画にも貼り付けられます)`);
  };

  const copyAllScenes = () => {
    if (doc.scenes.length === 0) return;
    copyScenes(doc.scenes);
    flash(`${doc.scenes.length} シーンをすべてコピーしました`);
  };

  /** コピーしたシーンを、選んでいるシーンの後ろに貼り付ける */
  const pasteScenes = () => {
    const c = readCopiedScenes();
    if (!c) return flash('コピーしたシーンがありません');
    const pasted = c.map((s) => ({ ...structuredClone(s), key: newKey() }));
    const scenes = [...doc.scenes.slice(0, insertAt), ...pasted, ...doc.scenes.slice(insertAt)];
    updateScenes(scenes);
    showScene(scenes, insertAt);
    flash(`${pasted.length} シーンを貼り付けました`);
  };

  const move = (from: number, to: number) => {
    const scenes = [...doc.scenes];
    const [x] = scenes.splice(from, 1);
    scenes.splice(to, 0, x);
    updateScenes(scenes);
    const key = doc.scenes[selected]?.key;
    setSelected(Math.max(0, scenes.findIndex((s) => s.key === key)));
  };

  /** 種類を変える。引き継げなかった入力があれば知らせる */
  const changePart = (id: string) => {
    const part = getPart(id);
    const scene = doc.scenes[selected];
    if (!part || !scene || scene.part === id) return;
    const next = switchPart(scene, part);
    changeScene(selected, next);
    const lost = lostFields(getPart(scene.part), scene.props, next.props);
    flash(
      lost.length > 0
        ? `「${part.meta.name}」に変えました。${lost.join('・')} は引き継げませんでした(Ctrl+Z で戻せます)`
        : `「${part.meta.name}」に変えました`,
    );
  };

  /** 文章やひな形から作ったシーンを入れる */
  const applyScenes = (scenes: EditorScene[], title: string, mode: 'replace' | 'append') => {
    const next = mode === 'replace' ? scenes : [...doc.scenes, ...scenes];
    history.set((d) => ({ ...d, title: mode === 'replace' && title ? title : d.title, scenes: next }));
    showScene(next, mode === 'replace' ? 0 : doc.scenes.length);
    flash(`${scenes.length} シーンを作りました`);
  };

  const goToIssue = (iss: Issue) => {
    setDialog(null);
    select(iss.scene);
  };
  const fixIssue = (iss: Issue) => {
    const s = doc.scenes[iss.scene];
    if (s && iss.fixSeconds !== undefined) changeScene(iss.scene, { ...s, seconds: iss.fixSeconds });
  };

  const onServer = projects.includes(name);

  /** プロジェクトと使っている画像を zip にまとめてダウンロードする */
  const exportZip = async () => {
    try {
      const res = await fetch('/api/archive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, project }) });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? `エラー (${res.status})`);
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      flash(`${name}.zip を書き出しました(使っている画像も入っています)`);
    } catch (e) {
      void showAlert('zip を書き出せませんでした', (e as Error).message);
    }
  };

  const zipInput = useRef<HTMLInputElement>(null);
  /** zip から読み込んで、そのプロジェクトを開く */
  const importZip = async (file: File) => {
    if (!(await leaveCurrent())) return;
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
      });
      const base = file.name.replace(/\.zip$/i, '').replace(/[^\p{L}\p{N}_\- ]/gu, '_').trim().slice(0, 60) || 'よみこんだ動画';
      const res = await fetch('/api/archive/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: base, data }) });
      const body = (await res.json()) as { name?: string; renamed?: Record<string, string>; error?: string };
      if (!res.ok || !body.name) throw new Error(body.error ?? `エラー (${res.status})`);
      setProjects(await api.list());
      await open(body.name);
      const renamed = Object.entries(body.renamed ?? {});
      flash(`「${body.name}」として読み込みました${renamed.length ? `(同じ名前の別の画像があったので ${renamed.map(([a, b]) => `${a} → ${b}`).join('、')} に変えました)` : ''}`);
    } catch (e) {
      void showAlert('zip を読み込めませんでした', (e as Error).message);
    }
  };

  /** 各シーンの「字幕」から字幕ファイル(SRT)を作ってダウンロードする */
  const exportSrt = () => {
    const cues = buildCues(project, (i) => {
      const s = project.scenes[i];
      const part = getPart(s.part);
      return part ? resolveProps(part, s.props).props : s.props;
    });
    if (cues.length === 0) {
      void showAlert('字幕のあるシーンがありません', '字幕の入力欄(流れ図・横棒グラフなど)に文を書くと、字幕ファイルに入ります。');
      return;
    }
    const url = URL.createObjectURL(new Blob([toSrt(cues)], { type: 'application/x-subrip;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.srt`;
    a.click();
    URL.revokeObjectURL(url);
    flash(`${name}.srt を書き出しました(${cues.length} 件)`);
  };

  /** 選んでいるシーンを PNG で書き出してダウンロードする */
  const exportStill = async () => {
    setStillBusy(true);
    try {
      const file = await api.renderStill(name, project, selected);
      const a = document.createElement('a');
      a.href = api.outputUrl(file);
      a.download = file;
      a.click();
      flash(`${file} を書き出しました`);
    } catch (e) {
      void showAlert('PNG を書き出せませんでした', (e as Error).message);
    } finally {
      setStillBusy(false);
    }
  };

  /** 新しい動画: 名前だけ決めて、最初の画面(作り方を選ぶ)を出す */
  const newProject = async () => {
    if (!(await leaveCurrent())) return;
    let base = '新しい動画';
    for (let i = 2; projects.includes(base); i++) base = `新しい動画 ${i}`;
    const n = await askName('新しい動画を作る', '作る', base, projects);
    if (!n) return;
    clearDraft(n);
    load(n, toProject(emptyProject('')), '');
  };

  const openProject = async (n: string) => {
    if (n === name || !(await leaveCurrent())) return;
    await open(n);
  };

  /** 別の名前でコピーを作り、そちらを開く */
  const saveAsCopy = async () => {
    const n = await askName('コピーして別の動画にする', 'コピーを作る', `${name} のコピー`, projects);
    if (!n) return;
    if (await saveNow({ as: n })) flash(`「${n}」を作りました(これからは「${n}」を編集します)`);
  };

  const renameCurrent = async () => {
    const n = await askName('名前を変える', '変える', name, projects.filter((p) => p !== name));
    if (!n || n === name) return;
    // 名前を変えたあとに、前の名前で自動保存されないよう、先に保存しておく
    if (dirty && onServer && !(await saveNow({ auto: true }))) return;
    try {
      if (onServer) await api.rename(name, n);
      clearDraft(name);
      setName(n);
      safeStorage.set(LAST_KEY, n);
      setProjects(await api.list());
      flash(`名前を「${n}」に変えました`);
    } catch (e) {
      void showAlert('名前を変えられませんでした', (e as Error).message);
    }
  };

  const deleteCurrent = async () => {
    const ok = await askConfirm({
      title: 'この動画を削除',
      message: `「${name}」を削除しますか?\n(ファイルは projects/.trash/ に移るので、手で戻すこともできます)`,
      ok: '削除する',
      danger: true,
    });
    if (!ok) return;
    // 消している間に自動保存で作り直さないよう、いったん読み込み前の状態にする
    setLoaded(false);
    try {
      if (onServer) await api.remove(name);
      clearDraft(name);
      const list = await api.list();
      setProjects(list);
      const removed = name;
      if (list[0]) await open(list[0]);
      else load('新しい動画', toProject(emptyProject('')), '');
      flash(`「${removed}」を削除しました`);
    } catch (e) {
      setLoaded(true);
      void showAlert('削除できませんでした', (e as Error).message);
    }
  };

  const refreshJobs = useCallback(() => api.renderJobs().then(setJobs, () => undefined), []);
  const active = jobs.some((j) => j.status === 'queued' || j.status === 'running');
  // 書き出し中・順番待ちがある間は、進み具合を取りに行く
  useEffect(() => {
    void refreshJobs();
    if (!active) return;
    const t = window.setInterval(() => void refreshJobs(), 700);
    return () => window.clearInterval(t);
  }, [active, refreshJobs]);

  /** 今の内容を、選んだ形式・画質で順番待ちに入れる(GIF は選んでいるシーンだけ) */
  const exportVideo = async () => {
    try {
      const job = await api.startRender(name, project, format, quality, selected);
      setJobs((js) => [job, ...js]);
      flash(`「${job.label}」を順番待ちに入れました`);
      void refreshJobs();
    } catch (e) {
      void showAlert('書き出しを始められませんでした', (e as Error).message);
    }
  };

  // キーボード: スペース 再生/停止、Ctrl+S 保存、Ctrl+Z 元に戻す、Ctrl+Shift+Z / Ctrl+Y やり直し、
  // ↑↓ シーンを選ぶ、Alt+↑↓ 並べ替え、Ctrl+D 複製、Ctrl+C / Ctrl+V コピー・貼り付け、Delete 削除、L シーンを繰り返す、? キー操作の一覧(入力欄の外のみ)
  const sceneKeys = {
    selectBy: (d: number) => doc.scenes.length > 0 && select(Math.max(0, Math.min(doc.scenes.length - 1, selected + d))),
    moveBy: (d: number) => {
      const to = selected + d;
      if (to >= 0 && to < doc.scenes.length) move(selected, to);
    },
    duplicate: () => doc.scenes[selected] && duplicate(selected),
    copy: () => copyScene(selected),
    paste: pasteScenes,
    remove: () => doc.scenes[selected] && remove(selected),
    keys: () => setDialog({ kind: 'keys' }),
  };
  const keys = useRef({ save, undo: history.undo, redo: history.redo, ...sceneKeys });
  useEffect(() => {
    keys.current = { save, undo: history.undo, redo: history.redo, ...sceneKeys };
  });
  const dialogOpen = dialog !== null;
  const dialogRef = useRef(dialogOpen);
  useEffect(() => {
    dialogRef.current = dialogOpen;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === 's') {
        e.preventDefault();
        void keys.current.save();
        return;
      }
      const t = e.target as HTMLElement;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable;
      // ダイアログの中では、シーンの操作はしない
      if (dialogRef.current || document.querySelector('.modal-back')) return;
      // 入力欄の中でも、ブラウザの元に戻すではなくアプリの履歴を使う(入力欄の値はアプリが持っているため)
      if (mod && k === 'z' && !e.shiftKey) {
        e.preventDefault();
        keys.current.undo();
        return;
      }
      if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) {
        e.preventDefault();
        keys.current.redo();
        return;
      }
      if (typing) return;
      const k2 = keys.current;
      if (e.key === ' ') {
        e.preventDefault();
        preview.current?.toggle();
      } else if (mod && k === 'c' && !window.getSelection()?.toString()) {
        e.preventDefault();
        k2.copy();
      } else if (mod && k === 'v') {
        e.preventDefault();
        k2.paste();
      } else if (mod && k === 'd') {
        e.preventDefault();
        k2.duplicate();
      } else if (e.key === 'Delete') {
        e.preventDefault();
        k2.remove();
      } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        k2.moveBy(e.key === 'ArrowUp' ? -1 : 1);
      } else if (!mod && !e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        k2.selectBy(e.key === 'ArrowUp' ? -1 : 1);
      } else if (!mod && k === 'l') {
        e.preventDefault();
        preview.current?.toggleLoop();
      } else if (e.key === '?') {
        e.preventDefault();
        k2.keys();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const projectMenu: MenuEntry[] = [
    { kind: 'heading', label: '動画を開く' },
    ...(onServer ? [] : [{ label: name, onClick: () => undefined, current: true, note: 'まだ保存していません' }]),
    ...projects.map((n): MenuEntry => ({ label: n, onClick: () => void openProject(n), current: n === name, note: n === name ? '編集中' : undefined })),
    { label: '新しい動画を作る', icon: 'plus', onClick: () => void newProject() },
    { kind: 'separator' },
    { kind: 'heading', label: 'この動画' },
    { label: '名前を変える', icon: 'edit', onClick: () => void renameCurrent() },
    { label: 'コピーして別の動画にする', icon: 'copy', onClick: () => void saveAsCopy() },
    { label: '前の版に戻す…', icon: 'history', onClick: () => setDialog({ kind: 'history' }), disabled: !onServer, hint: '一度も保存していない動画には前の版がありません' },
    { kind: 'separator' },
    { kind: 'heading', label: 'ほかの PC とやりとり' },
    { label: 'zip で持ち出す(画像も入る)', icon: 'download', onClick: () => void exportZip(), hint: '別の PC に移したり、人に渡したりするときに' },
    { label: 'zip から読み込む…', icon: 'upload', onClick: () => zipInput.current?.click() },
    { kind: 'separator' },
    { label: '画像の整理…', icon: 'image', onClick: () => setDialog({ kind: 'assets' }) },
    { label: 'この動画を削除', icon: 'trash', onClick: () => void deleteCurrent(), danger: true },
  ];

  const tabs = (
    <div className="tabs" role="tablist">
      <button type="button" role="tab" aria-selected={rightTab === 'scene'} className={rightTab === 'scene' ? 'on' : ''} onClick={() => setRightTab('scene')}>
        このシーン
      </button>
      <button type="button" role="tab" aria-selected={rightTab === 'video'} className={rightTab === 'video' ? 'on' : ''} onClick={() => setRightTab('video')}>
        動画全体(テーマ・ロゴ)
      </button>
    </div>
  );

  const empty = loaded && doc.scenes.length === 0;
  const close = () => setDialog(null);

  return (
    <div className="app">
      <input
        ref={zipInput}
        type="file"
        accept=".zip,application/zip"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void importZip(f);
        }}
      />
      <TopBar
        name={name}
        title={doc.title}
        sceneCount={doc.scenes.length}
        totalFrames={totalFrames(project)}
        saveState={saveState}
        jobs={jobs}
        message={message}
        issues={issues}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={history.undo}
        onRedo={history.redo}
        projectMenu={projectMenu}
        onTitle={(title) => history.set((d) => ({ ...d, title }), 'title')}
        onSave={() => void save()}
        onIssue={goToIssue}
        onFixIssue={fixIssue}
        onExport={() => setDialog({ kind: 'export' })}
      />
      {empty ? (
        <StartPanel
          onOutline={() => setDialog({ kind: 'add', tab: 'outline' })}
          onTemplate={() => setDialog({ kind: 'template' })}
          onKinds={() => setDialog({ kind: 'add', tab: 'kinds' })}
          onImportZip={() => zipInput.current?.click()}
        />
      ) : (
        <div className="columns">
          <SceneList
            settings={doc.settings}
            scenes={doc.scenes}
            selected={selected}
            onSelect={select}
            onOpenAdd={() => setDialog({ kind: 'add', tab: 'kinds' })}
            onDuplicate={duplicate}
            onCopy={copyScene}
            onCopyAll={copyAllScenes}
            onReplace={() => setDialog({ kind: 'replace' })}
            onDelete={remove}
            onMove={move}
          />
          <Preview ref={preview} project={project} selected={selected} onSelectScene={setSelected} onShowKeys={() => setDialog({ kind: 'keys' })} />
          {rightTab === 'video' ? (
            <VideoSettings header={tabs} settings={doc.settings} onChange={(settings) => history.set((d) => ({ ...d, settings }), 'settings')} />
          ) : (
            <SceneSettings
              header={tabs}
              settings={doc.settings}
              scene={doc.scenes[selected]}
              index={selected}
              onChange={(s, field) => changeScene(selected, s, `${s.key}:${field}`)}
              onChangePart={() => setDialog({ kind: 'change' })}
              onExportStill={() => void exportStill()}
              stillBusy={stillBusy}
            />
          )}
        </div>
      )}
      {dialog?.kind === 'add' && (
        <AddSceneDialog
          where={doc.scenes.length === 0 ? '最初のシーンになります' : `シーン ${insertAt} の後ろに入ります`}
          initialTab={dialog.tab}
          hasScenes={doc.scenes.length > 0}
          copied={copied}
          onAdd={addScene}
          onOutline={applyScenes}
          onPaste={pasteScenes}
          onClose={close}
        />
      )}
      {dialog?.kind === 'change' && doc.scenes[selected] && <ChangePartDialog current={doc.scenes[selected].part} onPick={changePart} onClose={close} />}
      {dialog?.kind === 'template' && <TemplateDialog onClose={close} onApply={(scenes, title) => applyScenes(scenes, title, 'replace')} />}
      {dialog?.kind === 'keys' && <KeysDialog onClose={close} />}
      {dialog?.kind === 'export' && (
        <ExportDialog
          title={doc.title}
          sceneCount={doc.scenes.length}
          totalFrames={totalFrames(project)}
          selected={selected}
          jobs={jobs}
          issues={issues}
          format={format}
          quality={quality}
          onFormat={setFormat}
          onQuality={setQuality}
          onStart={() => void exportVideo()}
          onIssue={goToIssue}
          onFixIssue={fixIssue}
          onStill={() => void exportStill()}
          stillBusy={stillBusy}
          onSrt={exportSrt}
          onChapters={() => setDialog({ kind: 'chapters' })}
          onBatch={() => setDialog({ kind: 'batch' })}
          onClose={close}
        />
      )}
      {dialog?.kind === 'history' && (
        <HistoryDialog
          name={name}
          onClose={close}
          onOpen={(p, label) => {
            history.set(fromProject(p));
            setSelected(0);
            close();
            flash(`${label} の版に戻しました(Ctrl+Z で今の内容に戻せます)`);
          }}
        />
      )}
      {dialog?.kind === 'batch' && (
        <BatchDialog
          current={name}
          currentProject={project}
          projects={projects}
          onClose={close}
          onQueued={(n) => {
            flash(`${n} 件を順番待ちに入れました`);
            void refreshJobs();
            setDialog({ kind: 'export' });
          }}
        />
      )}
      {dialog?.kind === 'assets' && (
        <AssetsDialog
          current={name}
          // 編集中(まだ保存していない)の内容で使っている画像
          usedNow={new Set([doc.settings.logo, ...doc.scenes.flatMap((s) => allStrings(s.props))].filter(Boolean))}
          onClose={close}
        />
      )}
      {dialog?.kind === 'chapters' && <ChaptersDialog project={project} onClose={close} />}
      {dialog?.kind === 'replace' && (
        <ReplaceDialog
          project={doc}
          onClose={close}
          onReplace={(f, r) => {
            history.set((d) => replaceAll(d, f, r));
            flash(`「${f}」を「${r}」に置き換えました`);
          }}
        />
      )}
      <DialogHost />
    </div>
  );
};
