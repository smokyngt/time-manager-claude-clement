import js from '@eslint/js';
import importX from 'eslint-plugin-import-x';
import jsdoc from 'eslint-plugin-jsdoc';
import perfectionist from 'eslint-plugin-perfectionist';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'drizzle', 'node_modules', 'openapi.json'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  perfectionist.configs['recommended-alphabetical'],
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { 'import-x': importX, jsdoc },
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'explicit' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-extraneous-class': ['error', { allowStaticOnly: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      'import-x/no-default-export': 'error',
      'import-x/no-duplicates': 'error',
      'jsdoc/check-tag-names': ['error', { definedTags: ['route'] }],
      'jsdoc/require-jsdoc': 'off',
      'no-console': 'error',
      'no-inline-comments': 'error',
      'no-warning-comments': 'error',
      'perfectionist/sort-imports': [
        'error',
        {
          groups: [
            ['value-builtin', 'value-external'],
            'value-internal',
            ['value-parent', 'value-sibling', 'value-index'],
            'type-import',
            'unknown',
          ],
          internalPattern: ['^@/'],
          newlinesBetween: 1,
          type: 'alphabetical',
        },
      ],
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unnecessary-type-parameters': 'off',
    },
  },
  {
    files: ['src/routes/**/*.ts'],
    rules: { '@typescript-eslint/require-await': 'off' },
  },
  {
    files: ['drizzle.config.ts', 'eslint.config.js'],
    rules: { 'import-x/no-default-export': 'off' },
  },
  {
    files: ['**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
);
