import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, type Page } from '@playwright/test';
import { E2E_PROJECTS_DIR } from '../playwright.config';

/** エディタを開き、シーンの一覧が出るまで待つ。前のテストの下書きは消しておく */
export const openEditor = async (page: Page, project = 'sample') => {
  await page.goto('/');
  await page.evaluate((p) => {
    localStorage.clear();
    localStorage.setItem('scene-video-maker:last', p);
  }, project);
  await page.goto('/');
  await expect(page.locator('.scene').first()).toBeVisible();
};

/** 左上のプロジェクトのメニューの項目を押す */
export const menu = async (page: Page, item: string) => {
  await page.getByRole('button', { name: 'プロジェクトのメニュー' }).click();
  await page.getByRole('menuitem', { name: item }).click();
};

/** アプリの確認・入力のダイアログに答える(text を渡すと入力欄に入れる) */
export const answerDialog = async (page: Page, button: string, text?: string) => {
  const dialog = page.locator('.modal').last();
  if (text !== undefined) await dialog.locator('input[type=text]').fill(text);
  await dialog.getByRole('button', { name: button, exact: true }).click();
};

/** 今開いているプロジェクトの名前 */
export const projectName = (page: Page) => page.locator('.project-name');

/** 一時フォルダに保存されたプロジェクトを読む */
export const readSavedProject = (name: string) => JSON.parse(readFileSync(path.join(E2E_PROJECTS_DIR, `${name}.json`), 'utf8'));
