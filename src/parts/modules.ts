/**
 * src/parts/<名前>/index.tsx を自動で集める。
 * エディタ(Vite)では import.meta.glob、書き出し(Remotion のバンドラ = webpack)では require.context を使う。
 * どちらの書き方も、それぞれのバンドラがビルド時に中身を埋め込む(もう一方の書き方は実行されない)。
 */
type WebpackRequire = {
  context: (dir: string, recursive: boolean, re: RegExp) => { keys(): string[]; (id: string): unknown };
};

const collect = (): Record<string, unknown> => {
  if (typeof require === 'function') {
    const ctx = (require as unknown as WebpackRequire).context('./', true, /^\.\/[^/]+\/index\.tsx$/);
    return Object.fromEntries(ctx.keys().map((k) => [k, ctx(k)]));
  }
  return import.meta.glob('./*/index.tsx', { eager: true });
};

/** キーは "./title/index.tsx" の形 */
export const partModules: Record<string, unknown> = collect();
