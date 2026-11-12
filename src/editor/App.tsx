/** エディタ画面(上部バー + 3 列: シーン一覧 / プレビュー / 設定) */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getPart, parts } from '../parts/registry';
import { defaultSettings, sceneTimeline, totalFrames, type Project } from '../video/project';
import { api, type RenderJob } from './api';
import { clearDraft, formatDraftTime, loadDraft, saveDraft } from './drafts';
import { useHistory } from './history';
import { Preview, type PreviewHandle } from './Preview';
import { SceneList } from './SceneList';
import { SceneSettings } from './SceneSettings';
import { TopBar } from './TopBar';
import { EXPORT_FORMATS, type ExportFormat } from '../remotion/composition-id';
import { VideoSettings } from './VideoSettings';
import { HistoryDialog } from './HistoryDialog';
import { ReplaceDialog } from './ReplaceDialog';
import { OutlineDialog } from './OutlineDialog';
import { ChaptersDialog } from './ChaptersDialog';
import { NewProjectDialog } from './NewProjectDialog';
import { AssetsDialog } from './AssetsDialog';
import { copyScenes, readCopiedScenes } from './clipboard';
import { replaceAll } from './replace';
import { buildCues, toSrt } from '../video/srt';
import { resolveProps } from '../parts/registry';
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

/** 入力値の中の文字をすべて集める(画像のファイル名を探すため) */
const allStrings = (v: unknown): string[] =>
  typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(allStrings) : v && typeof v === 'object' ? Object.values(v).flatMap(allStrings) : [];

const emptyProject = (title: string): EditorProject => ({ title, settings: defaultSettings(), scenes: parts[0] ? [newScene(parts[0])] : [] });

export const App = () => {
  const [projects, setProjects] = useState<string[]>([]);
  const [name, setName] = useState('');
  const history = useHistory<EditorProject>({ title: '', settings: defaultSettings(), scenes: [] });
  const doc = history.value;
  const [saved, setSaved] = useState<string>('');
  const [selectedRaw, setSelected] = useState(0);
  const [saving, setSaving] = useState(false);
  const [job, setJob] = useState<RenderJob | null>(null);
  const [message, setMessage] = useState('');
  const preview = useRef<PreviewHandle>(null);
  /** 開いているダイアログ */
  const [dialog, setDialog] = useState<null | 'history' | 'replace' | 'outline' | 'chapters' | 'new' | 'assets'>(null);
  const [stillBusy, setStillBusy] = useState(false);
  /** 右列のタブ: 選んだシーンの設定 / 動画全体の設定 */
  const [rightTab, setRightTab] = useState<'scene' | 'video'>('scene');
  const [format, setFormat] = useState<ExportFormat>('720p');

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
    const t = sceneTimeline({ scenes })[i];
    if (!t) return;
    const f = preview.current?.getFrame() ?? 0;
    const inSecondHalf = f >= t.from + t.durationInFrames * 0.5 && f < t.from + t.durationInFrames;
    if (!inSecondHalf) preview.current?.seekTo(t.from + Math.floor(t.durationInFrames * 0.7));
  };

  /** シーンの並びを変える。group を渡すと続けての変更(文字入力など)を 1 回の「元に戻す」にまとめる */
  const updateScenes = (scenes: EditorScene[], group?: string) => history.set((d) => ({ ...d, scenes }), group);

  const select = (i: number) => {
    setSelected(i);
    setRightTab('scene');
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
    preview.current?.seekTo(sceneTimeline({ scenes })[at].from);
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

  const copyScene = (i: number) => {
    const s = doc.scenes[i];
    if (!s) return;
    copyScenes([s]);
    flash(`シーン ${i + 1} をコピーしました(別のプロジェクトにも貼り付けられます)`);
  };

  const copyAllScenes = () => {
    if (doc.scenes.length === 0) return;
    copyScenes(doc.scenes);
    flash(`${doc.scenes.length} シーンをすべてコピーしました`);
  };

  /** コピーしたシーンを、選んでいるシーンの後ろに貼り付ける */
  const pasteScenes = () => {
    const copied = readCopiedScenes();
    if (!copied) return flash('コピーしたシーンがありません');
    const at = doc.scenes.length === 0 ? 0 : selected + 1;
    const pasted = copied.map((s) => ({ ...structuredClone(s), key: newKey() }));
    updateScenes([...doc.scenes.slice(0, at), ...pasted, ...doc.scenes.slice(at)]);
    setSelected(at);
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

  const cancelExport = async () => {
    if (!job) return;
    try {
      await api.cancelRender(job.id);
    } catch (e) {
      window.alert(`中止できませんでした: ${(e as Error).message}`);
    }
  };

  const onServer = projects.includes(name);

  /** 各シーンの「字幕」から字幕ファイル(SRT)を作ってダウンロードする */
  const exportSrt = () => {
    const cues = buildCues(project, (i) => {
      const s = project.scenes[i];
      const part = getPart(s.part);
      return part ? resolveProps(part, s.props).props : s.props;
    });
    if (cues.length === 0) {
      window.alert('字幕のあるシーンがありません。字幕の入力欄(流れ図・横棒グラフなど)に文を書くと、字幕ファイルに入ります。');
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
      window.alert(`PNG を書き出せませんでした: ${(e as Error).message}`);
    } finally {
      setStillBusy(false);
    }
  };

  const newProject = () => {
    if (!confirmDiscard()) return;
    setDialog('new');
  };

  const createProject = (n: string, scenes: EditorScene[] | null) => {
    clearDraft(n);
    setName(n);
    reset(scenes ? { title: n, settings: defaultSettings(), scenes } : emptyProject(n));
    setSaved('');
    setSelected(0);
    safeStorage.set(LAST_KEY, n);
    preview.current?.seekTo(0);
    flash(scenes ? `ひな形から ${scenes.length} シーンを作りました(まだ保存していません)` : '新しいプロジェクトを作りました');
  };

  const renameCurrent = async () => {
    const n = askName('新しい名前', name);
    if (!n || n === name) return;
    if (projects.includes(n)) return window.alert('同じ名前のプロジェクトがあります');
    try {
      if (onServer) await api.rename(name, n);
      clearDraft(name);
      setName(n);
      safeStorage.set(LAST_KEY, n);
      setProjects(await api.list());
      flash(`名前を「${n}」に変えました`);
    } catch (e) {
      window.alert(`名前を変えられませんでした: ${(e as Error).message}`);
    }
  };

  const deleteCurrent = async () => {
    if (!window.confirm(`「${name}」を削除しますか?\n(ファイルは projects/.trash/ に移るので、手で戻すこともできます)`)) return;
    try {
      if (onServer) await api.remove(name);
      clearDraft(name);
      const list = await api.list();
      setProjects(list);
      setSaved(snapshot); // 削除したプロジェクトの「保存していない変更」の確認を出さない
      if (list[0]) await open(list[0]);
      else {
        setName('新しい動画');
        reset(emptyProject(''));
        setSaved('');
      }
      flash(`「${name}」を削除しました`);
    } catch (e) {
      window.alert(`削除できませんでした: ${(e as Error).message}`);
    }
  };

  const exportVideo = async () => {
    try {
      let j = await api.startRender(name, project, format);
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

  // キーボード: スペース 再生/停止、Ctrl+S 保存、Ctrl+Z 元に戻す、Ctrl+Shift+Z / Ctrl+Y やり直し、
  // ↑↓ シーンを選ぶ、Alt+↑↓ 並べ替え、Ctrl+D 複製、Ctrl+C / Ctrl+V コピー・貼り付け、Delete 削除、L シーンを繰り返す(入力欄の外のみ)
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
  };
  const keys = useRef({ save, undo: history.undo, redo: history.redo, ...sceneKeys });
  useEffect(() => {
    keys.current = { save, undo: history.undo, redo: history.redo, ...sceneKeys };
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
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const tabs = (
    <div className="tabs">
      <button type="button" className={rightTab === 'scene' ? 'on' : ''} onClick={() => setRightTab('scene')}>
        シーン
      </button>
      <button type="button" className={rightTab === 'video' ? 'on' : ''} onClick={() => setRightTab('video')}>
        動画全体
      </button>
    </div>
  );

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
        projectMenu={[
          { label: '新規(ひな形から選べる)…', onClick: newProject },
          {
            label: '別名で保存',
            onClick: () => {
              const n = askName('別の名前で保存', `${name} のコピー`);
              if (!n) return;
              if (projects.includes(n) && !window.confirm(`「${n}」を上書きしますか?`)) return;
              void saveAs(n);
            },
          },
          { label: '名前を変更', onClick: () => void renameCurrent() },
          { label: '保存の履歴から開く…', onClick: () => setDialog('history'), disabled: !onServer, hint: '一度も保存していないプロジェクトには履歴がありません' },
          { label: '削除', onClick: () => void deleteCurrent() },
        ]}
        toolMenu={[
          { label: '文章からシーンを作る…', onClick: () => setDialog('outline') },
          { label: 'すべてのシーンをコピー', onClick: copyAllScenes, hint: '別のプロジェクトで Ctrl+V(または「貼り付け」)で貼り付けられます' },
          { label: '一括置換…', onClick: () => setDialog('replace') },
          { label: '動画全体の設定', onClick: () => setRightTab('video') },
          { label: '画像の管理…', onClick: () => setDialog('assets') },
          { label: '部品の見本ページ(新しいタブ)', onClick: () => window.open('/?gallery', '_blank') },
          { label: 'YouTube の章の時刻…', onClick: () => setDialog('chapters') },
          { label: '字幕ファイル(SRT)を書き出す', onClick: exportSrt, hint: '各シーンの「字幕」に書いた文を、そのシーンの時間に並べます' },
        ]}
        onCancelExport={() => void cancelExport()}
        exportExtra={
          <select value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)} title="書き出す形式">
            {Object.entries(EXPORT_FORMATS).map(([id, f]) => (
              <option key={id} value={id} title={f.detail}>
                {f.label}
              </option>
            ))}
          </select>
        }
        onTitle={(title) => history.set((d) => ({ ...d, title }), 'title')}
        onSave={() => void save()}
        onExport={() => void exportVideo()}
      />
      <div className="columns">
        <SceneList
          settings={doc.settings}
          scenes={doc.scenes}
          selected={selected}
          onSelect={select}
          onAdd={addScene}
          onDuplicate={duplicate}
          onCopy={copyScene}
          onPaste={pasteScenes}
          onDelete={remove}
          onMove={move}
        />
        <Preview ref={preview} project={project} selected={selected} onSelectScene={setSelected} />
        {rightTab === 'video' ? (
          <VideoSettings header={tabs} settings={doc.settings} onChange={(settings) => history.set((d) => ({ ...d, settings }), 'settings')} />
        ) : (
          <SceneSettings
            header={tabs}
            settings={doc.settings}
            scene={doc.scenes[selected]}
            index={selected}
            onChange={(s, field) => changeScene(selected, s, `${s.key}:${field}`)}
            onExportStill={() => void exportStill()}
            stillBusy={stillBusy}
            onSwitchPart={(id) => {
              const part = getPart(id);
              if (part && doc.scenes[selected]) changeScene(selected, switchPart(doc.scenes[selected], part));
            }}
          />
        )}
      </div>
      {dialog === 'history' && (
        <HistoryDialog
          name={name}
          onClose={() => setDialog(null)}
          onOpen={(p, label) => {
            history.set(fromProject(p));
            setSelected(0);
            setDialog(null);
            flash(`${label} の版を開きました(まだ保存していません)`);
          }}
        />
      )}
      {dialog === 'outline' && (
        <OutlineDialog
          hasScenes={doc.scenes.length > 0}
          onClose={() => setDialog(null)}
          onApply={(scenes, title, mode) => {
            history.set((d) => ({
              ...d,
              title: mode === 'replace' && title ? title : d.title,
              scenes: mode === 'replace' ? scenes : [...d.scenes, ...scenes],
            }));
            setSelected(mode === 'replace' ? 0 : doc.scenes.length);
            flash(`${scenes.length} シーンを作りました`);
          }}
        />
      )}
      {dialog === 'assets' && (
        <AssetsDialog
          current={name}
          // 編集中(まだ保存していない)の内容で使っている画像
          usedNow={new Set([doc.settings.logo, ...doc.scenes.flatMap((s) => allStrings(s.props))].filter(Boolean))}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'new' && <NewProjectDialog existing={projects} onClose={() => setDialog(null)} onCreate={createProject} />}
      {dialog === 'chapters' && <ChaptersDialog project={project} onClose={() => setDialog(null)} />}
      {dialog === 'replace' && (
        <ReplaceDialog
          project={doc}
          onClose={() => setDialog(null)}
          onReplace={(f, r) => {
            history.set((d) => replaceAll(d, f, r));
            flash(`「${f}」を「${r}」に置き換えました`);
          }}
        />
      )}
    </div>
  );
};
