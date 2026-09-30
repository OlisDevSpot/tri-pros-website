import antfu from '@antfu/eslint-config'
import { builtinRules } from 'eslint/use-at-your-own-risk'

// Navigation-path prefix group — keep in sync with ROOTS.* path prefixes.
// Selectors are intentionally NARROW (navigation call sites only) to avoid
// false-positives on asset paths, sitemap config, pathname comparisons, etc.
const NAV_PATH_RE
  = '/^\\/(dashboard|portfolio|services|proposal-flow|funnels|intake|about|contact|blog|community|experience)(\\/|$)/'
const NAV_PATH_MSG
  = 'Build app paths with ROOTS.* (absolute via mainSiteUrl/publicUrl), not string literals. See docs/codebase-conventions/urls-and-origins.md'

// Packages no page render needs. A static value import puts their code in the
// server bundle of every route that imports the tRPC app router, and each cold
// start compiles all of it (twilio alone was 3.4 MB of /dashboard's 11 MB).
// Load them with `await import()` in the function that uses them —
// `no-restricted-imports` does not see `import()`, and type-only imports stay
// allowed. A later block that sets `lazy-only/imports` replaces these lists
// for the files it matches rather than adding to them (same flat-config rule
// as project/no-inline-table-config), which is why each override block below
// passes the full list minus its exception.
const LAZY_ONLY_MESSAGE
  = 'Load this with `await import()` where it is used: a static import compiles it on every cold start of every route that imports the tRPC app router. See src/shared/config/lazy-async.ts.'
const LAZY_ONLY_PACKAGES = [
  'twilio',
  'resend',
  '@react-email/components',
  'pdfmake',
  'pdf-lib',
  'ably',
  'ai',
  '@ai-sdk/openai',
  '@aws-sdk/client-s3',
  '@aws-sdk/s3-request-presigner',
  'sharp',
]
const TWILIO_REST_PATTERN = {
  group: ['twilio/lib/rest/**'],
  message: `${LAZY_ONLY_MESSAGE} Twilio's TwiML, JWT, webhook and RestException modules are fine to import directly.`,
  allowTypeImports: true,
}
const EMAIL_TEMPLATES_PATTERN = {
  group: ['@/shared/services/providers/resend/emails/*'],
  message: 'Email templates pull in react-email; only providers/resend/lib/render-emails.tsx imports them.',
  allowTypeImports: true,
}
const RENDER_EMAILS_PATTERN = {
  group: ['@/shared/services/providers/resend/lib/render-emails'],
  message: 'render-emails pulls in every react-email template: load it with `await import()`.',
  allowTypeImports: true,
}
function lazyOnlyImports({ except = [], patterns = [TWILIO_REST_PATTERN, EMAIL_TEMPLATES_PATTERN, RENDER_EMAILS_PATTERN] } = {}) {
  return ['error', {
    paths: LAZY_ONLY_PACKAGES
      .filter(name => !except.includes(name))
      .map(name => ({ name, message: LAZY_ONLY_MESSAGE, allowTypeImports: true })),
    patterns,
  }]
}
// Aliased under its own plugin namespace for the same reason as
// project/no-inline-table-config below: a second config object setting
// `no-restricted-imports` for the same files would replace this rule's entry
// rather than layer onto it.
const lazyOnlyPlugin = { rules: { imports: builtinRules.get('no-restricted-imports') } }

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
  // Seven pre-existing tables inlined paginated-table config as of the
  // 2026-07-26 prefetch-hydration-fault audit (guardrail 2). Severity was
  // 'warn' while the Wave 3 conversions landed; now 'error' — all seven
  // callers were extracted to shared configs (Task 8, audit doc's "Patch
  // waves" section) and the rule reports ZERO diagnostics.
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
      'error',
      {
        selector: 'CallExpression[callee.name=/^(usePaginatedQuery|loadPaginatedQueryInput)$/] > ObjectExpression.arguments > Property[key.name=/^(paramPrefix|pageSize|pageSizeOptions|defaultSort|filters)$/]',
        message: 'Key-relevant table config must come from a shared PaginatedQueryConfig constant (query-toolkit.md#shared-table-config) — inline values silently break server-prefetch hydration cache-hits.',
      },
    ],
  },
}).append({
  name: 'project/lazy-only-imports',
  files: ['src/**/*.ts', 'src/**/*.tsx'],
  plugins: { 'lazy-only': lazyOnlyPlugin },
  rules: {
    'lazy-only/imports': lazyOnlyImports(),
  },
}).append({
  // The templates themselves and render-emails (loaded with import() by
  // email.service.ts) are where the react-email code is meant to live.
  name: 'project/lazy-only-imports/email-templates',
  files: [
    'src/shared/services/providers/resend/emails/**',
    'src/shared/services/providers/resend/lib/render-emails.tsx',
  ],
  rules: {
    'lazy-only/imports': lazyOnlyImports({
      except: ['@react-email/components'],
      patterns: [TWILIO_REST_PATTERN, RENDER_EMAILS_PATTERN],
    }),
  },
}).append({
  // Ably's browser Realtime client, rendered by RealtimeProvider.
  name: 'project/lazy-only-imports/realtime-client',
  files: ['src/shared/services/providers/upstash/realtime-client.ts'],
  rules: {
    'lazy-only/imports': lazyOnlyImports({ except: ['ably'] }),
  },
})
