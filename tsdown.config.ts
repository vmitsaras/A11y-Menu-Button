import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: './src/index.ts',
    core: './src/core.ts',
    docs: './src/docs.ts',
    'addons/async-menu-state': './src/addons/async-menu-state.ts',
    'addons/command-menu': './src/addons/command-menu.ts',
    'addons/filterable-menu': './src/addons/filterable-menu.ts',
    'addons/menu-feedback': './src/addons/menu-feedback.ts',
    'addons/menu-hints': './src/addons/menu-hints.ts',
    'addons/recent-actions': './src/addons/recent-actions.ts',
    'addons/rich-menu-items': './src/addons/rich-menu-items.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2022',
  platform: 'neutral',
  outDir: 'dist',
});
