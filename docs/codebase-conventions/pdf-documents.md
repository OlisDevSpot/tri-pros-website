# PDF Documents — Convention

How server-generated PDFs (proposals, SOW attachments, future finance forms) are built, rendered, secured, and verified. **One doc-definition builder per document type, one render chokepoint, data-safety and text hygiene enforced at chokepoints — never at call sites.**

> Reference impls: [`src/shared/lib/pdf/render-pdf.ts`](../../src/shared/lib/pdf/render-pdf.ts) (chokepoint), [`src/shared/lib/pdf/proposal-doc-definition.ts`](../../src/shared/lib/pdf/proposal-doc-definition.ts) (canonical full-document example), [`src/shared/services/pdf.service.ts`](../../src/shared/services/pdf.service.ts), [`src/app/api/proposals/[proposalId]/pdf/route.ts`](../../src/app/api/proposals/%5BproposalId%5D/pdf/route.ts).

---

## the-pipeline

Every PDF flows through the same four layers. Do not shortcut any of them.

```
route (auth + HTTP headers)
  → pdfService.generateXxx (fetch + orchestrate; no layout logic)
    → buildXxxDocDefinition (pure data → pdfmake TDocumentDefinitions)
      → renderPdf (fonts + sanitization + Buffer)
```

- **Builders** live in `src/shared/lib/pdf/`, one file per document type, named `<type>-doc-definition.ts`, exporting `buildXxxDocDefinition`. They take an entity view (e.g. `ProposalWithCustomer`) and return a doc definition — no DB access, no HTTP.
- **`pdfService`** fetches via the DAL and calls builder + `renderPdf`. Services orchestrate; they contain zero pdfmake content.
- **Rich text** converts through [`tiptap-to-pdfmake.ts`](../../src/shared/lib/pdf/tiptap-to-pdfmake.ts) — never hand-parse tiptap JSON in a builder. Legacy rows may carry `undefined`/unparseable `contentJSON`; parse with a try/catch helper and render without body text rather than throwing.
- **Token-gated delivery**: customer-facing PDF routes follow the proposal pattern — token match *is* the authorization. Canonical: [`proposals/DOCS.md#pdf-export-token-gated`](../../src/shared/entities/proposals/DOCS.md).

## fonts-and-winansi-text

We use the **standard 14 PDF fonts** (logical name `Roboto` → Helvetica) — no TTF files shipped, tiny output, universal rendering. The cost: standard fonts are **WinAnsi (CP-1252) encoded**, and characters outside that set render as *garbage glyphs*, not dropped.

- `renderPdf` deep-walks the entire doc definition and strips non-CP-1252 characters (including from dynamic header/footer function output). **Never sanitize inside a builder** — the chokepoint already covers every string, and per-builder sanitizing rots.
- **Never tighten the filter to Latin-1 only.** The CP-1252 specials in 0x80–0x9F (`•`, `–`, `—`, curly quotes, `€`, `™`, `…`) DO render — a Latin-1-only regex silently deletes the bullets and dashes real proposals use.
- Dev records carry emoji name prefixes; the sanitizer is what keeps them out of PDFs. See the doc comment on `pdfSafeString` for the exact keep-set.

## homeowner-safe-data

Customer-facing builders are read-only consumers of homeowner-visible fields:

- **Never** read `sow[].financials.costLines` or any margin data. The final price is **always** `computeFinalTcp(fundingJSON.data)` — never a stored total. Canonical: `proposals/DOCS.md#final-tcp-derived`.
- Company identity (name, address, licenses, contact) comes from `src/shared/constants/company/` — never hardcoded. See [phone-numbers.md](./phone-numbers.md) for phone display (`formatPhone`).
- Dates render with an explicit `timeZone: 'America/Los_Angeles'` — the server runs UTC, so an evening-PT `createdAt` otherwise prints as the next day.
- Logo: fs-read from `public/company/logo/` as a base64 data URL, with a text-only fallback when the read fails (never crash the document over branding). Note the counterintuitive naming: `logo-light-right` = dark lettering *for light backgrounds* — the right choice on a white page.

## layout-geometry

Letter page (612×792pt) with `pageMargins: [56, 56, 56, 72]` → **content width is 500pt**. Every fixed-width element must respect this.

- **pdfmake canvases never clip and never adapt.** A `canvas` line/rect draws at its literal coordinates, even past the page edge, and gets *narrower* room inside table cells (subtract cell fixed widths + paddings). Any fixed-width canvas must fit the *narrowest* container it can render in. Prefer tables with `'*'` widths for anything that should adapt.
- **Header-card pattern**: a borderless single-row table `widths: [4, '*']` — accent-bar cell + light-fill content cell, per-column padding functions (bar cell gets 0). Fill and bar repeat when content splits across pages.
- **Page structure** (proposal is the template): ceremonial cover → one content section per page (`pageBreak: 'before'`) → money summary on its own closing page. Watch double-breaks: an element with `pageBreak: 'after'` followed by one with `'before'` produces a blank page — make the follower conditional.
- **Cover pages**: the decorative frame draws on the `background` layer (absolute coords, per-page conditional — never interacts with content flow); the footer is a function returning `null` on page 1. pdfmake has **no vertical centering** — balance the cover with fixed top spacing tuned to typical content.
- `unbreakable: true` is dangerous on content that could exceed one page (pdfmake truncates/misbehaves). Prefer page-break discipline so headers naturally get a full page of room.

## deployment-vercel

pdfkit reads its font metrics from disk at runtime, which breaks on Vercel unless three things hold (full rationale in the [`next.config.ts`](../../next.config.ts) comment):

1. `pdfkit` is a **direct** dependency in `package.json` (pnpm's isolated layout hides transitive deps from the externalization check).
2. `serverExternalPackages: ['pdfkit']`.
3. Every PDF route has an `outputFileTracingIncludes` entry with the pdfkit `data/**` glob **plus every asset the builder fs-reads** (e.g. the logo). A missing entry 500s only in prod.

Adding a new PDF route = adding its `outputFileTracingIncludes` entry. No exceptions.

## http-delivery

At the route layer:

- `Content-Disposition` is a **ByteString** — non-Latin-1 characters in the filename throw. Strip to printable ASCII with a `'Document'`-class fallback, and drop `"`/`\` (header injection). Reference: `sanitizeFilename` + the route's filename handling.
- `Content-Type: application/pdf`, `Content-Disposition: inline` (opens the browser viewer; the anchor's `target="_blank"` does the new-tab part), `Cache-Control: no-store` (token-gated content).

## verification

`pnpm tsc` proves nothing about a PDF. Before calling PDF work done:

1. **Render real records through the route** (`curl` against the dev server) — at least one minimal and one content-rich record, and every branch mode (e.g. `total` vs `breakdown` pricing).
2. **Look at the pages.** Rasterize with the scratchpad recipe: `pdfjs-dist@3` + `canvas` + `standardFontDataUrl` as a plain fs path (`file://` URLs don't fetch in Node), then Read the PNGs. Geometry regressions (margin overflow) can also be caught by scanning content streams for line ops past x=556.
3. **Audit the numbers**: totals in the output must match the expected derivation, and nothing cost-line-shaped may appear anywhere in the extracted text.

---

## Anti-patterns

| Anti-pattern | Instead |
|---|---|
| Sanitizing strings inside a builder | `renderPdf` chokepoint already covers it |
| Latin-1-only character filter | Keep the CP-1252 specials (bullets, dashes, curly quotes) |
| Reading `costLines`/margins in a customer-facing builder | Homeowner-visible fields + `computeFinalTcp` only |
| Fixed-width canvas sized to "the page" | Size to the narrowest container; prefer `'*'` tables |
| Persisting/hardcoding company data or formatted phones | `constants/company/` + `formatPhone` |
| New PDF route without `outputFileTracingIncludes` | Add the pdfkit glob + fs-read assets (prod-only 500 otherwise) |
| `new Date(x).toLocaleDateString()` without a timeZone | Always pass `timeZone: 'America/Los_Angeles'` |
| Shipping after `tsc` alone | Render real records, rasterize, audit numbers |
