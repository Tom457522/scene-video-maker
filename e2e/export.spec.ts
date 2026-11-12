/**
 * 書き出しを本物で確かめる(Remotion のバンドル作成と Chrome Headless Shell を使うので時間がかかる)。
 */
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { openEditor, projectSelect } from './helpers';

test('MP4 と PNG を書き出してダウンロードできる', async ({ page, request }, testInfo) => {
  test.setTimeout(600_000);
  // 書き出しを短くするため、短いプロジェクトを用意する
  const put = await request.put('/api/projects/自動テストの書き出し', {
    data: {
      title: '短い動画',
      scenes: [
        { part: 'title', seconds: 1.5, props: { title: '短い動画' } },
        { part: 'bullets', seconds: 1.5, props: {} },
      ],
    },
  });
  expect(put.ok()).toBeTruthy();
  await openEditor(page, '自動テストの書き出し');
  await expect(projectSelect(page)).toHaveValue('自動テストの書き出し');

  // PNG(選んだシーン)
  await page.locator('.scene').nth(1).click();
  const [png] = await Promise.all([page.waitForEvent('download', { timeout: 300_000 }), page.locator('.col-right .small-btn', { hasText: 'PNG' }).click()]);
  const pngPath = testInfo.outputPath('scene.png');
  await png.saveAs(pngPath);
  expect(readFileSync(pngPath).subarray(1, 4).toString()).toBe('PNG');

  // MP4(720p・軽い)
  await page.locator('.export select').nth(1).selectOption('light');
  await page.getByRole('button', { name: '書き出す' }).click();
  await expect(page.locator('.export a.dl')).toBeVisible({ timeout: 300_000 });
  const [mp4] = await Promise.all([page.waitForEvent('download'), page.locator('.export a.dl').click()]);
  const mp4Path = testInfo.outputPath('video.mp4');
  await mp4.saveAs(mp4Path);
  const head = readFileSync(mp4Path);
  expect(head.length).toBeGreaterThan(10_000);
  expect(head.subarray(4, 8).toString()).toBe('ftyp');
});
