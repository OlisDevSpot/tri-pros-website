# Handoff: Product proof (Benefits tab and upgrade registry), paused 2026-10-30

Tracker: `docs/plans/2026-10-16-trade-scenes-epic.md`, row "Product proof" in §2; requirements R114–R118, R127, R128 (read R127 and R128 first, they carry the rulings). Brainstormed with the owner on 2026-10-30, then paused: the Benefits tab needs a proper UI brainstorm pass before any spec.

## What the owner asked for

The trade scene becomes the meeting's product-benefits presentation (R118), next to the company presentation. Selling aids: a Tri Pros yard sign in the build (R114); each product's official manufacturer documents (R115); vinyl window frame colours (R116); Cool Life paint colours (R117); "Savings" becomes "Benefits" (R127); one upgrade registry behind all of it (R128).

## Settled with the owner

- **Who reads the registry:** the scene only, for now. Construction data is one truth for every surface, so the registry lives with the construction data in `src/shared/modules/construction/` and absorbs the scene's existing product data (`owens-corning-shingles.ts` and the like) instead of copying it. The proposal, the public service pages (`features/landing/constants/trade-benefits.ts`, which still lists solar) and the meeting flow (`meeting-flow/lib/profile-benefits.ts`) move onto it later.
- **An entry** is an upgrade. It holds the job's own benefits (no leaks, structure protection, passive cooling, longer material life). A branded upgrade hangs one or two manufacturers off it, each with its documents, warranty and product constants.
- **Manufacturers:** one default per upgrade; where a second exists the rep can switch to it, never both side by side; switching swaps the documents, warranty and constants.
  - Exterior paint: Cool Life.
  - Windows: WMB (default) or Premium (Premium is a brand's name).
  - Cool roof: Owens Corning Duration COOL series.
  - Fiberglass insulation, attic and crawl space: Owens Corning.
  - Central HVAC: Goodman (default) or Lennox.
  - Everything else unbranded, benefits only: attic fan, ducts, air sealing, radiant barrier and the rest.
- **The Tri Pros workmanship warranty** belongs to every upgrade, not to a manufacturer.
- **Documents** open in a modal that reuses existing primitives: the shared `PhotoLightbox` (`src/shared/modules/media/core/components/display/photo-lightbox.tsx`), as the proposal's `CompanyDocumentsRow` does for the license and insurance. Documents are stored as page images in the `CompanyDocument` shape (`src/shared/constants/company/company-documents.ts`), not raw PDFs (Claude's call: iPad Safari shows an embedded PDF poorly); the manufacturer's original link can ride along. Where the images live waits on the R2 storage reform (Cloudflare changes are the owner's). `meeting-flow/.../document-dialog.tsx` is a stopgap marked to move onto the lightbox, so it is not the primitive to reuse.
- **Lifespan-type benefits** ("your AC lasts longer") are plain statements, no figures, for now. Environmental figures may show "coming soon" first but should go live soon after.
- **The Benefits tab** is global (every benefit of the build) and per system (roof, attic, windows, walls, heating & cooling, foundation). Owner's direction: sub-tabs per kind of benefit (savings, environmental, structural and the rest), built like the Home tab's Structure | Current materials sub-tabs (`ui/components/panel/panel-sub-tabs.tsx`), each kind shown per system.
- **Colours never show savings they can't deliver**, paint and roofing alike (R117): either the bill cut follows the picked colour's reflectance, or picks stay within the colours the cut assumes. Which one is open.

## Rejected layouts (so the UI pass doesn't repeat them)

Mockups kept locally (gitignored) in `.superpowers/brainstorm/1509949-1793400812/content/`.

- Round 1 (`benefits-tab-layouts.html`), all rejected: A, the savings figure on top, four summary tiles, then a section per system; B, everything grouped by kind with system tags, systems opening at the foot; C, a pinned total strip then one card per system with savings share, chips and document thumbnails.
- Round 2 (`benefits-tab-subtabs.html`), after the owner described sub-tabs per kind then per system, all rejected: A, one sliding row of underline tabs; B, two rows of three tabs; C, an icon column on the left. The kinds drafted were Savings, Protection, Lasts longer, Warranties, Planet, Looks & use (Claude's draft, not agreed).
- Neither round said why in detail; the owner asked for a proper UI brainstorm pass instead (`/ui-exploration` or `/ui-warmup`, per the UI methodology).

## Open

1. The Benefits tab's UI (the UI pass).
2. The list of kinds of benefit and their names (CONTEXT.md first; the owner agrees new terms).
3. Bill cut by colour vs picks limited to the assumed colours (R117).
4. The product and document list, gathered with the owner: every product above, the documents each needs (spec sheet, warranty, certifications such as Title 24 or ENERGY STAR), then the PDFs and pictures.
5. How a document is reached from the scene beyond the Benefits tab (the upgrade's row, the part's pin, up close in TS3b.4b).
6. The yard sign's artwork source (R114) and the window and paint colour pickers (R116, R117), which follow TS3b.4.
