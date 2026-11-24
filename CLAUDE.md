# CLAUDE.md

Auto-loaded every session. Address book + commands. Keep it short.

## Working principles (non-negotiable)

**The code is the source of truth.** Read the implementation, not a description of it. Prose about how the code works drifts. Do not write new `DOCS.md` files or convention docs; encode rules in schemas, guards and helpers. A plan or spec is deleted once it ships (git history keeps it); the docs it alone depended on go with it. Executed plans were pruned 2026-09-23 after a per-file audit; what remains under `docs/` is live, pending, or still cited by pending work.

**Trust but verify.** Before quoting any rule from a doc, memory, or comment, check the code still matches. If it doesn't, STOP and tell the user: "⚠️ Stale ref — `<doc>:<line>` says `X`, but code at `<path>` does `Y`." Favor the code; propose the doc fix. Never silently work around drift.

**Comments say why, never what.** No file banners, no restating the adjacent code, no citations of plans, specs, tasks, or docs from code. A comment earns its place only for a non-obvious reason, an external constraint (API quirk, statute, browser bug), or a trap.

## Commands

```bash
pnpm dev              # Dev server behind a router: stops after DEV_IDLE_MIN idle (5), wakes on the next request, restarts above DEV_MEM_LIMIT_GB (6). Use the PORT URL; the :PORT+1000 line in Next output is internal.
pnpm review <branch|folder>   # Point the review slot (.worktrees/review, :3001) at a lane's latest commit; Oliver's dev server there shows it. Run it from the main checkout
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
- `GLOSSARY.md` and `docs/ubiquitous-language.md` — domain terms (two glossaries today; merge pending)
- `DESIGN.md` (root: tokens, ladder, states) · `PRODUCT.md` (audiences) · `docs/design-system/` (app-wide constitution, anti-slop checklist, `theme-conventions.md`: which token to use, with examples and a self-check; read before any colour, surface, edge or state work)
- `docs/ui-design-playbook.md` + `docs/how-to/ui-exploration.md` — the UI process behind `/ui-exploration`

**Business content (not engineering)**
- `docs/README.md` — index of `docs/sales/`, `docs/proposal/`, `docs/company/`, `docs/customer/`, `docs/programs/`, `docs/marketing/` (`showcase-offer.md` is THE Showcase offer), `docs/seo/`

**Planning**
- `docs/plans/` — live epic trackers, standing contracts and ledgers, research that open work cites, and the VoIP epics. `docs/superpowers/specs|plans/` — pending, partial, or in-progress designs and plans only. Delete a plan when it ships.
- `/orient <path|words>` — verified orientation on a plan or epic tracker (tasks vs tree, plan vs git, requirements vs delta), a briefing on the lane's board page, and the structured status block written back; `session-capture` writes the same block at session end so `/orient <path>` is a fresh session's whole prompt.

**Session memory**
- `memory/MEMORY.md` — auto-loaded index; `reference-github-workflow.md` for ops details

## Mobile testing

`pnpm dev:mobile` runs dev + ngrok + QR. Static tunnel: `destined-emu-bold.ngrok-free.app`. Auth and OAuth work via `APP_HOSTS` in `src/shared/config/roots.ts` (single source of truth for valid hosts).

**One ngrok at a time** (free plan). **Webhooks** route to whichever worktree holds the tunnel.

Per-worktree port via `.env.local` (gitignored): `PORT=3001`. `pnpm dev` and `pnpm tunnel` honor it.

DevTools mobile viewport: Chrome `Cmd-Shift-M` / Safari Develop → Responsive Design Mode. When ngrok isn't enough, use Vercel Preview Deploys (real HTTPS per PR).

## GitHub workflow

One issue = one lane = one worktree branch = one PR. `main` is prod. GitHub issues are the record of all work; what each stage writes to them is in `docs/agents/issue-tracker.md`. The 12 stages below are the lifecycle of every issue, in an epic or on its own; the board's Flow tab draws them and its Skills tab lists the skills in the same order. "(you)" = Oliver types the command.

1. **Capture and triage:** an issue form (Bug, Feature, Epic) or `gh issue create`, then `/triage` (you) sets readiness. A small, clear issue skips to 4.
2. **Shape:** `/grill-with-docs` then `/to-spec` (you): the spec is a file under `docs/superpowers/specs/` and the issue body links to it (ADR-0007). An epic is shaped once as a whole; its tracker holds the requirements and rulings every plan serves. Foggy epic: `/wayfinder` (you) first. Screen changes: `/ui-warmup`, `/ui-exploration`. Glossary and ADR edits go straight to `main` the same sitting (Docs, below).
3. **Slice:** `/to-tickets` (you). On an epic: its plans as sub-issues with blocking links, each rated on whether a fresh session can build it from what it has: 8/10 or higher is `ready-for-agent`; below is `needs-info` and goes back through stage 2, against the epic, before its lane opens. On a plan: its tasks go in its tracker file, never sub-issues. `/stress-test-plan` checks them.
4. **Open the lane:** one `ready-for-agent` issue: assign it, Project 3 Status `In Progress`, then Start / Base / Branch below and a board row keyed by the issue number.
5. **Build:** `/implement #N` (you): `tdd` test-first, Matt's `code-review` at the end. Bugs: `diagnosing-bugs`. Draft PR early (below).
6. **Verify** and 7. **PR:** below. Status moves to `In Review` only when the PR is ready for Oliver.
8. **Review** and 9. **Merge:** Oliver, on the iPad preview; Squash and merge.
10. **Release** and 11. **Catch up:** Ship and "Shipping doesn't end the lane" below.
12. **Learn:** `/retro` (you); each finding becomes a guard or a `chore` issue. `session-capture` at session end; `/handoff` (you) at any stage.

**One skill per job.** Shaping = `/grill-with-docs`; plan = its tracker file (an epic's plans are its sub-issues); build = `/implement` with `mattpocock-skills:tdd`; debugging = `mattpocock-skills:diagnosing-bugs`; review = `mattpocock-skills:code-review`. In this flow they take the place of superpowers brainstorming, writing-plans, subagent-driven-development, executing-plans, test-driven-development and systematic-debugging, of `/grill-me`, `/ponytail-review`, the convention-auditor and the built-in `/code-review`. `/implement-spec` is unused: epics ship in slices.

- **Start:** a new worktree per lane, in Orca (`orca.yaml` installs deps and claims a free `PORT`) or `claude --worktree`. `.worktreeinclude` copies `.env`, `.env.local`, `.claude/settings.local.json`.
- **Base:** branch from `origin/main`. A branch off local main carries every unshipped commit on it and can't ship until they do.
- **Branch:** `{type}/{issue-number}-{slug}`; the number is how a session finds its issue and board row. Types: `feat | fix | refactor | chore` (docs skip the branch, below)
- **Draft PR early:** open a draft PR at the first working screen; every push rebuilds its Vercel preview. Oliver's notes arrive as preview comments.
- **Verify on the preview:** `pnpm lint && pnpm tsc`, the lane's tests, then Playwright against the lane's preview: first navigation to `/api/dev/playwright-session?secret=<DEV_LOGIN_SECRET>&x-vercel-protection-bypass=<VERCEL_AUTOMATION_BYPASS_SECRET>&x-vercel-set-bypass-cookie=true` (both secrets in `.env.local`). A lane reaches Oliver only after this passes; no dev server needed.
- **PR:** `pnpm lint && pnpm tsc` first, use the template. `Closes #N` on the PR that finishes the issue; `Refs #N` on a PR that ships part of a lane that keeps going. The PR gets a Vercel preview; the owner checks it on the iPad and merges. Agents never merge a PR or push code to `main`; docs are the one direct push (Docs, below).
- **Ship (owner-standardized 2026-11-01):** push the branch, open the PR, check the Vercel preview on the iPad. If `main` moved, merge `origin/main` **into the branch** (GitHub "Update branch" or `git merge origin/main`); never rebase, never force-push. Merge the PR with **Squash and merge** only; that is the one step that deploys prod. Then `git pull --ff-only origin main` on local main (a refusal means local main has commits of its own: stop and look, never let it merge).
- **Shipping doesn't end the lane:** a worktree may ship when it is good enough and keep going (bug hunting, the next part); its branch and worktree stay. Right after its PR squash-merges, `git merge origin/main` into the branch before the next commit, so the next PR shows only new work, then open a new PR. Delete the branch and worktree only when the lane is finished.
- **Epic worktrees ship in slices:** the epic worktree is the workbench; it ships through slices, or itself when it is good enough (as above). Each slice (a sub-issue of the epic) gets a new worktree and branch from `origin/main` (or the previous slice's branch when stacked), takes its files with `git checkout <epic-branch> -- <paths>`, opens a draft PR targeting its parent, and slices merge in order. After a slice squash-merges, `git merge origin/main` into the epic branch.
- **End:** the session ends when its PR merges. New work, including more work in the same worktree, starts a new session, not a compacted old one.
- **Hotfix:** a small lane. Open its issue, then start it like any lane (Orca or `claude --worktree`) on `fix/<N>-<slug>` from `origin/main`, change only the fix, `pnpm lint && pnpm tsc`, PR, preview, Squash and merge. UI, copy or style: that is all. Business or server logic: also the lane's tests and the preview Playwright check. A schema change is never a hotfix: it is a lane with its own Neon copy.
- **Docs (WF16, owner 2026-11-24):** docs-only changes (anything under `docs/`, `CLAUDE.md`, `GLOSSARY.md`, skill prose) get no branch, worktree or PR. Commit on `main` by explicit path, `git push origin main`, then `git merge origin/main` into every branch checked out under `.worktrees/` (skip one mid-merge or mid-rebase; on a conflict `git merge --abort` and tell Oliver). When the main checkout is on another branch or holds someone's edits, build the commit from `origin/main` with a temporary index and `git commit-tree`, push it to `main`, then `git fetch origin main:main`. Code, config, CI or `package.json` is not docs: that is a lane.
- **Local main:** mirrors prod and only moves by `git pull --ff-only origin main` or a docs push. Editing there is an allowed escape hatch, but commit on a branch: open the issue, then `git switch -c fix/<N>-<slug>` carries the edits over, so main never holds a code commit.
- **Older docs:** a plan, spec or memory that says "work on main", "the workbench", "stage on local main", `/pre-ship` or `pnpm hotfix` predates lanes; this section wins.
- **Board / issues:** lane status lives on the lane board https://claude.ai/artifact/7D8kgccA7iy6f8ATWzLdqS (each session keeps its row current; the SessionStart hook says how) · issues: https://github.com/OlisDevSpot/tri-pros-website/issues, the record of all work (see Agent skills below) · in flight: https://github.com/users/OlisDevSpot/projects/3 · board IDs, automations: `memory/reference-github-workflow.md`

## Agent skills

### Issue tracker

GitHub issues are the record of all work; specs and trackers are committed files the issue body links to (ADR-0007), readiness in labels, flight in Project 3 Status. See `docs/agents/issue-tracker.md`.

### Triage labels

Matt Pocock's five state labels plus `bug` / `enhancement` / `refactor` / `chore`; `area:*` and `P0`–`P3` kept. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` + `docs/adr/`. See `docs/agents/domain.md`.

## Who we are

**Tri Pros Remodeling** — Southern California residential construction & remodeling. Small specialized team. Sales edge: human-psychology-driven approach to customer needs.

**Revenue model**: leads from telemarketing + social → in-home meeting → proposal → e-signature → project. Sales playbooks in `docs/sales/`; company overview in `docs/company/overview.md`.
