import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

function copyExtensionManifest() {
  return {
    name: 'copy-extension-manifest',
    closeBundle() {
      copyFileSync(resolve(__dirname, 'src/extension/manifest.json'), resolve(__dirname, 'dist-extension/manifest.json'));
    },
  };
}

export default defineConfig({
  plugins: [react(), copyExtensionManifest()],
  publicDir: 'src/extension/public',
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: 'dist-extension',
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: resolve(__dirname, 'src/extension/content-script.tsx'),
      name: 'LinkedInPostFormatterExtension',
      formats: ['iife'],
      fileName: () => 'content-script.js',
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => (assetInfo.name?.endsWith('.css') ? 'style.css' : 'assets/[name][extname]'),
      },
    },
  },
});