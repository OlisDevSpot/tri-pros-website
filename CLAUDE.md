# CLAUDE.md

Auto-loaded every session. Address book + commands. Rules live elsewhere — follow the pointers.

## Working principles (non-negotiable)

**Trust but verify — always check code before asserting documented behavior.** Docs (DOCS.md, ADRs, codebase-conventions, memory) describe rules as-of-when-written. Code is what runs. Before quoting a rule as fact in a recommendation or implementation, verify the code still matches.

**Ping on staleness.** If you notice a referenced file, function, slug, or business rule has diverged from its natural-language description anywhere (DOCS.md, memory, comments, ADR), STOP and tell the user immediately. Format: "⚠️ Stale ref — `<doc>:<line>` says `X`, but code at `<path>` does `Y`." Then propose a fix. Do not silently work around it; do not assume the doc is right. Business rules drift faster than anything else — favor the code, propose the doc update.

**Why this matters**: a stale rule that silently misleads future sessions costs hours of debugging. A 30-second ping saves them. This applies during normal feature work and especially during refactors that touch business logic.

## Commands

```bash
pnpm dev              # Start dev server
pnpm dev:mobile       # Dev + ngrok tunnel + QR (mobile testing)
pnpm tunnel           # ngrok tunnel only
pnpm lint             # ESLint
pnpm tsc              # Type-check (NEVER pnpm build unless explicitly asked)
pnpm db:push:dev      # Push schema to dev DB (NEVER pnpm db:push — that's prod)
pnpm db:reset / db:seed / db:snapshot
pnpm push:test --to <email> --title "..." [--body "..."] [--navigate /path]
pnpm dispatch help    # Parallel issue work
```

Package manager: **pnpm**. Path alias: `@/` → `src/`.

## Where to find things

**Engineering — how we write code**
- `docs/adr/` — architectural decisions ("why we chose X")
- `docs/how-to/` — step-by-step recipes (start with `add-an-entity.md` for the entity workflow)
- `docs/codebase-conventions/` — cross-cutting engineering rules (DAL signatures, schema, enums, tRPC, services, query toolkit, frontend stack, environment)

**Business rules — what the code means**
- `src/shared/entities/<entity>/DOCS.md` — per-entity invariants, derivations, gates (proposals/ is the canonical example)
- `src/features/<feature>/DOCS.md` — feature-level UX/flow rules
- `src/trpc/DOCS.md` — Entity Server System operational rules (server-side)
- `docs/domain/ubiquitous-language.md` — canonical business terms

**Sales / company**
- `docs/README.md` — master index
- `docs/sales/`, `docs/proposal/`, `docs/company/`, `docs/customer/`, `docs/programs/` — sales-side playbooks

**Active planning**
- `docs/plans/` — large unimplemented designs (meta-ads compound intelligence, notion-CRM migration)

**Operational know-how (personal session memory)**
- `memory/MEMORY.md` — auto-loaded index
- `memory/reference-dispatch-system.md` — `pnpm dispatch` full reference
- `memory/reference-github-workflow.md` — issues / PRs / project board details

**In-code references**: `// see ./DOCS.md#slug` (same dir) or `// see <path>/DOCS.md#slug` (cross-dir). Refs use slug anchors — they survive reordering.

## Mobile testing

`pnpm dev:mobile` runs dev + ngrok + QR. Static tunnel: `destined-emu-bold.ngrok-free.app`. Auth and OAuth work via `APP_HOSTS` in `src/shared/config/roots.ts` (single source of truth for valid hosts).

**One ngrok at a time** (free plan). **Webhooks** route to whichever worktree holds the tunnel — see `docs/codebase-conventions/environment.md` for details.

Per-worktree port via `.env.local` (gitignored): `PORT=3001`. `pnpm dev` and `pnpm tunnel` honor it.

DevTools mobile viewport: Chrome `Cmd-Shift-M` / Safari Develop → Responsive Design Mode. When ngrok isn't enough, use Vercel Preview Deploys (real HTTPS per PR).

## GitHub workflow

- **Board:** https://github.com/users/OlisDevSpot/projects/3 (single source of truth for status)
- **Issues:** https://github.com/OlisDevSpot/tri-pros-website/issues
- **Branch:** `{type}/{issue-number}-{slug}` — types: `feat | fix | refactor | chore | docs`
- **PR:** open with `Closes #N`, run `pnpm lint && pnpm tsc` first, use the template
- **Parallel issue work:** `pnpm dispatch help` (full reference: `memory/reference-dispatch-system.md`)
- **Full workflow reference** (labels, board IDs, automations): `memory/reference-github-workflow.md`

## Who we are

**Tri Pros Remodeling** — Southern California residential construction & remodeling. Small specialized team. Sales edge: human-psychology-driven approach to customer needs.

**Revenue model**: leads from telemarketing + social → in-home meeting → proposal → e-signature → project. Sales playbooks in `docs/sales/`; company overview in `docs/company/overview.md`.
