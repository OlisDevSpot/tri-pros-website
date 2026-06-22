import antfu from '@antfu/eslint-config'

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
})
