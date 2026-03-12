// Necessary: import-x resolver does not see @playwright/test named exports (test, expect); they are valid exports.
export default [
  {
    files: ['tests/e2e/**/*.ts'],
    rules: { 'import-x/named': 'off' },
  },
]
