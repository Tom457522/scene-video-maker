/**
 * エディタの操作を、本物のブラウザで確かめる(npm run e2e)。
 */
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { answerDialogs, menu, openEditor, projectSelect, readSavedProject } from './helpers';

test('サンプルを開くと、シーンの一覧(縮小画像つき)とプレビューが出る', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openEditor(page);
  await expect(page.locator('.scene')).toHaveCount(5);
  await expect(page.locator('.scene-thumb')).toHaveCount(5);
  await expect(page.locator('.player-wrap')).toBeVisible();
  await expect(page.locator('.total')).toContainText('0:27.5');
  expect(errors).toEqual([]);
});

test('シーンの追加・複製・並べ替え・削除と、元に戻す・やり直し', async ({ page }) => {
  await openEditor(page);
  const scenes = page.locator('.scene');
  await page.getByRole('button', { name: '+ シーンを追加' }).click();
  await page.locator('.part-picker button', { hasText: 'Q&A' }).click();
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

test('入力は一覧に反映され、保存すると projects/ のファイルに書かれる', async ({ page }) => {
  await openEditor(page);
  await page.locator('.scene').nth(1).click();
  const heading = page.locator('.col-right input[type=text]').nth(1);
  await heading.fill('自動テストの見出し');
  await expect(page.locator('.scene').nth(1).locator('.scene-summary')).toHaveText('自動テストの見出し');
  await expect(page.locator('.topbar button.primary')).toContainText('保存 ●');
  await page.keyboard.press('Control+s');
  await expect(page.getByRole('button', { name: '保存済み' })).toBeVisible();
  expect(readSavedProject('sample').scenes[1].props.heading).toBe('自動テストの見出し');
});

test('文章からシーンを作る', async ({ page }) => {
  await openEditor(page);
  await menu(page, 'ツール', '文章からシーンを作る');
  await page.locator('.modal textarea').fill('# 自動テスト\n説明\n\n## 手順\n1. 一\n2. 二\n3. 三\n\n## 割合\nA: 60%\nB: 40%\n\n## まとめ\n- 終わり');
  await expect(page.locator('.outline-preview .item')).toHaveCount(4);
  await page.locator('.modal button.primary').click();
  await expect(page.locator('.scene .scene-part')).toContainText(['タイトル', '流れ図', '円グラフ', 'まとめ']);
});

test('ひな形から新しいプロジェクトを作り、別のプロジェクトのシーンを貼り付ける', async ({ page }) => {
  await openEditor(page);
  answerDialogs(page);
  await page.locator('.scene').nth(2).click();
  await page.keyboard.press('Control+c');
  await expect(page.locator('.add-row .paste')).toBeVisible();

  await menu(page, 'プロジェクト', '新規');
  await page.locator('.modal input[type=text]').fill('自動テストのひな形');
  await page.locator('.modal .template', { hasText: '手順の解説' }).click();
  await page.locator('.modal button.primary', { hasText: '作る' }).click();
  await expect(projectSelect(page)).toHaveValue('自動テストのひな形');
  const n = await page.locator('.scene').count();
  expect(n).toBeGreaterThanOrEqual(4);

  await page.locator('.scene').first().click();
  await page.keyboard.press('Control+v');
  await expect(page.locator('.scene')).toHaveCount(n + 1);
  await expect(page.locator('.scene').nth(1).locator('.scene-part')).toContainText('流れ図');
});

test('保存せずに閉じても、次に開いたときに下書きを復元できる', async ({ page }) => {
  await openEditor(page);
  answerDialogs(page);
  await page.locator('.title-input').fill('下書きのタイトル');
  await page.waitForTimeout(1200);
  await page.reload();
  await expect(page.locator('.scene').first()).toBeVisible();
  await expect(page.locator('.title-input')).toHaveValue('下書きのタイトル');
  await expect(page.locator('.topbar button.primary')).toContainText('保存 ●');
});

test('プレビューをクリックして、画像の丸の位置を決める', async ({ page }) => {
  await openEditor(page);
  await page.getByRole('button', { name: '+ シーンを追加' }).click();
  await page.locator('.part-picker button', { hasText: '画像' }).click();
  await page.locator('.col-right label.check', { hasText: '丸で囲む' }).locator('input').check();
  await page.locator('.col-right .point-field button').click();
  const box = (await page.locator('.pick-overlay').boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.25);
  const inputs = page.locator('.col-right .point-field input');
  await expect(inputs.nth(0)).toHaveValue(/^(95[7-9]|96[0-3])$/);
  await expect(inputs.nth(1)).toHaveValue(/^(17[7-9]|18[0-3])$/);
});

test('動画全体の設定: テーマ・章の表示・エンドカード', async ({ page }) => {
  await openEditor(page);
  const before = await page.locator('.total').innerText();
  await page.locator('.tabs button', { hasText: '動画全体' }).click();
  await page.locator('.col-right select').first().selectOption('light');
  await page.locator('.col-right label.check', { hasText: '章の表示' }).locator('input').check();
  await page.locator('.col-right label.check', { hasText: 'エンドカード' }).locator('input').check();
  await expect(page.locator('.total')).not.toHaveText(before);
  await menu(page, 'ツール', 'YouTube の章の時刻');
  await expect(page.locator('.chapters-text')).toHaveValue(/^0:00 ブロックチェーン/);
});

test('zip に書き出して、zip から読み込む', async ({ page }) => {
  await openEditor(page);
  answerDialogs(page);
  await page.locator('.tabs button', { hasText: '動画全体' }).click();
  await page.locator('.col-right .asset-field select').selectOption('ブロックの図.png');
  const [download] = await Promise.all([page.waitForEvent('download'), menu(page, 'プロジェクト', 'zip に書き出す')]);
  // ファイルの場所に日本語が入らないようにする(場所に日本語があると、ファイル選択で change が起きないことがある)
  const zipPath = path.join(mkdtempSync(path.join(os.tmpdir(), 'svm-zip-')), 'sample.zip');
  await download.saveAs(zipPath);

  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), menu(page, 'プロジェクト', 'zip から読み込む')]);
  await chooser.setFiles(zipPath);
  await expect(projectSelect(page)).toHaveValue('sample-2');
  await page.locator('.tabs button', { hasText: '動画全体' }).click();
  await expect(page.locator('.col-right .asset-field select')).toHaveValue('ブロックの図.png');
});
