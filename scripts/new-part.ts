/**
 * npm run new-part -- <部品名> [表示名]
 * src/parts/<部品名>/index.tsx を、決まり(meta / schema / Component、kit だけを使う)に沿ったひな形から作る。
 * 部品名は英小文字・数字・ハイフン(例: timeline2, step-list)。プロジェクトの JSON の "part" に入る値になる。
 */
import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { ROOT } from '../server/projects.ts';

const [id, displayName] = process.argv.slice(2);
if (!id) {
  console.error('使い方: npm run new-part -- <部品名> [表示名]   (例: npm run new-part -- step-list ステップ一覧)');
  process.exit(1);
}
if (!/^[a-z][a-z0-9-]{1,30}$/.test(id)) {
  console.error('部品名は、英小文字で始まる英小文字・数字・ハイフンの 2〜31 文字にしてください(例: step-list)');
  process.exit(1);
}
const dir = path.join(ROOT, 'src', 'parts', id);
if (existsSync(dir)) {
  console.error(`src/parts/${id}/ はすでにあります。別の名前にしてください。`);
  process.exit(1);
}
const name = (displayName ?? id).replace(/['`\\]/g, '');
const template = await fs.readFile(path.join(ROOT, 'scripts', 'templates', 'part.tsx.txt'), 'utf8');
await fs.mkdir(dir, { recursive: true });
await fs.writeFile(path.join(dir, 'index.tsx'), template.replaceAll('__ID__', id).replaceAll('__NAME__', name));

console.log(`src/parts/${id}/index.tsx を作りました。次の順で仕上げてください:

  1. meta の description と、schema の入力項目・Component の見た目を書き換える(PARTS_GUIDE.md を参照)
  2. npm run dev を開き、「+ シーンを追加」に「${name}」が出ることを確かめる(フォームは schema から自動でできる)
  3. npm run stress -- ${id}   … 最大・最小の入力でのはみ出しを自動で調べる
  4. npm run check            … 型・lint・テスト(部品の決まりの違反もここで見つかる)
  5. 見本ページ(/?gallery)で、ほかの部品と見た目がそろっているかを見比べる`);
