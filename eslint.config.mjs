import js from '@eslint/js';

// Налаштування навчального ESLint-аудиту 6 файлів Express.js.
// Лінтер читає код із ../express/lib через tools/lint.mjs.
export default [
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        module: 'readonly', exports: 'writable', require: 'readonly',
        process: 'readonly', Buffer: 'readonly', __dirname: 'readonly',
        __filename: 'readonly', console: 'readonly',
        setTimeout: 'readonly', clearTimeout: 'readonly',
        setImmediate: 'readonly', URL: 'readonly', URLSearchParams: 'readonly'
      }
    },
    rules: { ...js.configs.recommended.rules, 'no-unused-vars': 'warn', 'no-undef': 'warn' }
  }
];
