
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // Quan trọng: Dùng đường dẫn tương đối để chạy được trên GitHub Pages (sub-path)
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
});
