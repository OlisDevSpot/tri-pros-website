# Frontend Stack & Patterns

Tailwind v4, shadcn/ui (Radix), lucide-react, motion/react. Next.js 15 App Router. Two route groups: `(frontend)/(site)/` for marketing, `(frontend)/proposal-flow/` for the customer proposal flow, `(frontend)/dashboard/` for agent-facing surfaces. Component config at `components.json`.

## Rules

### use-client-pushed-to-leaves

`'use client'` lives as deep in the tree as possible — on the leaf components that need hooks or interactivity. Pages are server components. Views that fetch via tRPC are client components.

**Why**: server components keep the bundle smaller and let RSC stream. Lifting `'use client'` to a page boundary unnecessarily ships hooks to clients that don't need them.
**Reference impl**: any page in `src/app/(frontend)/`
**Enforced by**: convention

### views-own-data-fetching

Views (`ui/views/<x>-view.tsx`) own data fetching (`useQuery(trpc.x.y.queryOptions(...))`) and layout. Components (`ui/components/`) are props-driven and reusable — never call tRPC.

**Why**: components stay testable + reusable. Views are the integration point.
**Reference impl**: any `*-view.tsx` in `src/features/*/ui/views/`
**Enforced by**: convention

### error-and-loading-states

- **Full-page views** → `<ErrorState />` / `<LoadingState />` from `src/shared/components/states/`.
- **Inline grids/lists** → `animate-pulse` skeleton elements matching the final layout.

**Why**: uniform empty/error/loading affordances across the app.
**Reference impl**: `src/shared/components/states/`
**Enforced by**: convention

### one-react-component-per-file

Every `.tsx` file exports one React component. No "while I'm here, let me add a `StepHeader` to this view file." Extract to its own file in `components/` first.

**Why**: search, refactor, grep, IDE peek — every one of these breaks when files multi-export.
**Enforced by**: convention (lint rule is a candidate)

### named-exports-only

`export const X = ...` or `export function X() { ... }`. Never `export default`.

**Why**: explicit named imports survive refactors; default imports rename silently and obscure provenance.
**Enforced by**: convention

### no-component-file-constants-or-helpers

A component file does not have top-level `const X = [...]` or `function helper() { ... }` outside the component. Constants go to `constants/<scope>.ts`. Helpers go to `lib/<scope>.ts`.

**Why**: keeps each file single-responsibility. Constants and helpers are independently reusable + testable.
**Enforced by**: convention

### no-barrel-files-in-ui

`ui/components/`, `ui/views/`, `constants/`, `hooks/`, `lib/`, `dal/` do not have `index.ts` barrels. Always import the file directly.

**Why**: barrels create implicit re-exports + bundling-cycle risk. Direct paths are greppable + refactor-safe.
**Reference impl**: any of these directories — no `index.ts` present
**Enforced by**: convention

## Tailwind v4 / shadcn / motion

### shadcn-add-via-cli

Add new components via `pnpm dlx shadcn add <component>`. Don't hand-copy from the registry — the CLI manages versioning + dependencies.

### motion-not-framer

Animations use `motion/react`, never `framer-motion`. Keep subtle: `scale: 1.02`, `y: 20–30`. Hero animations on mount; everything else uses `useInView`. Stagger grid children with small delays.

**Reference impl**: any feature view with motion in `src/features/*/ui/`

### icons-lucide-only

Icons are `lucide-react`. Don't introduce a second icon library.

## Lint rules

Run `pnpm lint` before marking any task complete. The non-obvious rules:

- `perfectionist/sort-imports` — external before internal, alphabetical within groups
- `perfectionist/sort-named-imports` — named imports alphabetical
- `antfu/if-newline` — single-line `if` bodies not allowed; always braces + newline
- `import/no-duplicates` — no duplicate import sources

## TypeScript

- Explicit return types on all exported DAL functions and tRPC procedures
- No `any`
- `import type` for type-only imports
- Path alias: `@/` → `src/`

## Anti-patterns

- **`'use client'` at a page boundary that doesn't need it.** Push deeper.
- **A view component prop-drilling state into a deeply-nested presentational tree.** Pull into a context or restructure.
- **Component file with three exported sub-components.** Split.
- **`export default function Page() {}` with a re-named import.** Use named exports.
- **`framer-motion` import.** Use `motion/react`.

## See also

- `docs/codebase-conventions/query-toolkit.md` — paginated UI
- `docs/codebase-conventions/database-schema.md` — schema below
- `docs/ui-design-playbook.md` — visual design system + tokens
