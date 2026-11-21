# Pre-ship reference

## Reviewer prompt (one per area)

Fill the brackets. Areas that worked well: data views / tables / prefetch + hydration; dashboard shell, session and permissions; theme and tokens (public-site impact); backend perf, provider SDKs, webhooks and ops scripts; charts and calculators (sales-facing math); plus one for commits that landed after the last review.

> You are a skeptical pre-production reviewer for a Next.js 15 / React 19 / tRPC / TanStack Query / Drizzle (Neon) / better-auth / Tailwind v4 app at `<repo>`. Local `main` has commits not on `origin/main` (prod). Find real defects that would hurt prod in YOUR AREA ONLY.
> READ-ONLY: never edit files, never run state-changing git commands (checkout/stash/reset/add/commit), no DB writes, no `pnpm build`, never run scripts that touch a DB or external service. Other sessions edit the working tree — review COMMITTED code via `git log origin/main..main`, `git diff origin/main..main -- <paths>`, `git show <sha>`.
> AREA: [paths + the commit subjects/shas that belong to it].
> Hunt for: [area-specific list] plus the prod-only traps below.
> Output: ranked findings — BLOCKER / HIGH / MEDIUM / LOW, file:line, one-sentence defect, concrete failure scenario, suggested fix. Only verified things; mark speculation UNVERIFIED. Briefly list what looked solid. Under ~800 words.

## Architecture prompt (the `convention-auditor`, one for the whole range)

> Score the architecture of each feature below, out of 10, against this repo's conventions as the code holds them today: `CLAUDE.md` working principles, `docs/adr/`, `docs/codebase-conventions/`, the coding rules in memory (`coding-conventions.md` and the typing/backend reflexes indexed in `MEMORY.md`), and your ledger. Review COMMITTED code only (`git diff origin/main..main -- <paths>`, `git show <sha>`); READ-ONLY apart from your ledger.
> FEATURES: [name → shas → paths, from the range map].
> Deduct for: a thin wrapper or new API where an existing primitive covers it (`createCrudDal` slots, business DAL/service methods, entity action configs, compound entity components, shared helpers; name the primitive and its file:line); the wrong owner or layer (a router writing another entity's rows, a service running raw `db.*`, code outside the module it belongs in); bespoke UI where an entity component exists; hardcoded company data or colours instead of `src/shared/constants/company/` and tokens; comments that say what instead of why, or cite plans; new vocabulary missing from `CONTEXT.md`.
> Output per feature: `N/10` in whole points, then each deduction as `−1 · rule (source file:line) · offending file:line`. Design problems that match no rule above are listed without a deduction. A rule you could not confirm in code is `⚠️ Stale ref`, never a deduction. Under ~600 words.

## Prod-only traps (put in every reviewer prompt that fits)

- **Timezone**: Vercel runs in UTC; reps' browsers in America/Los_Angeles; local dev in PT hides it. Any server-rendered `Intl.DateTimeFormat`/`toLocale*String` without `timeZone`, or date-fns `isToday/isSameDay/getHours` on server-rendered rows → hydration error + wrong day for evening events. Use `src/shared/lib/business-time.ts`.
- **Hydration**: server vs client renders that differ (cookies, `Date.now()`, `window`, random), `useSuspenseQuery` without a boundary, prefetch key ≠ client key.
- **Auth**: data rendered before the session gate; request-memoized session shared across requests (must be React `cache()`); client ability trusted for anything but UI.
- **Serverless**: a send/publish no longer awaited (dropped when the function returns); lazy `import()` default/named mix-ups; cached rejected promises.
- **Deploy order**: schema change ⇒ `pnpm db:push:prod` BEFORE the push (lead intake reads every column).
- **Shared tokens**: `:root` token changes reach the public site, funnels, proposal pages; emails cannot use CSS vars; Tailwind v4 drops classes whose token is undefined silently.
- **User-controlled input**: cookies and query params parsed without try/catch or size limits.

## Fix prompt

> Fix these confirmed defects in `<repo>` on `main`. ANOTHER SESSION COMMITS TO THIS TREE: never stash/checkout/reset/rebase/`add -A`/`commit -a`; stage and commit ONLY the exact paths you edited, one commit per defect, conventional style, ending with the session's Co-Authored-By line. Do not touch [files under active edit]. No DB writes, no `pnpm build`; verify with `pnpm tsc` + `pnpm lint` + [the repro, e.g. a tsx script under `TZ=UTC` vs `TZ=America/Los_Angeles` kept in the scratchpad]. Reuse existing helpers (grep first); match surrounding style; comments say why. Defects: [numbered, each with file:line, scenario, intended fix]. Report: sha + message per commit, how verified, what you found but did not fix. Under 400 words.

## Ship card (one per feature)

Categories adapted from warpdotdev/common-skills `merge-risk` (MIT), re-cut for a workbench that ships without PRs. Fill every line; a line with no evidence is ⚠️, never skipped.

```
### <feature> — <ship | ship after owner check | hold>
Risk: <low | medium | high> · Architecture: <N>/10 · Commits: <shas or sha..sha ranges, count; name interleaved commits that belong elsewhere>
- Intent (poor ⚠️ / decent 👀 / good ✅): <matches its spec, plan and owner rulings? undocumented drive-bys inside its commits?>
- Impact (large ⚠️ / medium 👀 / small ✅): <blast radius; every sensitive area touched, by name>
- Verification (poor ⚠️ / decent 👀 / good ✅): <the evidence, as paths>
- Rollback (high ⚠️ / medium 👀 / low ✅): <two-way or one-way door, and what makes it one>
- Error detection (poor ⚠️ / decent 👀 / good ✅ / N/A ✅): <how a failure in prod gets noticed>
- Workbench sync (high ⚠️ / medium 👀 / low ✅): <depends on held work? reverted in the candidate? overlaps prod-only commits?>
Owner check: <exactly what the owner must look at, or "none">
```

**Intent** is judged against the memory file, tracker, spec/plan and owner rulings, never a GitHub issue (issues here are often overtaken by rulings made in a session). Docs and skill commits in their own commits are not drive-bys.

**Impact: sensitive areas** (any one makes Impact at least 👀, two or more ⚠️): auth and session; CASL permissions (`src/shared/domains/permissions/`, `src/shared/dal/server/lib/permissions/`); any procedure without a session (`baseProcedure`, `*PublicProcedure`, anything built on `shareableMiddleware`) — check server-side guards and rate limits, never the UI's; proposal pricing and calculators; e-signature and Zoho (`contracts.service.ts`, `zoho-sync.service.ts`); anything that messages a customer or staff (Twilio/VoIP, `email.service.ts`, `notification.service.ts`); QStash jobs, crons and `src/app/api/webhooks/`; schema under `src/shared/db/`; `src/middleware.ts`, `src/shared/config/roots.ts`, `next.config.*`; `:root` tokens in `globals.css` (reach the public site, funnels and proposal pages); root metadata, `src/app/sitemap.ts`, `src/app/robots.ts`, redirects; `public/sw.js` and `src/app/manifest.ts`; dependencies; shared factories (`create-crud-dal.ts`, `src/trpc/init.ts`); a new gate or state rule that existing prod rows fall under the moment it deploys — name the rows, and put a read-only prod count and the owner's call on what to do with them in the Owner check.

**Verification** counts local evidence; nothing has to sit on a PR. Evidence: the clean-checkout tsc/lint/`theme:check` (never enough alone for UI or math); a `scripts/verify-*.ts` or test that exercises the changed logic and can fail; screenshots from this run's visual step or a build ledger under `.superpowers/sdd/<feature>/` or `.worktrees/*/.superpowers/sdd/`; an owner sign-off recorded in memory or a tracker. A UI change needs phone and desktop, light and dark, before and after; without them it is ⚠️. If the diff changes only text strings (no className, layout or component change), one screenshot per changed surface is enough. Pricing, money, dates or permissions without an executable check are ⚠️.

**Rollback: one-way doors** (any one makes Rollback at least 👀): `db:push:prod` that drops, renames or narrows a column; a backfill or data migration; messages already sent to customers; records created in Zoho, Google Calendar, Meta or QuickBooks; `sw.js`/manifest changes (installed PWAs cache them); public URLs removed from the sitemap; a new env var prod must have.

**Error detection** asks whether someone hears about it before a customer reports it: failed mutations show a toast, DAL errors are returned and not swallowed, jobs and webhooks log and retry, and a revenue signal (a homeowner reply, a request to move forward, a lead) never degrades to `console.warn` alone. Judge each audience the flow reaches (homeowner, agent, staff) and take the worst: a flow with agent toasts and a silent homeowner side is ⚠️.

**Workbench sync** for a workbench feature: ⚠️ if the feature needs a commit that is held back, or must be reverted inside a candidate that also ships later work it is entangled with; 👀 if any of its files changed on prod since main forked (`git diff --name-only main...origin/main`) or the candidate reverts anything; ✅ if it ships by prefix with nothing reverted.

**Workbench sync** for a prod fix built in `.worktrees/prod` (`pnpm hotfix`): run `git merge-tree main <fix sha>`. 👀 for any conflict, ✅ if it merges clean; the fix still ships either way. For each conflict where taking main's side would drop the fix silently (the next workbench push would undo it on prod), the Owner check names the line that must survive `pnpm hotfix sync` and the grep that proves it afterwards.

**Risk score** (keep the numbers out of the report): ⚠️ = 3, 👀 = 2, ✅ = 1; weights Impact 2, Verification 2, Rollback 1.5, Intent 1, Error detection 1, Workbench sync 1; score = Σ(score × weight) / 8.5. Low < 1.5, medium 1.5 – < 2.25, high ≥ 2.25. If the score is within 0.1 of a threshold, write "borderline" after the risk and name the line whose verdict decides it.

**Decision:** half-done, high risk, or architecture under 8/10 → **hold**. Only the owner can waive the architecture gate, in this run; until they do, the card says "hold (architecture gate, waivable)", and a waiver is recorded on the card. Medium → **ship after owner check**, naming exactly what to look at. Low with architecture ≥ 8/10 → **ship**.

## Candidate shapes

- **Prefix push** — every held commit is newer than every shipping commit: the candidate is the newest shipping sha, pushed with `git push origin <sha>:main`. Nothing is reverted; main records the release with a plain fast-forward-able `pnpm hotfix sync` later.
- **Revert candidate** — held commits sit between shipping ones: on a scratch branch in the worktree `git revert` the held commits newest first; on conflict abort and report the dependency. After the owner pushes it, main records the release with `git merge -s ours origin/main` (one explanatory commit: `chore(sync): main records the <date> release (origin/main <sha>) and keeps its own tree`), so the reverts never replay onto main. **Record it right after the push and before any `pnpm hotfix sync`**: a sync or plain merge of that release first replays the reverts and undoes the held features on main. Once recorded, later syncs bring only newer prod commits and are safe. Write the release sha into the memory file of every held feature: when it ships later it reaches prod as its own commits (plus any `db:push:prod`).

## Dangling references after reverts

1. Tokens: diff the `--*:` names declared in `src/app/(frontend)/globals.css` between main and the candidate; for each removed name grep exact uses — `bg-|text-|border-|ring-|fill-|stroke-<name>` and `var(--name)` / `(--name)`. Loose greps match component names; use exact class patterns.
2. Code: `pnpm tsc` catches removed exports. Scripts (`theme:check`, verify scripts) may assert things the reverted commits added — revert those commits too.
3. A feature commit built on a reverted token (e.g. a switch using a quiet-rail token) goes with it; say so in the verdict.

## Visual prompt

> The owner runs the release candidate from the worktree `<path>` (branch `<branch>`) on port 3002 — only ports 3000–3002 are allowed hosts in `src/shared/config/roots.ts` (auth + funnel subdomains break elsewhere). Never start a dev server yourself: check `ss -ltnp`, and if 3002 does not answer, stop and report so the owner can start it. Never touch another session's server. No tracked-file edits, no commits, never submit forms. Playwright script in `<scratchpad>/visual/`. Prod origin: from `roots.ts`. Screenshot prod and local side by side, 1440×900 and 390×844, light AND dark (emulated scheme + `localStorage.theme`), for `/`, `/about`, `/contact`, one trade page, one portfolio page, one funnel; signed-in dashboard pages locally via `/api/dev/playwright-session` (read the route; DEV_LOGIN_SECRET from `.env.local`, NEVER printed). Open a Select and keyboard through it in dark mode. Read the PNGs yourself. Report ranked regressions (page, viewport, mode, what, screenshot path, measured contrast where useful), what got better, and what is already broken on prod.

## Gotchas (learned the hard way)

- A fresh worktree's `next-env.d.ts` points at `.next/types/routes.d.ts`, which does not exist yet → bogus `*.svg` tsc errors. Write `/// <reference types="next" />` + `/// <reference types="next/image-types/global" />` to it before tsc.
- Vercel restores `.next/cache` between deploys and can serve stale CSS with fresh JS. After any push that changes classes or `globals.css`: Vercel → Deployments → Redeploy with "Use existing Build Cache" unchecked, then curl the CSS for a rule added in the range.
- Subagents sometimes write throwaway files into `scripts/`; check `git status` after each wave.
- Memory and trackers drift: confirm a feature's status in code before calling it done or half-done.

## Report (verdict shape)

1. One-line verdict: ship main / ship the candidate / hold.
2. Facts: ahead/behind, schema/env/config changes, clean-checkout results.
3. Ship cards table: feature · decision · risk · architecture · commits. Then each card in full, holds first.
4. Commits made this run (sha + subject) and fixes made (shas).
5. Must fix before push (confirmed, with file links).
6. Waiting on the owner: every card's owner check, plus device and product calls.
7. After the push (lower-priority findings).
8. Already broken on prod (not caused by this release).
9. Push steps, in order: any `db:push:prod` first; the push (`git push origin <sha>:main` for a prefix, the candidate branch for a revert candidate, never force); redeploy without build cache when classes or `globals.css` changed; how main records the release (hotfix sync for a prefix, `-s ours` for a revert candidate, per §Candidate shapes).
