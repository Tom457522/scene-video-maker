import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { sceneApi } from './server/api.ts';

export default defineConfig({
  plugins: [react(), sceneApi()],
  server: {
    // このパソコンからだけ開ける
    host: '127.0.0.1',
    port: 5173,
    open: true,
    watch: { ignored: ['**/out/**', '**/stills/**', '**/projects/**'] },
  },
});
