import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'automatic',
    }),
    tailwindcss()
  ],
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router'
    ]
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
    }
  },
  resolve: {
    dedupe: ['react', 'react-dom']
  }
});