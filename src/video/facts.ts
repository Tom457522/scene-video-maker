/**
 * 数字の照合。台本(画面の文・ナレーション)に出てくる数字が、元の調査レポートにもあるかを調べる。
 * AI が台本に書き直すときに、数字が変わったり作られたりするのを見つけるため(AI は使わず、文字を比べるだけ)。
 */
import { stripMarks } from '../kit/text';
import { collectText } from './reading';
import type { Project } from './project';

export type FoundNumber = {
  /** 書いてあったとおりの文字(例: 「約1,200万人」) */
  text: string;
  /** 比べるための値(万・億を掛け、割は % に直したもの) */
  value: number;
  /** 割合(%・割)か */
  percent: boolean;
  /** 「約」「以上」など、おおよその数として書いているか */
  approx: boolean;
};

const MULT: Record<string, number> = { 千: 1e3, 万: 1e4, 億: 1e8, 兆: 1e12 };

/**
 * 数字の書き方:  [約] 1,234.5 [千|万|億|兆] [%|割|単位…]
 * 「3つ」「第2章」のような数え方の小さな数は、照合しない(台本の組み立てのための数なので)。
 */
const NUM = /(約|およそ|ほぼ|推定|最大|最低|少なくとも)?\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*(千|万|億|兆)?\s*(万|億)?\s*(%|パーセント|割|倍|[^\s\d,.、。()()「」ぁ-ゖ]{0,3})/gu;
const APPROX_AFTER = /^\S{0,4}?(以上|以下|超|未満|近く|程度|前後|強|弱|余り|ほど|あまり)/;
const COUNTER = /^(つ|個|点|章|段階|ステップ|位|番|回目|か条|項目|分で|行)/;

/** 全角の数字・記号を半角にする */
const normalize = (text: string): string => text.normalize('NFKC');

/** 文の中の数字を取り出す */
export const findNumbers = (raw: string): FoundNumber[] => {
  // ファイル名・URL・{part=...}・[アイコン名] の数字は照合しない
  const text = normalize(stripMarks(raw))
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\S+\.(png|jpe?g|gif|webp|svg)\b/gi, ' ')
    .replace(/\{[^}]*\}/g, ' ');
  const out: FoundNumber[] = [];
  for (const m of text.matchAll(NUM)) {
    const [whole, pre, digits, m1, m2, after = ''] = m;
    // 前が英字・数字につながっているもの(型番など)は除く
    const before = text[m.index - 1] ?? '';
    if (/[A-Za-z_\-/]/.test(before)) continue;
    let value = Number(digits.replace(/,/g, ''));
    if (!Number.isFinite(value)) continue;
    if (m1) value *= MULT[m1];
    if (m2) value *= MULT[m2];
    const percent = after === '%' || after === 'パーセント' || after === '割';
    if (after === '割') value *= 10;
    const rest = text.slice(m.index + whole.length - after.length);
    if (!m1 && !m2 && !percent && COUNTER.test(rest)) continue;
    // 単位のない 0〜10 の整数は、数え方や番号のことが多いので除く
    if (!m1 && !m2 && !percent && Number.isInteger(value) && value <= 10 && !/^(倍|年|月|日|歳|人|社|件|か国|カ国|ヶ国|度)/.test(after)) continue;
    const tail = text.slice(m.index + whole.length - after.length, m.index + whole.length + 6);
    const approx = !!pre || APPROX_AFTER.test(tail);
    out.push({ text: whole.trim(), value, percent, approx });
  }
  return out;
};

export type FactProblem = {
  /** シーンの番号(1 始まり) */
  scene: number;
  /** 台本に書いてあった数字 */
  text: string;
  /** その数字が出てくる文 */
  context: string;
  /** missing: レポートにない / rounded: 近い数はあるが同じではない(「約」を付けるか、数字を合わせる) */
  kind: 'missing' | 'rounded';
  /** rounded のとき、レポートにある近い数 */
  near?: string;
};

export type FactReport = { checked: number; problems: FactProblem[] };

/** 2 つの数が「同じ」か(小数の書き方の違いは許す) */
const same = (a: number, b: number) => Math.abs(a - b) <= Math.max(1e-9, Math.abs(b) * 1e-6);
/** おおよそ同じか(5% 以内) */
const close = (a: number, b: number) => b !== 0 && Math.abs(a - b) / Math.abs(b) <= 0.05;

/** グラフ・数字の部品の値(数値で入っている)を、単位つきの文にする */
const numericValues = (props: Record<string, unknown>): string[] => {
  const unit = typeof props.unit === 'string' ? props.unit : '';
  const out: string[] = [];
  if (typeof props.value === 'number') out.push(`${props.value}${unit}`);
  for (const v of Object.values(props)) {
    if (!Array.isArray(v)) continue;
    for (const row of v) {
      if (row && typeof row === 'object' && typeof (row as { value?: unknown }).value === 'number') out.push(`${(row as { value: number }).value}${unit}`);
    }
  }
  return out;
};

/** シーンの文(画面の文・グラフの値・ナレーション)を集める */
export const sceneTexts = (scene: Project['scenes'][number]): string[] => [
  ...collectText(scene.props),
  ...numericValues(scene.props),
  ...(scene.narration ? [scene.narration.replace(/▶/g, '')] : []),
];

/** 台本(プロジェクト)の数字を、レポートの文と照らし合わせる */
export const checkFacts = (project: Pick<Project, 'scenes'>, sourceText: string): FactReport => {
  const known = findNumbers(sourceText);
  // 年(1900〜2100 の 4 桁の整数)は、そのまま比べる。ほかは値で比べる
  const problems: FactProblem[] = [];
  let checked = 0;
  project.scenes.forEach((scene, i) => {
    const seen = new Set<string>();
    for (const text of sceneTexts(scene)) {
      for (const n of findNumbers(text)) {
        const key = `${n.value}|${n.percent}`;
        if (seen.has(key)) continue;
        seen.add(key);
        checked++;
        // 割合は割合とだけ、ふつうの数はふつうの数とだけ比べる(「10%」を「10人」で認めないため)
        const candidates = known.filter((k) => k.percent === n.percent);
        if (candidates.some((k) => same(n.value, k.value))) continue;
        const near = candidates.find((k) => close(n.value, k.value));
        const context = normalize(stripMarks(text)).trim().slice(0, 80);
        if (near && n.approx) continue;
        problems.push(near ? { scene: i + 1, text: n.text, context, kind: 'rounded', near: near.text } : { scene: i + 1, text: n.text, context, kind: 'missing' });
      }
    }
  });
  return { checked, problems };
};

/** 問題を 1 行の文にする */
export const describeFact = (p: FactProblem): string =>
  p.kind === 'missing'
    ? `「${p.text}」が元のレポートに見つかりません(「${p.context}」)`
    : `「${p.text}」はレポートでは「${p.near}」です。同じ数にするか「約」を付けてください(「${p.context}」)`;
