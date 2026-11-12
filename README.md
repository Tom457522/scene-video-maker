# シーン式 解説動画メーカー

文字を入力するだけで、アニメーション付きの解説動画(MP4)を作れるローカル Web アプリです。
動画は「シーンの並び」で、1 シーン = **部品の種類 + 入力した文字 + 秒数**。動きの速さやタイミングは部品が決めるので、ユーザーは文字・秒数・並び順だけを触ります。

- TypeScript / React / Vite / [Remotion](https://www.remotion.dev/)
- プレビューは `@remotion/player`、書き出しはローカルの Node から `@remotion/renderer`
- 1280 × 720 / 30fps / 音声なし
- 外部サーバー・課金サービスは使いません(このパソコンの中だけで動きます)

## 必要なもの

- Windows 10 / 11(macOS・Linux でも動きます)
- [Node.js](https://nodejs.org/) 20.19 以上(22 LTS 推奨)

## 起動

**Windows**: フォルダの中の `start.bat` をダブルクリックします(初回は `npm install` も自動で行います)。

**コマンドで起動する場合**:

```bash
npm install
npm run dev
```

ブラウザで http://127.0.0.1:5173 が開きます(開かなければ手で開いてください)。最初は `projects/sample.json` が開きます。

> **初回の書き出しについて**: MP4 の書き出しには Chrome Headless Shell を使います。初めて書き出すときに一度だけ自動でダウンロードされます(インターネット接続が必要)。すでにある Chrome / Chromium を使いたいときは、環境変数 `REMOTION_BROWSER_EXECUTABLE` にその実行ファイルのパスを入れて起動してください。

## 画面の使い方

| 場所 | できること |
|---|---|
| 上部 | プロジェクトの切り替え・新規・別名で保存、動画のタイトル、合計時間、保存(Ctrl+S)、MP4 書き出し(進捗表示・完了したらダウンロード) |
| 左 | シーンの一覧。「+ シーンを追加」で部品を選んで追加、⧉ で複製、🗑 で削除、ドラッグで並べ替え |
| 中央 | プレビュー。再生/停止(クリック・スペース)、シークバー、上の番号でシーンの頭出し、ダブルクリックで全画面 |
| 右 | 選択中のシーンの設定。部品の切り替え、秒数、部品ごとの入力項目 |

- 入力はすぐプレビューに反映されます。止めているときは、編集中のシーンの見どころ(70% 地点)へ自動で移ります。
- 文の中の `[[語]]` は、その語にマーカーが引かれます(対応している項目には案内が出ます)。
- 書き出した MP4 は `out/` にも保存されます。

## 最初からある部品

| 部品 | 内容 |
|---|---|
| `title` タイトル | 文字が 1 文字ずつ跳ねて登場、下線、サブタイトル、漂う図形 |
| `bullets` 箇条書き | 番号バッジが回転して登場、文が右から入る、`[[ ]]` の語にマーカー |
| `flow` 流れ図 | ボックスが順に出現、矢印が伸び、粒が行き来する |
| `bars` 横棒グラフ | 横棒が伸びながら数字がカウントアップ |
| `summary` まとめ | チェックマークが 1 つずつ描かれる |

## プロジェクトファイル

1 本の動画 = `projects/<名前>.json` の 1 ファイルです。エディタで保存すると書き出されます。手で書いても構いません。

```json
{ "title": "ブロックチェーン", "scenes": [
  { "part": "bullets", "seconds": 5.5,
    "props": { "heading": "ブロックチェーンとは", "items": ["取引の記録を[[ブロック]]にまとめる"] } }
] }
```

- `part` は部品のフォルダ名、`seconds` は 1〜60 秒、`props` は部品の入力項目です。
- `props` に足りない項目や不正な値があっても、部品の既定値で補って表示します(エディタの右列に注意が出ます)。

## コマンド

| コマンド | 内容 |
|---|---|
| `npm run dev` | エディタを起動 |
| `npm run render -- <プロジェクト>` | エディタを使わずに MP4 を `out/<プロジェクト>.mp4` へ書き出す |
| `npm run stills -- <プロジェクト> [割合]` | 各シーンの見どころ(既定は開始から 70%)を `stills/<プロジェクト>/` に PNG で書き出し、文字のはみ出し(画面の外・枠の外・文字の重なり)を自動で調べる。見つかったら終了コード 1 |
| `npm run check` | 型チェック(`tsc`)と lint(`eslint`) |
| `npm run studio` | Remotion Studio で開く(部品の開発用。サンプルが表示されます) |

`<プロジェクト>` には `sample` のような名前か、JSON ファイルのパスを書けます。

## 部品の足し方

`src/parts/<名前>/index.tsx` を 1 つ置くだけで、エディタの一覧とフォームに現れます。本体のコードは変えません。

```tsx
import { type PartComponent, type PartMeta, Fill, FitText, field, progress, z } from '../../kit';

export const meta: PartMeta = { name: '引用', description: '大きな文字で 1 文を見せる', defaultSeconds: 4 };

export const schema = z.object({
  text: field.longText('文', '「[[わかりやすさ]]は正義」', { marks: true }),
});

export const Component: PartComponent<typeof schema> = ({ props, frame }) => (
  <Fill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: progress(frame, 0) }}>
    <FitText text={props.text} maxWidth={900} max={64} frame={frame} markStart={12} />
  </Fill>
);
```

決まり(フレームだけで見た目を決める、色や動きは `src/kit/` を使う など)・kit の使い方・確認手順は **[PARTS_GUIDE.md](PARTS_GUIDE.md)** にまとめています。AI に部品の追加を頼むときも、このガイドを読ませてください。

## フォルダ構成

```
src/
  kit/        部品用の共通ライブラリ(色・フォント・動き・はみ出し対策・見出し・字幕・背景・退場)
  parts/      部品(1 フォルダ = 1 部品。自動登録)
  video/      プロジェクトの形と、それを 1 本の動画として描くコンポーネント
  remotion/   Remotion(書き出し・Studio)の入口
  editor/     エディタ画面
server/       プロジェクトの読み書き・書き出し(Vite の開発サーバーに組み込む API)
scripts/      render / stills コマンド
projects/     プロジェクト JSON(sample.json、はみ出し確認.json)
```

## CI(自動テスト)

GitHub に push すると、GitHub Actions(`.github/workflows/ci.yml`)が **Windows と Ubuntu** で次を実行します。

1. `start.bat --check`(Windows のみ。起動の手前までを確かめる)
2. `npm run check`(型チェックと lint)
3. `npm run stills -- sample` と `はみ出し確認` の静止画の書き出しと、はみ出しの自動検査

書き出した静止画は、実行結果のページの「Artifacts」からダウンロードして見られます。

## しくみのメモ

- エディタは Vite、書き出しは Remotion のバンドラ(webpack)で同じ `src/video/ProjectVideo.tsx` をビルドします。部品の自動登録は、Vite では `import.meta.glob`、webpack では `require.context` で行います(`src/parts/modules.ts`)。
- 書き出しのバンドルは `src/` が変わったときだけ作り直します(最初の書き出しは準備に少し時間がかかります)。
- 書き出し中に使う文字のフォント(Noto Sans JP、`@fontsource` から読み込み)が読み終わるまで撮影を待つので、ネットにつながっていなくても文字化けしません。
- API は `127.0.0.1` だけで待ち受け、別のサイトからの書き込み要求は断ります。

## ライセンスについて(Remotion)

Remotion は独自のライセンスです。**個人、従業員 3 人以下の営利団体、非営利団体は無料**で、商用の動画づくりにも使えます。それより大きい営利団体で使う場合は Company License(有料)が必要です。詳しくは https://www.remotion.dev/docs/license を確認してください。
エディタのプレビューでは `acknowledgeRemotionLicense` を指定して、ライセンス確認のメッセージを出さないようにしています。
