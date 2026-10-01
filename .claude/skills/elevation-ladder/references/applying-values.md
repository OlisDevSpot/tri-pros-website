# Applying a pick to the app

## Where the values go

All surface colours live in `src/app/(frontend)/globals.css`. Read the file before writing: the code is the source of truth, and this note can drift.

A pick has five numbers per the page: canvas lightness, step, tint (OKLCH chroma) per mode, plus one hue and one edge contrast. They map onto knob custom properties declared once per mode, with every surface derived from them:

| Pick | Meaning in the tokens |
|---|---|
| canvas | lightness of rung 0 |
| step | lightness added per rung |
| tint | chroma shared by every rung |
| hue | hue shared by every rung, both modes |
| edge | how far a hairline edge sits from its surface (darker in light, lighter in dark) |

**Status on 2026-10-01:** the app does not have rung tokens yet. `globals.css` still carries the earlier ramp (`--canvas-l`, `--lift`, `--surface-c`, `--surface-h` with `muted`/`band`/`card` formulas that do not follow the ladder: light `card` is pinned at white, `muted` sits below `card`). Applying a pick therefore needs the rung-token change first, which is its own spec and owner review. If `globals.css` has no rung knobs when you get here, stop and tell the owner; don't bend the old ramp to approximate the ladder.

Once rung tokens exist, also update `measure.map` in `ladder.json` so the measuring script reads the rungs directly.

Remember the public site reads the same `:root` tokens (only `/test` uses `.theme-marketing`). A change to the canvas or the step moves the landing pages too; check them every time.

## The gate before committing

1. `pnpm theme:check` and `pnpm tsc` pass.
2. Screenshots in light and dark of: `/dashboard`, a records table (`/dashboard/meetings`), a proposal-flow page, `/` scrolled past the hero (navbar over content), the bottom of `/` (footer), and `/about`. Use the repo's verify harness or a local Playwright script; sign in through `/api/dev/playwright-session` and never print the login secret or URL.
3. Shoot the live site (`https://triprosremodeling.com/`) at the same spots as the "before".
4. Show the owner the pairs. Commit only after they say so, by explicit pathspec (`git commit -m "…" -- <paths>`); never `git add -A`, stash, reset or checkout in this shared tree.
5. Record it in `ladder.json`: set `applied` to `{ "date": …, "commit": … }` and note it in the history entry.

If the dev server serves stale CSS (a class present in the source is missing in the browser), ask the owner before stopping it and clearing `.next`.
