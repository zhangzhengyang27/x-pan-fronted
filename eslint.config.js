import js from '@eslint/js'
import vue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-plugin-prettier'
import prettierConfig from 'eslint-config-prettier'
import vueParser from 'vue-eslint-parser'

const globals = {
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  location: 'readonly',
  localStorage: 'readonly',
  sessionStorage: 'readonly',
  File: 'readonly',
  FileReader: 'readonly',
  FileList: 'readonly',
  Blob: 'readonly',
  URL: 'readonly',
  ResizeObserver: 'readonly',
  HTMLElement: 'readonly',
  Element: 'readonly',
  Event: 'readonly',
  CustomEvent: 'readonly',
  console: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',
  Promise: 'readonly',
  process: 'readonly',
  fetch: 'readonly',
  alert: 'readonly',
  confirm: 'readonly',
  IntersectionObserver: 'readonly',
  MutationObserver: 'readonly',
  MessageChannel: 'readonly',
  queueMicrotask: 'readonly',
  defineProps: 'readonly',
  defineEmits: 'readonly',
  defineExpose: 'readonly',
  withDefaults: 'readonly',
}

export default [
  {
    name: 'global-settings',
    ignores: ['dist', 'node_modules', 'public', 'package-lock.json', '*.config.*'],
  },
  js.configs.recommended,
  {
    name: 'prettier-integration',
    plugins: {prettier},
    rules: {
      ...prettierConfig.rules,
      'prettier/prettier': 'warn',
    },
  },
  // TypeScript 文件
  ...tseslint.configs.recommended.map((cfg) => ({
    ...cfg,
    files: ['**/*.ts', '**/*.tsx'],
  })),
  {
    name: 'typescript-parser',
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {ecmaVersion: 'latest', sourceType: 'module'},
    },
    plugins: {'@typescript-eslint': tseslint.plugin},
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {argsIgnorePattern: '^_', varsIgnorePattern: '^_'},
      ],
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      'no-empty': 'warn',
    },
  },
  // Vue 文件
  {
    name: 'vue-overrides',
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals,
    },
    plugins: {vue, '@typescript-eslint': tseslint.plugin},
    rules: {
      ...vue.configs['flat/recommended'][0].rules,
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'off',
      'no-unused-vars': 'off',
      'no-empty': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {argsIgnorePattern: '^_', varsIgnorePattern: '^_'},
      ],
    },
  },
  // JavaScript 文件
  {
    name: 'javascript-overrides',
    files: ['**/*.{js,jsx,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals,
    },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'warn',
      'no-empty': 'warn',
    },
  },
]
