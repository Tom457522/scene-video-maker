/**
 * 動画の組み立ての質を、決まった規則で調べる(AI は使わない)。
 * はみ出しのような「壊れている」ではなく、「見づらい・単調・伝わりにくい」を見つけるためのもの。
 * 規則の考え方は .claude/skills/research-to-video/SKILL.md の「質の基準」と同じ。
 */
import { stripMarks } from '../kit/text';
import { countChars } from './reading';
import { cueItems, displayText } from './narration';
import type { Project } from './project';

export type QualityItem = {
  /** warn: 直したほうがよい / info: できれば直す */
  level: 'warn' | 'info';
  /** シーンの番号(1 始まり。動画全体のことなら 0) */
  scene: number;
  message: string;
};

export type QualityReport = { score: number; items: QualityItem[] };

/** データを見せる部品(出典がほしい) */
const DATA_PARTS = new Set(['bars', 'pie', 'line', 'number', 'table']);
/** つかみになる部品 */
const HOOK_PARTS = new Set(['number', 'qa', 'quote', 'bars', 'line', 'pie', 'image']);

/** 画面に出る文字数の上限の目安(これを超えると読み切れない) */
const SCREEN_CHARS = 100;
/** 1 シーンのナレーションの長さの目安(秒) */
const NARRATION_SECONDS = 24;
/** ナレーションの速さの目安(1 秒あたりの文字数。音声がまだないときの見積もりに使う) */
const SPEECH_CPS = 7.5;

const narrationSeconds = (s: Project['scenes'][number]): number =>
  s.audio ? s.audio.duration : Array.from(displayText(s.narration ?? '').replace(/\s/g, '')).length / SPEECH_CPS;

export const checkQuality = (project: Pick<Project, 'scenes'>, resolve: (i: number) => Record<string, unknown> = (i) => project.scenes[i].props): QualityReport => {
  const items: QualityItem[] = [];
  const scenes = project.scenes;
  const warn = (scene: number, message: string) => items.push({ level: 'warn', scene, message });
  const info = (scene: number, message: string) => items.push({ level: 'info', scene, message });
  const total = scenes.reduce((n, s) => n + s.seconds, 0);

  // 全体の長さとシーンの数
  if (total < 45) warn(0, `全体が ${Math.round(total)} 秒と短めです(1〜3 分が目安)`);
  if (total > 240) warn(0, `全体が ${Math.round(total / 60)} 分を超えています(論点を 3 つまでに絞ると見てもらいやすい)`);
  if (scenes.length > 0 && scenes.length < 5) warn(0, `シーンが ${scenes.length} 個と少なめです(8〜14 個が目安)`);
  if (scenes.length > 18) warn(0, `シーンが ${scenes.length} 個と多めです(8〜14 個が目安)`);

  // つかみ: タイトルの次(なければ最初)のシーンで、数字・問い・データを見せているか
  const first = scenes[0]?.part === 'title' ? 1 : 0;
  const hook = scenes[first];
  if (hook) {
    const words = `${stripMarks(JSON.stringify(resolve(first)))} ${hook.narration ?? ''}`;
    if (!HOOK_PARTS.has(hook.part) && !/[??]|\d/.test(words)) warn(first + 1, 'つかみがありません。最初のシーンで、意外な数字か問いを見せてください');
  }

  // 締め: 最後の 2 シーンに「まとめ」があるか
  if (scenes.length >= 4 && !scenes.slice(-2).some((s) => s.part === 'summary')) warn(scenes.length, '最後に「まとめ」のシーンがありません');

  // 単調さ: 同じ部品が 3 回続く・箇条書きばかり
  for (let i = 2; i < scenes.length; i++) {
    if (scenes[i].part === scenes[i - 1].part && scenes[i].part === scenes[i - 2].part && (i + 1 >= scenes.length || scenes[i + 1].part !== scenes[i].part)) {
      warn(i + 1, `同じ種類(${scenes[i].part})のシーンが続いています。図・グラフ・数字などに変えると単調になりません`);
    }
  }
  const bullets = scenes.filter((s) => s.part === 'bullets').length;
  if (scenes.length >= 6 && bullets / scenes.length > 0.4) warn(0, `箇条書きが ${bullets} / ${scenes.length} シーンあります。比較・流れ図・数字・アイコン一覧などに変えられないか見直してください`);

  // ナレーション: あるシーンとないシーンが混ざっていないか
  const narrated = scenes.map((s) => !!s.narration?.trim());
  if (narrated.some(Boolean)) {
    const missing = narrated.map((n, i) => (n ? 0 : i + 1)).filter(Boolean);
    if (missing.length > 0) warn(0, `ナレーションのないシーンがあります: ${missing.join('、')}(その間は無音になります)`);
  }

  scenes.forEach((s, i) => {
    const n = i + 1;
    const props = resolve(i);
    const chars = countChars(props);
    if (chars > SCREEN_CHARS) warn(n, `画面の文字が ${chars} 字あります。${SCREEN_CHARS} 字以内にし、説明はナレーションに回してください`);
    if (DATA_PARTS.has(s.part) && !s.source?.trim() && !(typeof props.note === 'string' && props.note.trim())) warn(n, 'データのシーンに出典がありません(「出典: 〜」の行を足してください)');
    const sec = narrationSeconds(s);
    if (sec > NARRATION_SECONDS) warn(n, `ナレーションが約 ${Math.round(sec)} 秒あります。${NARRATION_SECONDS} 秒以内になるよう短くするか、シーンを分けてください`);
    if (s.narration?.trim()) {
      const list = cueItems(s.part, props);
      if (s.audio && list.length >= 2 && s.audio.cues.length < list.length) {
        info(n, `項目 ${list.length} 個のうち ${s.audio.cues.length} 個しか、ナレーションに合わせて出せていません。ナレーションの項目を話し始める所に ▶ を入れてください`);
      }
    }
    if (!s.narration?.trim() && s.seconds > 30) info(n, `シーンが ${Math.round(s.seconds)} 秒あります。分けると見やすくなります`);
    const heading = typeof props.heading === 'string' ? props.heading : '';
    if (/(続き)$/.test(heading)) info(n, '項目が多くて「(続き)」のシーンに分かれました。項目を 6 個以内に絞ってください');
  });

  const score = Math.max(0, 100 - items.reduce((n, x) => n + (x.level === 'warn' ? 8 : 2), 0));
  return { score, items };
};

export const describeQuality = (q: QualityItem): string => `${q.level === 'warn' ? '△' : '・'} ${q.scene > 0 ? `シーン ${q.scene}: ` : ''}${q.message}`;
