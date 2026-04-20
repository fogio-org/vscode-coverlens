const tseslint = require('@typescript-eslint/eslint-plugin');

module.exports = [
  {
    ignores: [
      'dist/**',
      'out/**',
      'coverage/**',
      'examples/**',
      '.coverlens/**',
      'node_modules/**',
    ],
  },
  ...tseslint.configs['flat/recommended'],
  {
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
