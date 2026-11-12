import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { sceneApi } from './server/api.ts';

export default defineConfig({
  plugins: [react(), sceneApi()],
  // 画像(projects/assets/)をそのまま配信する。部品は kit の Picture / assetSrc で参照する
  publicDir: 'projects/assets',
  server: {
    // このパソコンからだけ開ける
    host: '127.0.0.1',
    port: 5173,
    open: true,
    // projects/assets/(画像)だけは見張る(追加した画像をすぐ配信するため)
    watch: { ignored: ['**/out/**', '**/stills/**', '**/projects/*.json', '**/projects/.history/**', '**/projects/.trash/**'] },
  },
});
