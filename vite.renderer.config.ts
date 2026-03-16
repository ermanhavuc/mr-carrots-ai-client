import type { ConfigEnv, UserConfig } from 'vite';
import { defineConfig } from 'vite';
import { pluginExposeRenderer } from './vite.base.config';
import renderer from 'vite-plugin-electron-renderer';
import svgLoader from 'vite-svg-loader';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config
export default defineConfig((env) => {
  const forgeEnv = env as ConfigEnv<'renderer'>;
  const { root, mode, forgeConfigSelf } = forgeEnv;
  const name = forgeConfigSelf.name ?? '';

  return {
    root,
    mode,
    base: './',
    build: {
      outDir: `.vite/renderer/${name}`,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/mermaid') || id.includes('node_modules/@mermaid-js')) {
              return 'vendor-mermaid'
            }
            if (id.includes('node_modules/katex')) {
              return 'vendor-katex'
            }
            if (id.includes('node_modules/highlight.js') || id.includes('node_modules/lowlight')) {
              return 'vendor-highlight'
            }
            if (id.includes('node_modules/@tiptap') || id.includes('node_modules/prosemirror')) {
              return 'vendor-tiptap'
            }
            if (id.includes('node_modules/vega') || id.includes('node_modules/vega-lite')) {
              return 'vendor-vega'
            }
          }
        }
      }
    },
    plugins: [
      pluginExposeRenderer(name),
      renderer(),
      vue({
        template: {
          compilerOptions: {
            isCustomElement: (tag) => tag === 'webview'
          }
        }
      }),
      svgLoader({ defaultImport: 'url' })
    ],
    resolve: {
      preserveSymlinks: true,
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@assets': path.resolve(__dirname, 'assets'),
        '@components': path.resolve(__dirname, 'src/renderer/components'),
        '@composables': path.resolve(__dirname, 'src/renderer/composables'),
        '@css': path.resolve(__dirname, 'css'),
        '@main': path.resolve(__dirname, 'src/main'),
        '@models': path.resolve(__dirname, 'src/models'),
        '@renderer': path.resolve(__dirname, 'src/renderer'),
        '@root': path.resolve(__dirname, './'),
        '@screens': path.resolve(__dirname, 'src/renderer/screens'),
        '@services': path.resolve(__dirname, 'src/renderer/services'),
        '@tests': path.resolve(__dirname, 'tests'),
        'types': path.resolve(__dirname, 'src/types'),
      }
    },
    clearScreen: false,
  } as UserConfig;
});
