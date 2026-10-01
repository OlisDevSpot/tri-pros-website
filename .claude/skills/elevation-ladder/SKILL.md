---
name: elevation-ladder
description: Tune the app's surface colours on a one-hue elevation ladder (canvas darkest, every stacked surface one step lighter, light and dark side by side) with a live slider page compared against the local build and the live site. Use whenever the owner wants to pick, retune, compare or apply background / section / card / popover / footer colours, says surfaces blend together, cards or tables are hard to see, dark mode looks muddy, the footer disappears into the page, or asks for "the ladder", "the elevation picker" or "the colour sliders", even if they don't name this skill.
---

# Elevation Ladder

The owner picks surface colours with their eyes on a slider page, not from numbers in chat. This skill keeps that page alive: it measures what the local build and the live site really serve, rebuilds the page with the last picked values as the starting point, republishes it to the same link, and records every pick so colours can be retuned over time.

## The model (owner's rule)

One base hue. The canvas is the darkest layer. Every surface stacked over another ("over" means a higher z-index) is lighter, in light AND dark mode:

| Rung | Role |
|---|---|
| −1 | beneath the page (the public-site footer revealed under it) |
| 0 | canvas |
| 1 | section / module / table sheet |
| 2 | card inside a section |
| 3 | card on a card, notes, nested panels |
| 4 | menus, popovers |

Chips and hovers step up one rung from whatever they sit on; table stripes sit half a rung up; hairline edges are the surface's own lightness pushed away from the canvas (darker in light mode, lighter in dark). Light mode needs headroom: if the canvas starts too high, the top rungs flatten into white and stop climbing.

## Files

- `ladder.json`: the state. Artifact link, the current pick, whether and where it was applied, the pick history, and the token map the measuring script reads.
- `assets/ladder-template.html`: the page (scenes + sliders). Its scenes mirror the app's real surfaces: dashboard modules with meeting and proposal cards, a note inside a card, an open menu, a records table, the public site with its footer.
- `scripts/measure.mjs`: reads the served tokens in light and dark and writes one comparison preset.
- `scripts/build.mjs`: fills the template with `ladder.json` and the measured presets.
- `scripts/shoot.mjs`: the gate's screenshots, light and dark, on desktop, tablet and phone, of the pages the owner judges by, with a report of surfaces by depth, page-coloured holes and see-through fills.
- `references/applying-values.md`: how a pick goes into the app's tokens, and the screenshot gate before it may be committed.

## Run

1. **Read `ladder.json`.** Tell the owner the current pick, its date, and whether it is applied.
2. **Measure both builds** (run them in parallel; each takes about 20 s). Use the session scratchpad for outputs.
   ```bash
   S=.claude/skills/elevation-ladder/scripts
   PORT=$(grep -E '^PORT=' .env.local | cut -d= -f2); PORT=${PORT:-3000}
   node $S/measure.mjs --url http://localhost:$PORT/ --id current --label "Local build now" --out $SCRATCH/ladder-current.json
   node $S/measure.mjs --url https://triprosremodeling.com/ --id live --label "Live site today" --out $SCRATCH/ladder-live.json
   ```
   If the dev server doesn't answer, build without the local preset and say so. Don't start, stop or restart the owner's server for this.
3. **Build:** `node $S/build.mjs --out $SCRATCH/elevation-ladder.html $SCRATCH/ladder-current.json $SCRATCH/ladder-live.json`
4. **Publish** with the Artifact tool to the link in `ladder.json` (`url` = that link, `file_path` = the built page). From a conversation that didn't publish it, `read` the artifact first; the tool requires it. If the link is gone, publish a new one and store its URL in `ladder.json`.
5. **Hand over:** the link, what the comparison buttons show, and the ask: "drag until both scenes read right, then press Copy values and paste them here."

## When the owner pastes values

The page copies one line in this shape:

```
light canvas 0.894 step 0.024 tint 0.017 · dark canvas 0.159 step 0.047 tint 0.059 · hue 253 · edge 0.048
```

A trailing ` · edges off` means hairline edges were switched off. Write the numbers into `ladder.json` → `picked` (with today's date and `edges`), append a `history` entry with the line and a short note in the owner's words, and republish so the sliders start at the new pick. That is the whole job unless the owner asks to apply it.

## Applying a pick to the app

Only when the owner asks. Read `references/applying-values.md` first. In short: the pick goes into the knob tokens in `src/app/(frontend)/globals.css`, then nothing is committed until the owner has seen before/after screenshots of the dashboard, a records table, the proposal flow and the public site (home, footer, /about) in both schemes.

Why the gate: on 2026-10-01 a token retune plus a mechanical class sweep was judged only by lint counts and lightness numbers. It made the public navbar see-through, sank chips into cards and merged the footer into the page, and the whole run was reverted (`6af35af2`). The slider page is a proxy; real screens decide.

## Keeping the page useful over time

- If the owner reports a surface the page doesn't show (a kanban column, a dialog, a sheet), add a small scene for it to the template so the next tune covers it. Keep the sample content invented: no real customers.
- When the app's tokens change (for example once rung tokens exist), update `measure.map` in `ladder.json` so "Local build now" measures the real rungs instead of the legacy names.
- The template reads only `CONFIG.project`, `picked`, `rail`, `text` and `compare`; keep `build.mjs` and the template in step if either changes.
