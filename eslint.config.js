import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import onlyWarn from 'eslint-plugin-only-warn';
import pluginNext from '@next/eslint-plugin-next';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';

/** @type {import("eslint").Linter.Config[]} */
const baseConfig = [
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    plugins: {
      onlyWarn,
    },
  },
  {
    ignores: ['dist/**'],
  },
];

/** @type {import("eslint").Linter.Config[]} */
const nextJsConfig = [
  ...baseConfig,
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    ...pluginReact.configs.flat.recommended,
    languageOptions: {
      ...pluginReact.configs.flat.recommended.languageOptions,
      globals: {
        ...globals.serviceworker,
      },
    },
  },
  {
    plugins: {
      '@next/next': pluginNext,
    },
    rules: {
      ...pluginNext.configs.recommended.rules,
      ...pluginNext.configs['core-web-vitals'].rules,
    },
  },
  {
    plugins: {
      'react-hooks': pluginReactHooks,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...pluginReactHooks.configs.recommended.rules,
      // React scope no longer necessary with new JSX transform.
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
  },
  // API-route Zod-validation nudge. Fires on the 28 routes still using
  // imperative validation (request.json(), searchParams.get()). Warn-level
  // because onlyWarn downgrades everything anyway, and because we don't
  // want to force-migrate every route in one PR — the goal is to surface
  // the pattern gap when an agent opens one of these files.
  //
  // The migration recipe is in .claude/skills/next-app-router/api-routes.md;
  // use @/lib/api/parse (parseJson / parseSearchParams / parseParams) with
  // schemas from @/lib/api/schemas.
  {
    files: ['src/app/api/**/route.ts', 'src/app/api/**/route.tsx'],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.object.name='request'][callee.property.name='json']",
          message:
            'API routes should use parseJson(request, schema) from @/lib/api/parse instead of request.json() directly. See .claude/skills/next-app-router/api-routes.md for the pattern.',
        },
        {
          selector:
            "MemberExpression[object.type='MemberExpression'][object.property.name='nextUrl'][property.name='searchParams']",
          message:
            'API routes should use parseSearchParams(request, schema) from @/lib/api/parse instead of request.nextUrl.searchParams. See .claude/skills/next-app-router/api-routes.md for the pattern.',
        },
        {
          selector:
            "NewExpression[callee.name='URL'][arguments.0.type='MemberExpression'][arguments.0.object.name='request'][arguments.0.property.name='url']",
          message:
            'Use parseSearchParams(request, schema) from @/lib/api/parse instead of `new URL(request.url)` + searchParams.get. See .claude/skills/next-app-router/api-routes.md for the pattern.',
        },
      ],
    },
  },
];

export default nextJsConfig;

