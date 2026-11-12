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

/** 上部のメニューの項目を押す */
export const menu = async (page: Page, menuName: 'プロジェクト' | 'ツール', item: string) => {
  await page.locator('.menu summary', { hasText: menuName }).click();
  await page.locator('.menu-items button', { hasText: item }).click();
};

/** 確認・入力のダイアログに答える(prompt には answer を入れる) */
export const answerDialogs = (page: Page, answer = '') => {
  page.on('dialog', (d) => {
    if (process.env.E2E_DEBUG) console.log(`[dialog] ${d.type()}: ${d.message()}`);
    void (d.type() === 'prompt' ? d.accept(answer) : d.accept());
  });
};

export const projectSelect = (page: Page) => page.locator('.topbar > select');

/** 一時フォルダに保存されたプロジェクトを読む */
export const readSavedProject = (name: string) => JSON.parse(readFileSync(path.join(E2E_PROJECTS_DIR, `${name}.json`), 'utf8'));
