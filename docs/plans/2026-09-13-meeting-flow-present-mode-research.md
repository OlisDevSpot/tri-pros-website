# Meeting-flow present mode — research note

**Date:** 2026-09-13 · **Scope:** (1) a present-mode toggle for `dashboard/meetings/[meetingId]` that collapses the app sidebar to icon mode and hides the flow's own top bar without disturbing the persisted sidebar preference; (2) an idle-fading floating previous/next capsule; (3) letting that one route escape `dashboard/template.tsx`'s padding and the layout's fixed mobile bottom nav · **Stack (installed, from `node_modules/*/package.json`):** next 15.5.9, react 19.2.4, motion 12.31.0 (framer-motion 12.31.0 + motion-dom 12.30.1 underneath), tailwindcss 4.1.18; `package.json` ranges `next 15.5.9`, `react ^19.0.0`, `motion ^12.18.1`, `tailwindcss ^4`.

## Summary

**Q1.** Neither `setOpen(false)`-then-restore nor a CSS-only class does the job: `setOpen` writes the `sidebar_state` cookie on every call, and the "collapsed" look is not CSS — it is the context `state` that `AppSidebar`, tooltips and the `data-collapsible` attribute all read. Add a transient `presenting` boolean to `SidebarProvider` that overrides the derived `open` (`open = presenting ? false : (openProp ?? _open)`) and leaves `_open` and the cookie untouched; make `toggleSidebar` exit present mode instead of toggling while `presenting`, so ⌘B / the chevron / the rail are the escape hatch. On refresh the client state is gone and the cookie still holds the user's real preference, so the sidebar comes back exactly as the user left it (§1). **Q2.** Listen on `document` for `pointermove` (timestamp-gated), `pointerdown`, `keydown`, `wheel`, `touchstart`, `focusin`, all `{ passive: true }`; when the 2.5 s timer fires, re-arm instead of hiding if `capsule.matches(':hover, :focus-within')` (guard `:hover` with `matchMedia('(hover: hover)')`); never unmount the capsule (a removed node cannot be hovered or focused) — animate `opacity` only with `motion.div initial={false} animate`, keep the fade under reduced motion (opacity is the sanctioned replacement for movement), and no `transition-all`. All APIs import from `motion/react`; the package declares `react ^18 || ^19` (§2). **Q3.** Route groups cannot remove the mobile nav (it lives in the shape-fixed `dashboard/layout.tsx`), a nested layout renders *inside* the template so it cannot undo the padding, and a pathname-aware template needs the nav to duplicate the route check. Use the repo's own `:has()` opt-out pattern (`data-no-gutter-stable`, `has-data-modal-hero:p-0`): the meeting-flow root carries `data-stage`; the template's `motion.main` adds `has-data-stage:p-0`; one `globals.css` rule hides the nav when `[data-slot='sidebar-inset']:has([data-stage])`. `layout.tsx` is untouched (§3).

## 1. Present mode — collapsing the sidebar without touching the preference

### 1.1 What the provider does today (code is the source of truth)

- **Cookie on every `setOpen`.** `setOpen` updates `_open` (or calls `onOpenChange` in controlled mode) and then unconditionally runs `` document.cookie = `sidebar_state=${openState}; path=/; max-age=604800` `` (`src/shared/components/ui/sidebar.tsx:77-91`; constants at `:29-30`). There is no flag to skip the write. `document.cookie` assignment "set[s]/update[s] a single cookie at a time" and `max-age` is "the maximum age of the cookie in seconds" ([MDN document.cookie](https://developer.mozilla.org/en-US/docs/Web/API/Document/cookie)), so each call also refreshes the 7-day expiry.
- **The layout reads that cookie for `defaultOpen`.** `cookieStore.get('sidebar_state')` → `defaultOpen = value === 'true'` (`src/app/(frontend)/dashboard/layout.tsx:16-17,23`). This is the whole persistence mechanism; the current shadcn docs pages no longer document it (see Unverified) — the repo file is the primary source.
- **`toggleSidebar` and ⌘B.** `toggleSidebar = isMobile ? setOpenMobile(o => !o) : setOpen(o => !o)` (`:94-96`); a `keydown` listener on `window` (bubble phase, no `capture`) calls `event.preventDefault(); toggleSidebar()` for `key === 'b' && (metaKey || ctrlKey)` (`:99-112`, `SIDEBAR_KEYBOARD_SHORTCUT = 'b'` at `:34`). The shadcn docs confirm "you use the `cmd+b` keyboard shortcut on Mac and `ctrl+b` on Windows" ([shadcn sidebar](https://ui.shadcn.com/docs/components/sidebar)).
- **"Collapsed" is context state, not CSS.** `state = open ? 'expanded' : 'collapsed'` (`:116`) is what everything reads: `<Sidebar>` stamps `data-state={state}` and `data-collapsible={state === 'collapsed' ? collapsible : ''}` (`:212-218`), and every `group-data-[collapsible=icon]:*` rule hangs off that attribute; `SidebarMenuButton` hides its tooltip unless `state === 'collapsed'` (`:544`); `AppSidebar` derives `isCollapsed = state === 'collapsed'` and drives the label `motion.span` (`animate={isCollapsed && !isMobile ? SIDEBAR_LABEL_ANIMATE.collapsed : …}`) and the logo swap from it (`src/features/agent-dashboard/ui/components/app-sidebar.tsx:52-53,112-119,164-201`). `AppSidebar` mounts `<Sidebar collapsible="icon">` (`:164`) and its chevron button calls `toggleSidebar` (`:211-219`). The width change is animated by `transition-[width] duration-200 ease-linear` on the gap and container (`sidebar.tsx:223-229,234`).
- **Mobile is a different axis.** Below `md` the desktop sidebar is `hidden md:block` and the mobile variant is a `<Sheet open={openMobile}>` (`sidebar.tsx:185-212`); `useIsMobile` is `window.innerWidth < 768` (`src/shared/hooks/use-mobile.ts`). Any desktop override is a no-op on phones.

### 1.2 Option A — `setOpen(false)` on enter, restore captured value on exit

- Works visually because it flows through `state`. But entering writes `sidebar_state=false` and exiting writes the captured value back (`:88`), so the cookie is changed for the whole presentation and its expiry is refreshed twice.
- **⌘B during present mode** → `toggleSidebar` → `setOpen(true)` → sidebar expands *and* cookie = `true`; on exit the captured value overwrites the user's mid-present choice. Two writers, last one wins.
- **Refresh mid-present** → present mode (client state) is gone, but the layout reads the cookie the enter-step wrote → sidebar boots *collapsed*, permanently, until the user toggles again. This is exactly the "cookie left changed" failure the requirement forbids.
- Effect cleanup is the right place for the restore (React: "The cleanup function should stop or undo whatever the setup function was doing" — [react.dev useEffect](https://react.dev/reference/react/useEffect#my-effect-runs-twice-when-the-component-mounts)), but cleanup cannot un-write a cookie that a refresh has already consumed.

### 1.3 Option B — transient override state on the provider (recommended)

- Add `presenting` state to `SidebarProvider` and derive `open` from it: `const userOpen = openProp ?? _open; const open = presenting ? false : userOpen`. `_open`, `openProp`, `onOpenChange` and the cookie are never touched; `state` becomes `'collapsed'`, so every consumer in §1.1 (attributes, tooltips, `AppSidebar` labels/logo) follows without further changes. The sidebar shows icon mode because `collapsible="icon"` is already set (`app-sidebar.tsx:164`).
- The functional form of `setOpen` must derive from `userOpen`, not the overridden `open` (`sidebar.tsx:79` currently reads `value(open)`), otherwise a toggle during present mode would flip from the forced `false`.
- **⌘B / chevron / rail during present mode.** `toggleSidebar` should `if (presenting) { setPresenting(false); return }` — any "show me my sidebar" gesture exits present mode and the sidebar returns to `userOpen`, which is still the persisted value. No cookie write occurs. The alternative (leave `toggleSidebar` alone) is wrong: it would flip `_open` and the cookie while the visible sidebar stays collapsed — an invisible preference change. A third option, intercepting ⌘B in the flow with a capture-phase `window` listener and `stopImmediatePropagation()`, is technically sound ("no remaining listeners will be called, either on that element or any other element" — [MDN stopImmediatePropagation](https://developer.mozilla.org/en-US/docs/Web/API/Event/stopImmediatePropagation); capture fires "first on the *least nested* element" — [MDN event bubbling](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/Event_bubbling)) but hides shell behaviour in a feature and still leaves the chevron unhandled. Keep the rule in the provider.
- **Single source of truth.** The meeting flow reads `presenting` from `useSidebar()` to hide its top bar and show the capsule, and sets it via `setPresenting` (P key / button). Because the provider owns the flag, ⌘B exiting present mode and the flow's chrome cannot desynchronise. The flow's `useEffect(() => () => setPresenting(false), [setPresenting])` guarantees chrome returns on navigation away; under Strict Mode's setup → cleanup → setup, cleanup is idempotent (React runs "setup and cleanup one extra time before the actual setup" in development — [react.dev](https://react.dev/reference/react/useEffect#my-effect-runs-twice-when-the-component-mounts)).
- **Refresh mid-present.** `presenting` is React state, so it resets; the cookie was never written, so `defaultOpen` is the user's real preference; `?step=N` survives via nuqs (`stepParser`, `src/features/meeting-flow/constants/query-parsers.ts`). The presenter presses P again. Putting `present` in the URL would *not* remove the sidebar flash on reload: "Layouts do not rerender on navigation, so they cannot access search params" ([Next.js layout.js](https://nextjs.org/docs/app/api-reference/file-conventions/layout)), so the server would still paint the sidebar expanded and the override would collapse it after hydration with the 200 ms width transition — in front of a customer. Client-only state is the safer default; a URL/`sessionStorage` restore is an opt-in later.

### 1.4 Option C — CSS-only class on the provider

- A `data-presenting` attribute on `[data-slot='sidebar-wrapper']` could re-declare the `group-data-[collapsible=icon]:*` rules under a new selector, but it cannot reach the JS consumers: tooltips stay `hidden` (`sidebar.tsx:544`), `AppSidebar`'s `motion.span` labels keep `width: auto` and the full logo stays (`app-sidebar.tsx:112-119,171-201`), and `useSidebar().state` still says `expanded` to any other consumer. It would also duplicate ~20 selectors from `sidebar.tsx` and `app-sidebar.tsx`. Reject.

## 2. Idle-fading floating capsule

### 2.1 Listener set and why each one

| Event | Reason | Source |
|---|---|---|
| `pointermove` (gated) | Mouse, pen and touch movement. Fires "whether or not any pointer buttons are pressed" and "can fire at a very high rate"; the browser may coalesce (`getCoalescedEvents`) and "may delay `pointermove` events to improve performance". | [MDN pointermove](https://developer.mozilla.org/en-US/docs/Web/API/Element/pointermove_event) |
| `pointerdown` | Any press from any pointer type; pointer events are "a single DOM event model to handle pointing input devices such as a mouse, pen/stylus or touch". Baseline since July 2020. | [MDN Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events) |
| `keydown` | "fired for all keys, regardless of whether they produce a character value"; bubbles to `Window`. Skip `event.isComposing || keyCode === 229` for IME composition. | [MDN keydown](https://developer.mozilla.org/en-US/docs/Web/API/Element/keydown_event) |
| `wheel` | Wheel/trackpad input that "doesn't necessarily dispatch a `scroll` event"; the snap scroller may already be at rest, so a `scroll` listener would miss it. | [MDN wheel](https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event) |
| `touchstart` | Belt-and-braces for engines that dispatch touch events; the spec says the `touchstart` must precede any *mouse* event for the action but does not order it against `pointerdown`, and MDN marks Touch Events "Limited availability". Harmless duplicate of `pointerdown` on pointer-event browsers. | [Touch Events](https://w3c.github.io/touch-events/), [MDN touchstart](https://developer.mozilla.org/en-US/docs/Web/API/Element/touchstart_event), [Pointer Events spec](https://w3c.github.io/pointerevents/) |
| `focusin` | Keyboard navigation into the capsule or anywhere else: "`focusin` bubbles, while `focus` does not"; not cancelable. Tabbing into a hidden capsule reveals it. | [MDN focusin](https://developer.mozilla.org/en-US/docs/Web/API/Element/focusin_event) |

Attach to `document` (everything above bubbles there; `focusin` targets the element that received focus). `scroll` is unnecessary once `wheel`/`touchstart`/`keydown` are covered, and `pointerrawupdate` is explicitly not recommended ("For most use cases, you should prefer `pointermove`" — MDN).

### 2.2 Passive listeners

- `passive: true` "indicates that the function specified by `listener` will never call `preventDefault()`"; it "defaults to `false` – except that in browsers other than Safari, it defaults to `true` for `wheel`, `mousewheel`, `touchstart` and `touchmove` events on the document-level nodes `Window`, `Document`, and `Document.body`" ([MDN addEventListener](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener)). The handler only resets a timer, so pass `{ passive: true }` explicitly on all six — Safari does not default it, and for `wheel` non-passive handlers make "the browser … wait for every wheel event to be processed before actually scrolling" ([MDN wheel](https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event)).

### 2.3 Throttling `pointermove`

- The handler's work is `clearTimeout` + `setTimeout`, so the cost is churn, not layout. Gate with a timestamp (`if (e.timeStamp - last < MOVE_GATE_MS) return`) at ~100–150 ms; a `requestAnimationFrame` gate is the alternative but rAF "calls are paused in most browsers when running in background tabs" and runs at display rate (60–144 Hz) ([MDN requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)) — more machinery than a timestamp for the same result. Keep React out of the hot path: only call `setHidden(false)` when a ref says the capsule is currently hidden.

### 2.4 Hover / focus-within exceptions

- Do the check when the timer fires, not on every event: `el.matches(':hover, :focus-within')` ("tests whether the element would be selected by the specified CSS selector" — [MDN Element.matches](https://developer.mozilla.org/en-US/docs/Web/API/Element/matches)); `:focus-within` "matches an element if the element or any of its descendants are focused" ([MDN :focus-within](https://developer.mozilla.org/en-US/docs/Web/CSS/:focus-within)). If it matches, re-arm the timer instead of hiding.
- `:hover` "is problematic on touchscreens … might … continue to match even after the user has stopped touching" ([MDN :hover](https://developer.mozilla.org/en-US/docs/Web/CSS/:hover)); on an iPad a tapped capsule would never fade. Guard it: only include `:hover` when `matchMedia('(hover: hover)').matches` — `hover: none` means "the primary input mechanism cannot hover at all or cannot conveniently hover (e.g., many mobile devices emulate hovering when the user performs an inconvenient long tap)" ([MDN @media hover](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/hover)).
- **Consequence: do not unmount.** `AnimatePresence` "works by detecting when its **direct children** are removed from the React tree" ([Motion AnimatePresence](https://motion.dev/docs/react-animate-presence)); a removed capsule has no DOM node to hover, focus, or reveal by Tab. Keep it mounted and animate `opacity` with `pointer-events-none` while hidden so it neither intercepts taps nor can be "hovered" invisibly. Do not add `aria-hidden` (its buttons stay focusable, and `focusin` is the reveal path for keyboard users).

### 2.5 Reduced motion — fade, but not motion

- MDN's own example under `prefers-reduced-motion: reduce` swaps a `transform: scale()` pulse for an `opacity` dissolve; "Animations such as scaling or panning large objects can be vestibular motion triggers" ([MDN prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)). The idle fade *is* an opacity change with no translation, so it stays on under reduced motion; only any `y` slide goes.
- `<MotionConfig reducedMotion="user">` already wraps the presentation (`src/features/meeting-flow/ui/components/presentation/snap-presentation.tsx:53`): "When reduced motion is on, transform and layout animations will be disabled. Other animations, like `opacity` and `backgroundColor`, will persist" ([Motion MotionConfig](https://motion.dev/docs/react-motion-config)). Source: `useReducedMotionConfig` returns the device preference for `"user"` (`framer-motion/dist/es/utils/reduced-motion/use-reduced-motion-config.mjs`). So a capsule using only `opacity` needs no extra gate; if an instant hide under reduced motion is wanted, use `useReducedMotion()` to set `transition={{ duration: 0 }}`.
- **`useReducedMotion` is a one-time snapshot, not live.** Docs say it "will actively respond to changes and re-render your components" ([Motion useReducedMotion](https://motion.dev/docs/react-use-reduced-motion)); the shipped 12.31.0 source is `const [shouldReduceMotion] = useState(prefersReducedMotion.current)` with a `TODO See if people miss automatically updating shouldReduceMotion setting` (`framer-motion/dist/es/utils/reduced-motion/use-reduced-motion.mjs`). The store value is `null` "server-side" and becomes `matchMedia('(prefers-reduced-motion)').matches` in the browser (`motion-dom/dist/es/render/utils/reduced-motion/{state,index}.mjs`). So: SSR renders as `null` (falsy), the first client render captures the real value, and later OS changes are ignored until remount. Fine for a transition duration; do not branch markup on it.
- Tailwind's `motion-safe`/`motion-reduce` variants map to the same media feature ([Tailwind variants](https://tailwindcss.com/docs/hover-focus-and-other-states)), useful only if the capsule is CSS-transitioned instead of Motion-driven.

### 2.6 No `transition: all`

- `transition-all` compiles to `transition-property: all` ([Tailwind transition-property](https://tailwindcss.com/docs/transition-property)), and `all` "specifies that the transition will be applied to all properties that change as the element changes state" ([MDN transition](https://developer.mozilla.org/en-US/docs/Web/CSS/transition)) — including `display`/`pointer-events` toggles and any layout property, which is how a "fade" turns into a jump. With Motion animating `opacity` through inline `style` there is no CSS transition at all; if a CSS fallback is used, it is `transition-opacity` (`transition-property: opacity`) plus `motion-reduce:transition-none`.

### 2.7 Motion 12 APIs and import paths (verified against installed package + docs)

- Entry: `import { motion, AnimatePresence, MotionConfig, useReducedMotion } from "motion/react"` ([Motion quick start](https://motion.dev/docs/react-quick-start), [MotionConfig](https://motion.dev/docs/react-motion-config), [useReducedMotion](https://motion.dev/docs/react-use-reduced-motion), [AnimatePresence](https://motion.dev/docs/react-animate-presence)); the upgrade guide's migration is "simply swap imports from `"framer-motion"` to `"motion/react"`" and "There are no breaking changes in Motion for React in version 12" ([upgrade guide](https://motion.dev/docs/react-upgrade-guide)). The repo convention agrees (`docs/codebase-conventions/frontend-stack.md#motion-not-framer`; 148 existing `motion/react` imports, zero `framer-motion`).
- **React 19.** `node_modules/motion/package.json` declares `peerDependencies.react: "^18.0.0 || ^19.0.0"` (same in framer-motion 12.31.0). `motion/react` is `export * from 'framer-motion'` (`node_modules/motion/dist/react.d.ts`); `motion/react-client` is `export * from 'framer-motion/client'` (`node_modules/motion/dist/es/react-client.mjs`), which exports only the `"use client"`-marked `motion.*` element components for use directly inside Server Components — not needed here, the capsule is a client component. The docs pages fetched do not state a React-19 minimum explicitly (only "Framer Motion 7 makes `react@18` the minimum"), so the peer range is the authoritative statement.
- `motion.div` props: `initial` ("`false` to disable the enter animation and initially render as the `animate` values"), `animate` ("A target to animate to on enter, and on update"), `exit` (only under `AnimatePresence`), `transition`, `whileHover`, `whileFocus` ([Motion component](https://motion.dev/docs/react-motion-component)). `AnimatePresence initial={false}` "will disable any initial animations on children that are present when the component is first rendered"; `mode="wait"` makes "entering element … wait until the exiting child has animated out" — the existing `PinnedColumn` uses exactly this (`presentation/pinned-column.tsx:29`).

## 3. Escaping `dashboard/template.tsx` for one route

### 3.1 Facts about templates and layouts (docs + Next 15.5.9 source)

- **Hierarchy.** Special files render `layout.js` → `template.js` → `error.js` → `loading.js` → `not-found.js` → `page.js` or nested `layout.js`, "recursively in nested routes" ([Next.js project structure](https://nextjs.org/docs/app/getting-started/project-structure#component-hierarchy)); `template.js` "wraps `error.js`, `loading.js`, `not-found.js`, and `page.js`, but does **not** wrap the `layout.js` in the same segment" ([template.js](https://nextjs.org/docs/app/api-reference/file-conventions/template)). A nested `meetings/[meetingId]/layout.tsx` is therefore a *child* of the dashboard template's `motion.main`.
- **Remount key = the child segment, without search params.** Docs (v16 pages): "Templates receive a unique key for their own segment level. They remount when that segment (including its dynamic params) changes. Navigations within deeper segments do not remount higher-level templates. Search params do not trigger remounts" ([template.js](https://nextjs.org/docs/app/api-reference/file-conventions/template)). The 15.1.x docs say the same in fewer words ("templates are given a unique key, meaning children Client Components reset their state on navigation" — context7 `/vercel/next.js/v15.1.11`). The installed 15.5.9 source: `OuterLayoutRouter` computes `activeStateKey = createRouterCacheKey(activeSegment, true) // no search params` from the *child* segment of the layout that owns the template (`node_modules/next/dist/client/components/layout-router.js:408-410`), stores it as `bfcacheEntry.stateKey` (`bfcache.js:27,47`) and uses it as the React `key` of the `TemplateContext.Provider` that renders `template` (`layout-router.js:422,474-509`); `createRouterCacheKey` returns the plain segment string, or `name|value|type` for a dynamic segment, and strips `?search` only from page segments (`create-router-cache-key.js`). For `dashboard/template.tsx` the key is `'meetings'` on **both** `/dashboard/meetings` and `/dashboard/meetings/<id>`, so the 0.2 s fade does not even fire on list → detail; it fires when entering `meetings` from another dashboard section. `?step=` changes never remount it.
- **What a hook inside the template can see.** The `<Template>` element is rendered as the *children* of `TemplateContext.Provider` inside `OuterLayoutRouter`, which reads the parent (dashboard) `LayoutRouterContext` (`layout-router.js:369-377`); the child segment's `LayoutRouterContext` is only provided further down, inside `InnerLayoutRouter` (`:316-318`). `useSelectedLayoutSegments` walks `context.parentTree` (`navigation.js:159-166`, `getSelectedLayoutSegmentPath` at `:137-157`, returning the dynamic *value*, not `[meetingId]`). So a client template calling `useSelectedLayoutSegments()` gets `['meetings', '<id>']`, the same as a client component imported into the layout ("lets you read the active route segments **below** the Layout it is called from" — [useSelectedLayoutSegments](https://nextjs.org/docs/app/api-reference/functions/use-selected-layout-segments); route-group names are included in the array). `usePathname` also works ("Client Components re-render during navigation, so they have access to the latest pathname" — [layout.js](https://nextjs.org/docs/app/api-reference/file-conventions/layout)).
- **Layouts persist; layouts cannot see pathname or search params.** "Layouts do not rerender. They can be cached and reused" and cannot access pathname/search params ([layout.js](https://nextjs.org/docs/app/api-reference/file-conventions/layout)); client-side transitions work by "Keeping any shared layouts and UI" ([linking and navigating](https://nextjs.org/docs/app/getting-started/linking-and-navigating)).
- **Route groups.** "(folderName)" folders are "omitted from the URL"; use cases include "Opting specific route segments into sharing a layout, while keeping others out"; caveat: "Routes in different groups should not resolve to the same URL path" ([route groups](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups)); "you can create a different layout for each group by adding a `layout.js` file inside their folders" ([project structure](https://nextjs.org/docs/app/getting-started/project-structure#organize-routes-without-affecting-the-url-path)). `template` is a routing file like `layout`, placeable in any segment including a group.

### 3.2 The constraint that decides it

`docs/codebase-conventions/app-shell.md#dashboard-layout-shape-fixed`: the dashboard layout "has one canonical shape. Do not refactor" — `SidebarProvider → AppSidebar + SidebarInset(h-full min-w-0 overflow-hidden) → div.flex-1.min-h-0.pt-[safe-area] → Suspense{children}; DashboardMobileNav`, with `pages-own-their-scroll`. The nav is `fixed bottom-4 left-4 right-4 z-30 md:hidden` (`src/features/agent-dashboard/ui/components/mobile-bottom-nav.tsx:15`) rendered by `dashboard/layout.tsx:37`, *outside* the template and the page. Whatever mechanism is chosen must (i) remove `px-4 pb-20 pt-4 md:px-6 md:py-6 md:pb-6` from the template's `motion.main` (`src/app/(frontend)/dashboard/template.tsx:8-13`) and (ii) suppress the nav — without moving the nav.

### 3.3 (a) Route groups `dashboard/(chrome)/**` + `dashboard/(stage)/meetings/[meetingId]`

- Correct Next-native tool for (i): `(chrome)/template.tsx` keeps the padded fade for every existing route; `(stage)` has no template. URLs unchanged; `ROOTS.dashboard.meetings.byId` unaffected (`src/shared/config/roots.ts:65-68`).
- Cannot do (ii): the nav is in `dashboard/layout.tsx`, above both groups. Moving it into `(chrome)/layout.tsx` puts it *inside* the `flex-1` content div and the layout's `<Suspense>` (visually fine because it is `position: fixed`, but it changes the canonical shape and needs a convention amendment) — or the nav still needs a route-aware/CSS switch, i.e. (c) or (d) anyway.
- Cost: every other dashboard route file moves (≈20 `page.tsx` plus `pipeline/[pipeline]/layout.tsx`), and the `meetings` folder is split across two groups (`(chrome)/meetings/page.tsx`, `(stage)/meetings/[meetingId]/page.tsx`). The docs forbid only identical resolved URLs, so this is legal, but two `meetings` folders is a permanent reading hazard. Not recommended.

### 3.4 (b) Nested `meetings/[meetingId]/layout.tsx` + negative margins

- Renders inside the template (§3.1), so it cannot remove padding; it can only cancel it with `-mx-4 -mt-4 -mb-20 md:-m-6` (four breakpoint-mirrored values that must track the template forever). Geometrically it works — `overflow-hidden` clips at the padding box, so a child pulled into the padding area is still painted — but the height chain breaks: the flow's `h-full` root (`meeting-flow.tsx:184`) resolves against `main`'s *content* box, so the negative-margin child must also be `h-[calc(100%+…)]`. And a nested layout cannot touch the nav at all. Reject.

### 3.5 (c) Pathname-aware template

- `DashboardTemplate` is already `'use client'`; `useSelectedLayoutSegments()` returns `['meetings', '<id>']` from inside it (§3.1) on the server and client alike, so no flash. It would render the padded `motion.main` or a bare `main` by predicate. The nav needs the same predicate (`DashboardMobileNav` is a client component; return `null`). Two JS call sites, one shared `isStageRoute(segments)` helper — acceptable, but the shell then carries a hard-coded list of feature routes, which grows with every future stage route.

### 3.6 (d) Page-set data attribute honoured by `:has()` (recommended)

- `:has()` "presents a way of selecting a parent element … with respect to a reference element"; Baseline widely available "since December 2023"; it "cannot be nested within another `:has()`" ([MDN :has](https://developer.mozilla.org/en-US/docs/Web/CSS/:has)). Tailwind v4: "Use the `has-*` variant to style an element based on the state or content of its descendants", including `has-[selector]` arbitrary forms ([Tailwind variants](https://tailwindcss.com/docs/hover-focus-and-other-states)).
- **Repo precedent, twice.** `html:not(:has([data-no-gutter-stable])) { scrollbar-gutter: stable }` (`src/app/(frontend)/globals.css:508-510`) is an ancestor rule switched off by a descendant attribute the dashboard layout sets (`layout.tsx:23`), and `BaseModal` uses `has-data-modal-hero:p-0 …` so a child slot removes the parent's padding (`src/shared/components/dialogs/modals/base-modal.tsx:41-53`). The stage opt-out is the same shape.
- **Specificity.** `has-data-stage:p-0` compiles to `.has-data-stage\:p-0:has(*[data-stage]) { padding: 0 }` — one class plus the `:has()` argument's attribute selector, (0,2,0) — which beats `md:px-6` / `md:pb-6` (0,1,0; `@media` adds nothing) regardless of source order.
- **No hydration timing.** `MeetingFlowView` is a client component that server-renders its root `div` immediately (it shows `LoadingState` inside it while the query loads), so the marker is in the HTML and the first paint is already edge-to-edge. No route knowledge in the shell; any future stage route opts in by rendering the attribute.
- **The nav.** `SidebarInset` (`data-slot="sidebar-inset"`, `sidebar.tsx:313`) is the nearest common ancestor of the content div and the nav, so one `globals.css` rule — `[data-slot='sidebar-inset']:has([data-stage]) [data-slot='dashboard-mobile-nav'] { display: none }` — hides it, next to the existing shell rules ("All CSS-based safe-area rules live in `globals.css`" — app-shell.md). The nav keeps its `ActionCenterSheet` state; only the fixed capsule disappears.
- **Precedent check: `proposal-flow/layout.tsx`.** It is a *self-owned shell* (`ProposalFlowShell → ScrollRootProvider → navbar with pt-[safe-area-top] → container with pb-[max(env(safe-area-inset-bottom),1rem)]`, `src/app/(frontend)/proposal-flow/layout.tsx`; `app-shell.md#proposal-flow-layout-shape-fixed`), with no template, because it is a separate top-level segment. The meeting flow must stay under `dashboard/` (session gate, `GlobalDialogs`, sidebar), so the precedent does not transfer as a structure — it transfers as the safe-area discipline: once the template's `pb-20` is gone, the flow footer must carry `pb-[env(safe-area-inset-bottom)]` itself (the top inset is already provided by the layout's content wrapper, `layout.tsx:31`).

## Recommendation

### Q1 — provider-owned `presenting` override

```tsx
// src/shared/components/ui/sidebar.tsx — SidebarProvider (additions only)
const [presenting, setPresenting] = React.useState(false)
const userOpen = openProp ?? _open
const open = presenting ? false : userOpen          // was: openProp ?? _open

const setOpen = React.useCallback((value: boolean | ((v: boolean) => boolean)) => {
  const openState = typeof value === 'function' ? value(userOpen) : value   // derive from the user's value, not the override
  setOpenProp ? setOpenProp(openState) : _setOpen(openState)
  document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
}, [setOpenProp, userOpen])

const toggleSidebar = React.useCallback(() => {
  if (presenting) { setPresenting(false); return }   // ⌘B, chevron, rail: "show my sidebar" = leave present mode; no cookie write
  return isMobile ? setOpenMobile(o => !o) : setOpen(o => !o)
}, [isMobile, presenting, setOpen])
// context value: add { presenting, setPresenting }
```

```tsx
// meeting-flow view (client): read/write present mode, restore on leave
const { presenting, setPresenting } = useSidebar()
useEffect(() => () => setPresenting(false), [setPresenting])   // idempotent under Strict Mode
// P toggles (window keydown, passive; ignore e.isComposing, modifier keys, and targets that are input/textarea/contenteditable);
// hide <header> when presenting; the footer prev/next bar is replaced by the Q2 capsule.
```

Behaviour: enter → sidebar animates to icon mode via the existing `transition-[width] duration-200`, cookie untouched; ⌘B / chevron → exits present mode, sidebar returns to the persisted value; navigate away → cleanup restores chrome; refresh → present mode ends, sidebar boots from the untouched cookie, `?step` preserved. On phones the override is a no-op (sheet sidebar); present mode there is "top bar hidden" plus Q3's nav removal.

### Q2 — `useIdleHidden` hook + kept-mounted capsule

```ts
// src/features/meeting-flow/hooks/use-idle-hidden.ts   (constants in constants/present-mode.ts: IDLE_HIDE_MS = 2500, MOVE_GATE_MS = 120)
export function useIdleHidden(targetRef: RefObject<HTMLElement | null>, enabled: boolean) {
  const [hidden, setHidden] = useState(false)
  const hiddenRef = useRef(false)
  useEffect(() => {
    if (!enabled) return
    const canHover = window.matchMedia('(hover: hover)').matches
    let timer: number | undefined
    let lastMove = 0
    const arm = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const el = targetRef.current
        if (el?.matches(canHover ? ':hover, :focus-within' : ':focus-within')) { arm(); return }  // never fade while hovered/focused
        hiddenRef.current = true; setHidden(true)
      }, IDLE_HIDE_MS)
    }
    const wake = () => { if (hiddenRef.current) { hiddenRef.current = false; setHidden(false) } ; arm() }
    const onMove = (e: PointerEvent) => { if (e.timeStamp - lastMove < MOVE_GATE_MS) return; lastMove = e.timeStamp; wake() }
    const opts: AddEventListenerOptions = { passive: true }
    document.addEventListener('pointermove', onMove, opts)
    for (const type of ['pointerdown', 'keydown', 'wheel', 'touchstart', 'focusin'] as const) document.addEventListener(type, wake, opts)
    arm()
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('pointermove', onMove)
      for (const type of ['pointerdown', 'keydown', 'wheel', 'touchstart', 'focusin'] as const) document.removeEventListener(type, wake)
    }
  }, [enabled, targetRef])
  return hidden
}
```

```tsx
// capsule (client component): stays mounted; opacity only; no AnimatePresence needed
<motion.div
  ref={ref}
  initial={false}
  animate={{ opacity: hidden ? 0 : 1 }}
  transition={{ duration: 0.2, ease: 'easeOut' }}   // opacity persists under MotionConfig reducedMotion="user"; pass duration 0 via useReducedMotion() only if an instant hide is wanted
  className={cn('fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 …', hidden && 'pointer-events-none')}
>
  <Button …>Previous</Button> <span>{step}/{TOTAL_STEPS}</span> <Button …>Next</Button>
</motion.div>
```

No `transition-all` anywhere on it; if a CSS fallback is ever used it is `transition-opacity motion-reduce:transition-none`. Keyboard users reveal it by tabbing (`focusin`); no `aria-hidden`.

### Q3 — `data-stage` opt-out via `:has()`

Files changed (no new files; `dashboard/layout.tsx` untouched, shape rule intact):

1. `src/app/(frontend)/dashboard/template.tsx` — `motion.main` gains `has-data-stage:p-0` (or `has-[[data-stage]]:p-0`).
2. `src/app/(frontend)/globals.css` — in the app-shell section next to `data-no-gutter-stable`: `[data-slot='sidebar-inset']:has([data-stage]) [data-slot='dashboard-mobile-nav'] { display: none; }`.
3. `src/features/agent-dashboard/ui/components/mobile-bottom-nav.tsx` — fixed wrapper gains `data-slot="dashboard-mobile-nav"`.
4. `src/features/meeting-flow/ui/views/meeting-flow.tsx` — root `div` gains `data-stage`; the footer gains `pb-[env(safe-area-inset-bottom)]` (the `pb-20` clearance it relied on is gone with the nav).
5. `docs/codebase-conventions/app-shell.md` — record the rule (`stage-routes-opt-out-with-data-stage`) so the next reader knows why the template has a `has-*` variant.

Fallback if the team prefers explicit route knowledge over CSS: (c) — `useSelectedLayoutSegments()` in the template and in `DashboardMobileNav` sharing one `isStageRoute(segments)` helper; same files minus `globals.css`, no flash either.

## Unverified

- The shadcn "Persisted State" (cookie) section: neither `ui.shadcn.com/docs/components/sidebar` nor `/docs/components/radix/sidebar` contains the word "cookie" today, and the GitHub raw MDX path 404'd. The mechanism is verified from the repo's `sidebar.tsx` and `dashboard/layout.tsx` only.
- Next.js docs pages fetched are the current site (v16.3.5 banner). 15.x behaviour was verified against the installed 15.5.9 source (`layout-router.js`, `bfcache.js`, `create-router-cache-key.js`, `navigation.js`) and context7 excerpts for v15.1.11; the "Search params do not trigger remounts" wording is v16 docs, the `// no search params` comment is 15.5.9 source.
- Whether two route groups may both contain a `meetings` folder with different leaves — docs forbid only identical resolved URLs; not tested.
- Dispatch order of `pointerdown` vs `touchstart` on the same tap: the Pointer Events spec states no mandatory order (only that compatibility mouse events are "interleaved"); the Touch Events spec orders `touchstart` before mouse events and marks `touchstart` cancelability as "Varies". The recommendation treats `touchstart` as a redundant safety net, so order does not matter.
- Motion docs' claim that `useReducedMotion` "will actively respond to changes" contradicts the 12.31.0 source (`useState` snapshot + TODO); treated as not live.
- nuqs `parseAsBoolean` URL serialisation (needed only if present mode is ever put in the URL) — not in the fetched excerpt; `history` defaults to `'replace'` and `clearOnDefault` to `true` per [nuqs options](https://nuqs.dev/docs/options).
- `focusin` reaching `window` (vs `document`) is not stated on the MDN page fetched; the hook attaches to `document`, which MDN's example uses.

## Sources

- Repo: `src/shared/components/ui/sidebar.tsx` · `src/app/(frontend)/dashboard/layout.tsx` · `src/app/(frontend)/dashboard/template.tsx` · `src/features/agent-dashboard/ui/components/{app-sidebar,mobile-bottom-nav,dashboard-mobile-nav}.tsx` · `src/features/meeting-flow/ui/views/meeting-flow.tsx` · `src/features/meeting-flow/ui/components/presentation/{snap-presentation,pinned-column}.tsx` · `src/features/meeting-flow/constants/{query-parsers,step-config,presentation-motion}.ts` · `src/shared/hooks/use-mobile.ts` · `src/shared/components/dialogs/modals/base-modal.tsx` · `src/app/(frontend)/globals.css` · `src/app/(frontend)/proposal-flow/layout.tsx` · `src/shared/config/roots.ts` · `docs/codebase-conventions/app-shell.md` · `docs/codebase-conventions/frontend-stack.md`
- Installed packages: `node_modules/next/dist/client/components/{layout-router,bfcache,navigation}.js` · `node_modules/next/dist/client/components/router-reducer/create-router-cache-key.js` · `node_modules/next/dist/server/app-render/create-component-tree.js` · `node_modules/motion/package.json`, `dist/react.d.ts`, `dist/es/react-client.mjs` · `node_modules/.pnpm/framer-motion@12.31.0_*/node_modules/framer-motion/dist/es/utils/reduced-motion/{use-reduced-motion,use-reduced-motion-config}.mjs`, `components/MotionConfig/index.mjs` · `node_modules/.pnpm/motion-dom@12.30.1/node_modules/motion-dom/dist/es/render/utils/reduced-motion/{state,index}.mjs`
- Next.js docs: https://nextjs.org/docs/app/api-reference/file-conventions/template · https://nextjs.org/docs/app/api-reference/file-conventions/layout · https://nextjs.org/docs/app/api-reference/file-conventions/route-groups · https://nextjs.org/docs/app/api-reference/functions/use-selected-layout-segment · https://nextjs.org/docs/app/api-reference/functions/use-selected-layout-segments · https://nextjs.org/docs/app/api-reference/functions/use-pathname · https://nextjs.org/docs/app/getting-started/project-structure · https://nextjs.org/docs/app/getting-started/linking-and-navigating · context7 `/vercel/next.js/v15.1.11` (template.mdx, layouts-and-templates.mdx)
- React docs: https://react.dev/reference/react/useEffect (cleanup, Strict Mode double-invoke) via context7 `/reactjs/react.dev`
- Motion docs: https://motion.dev/docs/react-quick-start · https://motion.dev/docs/react-motion-component · https://motion.dev/docs/react-motion-config · https://motion.dev/docs/react-use-reduced-motion · https://motion.dev/docs/react-animate-presence · https://motion.dev/docs/react-upgrade-guide · https://motion.dev/docs/react-accessibility (via context7 `/websites/motion_dev`)
- shadcn: https://ui.shadcn.com/docs/components/sidebar · https://ui.shadcn.com/docs/components/radix/sidebar
- MDN: EventTarget.addEventListener (passive/capture) · Element pointermove_event · pointerdown / Pointer_events · keydown_event · wheel_event · touchstart_event · focusin_event · Event.stopImmediatePropagation · Learn: Event bubbling · Element.matches · Document.cookie · Window.requestAnimationFrame · CSS `:has` · `:hover` · `:focus-within` · `@media/hover` · `@media/prefers-reduced-motion` · `transition` (all under https://developer.mozilla.org/en-US/docs/Web/)
- Specs: https://w3c.github.io/touch-events/ · https://w3c.github.io/pointerevents/
- Tailwind v4: https://tailwindcss.com/docs/hover-focus-and-other-states (has-*, in-*, motion-safe, arbitrary variants) · https://tailwindcss.com/docs/transition-property
- nuqs: https://nuqs.dev/docs/options · https://nuqs.dev/docs/parsers/built-in
