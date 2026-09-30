import antfu from '@antfu/eslint-config'
import { builtinRules } from 'eslint/use-at-your-own-risk'

// Navigation-path prefix group — keep in sync with ROOTS.* path prefixes.
// Selectors are intentionally NARROW (navigation call sites only) to avoid
// false-positives on asset paths, sitemap config, pathname comparisons, etc.
const NAV_PATH_RE
  = '/^\\/(dashboard|portfolio|services|proposal-flow|funnels|intake|about|contact|blog|community|experience)(\\/|$)/'
const NAV_PATH_MSG
  = 'Build app paths with ROOTS.* (absolute via mainSiteUrl/publicUrl), not string literals. See docs/codebase-conventions/urls-and-origins.md'

// Status, identity and chart colors are theme tokens; a raw palette class is light-only or needs a
// `dark:` patch, which is how 88 files drifted off-theme before.
const PALETTE_RE
  = '/\\b(bg|text|border(-[xytrblse])?|ring(-offset)?|fill|stroke|outline|divide|from|to|via|shadow|decoration|placeholder|accent|caret)-(slate|gray|zinc|neutral|stone|blue|sky|indigo|cyan|teal|red|rose|pink|green|emerald|lime|amber|yellow|orange|purple|violet|fuchsia)-\\d{2,3}\\b/'
const PALETTE_MSG = 'Use a theme token (status-*, chart-*, identity-*, destructive, success, warning) chosen by meaning.'
// The 2px rule: every font size is an even number of pixels, and Tailwind's steps are the ramp.
const TYPE_RAMP_RE = '/\\btext-\\[\\d+(\\.\\d+)?(px|rem)\\]/'
const TYPE_RAMP_MSG = 'Use the type ramp (2px rule: Tailwind steps only, text-xs 12px is the floor).'
// Surfaces are solid steps of one ramp (globals.css). A see-through surface class takes its colour from
// whatever happens to be beneath it, which is how tables came to blend into the page.
// esquery regexes cannot contain "/", hence \x2F.
const SURFACE_ALPHA_RE
  = '/(^|[\\s:!])(bg|border(-[xytrblse])?|divide|ring|outline|from|via|to|fill|stroke)-(background|card|muted|secondary|accent|popover|border|foreground|input|sidebar(-[a-z]+)?)\\x2F(\\d+|\\[[\\d.]+\\])/'
const SURFACE_ALPHA_MSG = 'Use a solid surface step (background, muted, band, card, surface-raised, border, border-strong, row-hover, row-selected); glass is --popover-glass.'
// Translucent by design: scrims and gradients over photos, lightbox and modal chrome, and the two follow-ups
// the spec defers (public-site `secondary` used as an accent; the proposal-flow navbar).
const SURFACE_ALPHA_IGNORES = [
  // Scrims, gradients and chrome over photos.
  'src/features/landing/ui/components/about/about-hero.tsx',
  'src/features/landing/ui/components/about/credentials.tsx',
  'src/features/landing/ui/components/about/partner-story.tsx',
  'src/features/landing/ui/components/about/team.tsx',
  'src/features/landing/ui/components/blog/blog-hero.tsx',
  'src/features/landing/ui/components/blog/blogpost-card-small.tsx',
  'src/features/landing/ui/components/blog/blogpost-card.tsx',
  'src/features/landing/ui/components/contact/contact-info.tsx',
  'src/features/landing/ui/components/experience/hero.tsx',
  'src/features/landing/ui/components/experience/project-story-card.tsx',
  'src/features/landing/ui/components/home/home-hero.tsx',
  'src/features/landing/ui/components/home/photo-card.tsx',
  'src/features/landing/ui/components/home/services-preview.tsx',
  'src/features/landing/ui/components/portfolio/portfolio-hero.tsx',
  'src/features/landing/ui/components/portfolio/project-card.tsx',
  'src/features/landing/ui/components/portfolio/project/progress-gallery.tsx',
  'src/features/landing/ui/components/portfolio/project/project-hero.tsx',
  'src/features/landing/ui/components/services/services-hero.tsx',
  'src/features/landing/ui/components/services/trade-hero.tsx',
  'src/features/landing/ui/views/pillar-view.tsx',
  'src/features/project-management/ui/components/form/import-from-proposal-dialog.tsx',
  'src/features/project-management/ui/components/phase-carousel.tsx',
  'src/features/project-management/ui/components/photo-lightbox.tsx',
  'src/features/project-management/ui/components/portfolio-hero.tsx',
  'src/features/project-management/ui/components/portfolio-project-card.tsx',
  'src/features/project-management/ui/components/story-before-after.tsx',
  'src/features/project-management/ui/components/story-gallery.tsx',
  'src/features/project-management/ui/components/story-hero.tsx',
  'src/features/proposal-flow/ui/components/form/proposal-media-manager.tsx',
  'src/features/proposal-flow/ui/components/proposal/trusted-contractor.tsx',
  'src/shared/components/buttons/inline-edit-button.tsx',
  'src/shared/components/image-slider.tsx',
  'src/shared/components/media/media-card.tsx',
  'src/shared/components/navigation/popover-nav.tsx',
  'src/shared/components/navigation/site-navbar.tsx',
  'src/shared/components/tiptap/tiptap.tsx',
  'src/shared/domains/funnels/ui/blocks/before-after-showcase.tsx',
  'src/shared/domains/funnels/ui/blocks/funnel-project-carousel.tsx',
  'src/shared/entities/customers/components/profile/customer-hero-header.tsx',
  'src/shared/modules/proposals/core/components/overview-card.tsx',
  // Modal scrims.
  'src/shared/components/ui/alert-dialog.tsx',
  'src/shared/components/ui/dialog.tsx',
  'src/shared/components/ui/drawer.tsx',
  'src/shared/components/ui/sheet.tsx',
  'src/shared/components/ui/sidebar-mobile-sheet.tsx',
  // A data mark (bar fill), not a surface.
  'src/features/lead-sources-admin/ui/components/lead-source-funnel.tsx',
  // Follow-up: public-site `secondary` is used as a brand accent and renders grey today.
  'src/features/landing/ui/components/about/company-story.tsx',
  'src/features/landing/ui/components/about/process-overview.tsx',
  'src/shared/components/decorative-line.tsx',
  // Follow-up: the proposal-flow navbar needs a visual check before its grey band moves.
  'src/features/proposal-flow/ui/components/navbar/navbar-frame.tsx',
  'src/features/proposal-flow/ui/components/navbar/navbar-menu.tsx',
  'src/features/proposal-flow/ui/components/navbar/navbar.tsx',
]
// The marketing world keeps its own palette, third-party brand marks keep theirs, and the meeting-flow
// program/benefit accents wait on a presentation decision before they move onto tokens.
const THEME_TOKEN_IGNORES = [
  'src/features/landing/**',
  'src/shared/domains/funnels/**',
  'src/shared/components/navigation/site-navbar.tsx',
  'src/shared/components/reviews/**',
  'src/shared/constants/company/socials.ts',
  'src/features/meeting-flow/constants/benefit-categories.ts',
  'src/features/meeting-flow/ui/components/steps/program-card.tsx',
  'src/features/meeting-flow/ui/components/steps/closing-step.tsx',
  'src/features/meeting-flow/ui/components/steps/who-we-are/reputation-mark.tsx',
]
// A flat config can declare one plugin name in two blocks only if both use the same object, so
// project/theme-tokens and project/surface-alpha (different ignore lists) share this constant.
const themeTokensPlugin = { rules: {
  'palette': builtinRules.get('no-restricted-syntax'),
  'type-ramp': builtinRules.get('no-restricted-syntax'),
  'surface-alpha': builtinRules.get('no-restricted-syntax'),
} }

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
}).append({
  // Aliased under its own plugin namespace for the same reason as project/no-inline-table-config:
  // a second `no-restricted-syntax` entry for these files would replace the nav-path one.
  name: 'project/theme-tokens',
  files: ['src/features/**/*.{ts,tsx}', 'src/shared/**/*.{ts,tsx}'],
  ignores: THEME_TOKEN_IGNORES,
  plugins: { 'theme-tokens': themeTokensPlugin },
  rules: {
    'theme-tokens/palette': ['error',
      { selector: `Literal[value=${PALETTE_RE}]`, message: PALETTE_MSG },
      { selector: `TemplateElement[value.raw=${PALETTE_RE}]`, message: PALETTE_MSG },
    ],
    'theme-tokens/type-ramp': ['error',
      { selector: `Literal[value=${TYPE_RAMP_RE}]`, message: TYPE_RAMP_MSG },
      { selector: `TemplateElement[value.raw=${TYPE_RAMP_RE}]`, message: TYPE_RAMP_MSG },
    ],
  },
}).append({
  // Its own block because its ignores differ: the landing pages and funnels are swept, not exempt.
  name: 'project/surface-alpha',
  files: ['src/**/*.{ts,tsx}'],
  ignores: SURFACE_ALPHA_IGNORES,
  plugins: { 'theme-tokens': themeTokensPlugin },
  rules: {
    'theme-tokens/surface-alpha': ['warn',
      { selector: `Literal[value=${SURFACE_ALPHA_RE}]`, message: SURFACE_ALPHA_MSG },
      { selector: `TemplateElement[value.raw=${SURFACE_ALPHA_RE}]`, message: SURFACE_ALPHA_MSG },
    ],
  },
}).append({
  // Syne tops out at 800 and turns wide and heavy there; Nunito past 700 reads as a different face beside the rest of the app.
  // Aliased under its own plugin namespace (not `project`, which project/no-inline-table-config already
  // owns): two config entries can't redefine the same plugin key with different rule objects — ESLint
  // throws "Cannot redefine plugin" at load time, it doesn't silently merge them.
  name: 'project/no-heavy-font-weight',
  plugins: {
    'heavy-font-weight': {
      rules: {
        'no-heavy-font-weight': builtinRules.get('no-restricted-syntax'),
      },
    },
  },
  rules: {
    'heavy-font-weight/no-heavy-font-weight': [
      'error',
      { selector: 'Literal[value=/\\bfont-(extrabold|black)\\b/]', message: 'Weights stop at font-bold (700); Syne stops at font-semibold (600).' },
      { selector: 'TemplateElement[value.raw=/\\bfont-(extrabold|black)\\b/]', message: 'Weights stop at font-bold (700); Syne stops at font-semibold (600).' },
    ],
  },
})
