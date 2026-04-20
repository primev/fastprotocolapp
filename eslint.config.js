import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import onlyWarn from 'eslint-plugin-only-warn';
import pluginNext from '@next/eslint-plugin-next';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import unusedImports from 'eslint-plugin-unused-imports';

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
  // Auto-fix for unused imports. `eslint --fix` deletes them — much faster
  // than chasing `tsc --noEmit` TS6133 errors by hand. We pair this with
  // the TypeScript `noUnusedLocals` / `noUnusedParameters` flags so unused
  // destructured props / parameters still surface as typecheck errors (those
  // need context-aware fixes, not auto-delete).
  {
    plugins: {
      'unused-imports': unusedImports,
    },
    rules: {
      // Turn off the stock no-unused-vars; unused-imports owns the import
      // arm of it. We keep tsc's flags doing the rest.
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'warn',
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
  // Pre-folderization `src/lib` paths.
  //
  // The "folderize lib" commit (6889c3b) moved most top-level files under
  // src/lib/ into config/ · tokens/ · settlement/ · swap/ subfolders.
  // Feature PRs from main that opened before that commit still import the
  // old paths; when they merge in, the imports are broken at runtime but
  // TypeScript can't narrow them to a useful message. This rule catches
  // every stale path before `next build` does, with a pointer to the new
  // location in the message.
  //
  // If you're seeing this rule fire: the module moved. Update your import
  // to the path in the message. Do NOT reintroduce the old top-level
  // module; any such re-add is an anti-pattern regression.
  //
  // Mirrors the rename table in .claude/skills/merging-main/SKILL.md.
  {
    rules: {
      'no-restricted-imports': [
        'warn',
        {
          paths: [
            // config/
            { name: '@/lib/site-config', message: "Moved to '@/lib/config/site'." },
            { name: '@/lib/network-config', message: "Moved to '@/lib/config/network'." },
            { name: '@/lib/feature-flags', message: "Moved to '@/lib/config/feature-flags'." },
            { name: '@/lib/constants', message: "Moved to '@/lib/config/constants'." },
            { name: '@/lib/leaderboard-config', message: "Moved to '@/lib/config/leaderboard'." },
            // tokens/
            { name: '@/lib/weth-abi', message: "Moved to '@/lib/tokens/weth-abi'." },
            { name: '@/lib/erc20-abi', message: "Moved to '@/lib/tokens/erc20-abi'." },
            { name: '@/lib/token-list', message: "Moved to '@/lib/tokens/token-list' (JSON: '@/lib/tokens/token-list.json')." },
            { name: '@/lib/token-resolver', message: "Moved to '@/lib/tokens/token-resolver'." },
            { name: '@/lib/stablecoins', message: "Moved to '@/lib/tokens/stablecoins'." },
            { name: '@/lib/stablecoin-list', message: "Moved to '@/lib/tokens/stablecoin-list'." },
            { name: '@/lib/weth-utils', message: "Moved to '@/lib/tokens/weth-utils'." },
            { name: '@/lib/token-icons', message: "Moved to '@/lib/tokens/token-icons'." },
            { name: '@/lib/popular-tokens', message: "Moved to '@/lib/tokens/popular-tokens'." },
            { name: '@/lib/barter-supported-tokens', message: "Moved to '@/lib/tokens/barter-supported-tokens'." },
            // settlement/
            { name: '@/lib/transaction-errors', message: "Moved to '@/lib/settlement/transaction-errors'." },
            { name: '@/lib/transaction-receipt-utils', message: "Moved to '@/lib/settlement/transaction-receipt-utils'." },
            { name: '@/lib/tx-config', message: "Moved to '@/lib/settlement/tx-config'." },
            { name: '@/lib/fast-rpc-status', message: "Moved to '@/lib/settlement/rpc-status'." },
            { name: '@/lib/fast-tx-status', message: "Moved to '@/lib/settlement/tx-status'." },
            { name: '@/lib/fast-db', message: "Moved to '@/lib/settlement/db'." },
            { name: '@/lib/preconfirm-sound', message: "Moved to '@/lib/settlement/preconfirm-sound'." },
            // swap/
            { name: '@/lib/slippage', message: "Moved to '@/lib/swap/slippage'." },
            { name: '@/lib/quote-guard', message: "Moved to '@/lib/swap/quote-guard'." },
            { name: '@/lib/eth-path-tx', message: "Moved to '@/lib/swap/eth-path-tx'." },
            { name: '@/lib/permit2-utils', message: "Moved to '@/lib/swap/permit2-utils'." },
            { name: '@/lib/barter-api', message: "Moved to '@/lib/swap/barter-api'." },
            { name: '@/lib/swap-constants', message: "Moved to '@/lib/swap/constants'." },
            { name: '@/lib/swap-events', message: "Moved to '@/lib/swap/events'." },
            { name: '@/lib/swap-server', message: "Moved to '@/lib/swap/server'." },
            // deleted
            { name: '@/lib/fast-settlement-v2-1', message: "Removed. The v2.1 ABI is no longer used; see contracts-abi/ for current ABIs." },
            { name: '@/lib/fast-settlement-v3-abi', message: "Removed. See src/lib/tokens/*-abi.ts and contracts-abi/ for current ABIs." },
          ],
        },
      ],
    },
  },
];

export default nextJsConfig;

