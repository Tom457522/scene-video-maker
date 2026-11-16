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

- **調査レポートなどから作るときは、スキル `.claude/skills/research-to-video/SKILL.md` の手順に従う**(台本の設計 → `--source` で数字の照合 → `--review` の静止画で見直し → 書き出し)。
- 台本(Markdown)の書き方は README の「文章からシーンを作る」と「ナレーション付きの動画にする」。1 シーン 1 論点、全体で 8〜14 シーン(1〜3 分)を目安にする。
- `npm run make -- 台本.md --source レポート.md --review review --check-only --json` で、`facts.problems`・`issues`・`notes` が空になり、`quality.score` が 90 以上になるまで直す。終了コード 2 ははみ出し、3 はレポートにない数字。
- `npm run make -- 台本.md --json --out <MP4>` で書き出す(字幕 .srt と説明文 .txt も隣にできる)。図があれば `--images <フォルダ>`(SVG は自動で PNG になる)。
- 音声は VOICEVOX(起動していれば)か Open JTalk(`open_jtalk`)。どちらもなければ `--voice none`。
- 書き出しに使う Chrome は `REMOTION_BROWSER_EXECUTABLE` で指定できる(クラウドのコンテナでは `/opt/pw-browsers/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell`)。

## 注意点

- API は 127.0.0.1 だけで待ち受け、Origin と Content-Type を確かめている。緩めない。
- `projects/assets/` に SVG を入れない(エディタと同じオリジンで配信されるため)。SVG は `npm run make` が PNG にする。
- `projects/assets/audio/` は `npm run make` が作る音声(ナレーション・BGM・効果音)の置き場所。git には入れない。
- 部品は「フレームだけで見た目を決める」。新しい部品は `npm run new-part` から作り、PARTS_GUIDE.md に従う。
