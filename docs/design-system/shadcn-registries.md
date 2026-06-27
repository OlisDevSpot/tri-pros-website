# shadcn Registry Catalog

> Discovered 2026-06-24. shadcn/ui's CLI (`npx shadcn@latest add <url-or-namespace>`) can install
> components from **any** public registry that follows the registry spec (`registry.json` / `r/{name}.json`).
> Hundreds of developers ship their own Radix + Tailwind component registries on top of it. This is the
> curated set worth our attention, ranked for **our stack**: Next.js 15 + tRPC + Tailwind v4 + `motion/react`,
> with a public marketing/funnel site **and** an internal agent CRM dashboard.

## How to use a registry

1. Add the namespace to `components.json` under `registries`, e.g.
   ```jsonc
   "registries": {
     "@kibo-ui": "https://www.kibo-ui.com/r/{name}.json"
   }
   ```
2. Install: `pnpm dlx shadcn@latest add @kibo-ui/kanban`

> ⚠️ **Alias caveat (as of 2026-06-24):** our `components.json` aliases (`@/components/ui`, `@/lib/utils`)
> do **not** match where code actually lives (`@/shared/components/ui`, `@/shared/lib/utils`). Fix the
> aliases before CLI-installing, or install into a temp dir and move files + rewrite imports manually.
> See [the alias decision](#alias-handling) once resolved.

## Meta-sources (the indexes of all registries)

| Source | What it is |
|---|---|
| `https://ui.shadcn.com/r/registries.json` | **Authoritative** machine-readable index baked into the CLI — ~343 namespaces with exact install URLs. Best for tooling. |
| [registry.directory](https://registry.directory/) | Best human-readable visual explorer. |
| [shadcn.io/awesome/registries](https://www.shadcn.io/awesome/registries) | Curated highlights with descriptions. |
| [birobirobiro/awesome-shadcn-ui](https://github.com/birobirobiro/awesome-shadcn-ui) | Curated GitHub list with repo links. |

---

## Priority ranking for Tri Pros

### 🥇 Tier 1 — install first (highest ROI, lowest friction)

| Registry | Serves | Why | Install ref |
|---|---|---|---|
| **Kibo UI** | Dashboard | One registry: Kanban, Gantt, Calendar, Dropzone, Editor, Table, Tree, List. Free, CSS-vars native. | `@kibo-ui` → `https://www.kibo-ui.com/r/{name}.json` |
| **tablecn** (shadcn-table) | Dashboard | ⚠️ **Evaluated 2026-06-25 — abandoned (invasive).** Force-bumped `react-day-picker` ^9→^10 (broke our calendar + date-time-picker), scattered 25 files across new top-level dirs, and its registry assumes `@/config`+`@/types` aliases we lack → shadcn collapsed imports → ~24 tsc errors. Also overlaps our existing `src/shared/components/data-table/`. If we ever need advanced server-side tables, enhance our own table instead. | `https://tablecn.com` registry |
| **Tailark** | Marketing | Tailwind **v4-native** marketing blocks (hero/features/pricing/FAQ/CTA/footer), plain editable code. | `@tailark/blocks` |
| **Magic UI** | Marketing | ✅ **Evaluated 2026-06-25 — clean & recommended for marketing.** ~21k★ MIT animated kit. Installed marquee, number-ticker, border-beam, shimmer-button, animated-shiny-text, aurora-text, blur-fade, bento-grid → all landed correctly in `src/shared/components/ui/`, no dep conflicts, on-brand in `.theme-marketing` (constrain aurora colors to brand-blue). Eval: `/magic-eval`. `motion/react`-aligned. | `@magicui` → `https://magicui.design/r/{name}.json` |
| **tweakcn** | Both (once) | Visual theme editor → exports a Tailwind-v4 token theme as a registry item. Lock in the brand palette once. | exports theme registry URL · [tweakcn.com](https://tweakcn.com) |

### 🥈 Tier 2 — strong, adopt as needs arise

| Registry | Serves | Note | Install ref |
|---|---|---|---|
| **full-calendar** (jeraidi) | Dashboard | Drop-in DnD scheduling calendar, single-URL install. | `https://calendar.jeraidi.dev/r/full-calendar.json` |
| **Plate** | Dashboard | 16k★ headless rich-text editor — notes, SOW/proposal editing. | `@plate` → `https://platejs.org/r/{name}.json` |
| **Origin UI** | Dashboard | ⚠️ **Checked 2026-06-25 — rebranded.** `originui.com` now redirects to **coss.com/ui ("COSS UI")**, rebuilt on **Base UI (not Radix)**. Registry no longer cleanly enumerable (index 403/redirects). Base-UI primitives are a different integration story than our Radix/shadcn setup — defer unless we specifically want Base UI. | ~~`https://originui.com/r/{name}.json`~~ (dead) |
| **Dice UI** | Dashboard | Accessible data-table pieces (sort/filter/action-bar) + WCAG. Same author as tablecn. | `https://diceui.com/r/{name}` |
| **Aceternity UI** | Marketing | ~28k★ max visual impact (Aurora, Beams, 3D globe). Watch mobile perf. | `@aceternity` → `https://ui.aceternity.com/registry/{name}.json` |
| **Launch UI** | Marketing | Hand-crafted landing kit, design-led. Verify v4. | `@launchui` → `https://launchuicomponents.com/r/{name}.json` |
| **shadcn-dropzone** | Dashboard | Accessible S3/file upload (proposal & project media). | `https://shadcn-dropzone.vercel.app/dropzone.json` |
| **Tremor** | Dashboard | 16k★ charts/KPI cards. Tremor Raw is copy-paste/own-CLI — verify path. | [tremor.so](https://www.tremor.so) |

### 🥉 Tier 3 — accents & differentiators (cherry-pick)

| Registry | Serves | Note | Install ref |
|---|---|---|---|
| **Kokonut UI** | Marketing | Explicit **Tailwind v4** animated landing components. | `@kokonutui` → `https://kokonutui.com/r/{name}.json` |
| **Cult UI** | Marketing | Premium liquid-metal/gradient heros. | `@cult-ui` → `https://cult-ui.com/r/{name}.json` |
| **Smoothui** | Marketing | Turnkey marketing blocks; Vercel OSS program. | `@smoothui` → `https://smoothui.dev/r/{name}.json` |
| **Shadcnblocks** | Marketing | ~1,500 blocks (Pro is token-gated/paid). Runs Kibo UI. | `@shadcnblocks` → `https://shadcnblocks.com/r/{name}.json` |
| **React Bits** | Marketing | 110+ animated text/background effects (use TS+TW variants). | `@react-bits` → `https://reactbits.dev/r/{name}.json` |
| **Motion Primitives** | Marketing | Low-level motion building blocks. Minor CLI-URL caveat — test first. | `@motion-primitives` → `https://motion-primitives.com/c/{name}.json` |
| **Animate UI** | Marketing | Animated backgrounds + icon micro-interactions. | `@animate-ui` → `https://animate-ui.com/r/{name}.json` |
| **Fancy Components** | Marketing | 100% free whimsical micro-interactions. Use sparingly. | `@fancy` |
| **21st.dev** | Both | Community marketplace; quality varies. | `https://21st.dev/r/<author>/<component>` |

### 🔮 Tier 4 — future / situational

| Registry | When | Install ref |
|---|---|---|
| **prompt-kit** | AI copilot in CRM (note summarization, proposal assist) — lightest. | `@prompt-kit` → `https://prompt-kit.com/c/{name}.json` |
| **Vercel AI Elements** | If we adopt the Vercel AI SDK (first-party). | `https://elements.ai-sdk.dev/api/registry/all.json` |
| **assistant-ui** | Heaviest batteries-included chat surface. | `https://r.assistant-ui.com/{name}.json` |
| **ui.jln.dev** | Serendipitous palette discovery (10k+ themes). | [ui.jln.dev](https://ui.jln.dev) |

---

## Caveats / do-not-use

- **Tailwind v4 is our filter.** Confirmed v4-native: Tailark, Kokonut UI, Origin UI, Smoothui, tweakcn.
  ⚠️ **Page UI is Tailwind v3** — skip until they ship v4. Verify v4 on Launch UI / Aceternity before committing.
- **Skip opinionated themed systems** (8bitcn, RetroUI, Neobrutalism, The Gridcn, glass-ui) — they impose a
  strong aesthetic that would fight our design system. Off-tone for a premium remodeling brand.
- **Unmaintained:** shadcn-chat (author redirects to prompt-kit / AI Elements).
- **npm-only, NOT CLI registries:** Novel, schedule-x, Syntax UI, Luxe UI.

## Mental model

These all share the shadcn "you own the code" + Tailwind + Motion model, so mixing is the expected pattern:
shadcn/ui (app shell/forms) + Kibo/tablecn (dashboard) + Tailark/Magic UI (marketing). Prefer registries whose
output is plain editable shadcn code over opinionated themed systems that fight our design tokens.

<a id="alias-handling"></a>
## Install workflow (resolved 2026-06-25, first install: Kibo UI)

**Aliases fixed.** `components.json` aliases now point at the real locations
(`@/shared/components`, `@/shared/components/ui`, `@/shared/lib/utils`, `@/shared/lib`,
`@/shared/hooks`). `shadcn add` now resolves shadcn primitives correctly and *skips*
our themed versions instead of clobbering them.

**Gotchas learned installing Kibo:**
1. **Answer `N` to overwrite prompts** — `--yes` does NOT auto-answer them. Run
   `yes N | pnpm dlx shadcn@latest add @kibo-ui/<name> ...` to keep our themed primitives
   (card/button/dialog/etc.) and write only the new component files.
2. **Kibo files land in `src/components/kibo-ui/`** (not `src/shared/...`). They import only
   `@/shared/...`, so relocate them to `src/shared/components/kibo-ui/` after install — zero
   import breakage. (Or pass `shadcn add --path src/shared/components/kibo-ui`.)
3. **eslint `--fix` can break vendored types** — it rewrote Kibo's `new Array(4)` → `Array.from({length:4})`
   (`unknown[]` vs `any[]`), causing a tsc error; cast or revert. Also added a scoped
   `/* eslint-disable ts/no-use-before-define */` to the vendored gantt file.
4. **`interface` vs Kibo generics** — Kibo's `& Record<string, unknown>` constraints require an
   index signature; our lint forces `interface` (no implicit index sig). Add `[key: string]: unknown`.
5. **`@dnd-kit` SSR hydration mismatch** — dnd-kit's incrementing `aria-describedby` ids diverge
   server/client. Render DnD components (gantt/kanban/list) client-only (mount gate) to avoid it.

**⚠️ App-theme token bug surfaced:** the app theme maps `--secondary` to a saturated indigo
(`oklch(0.6231 0.188 259.8145)` in both `:root` and `.dark`) instead of a neutral raised surface.
Any shadcn/Kibo component using `bg-secondary` fills solid blue. Fix as part of the deferred
app-theme re-point (DESIGN.md §4). The eval page works around it by pointing `--secondary` at `--muted`.

**Live eval:** `src/app/(frontend)/kibo-eval/page.tsx` → route `/kibo-eval` (gantt, kanban, calendar,
list, dropzone with Tri Pros sample data).
