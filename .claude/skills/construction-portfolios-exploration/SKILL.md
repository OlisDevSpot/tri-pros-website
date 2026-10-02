---
name: construction-portfolios-exploration
description: Finds US residential contractor web pages that each tell ONE project's story with before, during (visible construction work) and after photos, and returns a plain list of URLs. Use when the owner wants examples of contractor project pages, portfolio/case-study references, before-during-after galleries, "how other contractors show a project", or invokes /construction-portfolios-exploration.
---

# Construction Portfolios Exploration

Output = a plain list of ~20 URLs, grouped by trade. No dossiers, no artifact, no screenshots unless asked.

## What a hit is (the bar)

1. **One project per page** — a dedicated project / case-study / blog post for a single home. Not a mixed gallery.
2. **Before + DURING + after.** DURING is the point: demo, tear-off, framing, rough-ins, waterproofing, tile setting, crew working. Rank pages by how many during shots they have.
3. **~12+ photos** for that project (excluding logos, headshots, "related post" thumbnails, renderings).
4. **Contractor's own website, US only.** Not Houzz/Facebook/Instagram/YouTube, magazines, manufacturers, utilities, architects/designers, homeowners, databases, or non-US firms.
5. Any trade on our list — **trade is a spread target, not a filter**. Energy efficiency does NOT matter. Never solar ([[project-no-solar]]).

Trades: `docs/company/services-catalog.md` + Notion trades (kitchen, bathroom, flooring, paint, roofing, windows & doors, siding, decking, ADU/garage conversion, additions, foundation, concrete, HVAC, insulation, plumbing, electrical).

## Workflow

1. **Confirm only what changes the search** — at most 1–2 questions (e.g. "any trade, or a specific one?"). Default to the bar above. Do not grill on deliverable format.
2. **Dispatch 3 parallel `general-purpose` scouts**, one per trade group:
   - Interior: kitchen, bath, flooring, paint, whole-home interiors
   - Exterior: roofing, windows & doors, siding, exterior paint, decking
   - Structural: ADU/garage conversions, additions, foundation, concrete, HVAC, insulation, plumbing/electrical, whole-house
3. Each scout prompt MUST include: the bar verbatim, "load WebSearch + WebFetch via ToolSearch", **"don't spawn subagents"**, **"budget ~60 searches"**, the verification method below, the EXCLUDE list of domains already found, and "return 8–12 verified URLs: URL — contractor, state — trade — photo count — during count; then ≤3 near-misses".
4. Merge: dedupe, cap ~3 pages per domain, spread trades, rank by during count. Flag thin trades and weak before-shots honestly; list deep-catalog domains for "more like this".

## Verification method (give this to every scout)

- WebFetch misses lazy-loaded Squarespace/Wix/GoDaddy galleries → **curl the raw HTML and list image filenames + alt text** (IMG_xxxx phone filenames, "demo", "framing", "slab" = job-site shots).
- When alt text is empty, build a thumbnail contact sheet and look at it.
- Subtract related-post thumbnails from counts.

## Where hits come from

Small firms that blog one post per job (tile/remodel WordPress blogs), ADU builders' project pages, roofing/exterior firms with `/case-studies/` or `/projects/` post types. Deep catalogs and the last verified list: [REFERENCE.md](REFERENCE.md).

## Mistakes made the first time (don't repeat)

See [REFERENCE.md#mistakes](REFERENCE.md#mistakes). Short version: the real criterion was *visible construction work*, not the topic in the prompt; deliverable = URLs only; scouts must not spawn sub-scouts (they burned the 200-search session cap).
