/** エディタ画面(上部バー + 3 列: シーン一覧 / プレビュー / 設定) */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getPart, parts } from '../parts/registry';
import { sceneTimeline, totalFrames, type Project } from '../video/project';
import { api, type RenderJob } from './api';
import { clearDraft, formatDraftTime, loadDraft, saveDraft } from './drafts';
import { useHistory } from './history';
import { Preview, type PreviewHandle } from './Preview';
import { SceneList } from './SceneList';
import { SceneSettings } from './SceneSettings';
import { TopBar } from './TopBar';
import { fromProject, newKey, newScene, switchPart, toProject, type EditorProject, type EditorScene } from './state';

const LAST_KEY = 'scene-video-maker:last';
const NAME_RE = /^[\p{L}\p{N}_\- ]{1,60}$/u;
/** 最後の変更からこの時間(ミリ秒)たったら下書きを残す */
const DRAFT_DELAY = 800;

const askName = (message: string, initial: string): string | null => {
  const name = window.prompt(`${message}\n(日本語・英数字・空白・_ - が使えます。60 文字まで)`, initial)?.trim();
  if (!name) return null;
  if (!NAME_RE.test(name)) {
    window.alert('使えない文字が含まれています');
    return null;
  }
  return name;
};

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

/** 下書きが残っていれば復元するか尋ねる。復元するならその内容、しないなら null(下書きは消す) */
const askRestore = (name: string, saved: Project | null): Project | null => {
  const draft = loadDraft(name);
  if (!draft) return null;
  if (saved && JSON.stringify(draft.project) === JSON.stringify(saved)) {
    clearDraft(name);
    return null;
  }
  const ok = window.confirm(
    `「${name}」に、保存していない変更の下書きが残っています(${formatDraftTime(draft.at)})。\n\n` +
      'OK: 下書きを復元する(まだ保存はされません)\nキャンセル: 下書きを捨てる',
  );
  if (ok) return draft.project;
  clearDraft(name);
  return null;
};

const emptyProject = (title: string): EditorProject => ({ title, scenes: parts[0] ? [newScene(parts[0])] : [] });

export const App = () => {
  const [projects, setProjects] = useState<string[]>([]);
  const [name, setName] = useState('');
  const history = useHistory<EditorProject>({ title: '', scenes: [] });
  const doc = history.value;
  const [saved, setSaved] = useState<string>('');
  const [selectedRaw, setSelected] = useState(0);
  const [saving, setSaving] = useState(false);
  const [job, setJob] = useState<RenderJob | null>(null);
  const [message, setMessage] = useState('');
  const preview = useRef<PreviewHandle>(null);

  // 元に戻したときにシーンが減っていても、選択がはみ出さないようにする
  const selected = Math.min(selectedRaw, Math.max(0, doc.scenes.length - 1));

  const project = useMemo(() => toProject(doc), [doc]);
  const snapshot = useMemo(() => JSON.stringify(project), [project]);
  const dirty = snapshot !== saved;
  const timeline = useMemo(() => sceneTimeline(project), [project]);

  const flash = useCallback((text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage((m) => (m === text ? '' : m)), 3000);
  }, []);

  const { reset } = history;
  const open = useCallback(
    async (n: string) => {
      try {
        const p = await api.load(n);
        const restored = askRestore(n, p);
        setName(n);
        reset(fromProject(restored ?? p));
        setSaved(JSON.stringify(p));
        setSelected(0);
        preview.current?.seekTo(0);
        safeStorage.set(LAST_KEY, n);
        if (restored) setMessage('下書きを復元しました(まだ保存していません)');
      } catch (e) {
        window.alert(`読み込めませんでした: ${(e as Error).message}`);
      }
    },
    [reset],
  );

  // 起動時: 前回のプロジェクト → sample → 先頭 の順に開く。
  // 前回が一度も保存していない新規プロジェクトで、下書きが残っていれば復元を尋ねる
  useEffect(() => {
    void (async () => {
      const list = await api.list();
      setProjects(list);
      const last = safeStorage.get(LAST_KEY);
      if (last && !list.includes(last)) {
        const restored = askRestore(last, null);
        if (restored) {
          setName(last);
          reset(fromProject(restored));
          setSaved('');
          setMessage('下書きを復元しました(まだ保存していません)');
          return;
        }
      }
      const first = last && list.includes(last) ? last : list.includes('sample') ? 'sample' : list[0];
      if (first) await open(first);
      else {
        setName('新しい動画');
        reset(emptyProject(''));
      }
    })();
  }, [open, reset]);

  // 下書きの自動保存: 変更があれば少し待ってから残し、変更がなくなれば消す
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

  /** 変更を捨ててよいか確かめる。捨てるなら下書きも消す */
  const confirmDiscard = () => {
    if (!dirty) return true;
    if (!window.confirm('保存していない変更があります。破棄してよいですか?')) return false;
    clearDraft(name);
    return true;
  };

  const saveAs = async (n: string) => {
    setSaving(true);
    try {
      const p = await api.save(n, project);
      setSaved(JSON.stringify(p));
      if (n !== name) clearDraft(name);
      clearDraft(n);
      setName(n);
      safeStorage.set(LAST_KEY, n);
      setProjects(await api.list());
      flash(`projects/${n}.json に保存しました`);
    } catch (e) {
      window.alert(`保存できませんでした:\n${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };
  const save = () => saveAs(name);

  /**
   * 編集した結果が見えるように、止まっているときは編集中のシーンの見どころ(70%)へ移る。
   * (シーンの頭は登場前で何も映っていないことが多いため。すでに後半を見ているなら動かさない)
   */
  const revealScene = (i: number, scenes: EditorScene[]) => {
    if (preview.current?.isPlaying()) return;
    const t = sceneTimeline({ title: '', scenes })[i];
    if (!t) return;
    const f = preview.current?.getFrame() ?? 0;
    const inSecondHalf = f >= t.from + t.durationInFrames * 0.5 && f < t.from + t.durationInFrames;
    if (!inSecondHalf) preview.current?.seekTo(t.from + Math.floor(t.durationInFrames * 0.7));
  };

  /** シーンの並びを変える。group を渡すと続けての変更(文字入力など)を 1 回の「元に戻す」にまとめる */
  const updateScenes = (scenes: EditorScene[], group?: string) => history.set((d) => ({ ...d, scenes }), group);

  const select = (i: number) => {
    setSelected(i);
    const t = timeline[i];
    if (t) preview.current?.seekTo(t.from);
  };

  const changeScene = (i: number, scene: EditorScene, group?: string) => {
    const scenes = doc.scenes.map((s, j) => (j === i ? scene : s));
    updateScenes(scenes, group);
    revealScene(i, scenes);
  };

  const addScene = (partId: string) => {
    const part = getPart(partId);
    if (!part) return;
    const at = doc.scenes.length === 0 ? 0 : selected + 1;
    const scenes = [...doc.scenes.slice(0, at), newScene(part), ...doc.scenes.slice(at)];
    updateScenes(scenes);
    setSelected(at);
    preview.current?.seekTo(sceneTimeline({ title: '', scenes })[at].from);
  };

  const duplicate = (i: number) => {
    const copy = { ...structuredClone(doc.scenes[i]), key: newKey() };
    updateScenes([...doc.scenes.slice(0, i + 1), copy, ...doc.scenes.slice(i + 1)]);
    setSelected(i + 1);
  };

  const remove = (i: number) => {
    updateScenes(doc.scenes.filter((_, j) => j !== i));
    setSelected((s) => Math.max(0, Math.min(s > i ? s - 1 : s, doc.scenes.length - 2)));
  };

  const move = (from: number, to: number) => {
    const scenes = [...doc.scenes];
    const [x] = scenes.splice(from, 1);
    scenes.splice(to, 0, x);
    updateScenes(scenes);
    const key = doc.scenes[selected]?.key;
    setSelected(Math.max(0, scenes.findIndex((s) => s.key === key)));
  };

  const exportVideo = async () => {
    try {
      let j = await api.startRender(name, project);
      setJob(j);
      while (j.status === 'running') {
        await new Promise((r) => window.setTimeout(r, 600));
        j = await api.renderStatus(j.id);
        setJob(j);
      }
    } catch (e) {
      window.alert(`書き出しを始められませんでした: ${(e as Error).message}`);
    }
  };

  // キーボード: スペースで再生/停止、Ctrl+S で保存、Ctrl+Z で元に戻す、Ctrl+Shift+Z / Ctrl+Y でやり直し
  const keys = useRef({ save, undo: history.undo, redo: history.redo });
  useEffect(() => {
    keys.current = { save, undo: history.undo, redo: history.redo };
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
      const t = e.target as HTMLElement;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable;
      if (e.key === ' ' && !typing) {
        e.preventDefault();
        preview.current?.toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app">
      <TopBar
        projects={projects}
        name={name}
        title={doc.title}
        totalFrames={totalFrames(project)}
        dirty={dirty}
        saving={saving}
        job={job}
        message={message}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={history.undo}
        onRedo={history.redo}
        onOpen={(n) => confirmDiscard() && void open(n)}
        onNew={() => {
          if (!confirmDiscard()) return;
          const n = askName('新しいプロジェクトの名前', '新しい動画');
          if (!n) return;
          if (projects.includes(n)) return window.alert('同じ名前のプロジェクトがあります');
          clearDraft(n);
          setName(n);
          reset(emptyProject(n));
          setSaved('');
          setSelected(0);
          safeStorage.set(LAST_KEY, n);
          preview.current?.seekTo(0);
        }}
        onSaveAs={() => {
          const n = askName('別の名前で保存', `${name} のコピー`);
          if (!n) return;
          if (projects.includes(n) && !window.confirm(`「${n}」を上書きしますか?`)) return;
          void saveAs(n);
        }}
        onTitle={(title) => history.set((d) => ({ ...d, title }), 'title')}
        onSave={() => void save()}
        onExport={() => void exportVideo()}
      />
      <div className="columns">
        <SceneList
          scenes={doc.scenes}
          selected={selected}
          onSelect={select}
          onAdd={addScene}
          onDuplicate={duplicate}
          onDelete={remove}
          onMove={move}
        />
        <Preview ref={preview} project={project} selected={selected} onSelectScene={setSelected} />
        <SceneSettings
          scene={doc.scenes[selected]}
          index={selected}
          onChange={(s, field) => changeScene(selected, s, `${s.key}:${field}`)}
          onSwitchPart={(id) => {
            const part = getPart(id);
            if (part && doc.scenes[selected]) changeScene(selected, switchPart(doc.scenes[selected], part));
          }}
        />
      </div>
    </div>
  );
};
