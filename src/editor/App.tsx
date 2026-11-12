/** エディタ画面(上部バー + 3 列: シーン一覧 / プレビュー / 設定) */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getPart, parts } from '../parts/registry';
import { sceneTimeline, totalFrames } from '../video/project';
import { api, type RenderJob } from './api';
import { Preview, type PreviewHandle } from './Preview';
import { SceneList } from './SceneList';
import { SceneSettings } from './SceneSettings';
import { TopBar } from './TopBar';
import { fromProject, newKey, newScene, switchPart, toProject, type EditorProject, type EditorScene } from './state';

const LAST_KEY = 'scene-video-maker:last';
const NAME_RE = /^[\p{L}\p{N}_\- ]{1,60}$/u;

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

export const App = () => {
  const [projects, setProjects] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [doc, setDoc] = useState<EditorProject>({ title: '', scenes: [] });
  const [saved, setSaved] = useState<string>('');
  const [selected, setSelected] = useState(0);
  const [saving, setSaving] = useState(false);
  const [job, setJob] = useState<RenderJob | null>(null);
  const [message, setMessage] = useState('');
  const preview = useRef<PreviewHandle>(null);

  const project = useMemo(() => toProject(doc), [doc]);
  const snapshot = useMemo(() => JSON.stringify(project), [project]);
  const dirty = snapshot !== saved;
  const timeline = useMemo(() => sceneTimeline(project), [project]);

  const flash = useCallback((text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage((m) => (m === text ? '' : m)), 3000);
  }, []);

  const open = useCallback(async (n: string) => {
    try {
      const p = await api.load(n);
      setName(n);
      setDoc(fromProject(p));
      setSaved(JSON.stringify(p));
      setSelected(0);
      preview.current?.seekTo(0);
      safeStorage.set(LAST_KEY, n);
    } catch (e) {
      window.alert(`読み込めませんでした: ${(e as Error).message}`);
    }
  }, []);

  // 起動時: 前回のプロジェクト → sample → 先頭 の順に開く
  useEffect(() => {
    void (async () => {
      const list = await api.list();
      setProjects(list);
      const last = safeStorage.get(LAST_KEY);
      const first = last && list.includes(last) ? last : list.includes('sample') ? 'sample' : list[0];
      if (first) await open(first);
      else {
        setName('新しい動画');
        setDoc({ title: '', scenes: parts[0] ? [newScene(parts[0])] : [] });
      }
    })();
  }, [open]);

  const confirmDiscard = () => !dirty || window.confirm('保存していない変更があります。破棄してよいですか?');

  const saveAs = async (n: string) => {
    setSaving(true);
    try {
      const p = await api.save(n, project);
      setSaved(JSON.stringify(p));
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
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

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

  const updateScenes = (scenes: EditorScene[]) => setDoc((d) => ({ ...d, scenes }));

  const select = (i: number) => {
    setSelected(i);
    const t = timeline[i];
    if (t) preview.current?.seekTo(t.from);
  };

  const changeScene = (i: number, scene: EditorScene) => {
    const scenes = doc.scenes.map((s, j) => (j === i ? scene : s));
    updateScenes(scenes);
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

  // キーボード: スペースで再生/停止、Ctrl+S で保存
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saveRef.current();
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

  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [dirty]);

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
        onOpen={(n) => confirmDiscard() && void open(n)}
        onNew={() => {
          if (!confirmDiscard()) return;
          const n = askName('新しいプロジェクトの名前', '新しい動画');
          if (!n) return;
          if (projects.includes(n)) return window.alert('同じ名前のプロジェクトがあります');
          setName(n);
          setDoc({ title: n, scenes: parts[0] ? [newScene(parts[0])] : [] });
          setSaved('');
          setSelected(0);
          preview.current?.seekTo(0);
        }}
        onSaveAs={() => {
          const n = askName('別の名前で保存', `${name} のコピー`);
          if (!n) return;
          if (projects.includes(n) && !window.confirm(`「${n}」を上書きしますか?`)) return;
          void saveAs(n);
        }}
        onTitle={(title) => setDoc((d) => ({ ...d, title }))}
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
          onChange={(s) => changeScene(selected, s)}
          onSwitchPart={(id) => {
            const part = getPart(id);
            if (part && doc.scenes[selected]) changeScene(selected, switchPart(doc.scenes[selected], part));
          }}
        />
      </div>
    </div>
  );
};
