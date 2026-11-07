const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/'] },
  js.configs.recommended,
  {
    files: ['**/*.user.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        ...globals.browser,
        GM_addStyle: 'readonly',
        GM_setValue: 'readonly',
        GM_getValue: 'readonly',
        GM_setClipboard: 'readonly'
      }
    },
    rules: {
      eqeqeq: 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'no-unused-vars': ['error', { caughtErrors: 'none' }],
      // try { GM_* } catch (e) { } fallbacks are intentional
      'no-empty': ['error', { allowEmptyCatch: true }]
    }
  },
  {
    files: ['eslint.config.js'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node }
  }
];
