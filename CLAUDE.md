# CLAUDE.md

Auto-loaded every session. Address book + commands. Keep it short.

## Working principles (non-negotiable)

**The code is the source of truth.** Read the implementation, not a description of it. Prose about how the code works drifts. Do not write new `DOCS.md` files or convention docs; encode rules in schemas, guards and helpers. A plan or spec is deleted once it ships (git history keeps it); the docs it alone depended on go with it. Executed plans were pruned 2026-09-23 after a per-file audit; what remains under `docs/` is live, pending, or still cited by pending work.

**Trust but verify.** Before quoting any rule from a doc, memory, or comment, check the code still matches. If it doesn't, STOP and tell the user: "⚠️ Stale ref — `<doc>:<line>` says `X`, but code at `<path>` does `Y`." Favor the code; propose the doc fix. Never silently work around drift.

**Comments say why, never what.** No file banners, no restating the adjacent code, no citations of plans, specs, tasks, or docs from code. A comment earns its place only for a non-obvious reason, an external constraint (API quirk, statute, browser bug), or a trap.

## Commands

```bash
pnpm dev              # Dev server behind a router: stops after DEV_IDLE_MIN idle (30), wakes on the next request, restarts above DEV_MEM_LIMIT_GB (6). Use the PORT URL; the :PORT+1000 line in Next output is internal.
pnpm dev:mobile       # Dev + ngrok tunnel + QR (mobile testing)
pnpm tunnel           # ngrok tunnel only
pnpm lint             # ESLint
pnpm tsc              # Type-check (NEVER pnpm build unless explicitly asked)
pnpm db:push:dev      # Push schema to dev DB (prod = explicit db:push:prod, only when asked)
pnpm db:reset:dev / db:seed:dev
pnpm db:refresh:dev [--dry-run]   # dev DB ← Neon reset from parent + scrub (no children allowed on the dev branch)
# Scripts target the prod DB ONLY via DRIZZLE_TARGET=prod — never NODE_ENV (see src/shared/config/server-env.ts).
pnpm push:test --to <email> --title "..." [--body "..."] [--navigate /path]
```

**Only Oliver starts a dev server.** No session or subagent runs `pnpm dev`, `pnpm dev:mobile` or `next dev`. If a task needs the server and the port does not answer (`ss -ltnp`), stop and ask Oliver to start it. `permissions.deny` in `~/.claude/settings.json` blocks the commands.

Package manager: **pnpm**. Path alias: `@/` → `src/`.

## Where to find things

**Engineering (kept only where code cannot carry it, or pending work still cites it)**
- `docs/adr/` — why: 0001 entity actions · 0002 entity server system · 0003 service/provider tiers · 0004 proposal/contract independence · 0005 JSONB vs column vs child table · 0006 dev on Turbopack, server SDKs unbundled, realtime only in the meeting flow
- `docs/codebase-conventions/` — cross-cutting rules that pending plans still cite. Verify each against the code before asserting it; delete a file when the plan that cites it ships.
- `src/**/DOCS.md` — business-rule notes that survive only where a pending spec or plan cites them (proposals core, meetings, customers, applications, projects, construction, media, notion, meta, trpc, proposal-flow, funnels, lead-sources, file-optimization, twilio). Same rule: verify against code, delete when the citing work ships, never add one.
- `CONTEXT.md` and `docs/ubiquitous-language.md` — domain terms (two glossaries today; merge pending)
- `DESIGN.md` (root: tokens, ladder, states) · `PRODUCT.md` (audiences) · `docs/design-system/` (app-wide constitution, anti-slop checklist, `theme-conventions.md`: which token to use, with examples and a self-check; read before any colour, surface, edge or state work)
- `docs/ui-design-playbook.md` + `docs/how-to/ui-exploration.md` — the UI process behind `/ui-exploration`

**Business content (not engineering)**
- `docs/README.md` — index of `docs/sales/`, `docs/proposal/`, `docs/company/`, `docs/customer/`, `docs/programs/`, `docs/marketing/` (`showcase-offer.md` is THE Showcase offer), `docs/seo/`

**Planning**
- `docs/plans/` — live epic trackers, standing contracts and ledgers, research that open work cites, and the VoIP epics. `docs/superpowers/specs|plans/` — pending, partial, or in-progress designs and plans only. Delete a plan when it ships.
- `/orient <path|words>` — verified orientation on a plan or epic tracker (tasks vs tree, plan vs git, requirements vs delta), a lean page, a decision sheet, and the structured status block written back; `session-capture` writes the same block at session end so `/orient <path>` is a fresh session's whole prompt.

**Session memory**
- `memory/MEMORY.md` — auto-loaded index; `reference-github-workflow.md` for ops details

## Mobile testing

`pnpm dev:mobile` runs dev + ngrok + QR. Static tunnel: `destined-emu-bold.ngrok-free.app`. Auth and OAuth work via `APP_HOSTS` in `src/shared/config/roots.ts` (single source of truth for valid hosts).

**One ngrok at a time** (free plan). **Webhooks** route to whichever worktree holds the tunnel.

Per-worktree port via `.env.local` (gitignored): `PORT=3001`. `pnpm dev` and `pnpm tunnel` honor it.

DevTools mobile viewport: Chrome `Cmd-Shift-M` / Safari Develop → Responsive Design Mode. When ngrok isn't enough, use Vercel Preview Deploys (real HTTPS per PR).

## GitHub workflow

One feature = one worktree branch = one session = one PR. `main` is prod.

- **Start:** a new worktree per feature, in Orca (`orca.yaml` installs deps and claims a free `PORT`) or `claude --worktree`. `.worktreeinclude` copies `.env`, `.env.local`, `.claude/settings.local.json`.
- **Base:** branch from `origin/main`. A branch off local main carries every unshipped commit on it and can't ship until they do.
- **Branch:** `{type}/{issue-number}-{slug}`, or `{type}/{slug}` with no issue. Types: `feat | fix | refactor | chore | docs`
- **PR:** `pnpm lint && pnpm tsc` first, use the template, `Closes #N` when there is an issue. The PR gets a Vercel preview; the owner checks it on the iPad and merges. Agents never merge or push to `main`.
- **Ship (owner-standardized 2026-11-01):** push the branch, open the PR, check the Vercel preview on the iPad. If `main` moved, merge `origin/main` **into the branch** (GitHub "Update branch" or `git merge origin/main`); never rebase, never force-push. Merge the PR with **Squash and merge** only; that is the one step that deploys prod. Then `git pull --ff-only origin main` on local main (a refusal means local main has commits of its own: stop and look, never let it merge). Delete the branch and worktree; a squashed branch is never reused.
- **End:** the session ends when its PR merges. New work starts a new session, not a compacted old one.
- **Transition:** until the local-main queue is drained by one last `/pre-ship`, local main is still the workbench (stage by explicit path, prod fixes only via `pnpm hotfix`; memory `feedback-work-on-main.md`). After the drain a hotfix is an ordinary PR.
- **Board / issues:** https://github.com/users/OlisDevSpot/projects/3 (status lives here) · https://github.com/OlisDevSpot/tri-pros-website/issues · labels, board IDs, automations: `memory/reference-github-workflow.md`

## Who we are

**Tri Pros Remodeling** — Southern California residential construction & remodeling. Small specialized team. Sales edge: human-psychology-driven approach to customer needs.

**Revenue model**: leads from telemarketing + social → in-home meeting → proposal → e-signature → project. Sales playbooks in `docs/sales/`; company overview in `docs/company/overview.md`.
