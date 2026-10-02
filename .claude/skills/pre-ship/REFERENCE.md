# Pre-ship reference

## Reviewer prompt (one per area)

Fill the brackets. Areas that worked well: data views / tables / prefetch + hydration; dashboard shell, session and permissions; theme and tokens (public-site impact); backend perf, provider SDKs, webhooks and ops scripts; charts and calculators (sales-facing math); plus one for commits that landed after the last review.

> You are a skeptical pre-production reviewer for a Next.js 15 / React 19 / tRPC / TanStack Query / Drizzle (Neon) / better-auth / Tailwind v4 app at `<repo>`. Local `main` has commits not on `origin/main` (prod). Find real defects that would hurt prod in YOUR AREA ONLY.
> READ-ONLY: never edit files, never run state-changing git commands (checkout/stash/reset/add/commit), no DB writes, no `pnpm build`, never run scripts that touch a DB or external service. Other sessions edit the working tree — review COMMITTED code via `git log origin/main..main`, `git diff origin/main..main -- <paths>`, `git show <sha>`.
> AREA: [paths + the commit subjects/shas that belong to it].
> Hunt for: [area-specific list] plus the prod-only traps below.
> Output: ranked findings — BLOCKER / HIGH / MEDIUM / LOW, file:line, one-sentence defect, concrete failure scenario, suggested fix. Only verified things; mark speculation UNVERIFIED. Briefly list what looked solid. Under ~800 words.

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

## Dangling references after reverts

1. Tokens: diff the `--*:` names declared in `src/app/(frontend)/globals.css` between main and the candidate; for each removed name grep exact uses — `bg-|text-|border-|ring-|fill-|stroke-<name>` and `var(--name)` / `(--name)`. Loose greps match component names; use exact class patterns.
2. Code: `pnpm tsc` catches removed exports. Scripts (`theme:check`, verify scripts) may assert things the reverted commits added — revert those commits too.
3. A feature commit built on a reverted token (e.g. a switch using a quiet-rail token) goes with it; say so in the verdict.

## Visual prompt

> Run the release candidate from the worktree `<path>` (branch `<branch>`) with `PORT=3002 pnpm dev` — only ports 3000–3002 are allowed hosts in `src/shared/config/roots.ts` (auth + funnel subdomains break elsewhere); check `ss -ltnp` and never touch another session's server. No tracked-file edits, no commits, never submit forms. Playwright script in `<scratchpad>/visual/`. Prod origin: from `roots.ts`. Screenshot prod and local side by side, 1440×900 and 390×844, light AND dark (emulated scheme + `localStorage.theme`), for `/`, `/about`, `/contact`, one trade page, one portfolio page, one funnel; signed-in dashboard pages locally via `/api/dev/playwright-session` (read the route; DEV_LOGIN_SECRET from `.env.local`, NEVER printed). Open a Select and keyboard through it in dark mode. Read the PNGs yourself. Report ranked regressions (page, viewport, mode, what, screenshot path, measured contrast where useful), what got better, and what is already broken on prod. Stop your server.

## Gotchas (learned the hard way)

- A fresh worktree's `next-env.d.ts` points at `.next/types/routes.d.ts`, which does not exist yet → bogus `*.svg` tsc errors. Write `/// <reference types="next" />` + `/// <reference types="next/image-types/global" />` to it before tsc.
- Vercel restores `.next/cache` between deploys and can serve stale CSS with fresh JS. After any push that changes classes or `globals.css`: Vercel → Deployments → Redeploy with "Use existing Build Cache" unchecked, then curl the CSS for a rule added in the range.
- Subagents sometimes write throwaway files into `scripts/`; check `git status` after each wave.
- Memory and trackers drift: confirm a feature's status in code before calling it done or half-done.

## Report (verdict shape)

1. One-line verdict: ship main / ship the candidate / hold.
2. Facts: ahead/behind, schema/env/config changes, clean-checkout results.
3. Commits made this run (sha + subject).
4. Held back, with why (half-done feature → its commits).
5. Must fix before push (confirmed, with file links) and what was fixed this run (shas).
6. Waiting on the owner (visual checks, device checks, product calls).
7. After the push (lower-priority findings).
8. Already broken on prod (not caused by this release).
9. Push steps: push the candidate (never force), redeploy without build cache, any `db:push:prod` first.
