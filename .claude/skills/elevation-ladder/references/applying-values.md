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

**Where each number goes.** Light values sit in the `:root, .funnel-light` block and dark values in `.dark`: canvas → `--canvas-l`, step → `--step`, tint → `--surface-c`. Hue → `--surface-h` and edge → `--edge` are declared once, in `:root, .funnel-light`. Everything else (rungs, chips, bands, edges, the dark rail) derives from these. After a change, `pnpm theme:check` resolves every text and control colour on every rung; a failure there is the owner's call, not a number to nudge quietly.

Remember the public site reads the same `:root` tokens (only `/test` uses `.theme-marketing`). A change to the canvas or the step moves the landing pages too; check them every time.

## The gate before committing

1. `pnpm theme:check` and `pnpm tsc` pass.
2. Shoot the local build before and after the change: `node scripts/shoot.mjs --base http://localhost:$PORT --out <dir>` (light and dark, on desktop, tablet and phone; 11 shots: dashboard, records table, its row menu, the customer dialog, the proposal editor and review page, home scrolled and at the footer, `/about`, `/services`, `/test`). It signs in through `/api/dev/playwright-session` without printing the secret. Read its `report.json`: surfaces by depth, page-coloured holes inside surfaces, and see-through fills.
3. Shoot the live site with `--public` as the "before" for the public pages.
4. Show the owner the pairs. Commit only after they say so, by explicit pathspec (`git commit -m "…" -- <paths>`); never `git add -A`, stash, reset or checkout in this shared tree.
5. Record it in `ladder.json`: set `applied` to `{ "date": …, "commit": … }` and note it in the history entry.

If the dev server serves stale CSS (a class present in the source is missing in the browser), ask the owner before stopping it and clearing `.next`.
