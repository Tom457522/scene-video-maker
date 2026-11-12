import assert from 'node:assert/strict';
import { test } from 'node:test';
import { themes } from '../src/kit/theme.ts';

/** WCAG のコントラスト比 */
const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [16, 8, 0]
    .map((s) => ((n >> s) & 255) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

for (const [id, t] of Object.entries(themes)) {
  test(`テーマ「${t.name}」(${id}): 文字と背景のコントラストが十分`, () => {
    assert.ok(contrast(t.text, t.bg) >= 7, `本文 ${contrast(t.text, t.bg).toFixed(2)}`);
    assert.ok(contrast(t.sub, t.bg) >= 4.5, `補助の文字 ${contrast(t.sub, t.bg).toFixed(2)}`);
    for (const k of ['yellow', 'teal', 'coral'] as const) {
      // 強調色は太字・大きめの文字や図形に使うので 3 以上(WCAG の大きな文字の基準)
      assert.ok(contrast(t[k], t.bg) >= 3, `${k} と背景 ${contrast(t[k], t.bg).toFixed(2)}`);
      assert.ok(contrast(t.onAccent, t[k]) >= 3, `${k} の上の文字 ${contrast(t.onAccent, t[k]).toFixed(2)}`);
    }
  });
}
