/**
 * Noto Sans JP を npm パッケージ(@fontsource)から読み込む。ネットにつながっていなくても書き出せる。
 */
import '@fontsource/noto-sans-jp/400.css';
import '@fontsource/noto-sans-jp/700.css';
import '@fontsource/noto-sans-jp/900.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';
import { font } from './theme';

/**
 * text に含まれる文字のフォントを、使う太さぶん読み込み終えるまで待つ。
 * (日本語フォントは文字の範囲ごとに分割されていて、使う分だけ読まれるため)
 */
export const loadFontsFor = async (text: string): Promise<void> => {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  const sample = text.length > 0 ? text : 'あ';
  await Promise.all([
    ...Object.values(font.weight).map((w) => document.fonts.load(`${w} 40px "Noto Sans JP"`, sample).catch(() => [])),
    ...[400, 700].map((w) => document.fonts.load(`${w} 40px "JetBrains Mono"`, sample).catch(() => [])),
  ]);
  await document.fonts.ready;
};
