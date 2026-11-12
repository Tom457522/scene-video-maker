/**
 * エディタの自動操作テスト(npm run e2e)。e2e/*.spec.ts を、本物のブラウザでエディタを操作して確かめる。
 * エディタは scripts/e2e-server.mjs が一時フォルダのプロジェクトで起動する(本物の projects/ は変えない)。
 */
import os from 'node:os';
import path from 'node:path';
import { defineConfig } from '@playwright/test';

const port = Number(process.env.E2E_PORT ?? 5180);
/** scripts/e2e-server.mjs と同じ場所 */
export const E2E_PROJECTS_DIR = path.join(os.tmpdir(), 'scene-video-maker-e2e', 'projects');

export default defineConfig({
  testDir: 'e2e',
  // エディタとプロジェクトの置き場所を共有するので、1 つずつ順に動かす
  workers: 1,
  fullyParallel: false,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1600, height: 900 },
    acceptDownloads: true,
    trace: 'off',
  },
  webServer: {
    command: 'node scripts/e2e-server.mjs',
    url: `http://127.0.0.1:${port}/api/projects`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { E2E_PORT: String(port), SCENE_NO_PREBUNDLE: '1' },
  },
});
