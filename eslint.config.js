import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      // 'no-console': 'warn',
      '@typescript-eslint/no-namespace': [
        'error',
        {
          allowDeclarations: true, // Allow namespace declarations
        },
      ],
      '@typescript-eslint/no-require-imports': 'error',
      '@typescript-eslint/no-unsafe-function-type': 'off',
    },
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      'coverage/',
      '*.config.js',
      '*.config.ts',
      'scripts/',
    ],
  }
);