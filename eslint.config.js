import antfu from '@antfu/eslint-config'
import { builtinRules } from 'eslint/use-at-your-own-risk'

// Navigation-path prefix group — keep in sync with ROOTS.* path prefixes.
// Selectors are intentionally NARROW (navigation call sites only) to avoid
// false-positives on asset paths, sitemap config, pathname comparisons, etc.
const NAV_PATH_RE
  = '/^\\/(dashboard|portfolio|services|proposal-flow|funnels|intake|about|contact|blog|community|experience)(\\/|$)/'
const NAV_PATH_MSG
  = 'Build app paths with ROOTS.* (absolute via mainSiteUrl/publicUrl), not string literals. See docs/codebase-conventions/urls-and-origins.md'

export default antfu({
  formatters: true,
  react: true,
  ignores: [
    'src/payload-types.ts',
    'src/app/(payload)/admin/importMap.js',

    // Remotion ad-video package — self-contained, own tsconfig/node_modules
    'video/**',

    // don't lint .md files
    '**/*.md',
  ],
  rules: {
    'react-refresh/only-export-components': 'off',
    'ts/no-empty-object-type': 'off',
  },
}).append({
  // Preserve antfu's original no-restricted-syntax entries (TSEnumDeclaration[const=true],
  // TSExportAssignment) and layer in four navigation-scoped selectors that prevent
  // bypassing ROOTS.* by writing raw app-path string literals in navigation contexts.
  name: 'project/no-raw-nav-paths',
  rules: {
    'no-restricted-syntax': [
      'error',
      // ── antfu originals (preserved) ──────────────────────────────────────
      'TSEnumDeclaration[const=true]',
      'TSExportAssignment',
      // ── navigation-scoped app-path guards ────────────────────────────────
      {
        selector: `JSXAttribute[name.name='href'] > Literal[value=${NAV_PATH_RE}]`,
        message: NAV_PATH_MSG,
      },
      {
        selector: `CallExpression[callee.name='redirect'] > Literal[value=${NAV_PATH_RE}]`,
        message: NAV_PATH_MSG,
      },
      {
        selector: `CallExpression[callee.property.name=/^(push|replace)$/] > Literal[value=${NAV_PATH_RE}]`,
        message: NAV_PATH_MSG,
      },
      {
        selector: `CallExpression[callee.object.name='window'][callee.property.name='open'] > Literal[value=${NAV_PATH_RE}]`,
        message: NAV_PATH_MSG,
      },
    ],
  },
}).append({
  // Seven pre-existing tables still inline paginated-table config today
  // (2026-07-26 prefetch-hydration-fault audit, guardrail 2). Severity is
  // 'warn' so the rule doesn't block work-in-progress; flip to 'error' once
  // the Wave 3 conversions land (audit doc's "Patch waves" section).
  //
  // Aliased to a custom rule id (rather than a second `no-restricted-syntax`
  // block) because ESLint flat config resolves rules per-name across the
  // WHOLE config array: a second config object setting `no-restricted-syntax`
  // for the same files completely REPLACES project/no-raw-nav-paths's entry
  // above (arrays don't merge, last writer wins) instead of layering on top
  // of it — verified via `eslint --print-config`, which showed the nav-path
  // selectors silently dropped before this alias was introduced.
  name: 'project/no-inline-table-config',
  plugins: {
    project: {
      rules: {
        'no-inline-table-config': builtinRules.get('no-restricted-syntax'),
      },
    },
  },
  rules: {
    'project/no-inline-table-config': [
      'warn',
      {
        selector: 'CallExpression[callee.name=/^(usePaginatedQuery|loadPaginatedQueryInput)$/] > ObjectExpression.arguments > Property[key.name=/^(paramPrefix|pageSize|pageSizeOptions|defaultSort|filters)$/]',
        message: 'Key-relevant table config must come from a shared PaginatedQueryConfig constant (query-toolkit.md#shared-table-config) — inline values silently break server-prefetch hydration cache-hits.',
      },
    ],
  },
})
