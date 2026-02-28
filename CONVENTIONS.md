# Project Conventions

Reference document for Claude sessions and contributors.

---

## Database Schema

### pgEnum placement
- **`pgEnum` declarations** always go in `src/shared/db/schema/meta.ts`
- **Const arrays** (`as const`) go in `src/shared/constants/enums.ts`
- **TypeScript types** derived from those arrays go in `src/shared/types/enums.ts`

```ts
// src/shared/constants/enums.ts
export const myValues = ['a', 'b', 'c'] as const

// src/shared/types/enums.ts
export type MyValue = (typeof myValues)[number]

// src/shared/db/schema/meta.ts
import { myValues } from '@/shared/constants/enums'
export const myValueEnum = pgEnum('my_value', myValues)
```

### Schema file conventions
- One table per file, named after the table (e.g. `media-files.ts`)
- Always export `selectSchema`, `insertSchema`, and their inferred types
- UUID primary keys: `uuid().primaryKey().defaultRandom()`
- Timestamps: `timestamp({ mode: 'string', withTimezone: true }).defaultNow()`
- All schemas export from `src/shared/db/schema/index.ts`

---

## tRPC Routers

### Sub-directory rule
Create a sub-directory (matching `notion.router/` pattern) when a router has **2+ sub-routers**.

```
src/trpc/routers/
  notion.router/          ← directory (3 sub-routers)
    index.ts
    trades.router.ts
    contacts.router.ts
    scopes.router.ts
  construction.router/    ← directory (2 sub-routers)
    index.ts
    projects.router.ts
  landing.router.ts       ← flat file (single router)
```

### Procedure types
- `baseProcedure` — public, no auth
- `agentProcedure` — requires session (throws UNAUTHORIZED otherwise)
- `payloadProcedure` — injects Payload CMS into context

---

## Data Access Layer (DAL)

### File naming
- `src/shared/dal/server/<domain>/<descriptive-name>.ts`
- Descriptive filenames, not generic (e.g. `proposal-views.ts` not `api.ts`)
- No index barrel files inside DAL domain folders

### Return types
All exported DAL functions **must** have explicit return type annotations. No `any`.

Define named types *before* the function if the function's return type references them:

```ts
export type PublicProject = { project: Project; heroImage: SelectMediaFilesSchema | null }

export async function getPublicProjects(): Promise<PublicProject[]> { ... }
```

### Client-side DAL hooks
Only create a custom hook wrapper if the query is reused in **2+ places**. For one-off queries, use `useTRPC()` + `useQuery(trpc.router.proc.queryOptions())` directly in the component.

---

## TypeScript

- Explicit return types on all exported DAL functions and tRPC procedures
- No `any`
- `import type` for type-only imports
- Path alias: `@/` → `src/`

---

## React / Next.js

### `'use client'` boundary
Push as deep as possible — into leaf components. Pages are server components. Views that need hooks are client components.

### Error / loading states
- Full-page views → `ErrorState` / `LoadingState` from `src/shared/components/states/`
- Inline grids or lists → `animate-pulse` skeleton elements

---

## UI & Styling

- Tailwind v4 + shadcn/ui (Radix primitives). Add new components with `pnpm dlx shadcn add <component>`
- Animations: `motion/react` (not `framer-motion`). Keep subtle — scale 1.02, y: 20–30. Stagger grid children with small delays. Heroes animate on mount; everything else uses `useInView`
- Icons: `lucide-react`

---

## Lint Rules (ESLint)

- `perfectionist/sort-imports` — imports sorted; external before internal, alphabetical within groups
- `perfectionist/sort-named-imports` — named imports alphabetical
- `antfu/if-newline` — single-line `if` bodies not allowed; always use braces + newline
- `import/no-duplicates` — no duplicate import sources

Run `pnpm lint` before marking any task complete.

---

## General Discipline

- Only implement what was asked. Do not refactor adjacent code or add unsolicited improvements.
- Flag heavy new dependencies before adding them — prefer the existing stack.
- Run `pnpm build` to verify after schema or router changes.
- Never auto-commit. Always ask first.
