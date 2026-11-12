/**
 * はみ出しの自動検出。書き出し中のブラウザで実際の文字の位置を測り、次の 3 つを見つける。
 *   - outside: 文字が画面(1280×720)の外に出ている
 *   - box:     文字が、それを囲む枠(背景色や枠線のある箱)の外に出ている
 *   - overlap: 別々の文字どうしが重なっている
 * 結果は console.log で書き出し側(server/render.ts)へ渡す。
 */
import { VIDEO } from '../kit/theme';

export type LayoutIssue = {
  kind: 'outside' | 'box' | 'overlap';
  /** 問題のある文字(先頭 30 文字) */
  text: string;
  /** overlap のとき、重なっている相手の文字 */
  other?: string;
};

/** console.log で結果を渡すときの目印 */
export const LAYOUT_LOG_PREFIX = '__LAYOUT_CHECK__';

/** 透明に近い要素(まだ登場していない・退場した)は調べない */
const MIN_OPACITY = 0.05;
/** 誤差として許すずれ(px) */
const TOLERANCE = 2;

type TextBlock = { node: Text; text: string; rects: DOMRect[] };

const effectiveOpacity = (el: Element | null, stop: Element): number => {
  let o = 1;
  for (let cur = el; cur && cur !== stop.parentElement; cur = cur.parentElement) {
    o *= Number(getComputedStyle(cur).opacity);
  }
  return o;
};

const hasVisibleBox = (el: Element): boolean => {
  const s = getComputedStyle(el);
  const bg = s.backgroundColor;
  const transparentBg = bg === 'transparent' || /rgba\(.*,\s*0\)$/.test(bg);
  const border = ['Top', 'Right', 'Bottom', 'Left'].some(
    (side) => parseFloat(s.getPropertyValue(`border-${side.toLowerCase()}-width`)) > 0 && s.getPropertyValue(`border-${side.toLowerCase()}-style`) !== 'none',
  );
  return !transparentBg || s.backgroundImage !== 'none' || border;
};

const shorten = (s: string) => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > 30 ? `${t.slice(0, 30)}…` : t;
};

const intersectArea = (a: DOMRect, b: DOMRect): number => {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
};

/** root(シーンの入れ物)の中の文字を調べる。座標は root の左上を (0, 0) とした 1280×720 */
export const checkLayout = (root: HTMLElement): LayoutIssue[] => {
  const origin = root.getBoundingClientRect();
  // プレビューで縮小表示されていても 1280×720 の座標に直す
  const scale = origin.width / VIDEO.width || 1;
  const toLocal = (r: DOMRect) =>
    new DOMRect((r.left - origin.left) / scale, (r.top - origin.top) / scale, r.width / scale, r.height / scale);

  const blocks: TextBlock[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const node = n as Text;
    const text = node.textContent ?? '';
    if (text.trim() === '') continue;
    const parent = node.parentElement;
    if (!parent || effectiveOpacity(parent, root) < MIN_OPACITY) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = Array.from(range.getClientRects())
      .filter((r) => r.width > 0 && r.height > 0)
      .map(toLocal);
    if (rects.length > 0) blocks.push({ node, text, rects });
  }

  const issues: LayoutIssue[] = [];
  for (const b of blocks) {
    // 画面の外
    if (b.rects.some((r) => r.left < -TOLERANCE || r.top < -TOLERANCE || r.right > VIDEO.width + TOLERANCE || r.bottom > VIDEO.height + TOLERANCE)) {
      issues.push({ kind: 'outside', text: shorten(b.text) });
      continue;
    }
    // 囲んでいる枠の外
    for (let el = b.node.parentElement; el && el !== root; el = el.parentElement) {
      if (!hasVisibleBox(el)) continue;
      const box = toLocal(el.getBoundingClientRect());
      const out = b.rects.some(
        (r) => r.left < box.left - TOLERANCE || r.top < box.top - TOLERANCE || r.right > box.right + TOLERANCE || r.bottom > box.bottom + TOLERANCE,
      );
      if (out) issues.push({ kind: 'box', text: shorten(b.text) });
      break;
    }
  }
  // 別々の文字どうしの重なり(小さいほうの 15% 以上が重なったら問題とする)
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const hit = blocks[i].rects.some((a) =>
        blocks[j].rects.some((c) => intersectArea(a, c) > 0.15 * Math.min(a.width * a.height, c.width * c.height)),
      );
      if (hit) issues.push({ kind: 'overlap', text: shorten(blocks[i].text), other: shorten(blocks[j].text) });
    }
  }
  return issues;
};
