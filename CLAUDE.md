# CLAUDE.md

シーン式の解説動画メーカー(TypeScript / React / Vite / Remotion)。UI 文言・コメント・README・コミットメッセージはすべて日本語。詳しい説明は README.md、部品の作り方は PARTS_GUIDE.md。

## コマンド

```bash
npm run dev                         # エディタ(http://127.0.0.1:5173)
npm run make -- 原稿.md [オプション] # 原稿から、はみ出しを調べてから MP4 を作る
npm run check                       # 型チェック・lint・単体テスト(変更後は必ず)
npx tsx --test test/make.test.ts    # 1 ファイルだけ
```

## 動画を作ってと頼まれたとき

1. README の「文章からシーンを作る」の書き方で原稿(Markdown)を書く。1 シーン 1 論点、全体で 8〜14 シーン(1〜3 分)を目安にする。
2. `npm run make -- 原稿.md --check-only --json` で、`notes`(切り詰め)と `issues`(はみ出し)が空になるまで原稿を直す。終了コード 2 ははみ出し。
3. `npm run make -- 原稿.md --json --out <MP4>` で書き出す。図があれば `--images <フォルダ>`(SVG は自動で PNG になる)。
- 原稿の書き方のこつは README の「原稿から 1 コマンドで動画にする」。
- 書き出しに使う Chrome は `REMOTION_BROWSER_EXECUTABLE` で指定できる(クラウドのコンテナでは `/opt/pw-browsers/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell`)。

## 注意点

- API は 127.0.0.1 だけで待ち受け、Origin と Content-Type を確かめている。緩めない。
- `projects/assets/` に SVG を入れない(エディタと同じオリジンで配信されるため)。SVG は `npm run make` が PNG にする。
- 部品は「フレームだけで見た目を決める」。新しい部品は `npm run new-part` から作り、PARTS_GUIDE.md に従う。
