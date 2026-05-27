# App Shell — PWA, Safe Area, Layout, Scroll Ownership

The Tri Pros app runs as a Next.js App Router web app **and** a PWA (installed on iOS / Android home screens). The shell rules below keep the install experience working — they cover viewport configuration, iOS safe-area handling, the full-height layout chain, and where scroll is allowed to live.

When in doubt: **container extends edge-to-edge (background fills); content is padded.** Safe-area padding goes on the inner content wrapper, never on the container that paints the background.

## Rules

### viewport-fit-cover-plus-black-translucent

`src/app/layout.tsx` exports a `viewport` config with:

```ts
export const viewport: Viewport = {
  themeColor: '#03AFED',
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}
```

`viewportFit: 'cover'` lets the document paint behind the notch + home indicator. Combined with `black-translucent` status-bar style in the PWA manifest, iOS pushes the document up under the status bar.

**Why**: PWAs need the canvas to bleed under the status bar so brand backgrounds extend edge-to-edge.
**Reference impl**: `src/app/layout.tsx`
**Enforced by**: convention (Next.js merges this with the manifest)

### html-height-fix-for-webkit-191872

In `globals.css`, the document root must compensate for [WebKit bug #191872](https://bugs.webkit.org/show_bug.cgi?id=191872): with `viewport-fit=cover` + `black-translucent`, iOS pushes the document UP behind the status bar but does **not** increase document height, creating a bottom gap on initial load equal to `safe-area-inset-top`.

```css
html {
  height: 100%;
  min-height: calc(100% + env(safe-area-inset-top));
}
body {
  height: 100%;
}
```

`body { height: 100% }` (not `min-height`) is critical — children using `h-full` can only resolve against an explicit `height`, not `min-height`.

**Why**: unresolved WebKit bug from 2018; CSS-only workaround required for initial paint on iOS PWA.
**Reference impl**: `src/app/globals.css`
**Enforced by**: convention

### safe-area-padding-on-content-not-container

The "sidebar golden rule" — and the same rule every dialog, sheet, navbar, and layout shell follows:

> Container extends edge-to-edge (background fills). Content is padded.

Padding goes on the **inner content wrapper**, NOT on the container that paints the background. This way:
- Gradient/background continues behind the notch (no gap, no clipping)
- Interactive content starts below the notch
- On devices without a notch, `env(safe-area-inset-top)` resolves to `0px` — zero impact

| Surface | Element | Padding |
|---|---|---|
| Dashboard layout | Content wrapper div | `pt-[env(safe-area-inset-top)]` |
| Proposal flow | `<ProposalPageNavbar>` wrapper | `pt-[env(safe-area-inset-top)]` |
| Proposal flow | Content container | `pb-[max(env(safe-area-inset-bottom),1rem)]` |
| Sidebar (desktop) | `SidebarHeader` / `SidebarFooter` | CSS on data-slot selectors in `globals.css` |
| Sidebar (mobile sheet) | Sheet inner div | CSS in `globals.css` |
| Site navbar | Inner content wrapper | `pt-[env(safe-area-inset-top)]` |
| Popover nav | Content wrapper | `pt-[calc(env(safe-area-inset-top)+1rem)]` |
| Base modal (mobile) | `DialogContent` | `pt-[max(env(safe-area-inset-top),1rem)]` + `pb-[max(env(safe-area-inset-bottom),1rem)]` |
| Sheets | `SheetContent` | CSS on `[data-slot='sheet-content']` in `globals.css` |

All CSS-based safe-area rules live in `globals.css` under the "PWA safe-area insets" section.

**Why**: backgrounds must paint edge-to-edge for the install experience to feel native; interactive content must clear the notch / home indicator.
**Reference impl**: `src/app/globals.css`, `src/app/(frontend)/dashboard/layout.tsx`, `src/shared/components/dialogs/base-modal.tsx`
**Enforced by**: convention (CSS lives in `globals.css`; component-level wrappers apply Tailwind utilities directly)

### dashboard-layout-shape-fixed

The dashboard layout has one canonical shape. Do not refactor without reading the "Key lessons learned" anti-pattern list below.

```jsx
<SidebarProvider>                                    {/* height: 100% via CSS */}
  <AppSidebar />                                     {/* fixed inset-y-0; owns its safe areas */}
  <SidebarInset className="h-full min-w-0 overflow-hidden">
    <div className="flex-1 min-h-0 pt-[env(safe-area-inset-top)]">
      <Suspense>{children}</Suspense>
    </div>
    <DashboardMobileNav />                           {/* fixed bottom-4 */}
  </SidebarInset>
</SidebarProvider>
```

**Critical rules**:
- The content wrapper div has **NO** `overflow-y-auto` — pages own their own scrolling. Layout-level overflow causes scrollbar flashes during loading-skeleton transitions.
- The `flex-1` div MUST be outside `<Suspense>` — Suspense doesn't create a DOM node in the flex layout.
- `min-h-0` on the flex child allows it to shrink below content size.
- `overflow-hidden` on `SidebarInset` prevents double scrollbars.

**Why**: every deviation tried (layout-level scroll, lifting Suspense up, removing `min-h-0`) has caused a visible regression. Lessons paid for in PR pain.
**Reference impl**: `src/app/(frontend)/dashboard/layout.tsx`
**Enforced by**: convention (no enforcement mechanism — guard via review)

### proposal-flow-layout-shape-fixed

The proposal flow has its own canonical shape — gradient bg, scroll root context, full-height column:

```jsx
<div className="h-full flex flex-col" style={{ background: '..gradient..' }}>
  <ScrollRootProvider>
    <div className="pt-[env(safe-area-inset-top)]">
      <ProposalPageNavbar />
    </div>
    <div className="container grow min-h-0 py-4 lg:py-8 pb-[max(env(safe-area-inset-bottom),1rem)]">
      {children}
    </div>
  </ScrollRootProvider>
</div>
```

Same safe-area discipline: gradient lives on the outer container (paints behind the notch); content is the inner padded div.

**Why**: same as `dashboard-layout-shape-fixed` — every reshape has produced a regression.
**Reference impl**: `src/app/(frontend)/proposal-flow/layout.tsx`
**Enforced by**: convention

### pages-own-their-scroll

The shell layouts above NEVER set `overflow-y-auto`. Individual pages own their scrolling — most commonly via an inner `<div className="h-full overflow-y-auto">` wrapping the page body.

**Why**: layout-level scroll containers cause scrollbar flashes during page transitions when loading skeletons briefly overflow. Page-owned scroll has stable scrollbar behavior.
**Reference impl**: any agent-dashboard view in `src/features/agent-dashboard/ui/views/`
**Enforced by**: convention

### html-bg-color-inline-style

The `<html>` element has `style={{ backgroundColor: '#09090b' }}` inline so the canvas color is correct on the very first paint before CSS variables resolve.

**Why**: a flash of white before stylesheet load is visible on PWA cold-launch; inline style paints immediately.
**Reference impl**: `src/app/layout.tsx`
**Enforced by**: convention

### h-dvh-svh-not-needed

You don't need `h-dvh` or `h-svh` for the app shell. The bottom-gap problem these would solve is already solved by `html { min-height: calc(100% + env(safe-area-inset-top)) }` (see `html-height-fix-for-webkit-191872`). Use `h-full` against the height chain.

**Why**: `h-dvh` / `h-svh` have subtle iOS quirks (recalc-on-scroll) and aren't required given the CSS fix above. Avoid the complexity.
**Reference impl**: any layout shell in `src/app/(frontend)/`
**Enforced by**: convention

### fixed-positioning-uses-real-viewport

`fixed inset-0` and `fixed inset-y-0` always fill the real visual viewport — they don't depend on viewport units. The sidebar (`AppSidebar`) uses this and works correctly across all iOS / Android states. Prefer fixed-with-inset when you need a full-height side element.

**Reference impl**: `src/features/agent-dashboard/ui/components/app-sidebar.tsx`

## Web Push (PWA Notifications)

### vapid-keys-never-rotate

See `environment.md#vapid-keys-never-rotate`. Generated once; every existing subscription is bound to the public key. Rotating invalidates all subscriptions silently.

### manifest-scope-stays-slash

`scope: '/'` in `public/manifest.json` is required for deep-link push notifications (the `navigate` field on Declarative Web Push). Narrowing scope breaks deep links on iOS.

**Reference impl**: `public/manifest.json`
**Related**: `memory/pattern-push-notifications.md` — how to add a new push type

## Anti-patterns

- **Adding `overflow-y-auto` to a layout shell.** Pages own scrolling. Layout-level overflow flashes scrollbars during transitions.
- **Putting safe-area padding on the *container* instead of the inner content wrapper.** Background gets cut off behind the notch.
- **Using `h-dvh` / `h-svh` on the app shell.** The html-min-height fix already solves the bottom-gap; the dynamic-viewport units add complexity for no gain.
- **`body { min-height: 100% }` instead of `height: 100%`.** Children using `h-full` can't resolve against `min-height`.
- **Wrapping `<Suspense>` around the flex-grow div.** Suspense doesn't create a DOM node — the flex layout collapses.
- **Hand-rolling a new layout shell instead of reusing the dashboard / proposal-flow patterns.** Every regression has been caused by departing from these shapes.

## See also

- [`environment.md`](./environment.md) — viewport URLs, VAPID keys, integrations inventory
- [`frontend-stack.md`](./frontend-stack.md) — `'use client'` and view/component boundaries above the shell
- [`docs/ui-design-playbook.md`](../ui-design-playbook.md) — visual design tokens that the shell renders
- `memory/pattern-push-notifications.md` — Web Push pipeline + iOS deep-link invariants
- `memory/feedback-pwa-safe-area.md` — historical reflection on the WebKit #191872 discovery
