/**
 * エディタの操作を、本物のブラウザで確かめる(npm run e2e)。
 */
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { answerDialog, menu, openEditor, projectName, readSavedProject } from './helpers';

/** 「シーンを追加」から種類を選んで追加する */
const addPart = async (page: Page, name: string) => {
  await page.getByRole('button', { name: 'シーンを追加' }).click();
  await page.locator('.part-card').filter({ has: page.locator('b', { hasText: new RegExp(`^${name}$`) }) }).click();
};

test('サンプルを開くと、シーンの一覧(縮小画像つき)とプレビューが出る', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openEditor(page);
  await expect(page.locator('.scene')).toHaveCount(5);
  await expect(page.locator('.scene-thumb')).toHaveCount(5);
  await expect(page.locator('.player-wrap')).toBeVisible();
  await expect(page.locator('.total')).toContainText('5 シーン');
  await expect(page.locator('.total')).toContainText('0:27.5');
  await expect(page.locator('.save-state')).toContainText('自動で保存済み');
  expect(errors).toEqual([]);
});

test('シーンの追加・複製・並べ替え・削除と、元に戻す・やり直し', async ({ page }) => {
  await openEditor(page);
  const scenes = page.locator('.scene');
  await addPart(page, 'Q&A');
  await expect(scenes).toHaveCount(6);
  await expect(scenes.nth(1).locator('.scene-part')).toContainText('Q&A');

  await page.keyboard.press('Control+d');
  await expect(scenes).toHaveCount(7);
  await page.keyboard.press('Alt+ArrowUp');
  await page.keyboard.press('Delete');
  await expect(scenes).toHaveCount(6);

  await page.keyboard.press('Control+z');
  await expect(scenes).toHaveCount(7);
  await page.getByRole('button', { name: '元に戻す' }).click();
  await page.getByRole('button', { name: '元に戻す' }).click();
  await page.getByRole('button', { name: '元に戻す' }).click();
  await expect(scenes).toHaveCount(5);
  await page.keyboard.press('Control+y');
  await expect(scenes).toHaveCount(6);
});

test('入力は一覧に反映され、少し待つと自動で projects/ のファイルに保存される', async ({ page }) => {
  await openEditor(page);
  await page.locator('.scene').nth(1).click();
  const heading = page.locator('.col-right input[type=text]').first();
  await heading.fill('自動テストの見出し');
  await expect(page.locator('.scene').nth(1).locator('.scene-summary')).toHaveText('自動テストの見出し');
  await expect(page.locator('.save-state')).toContainText('自動で保存済み', { timeout: 10_000 });
  expect(readSavedProject('sample').scenes[1].props.heading).toBe('自動テストの見出し');
  // Ctrl+S ではすぐに保存し、知らせる
  await heading.fill('もう一度');
  await page.keyboard.press('Control+s');
  await expect(page.locator('.message')).toContainText('保存しました');
  expect(readSavedProject('sample').scenes[1].props.heading).toBe('もう一度');
});

test('文章からシーンを作る', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'シーンを追加' }).click();
  await page.getByRole('tab', { name: '文章から作る' }).click();
  await page.locator('.modal textarea').fill('# 自動テスト\n説明\n\n## 手順\n1. 一\n2. 二\n3. 三\n\n## 割合\nA: 60%\nB: 40%\n\n## まとめ\n- 終わり');
  await expect(page.locator('.outline-preview .item')).toHaveCount(4);
  await page.locator('.modal button.primary').click();
  await expect(page.locator('.scene .scene-part')).toContainText(['タイトル', '流れ図', '円グラフ', 'まとめ']);
});

test('新しい動画は最初の画面から作り方を選べ、ひな形から作って別の動画のシーンを貼り付けられる', async ({ page }) => {
  await openEditor(page);
  await page.locator('.scene').nth(2).click();
  await page.keyboard.press('Control+c');

  await menu(page, '新しい動画を作る');
  await answerDialog(page, '作る', '自動テストのひな形');
  await expect(projectName(page)).toHaveText('自動テストのひな形');
  await expect(page.getByRole('heading', { name: 'どうやって作りますか?' })).toBeVisible();
  await page.locator('.start-card', { hasText: 'ひな形から作る' }).click();
  await page.locator('.modal .template', { hasText: '手順の解説' }).click();
  await page.getByRole('button', { name: 'このひな形で作る' }).click();
  const n = await page.locator('.scene').count();
  expect(n).toBeGreaterThanOrEqual(4);

  await page.locator('.scene').first().click();
  await page.keyboard.press('Control+v');
  await expect(page.locator('.scene')).toHaveCount(n + 1);
  await expect(page.locator('.scene').nth(1).locator('.scene-part')).toContainText('流れ図');
  // 「シーンを追加」の中の「貼り付け」からも貼り付けられる
  await page.getByRole('button', { name: 'シーンを追加' }).click();
  await page.getByRole('tab', { name: /貼り付け/ }).click();
  await page.getByRole('button', { name: '1 シーンを貼り付ける' }).click();
  await expect(page.locator('.scene')).toHaveCount(n + 2);
  // 自動で保存されている
  await expect(page.locator('.save-state')).toContainText('自動で保存済み', { timeout: 10_000 });
  expect(readSavedProject('自動テストのひな形').scenes.length).toBe(n + 2);
});

test('保存できなかった変更は、次に開いたときに下書きから復元できる', async ({ page }) => {
  await openEditor(page);
  // 保存を失敗させる
  await page.route('**/api/projects/**', (route) => (route.request().method() === 'PUT' ? route.fulfill({ status: 500, body: '{"error":"テストの失敗"}' }) : route.fallback()));
  await page.locator('.title-input').fill('下書きのタイトル');
  await expect(page.locator('.save-state')).toContainText('保存できませんでした', { timeout: 10_000 });
  await page.unroute('**/api/projects/**');
  await page.reload();
  await answerDialog(page, '下書きを復元する');
  await expect(page.locator('.title-input')).toHaveValue('下書きのタイトル');
  await expect(page.locator('.save-state')).toContainText('自動で保存済み', { timeout: 10_000 });
});

test('プレビューをクリックして、画像の丸の位置を決める', async ({ page }) => {
  await openEditor(page);
  await addPart(page, '画像');
  await page.locator('.col-right label.check', { hasText: '丸で囲む' }).locator('input').check();
  await page.locator('.col-right .point-field button').click();
  const box = (await page.locator('.pick-overlay').boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.25);
  const inputs = page.locator('.col-right .point-field input');
  await expect(inputs.nth(0)).toHaveValue(/^(95[7-9]|96[0-3])$/);
  await expect(inputs.nth(1)).toHaveValue(/^(17[7-9]|18[0-3])$/);
});

test('動画全体の設定: テーマ・章の表示・エンドカード、YouTube の章は「動画にする」から', async ({ page }) => {
  await openEditor(page);
  const before = await page.locator('.total').innerText();
  await page.getByRole('tab', { name: /動画全体/ }).click();
  await page.locator('.col-right select').first().selectOption('light');
  await page.locator('.col-right label.check', { hasText: '章の表示' }).locator('input').check();
  await page.locator('.col-right label.check', { hasText: 'エンドカード' }).locator('input').check();
  await expect(page.locator('.total')).not.toHaveText(before);
  await page.getByRole('button', { name: '動画にする' }).click();
  await page.getByRole('button', { name: 'YouTube の章の時刻' }).click();
  await expect(page.locator('.chapters-text')).toHaveValue(/^0:00 ブロックチェーン/);
});

test('zip で持ち出して、zip から読み込む', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('tab', { name: /動画全体/ }).click();
  await page.locator('.col-right .asset-field select').selectOption('ブロックの図.png');
  const [download] = await Promise.all([page.waitForEvent('download'), menu(page, 'zip で持ち出す(画像も入る)')]);
  // ファイルの場所に日本語が入らないようにする(場所に日本語があると、ファイル選択で change が起きないことがある)
  const zipPath = path.join(mkdtempSync(path.join(os.tmpdir(), 'svm-zip-')), 'sample.zip');
  await download.saveAs(zipPath);

  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), menu(page, 'zip から読み込む…')]);
  await chooser.setFiles(zipPath);
  await expect(projectName(page)).toHaveText('sample-2');
  await page.getByRole('tab', { name: /動画全体/ }).click();
  await expect(page.locator('.col-right .asset-field select')).toHaveValue('ブロックの図.png');
});

test('短すぎる秒数は「確認」に出て、目安に合わせると消える', async ({ page }) => {
  await openEditor(page);
  await expect(page.getByRole('button', { name: /確認 \d+ 件/ })).toHaveCount(0);
  await page.locator('.scene').nth(1).click();
  await page.locator('.more-settings summary').click();
  await page.getByRole('spinbutton', { name: '長さ(秒)の数字' }).fill('1');
  await expect(page.locator('.warn-notice')).toContainText('短め');
  await page.getByRole('button', { name: '確認 1 件' }).click();
  await expect(page.locator('.issue-list')).toContainText('シーン 2');
  await page.locator('.issue-list').getByRole('button', { name: '目安に合わせる' }).click();
  await expect(page.getByRole('button', { name: /確認 \d+ 件/ })).toHaveCount(0);
});

test('シーンの種類を変えると、引き継げなかった入力を知らせる', async ({ page }) => {
  await openEditor(page);
  await page.locator('.scene').nth(1).click();
  await page.getByRole('button', { name: '種類を変える' }).click();
  await page.locator('.part-card').filter({ has: page.locator('b', { hasText: /^流れ図$/ }) }).click();
  await expect(page.locator('.scene').nth(1).locator('.scene-part')).toContainText('流れ図');
  await expect(page.locator('.message')).toContainText('引き継げませんでした');
  await page.keyboard.press('Control+z');
  await expect(page.locator('.scene').nth(1).locator('.scene-part')).toContainText('箇条書き');
});

test('メニューは外をクリックすると閉じ、? キーでキー操作の一覧が開く', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: 'プロジェクトのメニュー' }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await page.locator('.player-wrap').click({ position: { x: 5, y: 200 } });
  await expect(page.getByRole('menu')).toHaveCount(0);
  await page.getByRole('button', { name: 'プロジェクトのメニュー' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: 'キー操作の一覧' })).toBeVisible();
});
