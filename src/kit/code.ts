/**
 * コードの色分け(簡易版)。キーワード・文字列・数値・コメント・関数名を見分ける。
 * 外部のライブラリを使わず、同じ入力なら必ず同じ結果になる。
 */
import { alpha, colors } from './theme';

export const LANGUAGES = {
  ts: 'TypeScript / JavaScript',
  python: 'Python',
  shell: 'シェル',
  html: 'HTML',
  css: 'CSS',
  json: 'JSON',
  text: 'テキスト(色分けなし)',
} as const;

export type Language = keyof typeof LANGUAGES;
export type TokenKind = 'plain' | 'keyword' | 'string' | 'number' | 'comment' | 'func' | 'punct';
export type Token = { text: string; kind: TokenKind };

const KEYWORDS: Record<Language, string[]> = {
  ts: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'of', 'in', 'new', 'class', 'extends', 'import', 'from', 'export', 'default', 'async', 'await', 'type', 'interface', 'true', 'false', 'null', 'undefined', 'try', 'catch', 'throw', 'this', 'switch', 'case', 'break'],
  python: ['def', 'return', 'if', 'elif', 'else', 'for', 'while', 'in', 'import', 'from', 'as', 'class', 'with', 'try', 'except', 'raise', 'lambda', 'yield', 'True', 'False', 'None', 'and', 'or', 'not', 'pass', 'async', 'await', 'print'],
  shell: ['if', 'then', 'else', 'fi', 'for', 'do', 'done', 'echo', 'cd', 'export', 'npm', 'npx', 'git', 'sudo', 'curl', 'node'],
  html: [],
  css: ['@media', '@import', 'important'],
  json: ['true', 'false', 'null'],
  text: [],
};

const lineComment: Partial<Record<Language, string>> = { ts: '//', python: '#', shell: '#' };
const blockComment: Partial<Record<Language, [string, string]>> = { ts: ['/*', '*/'], css: ['/*', '*/'], html: ['<!--', '-->'] };

/** 1 行を色分けする。state は複数行のコメントの途中かどうか(行をまたいで引き継ぐ) */
const tokenizeLine = (line: string, lang: Language, state: { inBlock: boolean }): Token[] => {
  if (lang === 'text') return [{ text: line, kind: 'plain' }];
  const out: Token[] = [];
  const push = (text: string, kind: TokenKind) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last && last.kind === kind) last.text += text;
    else out.push({ text, kind });
  };
  const block = blockComment[lang];
  const keywords = new Set(KEYWORDS[lang]);
  let i = 0;
  while (i < line.length) {
    const rest = line.slice(i);
    if (state.inBlock && block) {
      const end = rest.indexOf(block[1]);
      if (end < 0) {
        push(rest, 'comment');
        break;
      }
      push(rest.slice(0, end + block[1].length), 'comment');
      i += end + block[1].length;
      state.inBlock = false;
      continue;
    }
    if (block && rest.startsWith(block[0])) {
      state.inBlock = true;
      push(block[0], 'comment');
      i += block[0].length;
      continue;
    }
    const lc = lineComment[lang];
    if (lc && rest.startsWith(lc)) {
      push(rest, 'comment');
      break;
    }
    const str = /^(["'`])(?:\\.|(?!\1).)*\1?/.exec(rest);
    if (str) {
      push(str[0], 'string');
      i += str[0].length;
      continue;
    }
    const num = /^\d[\d_]*(?:\.\d+)?/.exec(rest);
    if (num && !/[\w$]/.test(line[i - 1] ?? '')) {
      push(num[0], 'number');
      i += num[0].length;
      continue;
    }
    const word = /^[@A-Za-z_$][\w$-]*/.exec(rest);
    if (word) {
      const w = lang === 'css' || lang === 'html' ? word[0] : word[0].replace(/-.*$/, '');
      const next = line[i + w.length];
      if (keywords.has(w)) push(w, 'keyword');
      else if (next === '(') push(w, 'func');
      else if (lang === 'html' && line[i - 1] === '<') push(w, 'keyword');
      else if (lang === 'html' && line[i - 1] === '/' && line[i - 2] === '<') push(w, 'keyword');
      else push(w, 'plain');
      i += w.length;
      continue;
    }
    const ch = Array.from(rest)[0];
    push(ch, /[{}()[\];,.:=<>+\-*/!&|?]/.test(ch) ? 'punct' : 'plain');
    i += ch.length;
  }
  return out;
};

/** コード全体を行ごとに色分けする */
export const highlightCode = (code: string, lang: Language): Token[][] => {
  const state = { inBlock: false };
  return code.replace(/\t/g, '  ').split(/\r?\n/).map((line) => tokenizeLine(line, lang, state));
};

/** 色分けの色(今のテーマから決める) */
export const tokenColor = (kind: TokenKind): string => {
  switch (kind) {
    case 'keyword':
      return colors.coral;
    case 'string':
      return colors.teal;
    case 'number':
      return colors.yellow;
    case 'func':
      return colors.yellow;
    case 'comment':
      return alpha(colors.sub, 0.85);
    case 'punct':
      return colors.sub;
    default:
      return colors.text;
  }
};

/** "3,5-7" のような行の指定を、行番号(1 始まり)の集まりにする */
export const parseLineSpec = (spec: string): Set<number> => {
  const out = new Set<number>();
  for (const part of spec.split(/[,、\s]+/)) {
    const m = /^(\d+)(?:\s*[-~〜]\s*(\d+))?$/.exec(part.trim());
    if (!m) continue;
    const a = Number(m[1]);
    const b = Math.min(Number(m[2] ?? m[1]), a + 500);
    for (let n = Math.min(a, b); n <= Math.max(a, b); n++) out.add(n);
  }
  return out;
};

/** 等幅フォントでの 1 行の幅(em)。全角は 1、半角は 0.6 */
export const monoWidthEm = (line: string): number => {
  let w = 0;
  for (const ch of line.replace(/\t/g, '  ')) w += (ch.codePointAt(0) ?? 0) < 0x80 ? 0.6 : 1;
  return w;
};
