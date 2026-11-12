# 部品(パーツ)の作り方ガイド

このアプリで動画の見た目を増やすときは、**部品を 1 つ足す**だけで済むようにできています。
このガイドは、人が部品を作るときにも、AI に部品の追加を頼むときにも使う指示書です。
AI に頼むときは、このファイルと `src/kit/`・`src/parts/bullets/index.tsx` を読ませてから依頼してください。

---

## 1. 部品の決まり(必ず守る)

1. **1 部品 = `src/parts/<名前>/index.tsx` の 1 フォルダ。** フォルダを置くだけで自動で登録され、エディタの一覧とフォームに現れる。本体のコード(`src/editor/`・`src/video/`・`server/` など)は変更しない。
   - `<名前>` は英小文字・数字・ハイフン(例: `timeline`、`compare-2col`)。これがプロジェクト JSON の `"part"` に入る値になるので、作ったあとで変えない。
2. **公開するのは次の 3 つだけ。**
   | export | 型 | 中身 |
   |---|---|---|
   | `meta` | `PartMeta` | `name`(一覧に出す名前)、`description`(どんな場面に使うか 1〜2 文)、`defaultSeconds`(追加したときの秒数)、任意で `order`(一覧の並び順) |
   | `schema` | `z.object({...})` | 入力項目。**すべての項目に既定値が必要**(kit の `field` を使えば自動で付く) |
   | `Component` | `PartComponent<typeof schema>` | `props`・`frame`・`durationInFrames`・`fps` を受けて描画する React コンポーネント |
3. **見た目は `frame` だけから決める。** 同じフレームなら必ず同じ絵になること。
   - 使ってはいけないもの: CSS の `transition` / `animation`、`setTimeout` / `setInterval` / `requestAnimationFrame`、`Math.random()`、`Date`、`useState` で時間を数えること。
   - `frame` は**シーンの先頭を 0** とした番号。`durationInFrames` はシーンの長さ(秒数 × 30)。
4. **kit(`src/kit/`)だけを使う。** 色・フォント・動きの関数を独自に定義しない。`remotion` を直接 import しない。
   - 色は `colors` / `accent(i)` / `alpha(色, 透明度)` / `surface` から。`#xxxxxx` や `rgba()` を書かない。
   - import してよいのは `react` と `'../../kit'` だけ(zod も kit から `z` として使う)。
5. **ユーザーが触るのは文字・数値・並び順だけ。** 速さやタイミング、色の選択はユーザーに任せず、部品の中で決める(schema に「速さ」や「色」の項目を作らない)。
6. **短い秒数でも見どころの 70% 地点までに全要素が出そろう**ようにする(`settleBy` と `stagger` を使う)。
7. **長い文字でもはみ出さない**ようにする(`FitText` / `fitFontSize` / `fitFontSizeAll` を使う)。
8. シーン終わりの退場(左へスライドしながらフェード)と背景は**動画の側で自動で付く**ので、部品の中で作らない。

違反の多くは `npm run lint` が検出します(`src/parts/` だけに厳しいルールをかけています)。

---

## 2. 画面と座標

- 動画は **1280 × 720 / 30fps / 音声なし**。部品は 1280 × 720 の画面いっぱいの箱(`<Fill>`)の中に、`position: absolute` で置くのが基本。
- 決まった配置は `layout` を使う:

| 名前 | 値 | 意味 |
|---|---|---|
| `layout.padX` | 96 | 左右の余白 |
| `layout.headingTop` | 64 | 見出しの上端(`<Heading>` が使う) |
| `layout.contentTop` | 196 | 本文を置き始める位置(見出しの下) |
| `layout.contentBottom` | 620 | 字幕があるときの本文の下端 |
| `layout.contentWidth` | 1088 | 本文の最大幅 |

---

## 3. kit の使い方

部品は `import { ... } from '../../kit';` で次のものを使う。

### 3.1 テーマ(`theme.ts`)

| 名前 | 内容 |
|---|---|
| `colors.bg` `#0E1630` | 背景 |
| `colors.text` `#F4F6FB` | 本文の文字 |
| `colors.sub` `#B9C2E0` | 補助の文字・線 |
| `colors.yellow` `#FFC53D` | 強調・マーカー・下線 |
| `colors.teal` `#4FD1C5` | 青緑 |
| `colors.coral` `#FF7A59` | 朱 |
| `accent(i)` | 黄 → 青緑 → 朱 の順に i 番目の色(番号バッジや棒の色分け) |
| `alpha(色, a)` | 半透明にした色(光彩・薄い面) |
| `surface.fill` / `fillStrong` / `border` | カードやパネルの面と枠線 |
| `font.weight.regular / bold / black` | 400 / 700 / 900(フォントは Noto Sans JP) |
| `font.size.hero / heading / body / small / caption` | 96 / 52 / 38 / 28 / 30(上限の目安) |

### 3.2 動き(`motion.ts`)

すべて「フレーム → 値」の純粋な関数です。

| 関数 | 返す値 | 使いどころ |
|---|---|---|
| `progress(frame, start, duration = T.enter, easing = ease.out)` | 0 → 1 | すべての基本。フェード・スライド |
| `back(frame, start, duration)` | 0 → 1(途中で 1 を少し超える) | ポンと出る登場(拡大・回転) |
| `bump(frame, at, duration = 10)` | 0 → 1 → 0 | 着地や完了の瞬間に一瞬ふくらませる |
| `draw(frame, start, duration)` | `{ strokeDasharray, strokeDashoffset, progress }` | SVG の線を描く。要素に `pathLength={1}` を付けて値をそのまま渡す |
| `mix(p, from, to)` | from → to | 0〜1 の進み具合を px や角度に変える |
| `stagger(i, n, from, until, gap)` | i 番目の開始フレーム | 複数要素を順に出す。until までに収まるよう間隔を詰める |
| `settleBy(durationInFrames, ratio = 0.55)` | フレーム | 「ここまでに登場を終える」目安 |
| `drift(frame, period, phase)` | -1 〜 1 | ゆっくり漂う |
| `pingPong(frame, period)` | 0 → 1 → 0 の繰り返し | 往復する粒 |
| `countUp(p, value, decimals)` | 文字列 | 数字のカウントアップ(3 桁区切り) |
| `ease.out / inOut / in / back / linear` | イージング | `progress` の第 5 引数 |
| `T.enter / beat / draw / exit` | 18 / 8 / 20 / 12 | 長さの目安(フレーム) |

### 3.3 文字とはみ出し対策(`text.ts`)

文字幅は DOM を測らず文字の種類から見積もるので、同じ入力なら必ず同じサイズになります。

| 名前 | 内容 |
|---|---|
| `fitFontSize(text, { maxWidth, max, min, maxLines })` | 幅と行数に収まる最大の文字サイズ。下限でも入らなければ折り返す |
| `fitFontSizeAll(texts, opts)` | 複数の文を同じサイズにそろえるとき |
| `parseMarks(text)` / `stripMarks(text)` | `[[語]]` の解析 / 取り除き |
| `measureEm(text)` / `estimateLines(...)` | 幅・行数の見積もり |
| `wrapStyle` | 日本語を文節で折り返す CSS。文字を置く要素に `...wrapStyle` で付ける |

### 3.4 共通要素(`components.tsx`)

| 要素 | 内容 |
|---|---|
| `<Fill>` | 画面いっぱいの箱 |
| `<Heading text frame start?>` | 見出し。左からスライドし、下線が伸びる。長いと自動で縮小・2 行化 |
| `<Caption text frame start?>` | 画面下の字幕。空文字なら何も出さない |
| `<FitText text maxWidth max min? maxLines? frame? markStart?>` | 自動縮小・折り返しつきの文。`frame` を渡すと `[[ ]]` のマーカーが `markStart` から引かれる |
| `<MarkedText text frame? markStart?>` | `[[ ]]` のマーカーだけを付けた文(サイズは親で決める) |
| `Background` / `SceneFrame` / `Stage` | 動画の側で使う(部品の中では使わない) |

### 3.5 入力項目(`fields.ts`)

`field` を使うと、フォームの項目名・入力欄の種類・既定値・上限が一度に決まります。

| 書き方 | フォーム |
|---|---|
| `field.text('見出し', '既定値', { max: 40, marks: true })` | 1 行の入力欄(`marks: true` で `[[ ]]` の案内を表示) |
| `field.longText('本文', '既定値', { max: 200 })` | 複数行の入力欄 |
| `field.number('値', 50, { min: 0, max: 100, step: 1 })` | 数値の入力欄 |
| `field.toggle('枠を出す', true)` | チェックボックス |
| `field.choice('配置', { left: '左', right: '右' }, 'left')` | 選択肢 |
| `field.list('項目', ['a', 'b'], { min: 1, max: 6, itemMax: 60 })` | 文字のリスト(追加・削除・並べ替え) |
| `field.rows('棒', { label: field.text(...), value: field.number(...) }, [既定の行...])` | 複数の入力を持つ行のリスト |

素の zod も使えますが、その場合は `.default(...)` と `.meta({ title: '項目名' })` を付けてください。

---

## 4. 良い例の解説: bullets(`src/parts/bullets/index.tsx`)

見出しと 1〜6 個の要点を出す部品です。新しい部品はこれを写して作り始めるのがおすすめです。

```tsx
// 1. meta: 一覧に出す名前・説明・既定の秒数・並び順
export const meta: PartMeta = { name: '箇条書き', description: '…', defaultSeconds: 6, order: 20 };

// 2. schema: field を使うと既定値と項目名が付き、フォームが自動でできる
export const schema = z.object({
  heading: field.text('見出し', 'ブロックチェーンとは', { max: 40, marks: true }),
  items: field.list('項目', ['取引の記録を[[ブロック]]にまとめる', …], { min: 1, max: 6, itemMax: 60, marks: true }),
});
```

コンポーネントで押さえている点:

1. **配置を数から計算する。** 項目数 `n` から 1 行の高さ `rowHeight` を決め、`fitFontSizeAll` で全項目が 2 行以内に収まる共通の文字サイズを出す。項目が増えても、文が長くても画面に収まる。
2. **タイミングをシーンの長さから決める。** `stagger(i, n, from, settleBy(durationInFrames, 0.5), 14)` で i 番目の開始フレームを出す。秒数を短くすると間隔が自動で詰まり、70% 地点では全項目が出そろう。
3. **動きは kit の関数だけで書く。**
   - 番号バッジ: `const badge = back(frame, s, T.enter)` → `rotate(mix(badge, -200, 0))` と `scale(badge)` で回転しながらポンと出る。
   - 文: `const textIn = progress(frame, s + 4, T.enter)` → `translateX(mix(textIn, 80, 0))` で右から入る。
   - マーカー: `<FitText … frame={frame} markStart={s + T.enter} />` で、文が入りきったあとに `[[ ]]` の語へ引かれる。
4. **色は `accent(i)` と `colors.*` だけ。** 番号の文字色は `colors.bg`、バッジの色は `accent(i)`。
5. **見出しは `<Heading>` に任せる。** スライド・下線・長いときの縮小は kit 側で済んでいる。

---

## 5. 新しい部品を足す手順

1. `src/parts/<名前>/index.tsx` を作る(`bullets` をコピーして直すのが早い)。
2. `meta` / `schema` / `Component` の 3 つを書く。
3. `npm run dev` のエディタで「+ シーンを追加」から選び、フォームが出ること・入力がすぐプレビューに反映されることを確かめる。
4. 確認用のプロジェクトを `projects/` に作り(エディタで保存してもよい)、次の「確認手順」を行う。

## 6. 確認手順(部品を作ったり直したりしたら必ず行う)

```bash
npm run check                      # 型チェック(tsc)と lint(部品の決まりの違反も検出)
npm run stills -- sample           # 各シーンの 70% 地点を stills/sample/ に PNG で書き出し、はみ出しを自動で調べる
npm run stills -- はみ出し確認      # 長い文字・多い項目でもはみ出さないか
npm run stills -- <プロジェクト> 0.3  # 登場の途中(30% 地点)の見た目
```

`npm run stills` は、書き出しと同時に**文字のはみ出しを自動で調べます**(実際のブラウザで文字の位置を測る)。
問題が見つかると `✗` と理由を表示し、終了コード 1 で終わります。CI でも同じ検査をしています。

| 表示 | 意味 | よくある直し方 |
|---|---|---|
| 画面の外にはみ出しています | 文字が 1280×720 の外に出ている | `FitText` / `fitFontSize` で縮める、`maxWidth` を付ける |
| 枠の外にはみ出しています | 背景色や枠線のある箱の外に文字が出ている | 箱の大きさに合わせて `maxLines` や文字サイズの上限を下げる |
| 文字が重なっています | 別々の文字どうしが重なっている | 行の高さを項目数から計算する、見出しの下(`layout.contentTop`)から置く |

透明に近い(まだ登場していない)文字は調べません。そのため 70% 地点で全要素が出そろっていることが前提です。
自動の検査は文字だけを見るので、図形の重なりや見た目の良し悪しは PNG を開いて確かめてください:

- [ ] 70% 地点で全要素が出そろっている(秒数を 3 秒にしても)
- [ ] `npm run stills` の自動検査で ✗ が出ない(長い文字・最大数の項目でも)
- [ ] 色が theme の 6 色(と、その半透明)だけで、文字が背景に対して読みやすい
- [ ] 同じコマンドを 2 回実行して同じ画像になる(フレームだけで見た目が決まっている)
- [ ] エディタで入力を空にしたり、項目を最小数・最大数にしたりしても壊れない
- [ ] MP4 に書き出して、動きが速すぎ・遅すぎないか(30fps で 1 要素の登場は 0.5 秒前後が目安)

## 7. AI に部品の追加を頼むときの依頼文の例

```
PARTS_GUIDE.md、src/kit/ の全ファイル、src/parts/bullets/index.tsx を読んでから、
新しい部品 "timeline" を src/parts/timeline/index.tsx に作ってください。

- 用途: 年表。3〜6 個の「年」と「出来事」を横一列に並べる
- 動き: 横線が左から伸び、点が順にポンと出て、出来事の文が下から入る
- 入力: 見出し、行(年・出来事)のリスト、字幕

ガイドの決まりを守り、最後に npm run check と npm run stills の確認手順を行って、
はみ出し確認用のプロジェクトも projects/ に作ってください。
```
