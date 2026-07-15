import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    '**/dist',
    '**/.next',
    '**/.output',
    '**/.turbo',
    '**/.wxt',
    '**/node_modules',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // shadcn/ui files export variants alongside components by convention
    files: ['**/components/ui/**'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // Next.js app router files legitimately export metadata/config;
    // extension entrypoints are mount points, not refreshable modules
    files: ['apps/web/app/**', 'apps/extension/src/entrypoints/**'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
