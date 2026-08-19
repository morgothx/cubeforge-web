// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * The same bar as `cubeforge-api`: type-checked rules, Prettier as a rule
 * rather than a separate command, and a boundary enforced instead of merely
 * written down.
 *
 * The Vite template ships oxlint. It is replaced here on purpose — the two
 * repositories are read together, and a reviewer should not have to learn two
 * lint configurations to read one project.
 */
export default tseslint.config(
  {
    ignores: ['dist', 'eslint.config.mjs', 'vite.config.ts'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  reactHooks.configs['recommended-latest'],
  reactRefresh.configs.vite,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },

  // --- The one boundary worth enforcing here ---
  //
  // Everything that talks to the backend lives in `src/api`. A component that
  // reaches for `fetch` directly is how request shapes, error handling and the
  // access token end up duplicated across a dozen files — and how a refusal
  // stops being handled the same way everywhere. The rule is narrow on purpose:
  // it buys one thing, and the rest of the app follows plain React conventions.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/api/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message:
            'Reach the backend through src/api, so every request is shaped, authorized and refused the same way.',
        },
      ],
    },
  },

  {
    files: ['src/**/*.test.{ts,tsx}', 'test/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // Test helpers are never a hot-reload boundary, and this rule cannot see
      // through a re-export of the testing library.
      'react-refresh/only-export-components': 'off',
    },
  },

  {
    rules: {
      // `const { email, ...rest } = member` is how a field is *omitted*, which
      // this codebase does deliberately — the backend omits an address rather
      // than emptying it, and the fixtures have to be able to say so.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { ignoreRestSiblings: true, argsIgnorePattern: '^_' },
      ],
    },
  },
);
