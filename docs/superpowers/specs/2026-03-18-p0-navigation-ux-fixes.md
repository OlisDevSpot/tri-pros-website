# P0 Navigation UX Fixes — Design Spec

**Date**: 2026-03-18
**Status**: Draft
**Scope**: 4 fixes — navbar session blocking, mobile menu close behavior, submenu page jump, centralized routing

---

## 1. Overview

Fix four broken UX patterns in the site navigation that cause visible user-facing issues: delayed navbar render, mobile menu not closing on navigate, page jumping on submenu click, and broken/hardcoded links.

### Goals

1. Navbar renders instantly — no blank state while session loads
2. Mobile popover closes with exit animation before navigating
3. Submenu parent clicks toggle the submenu without scrolling the page
4. All internal links use the centralized `ROOTS` config — zero hardcoded URL strings in components

### Non-Goals

- Restructuring the navbar into server + client components (future optimization)
- Adding new navigation items or changing the nav structure
- Fixing the mobile dashboard project editing (separate P1 item)

---

## 2. Fix 1: Navbar Session Blocking

### Problem

`SiteNavbar` (`src/shared/components/navigation/site-navbar.tsx`) returns `null` until a `mounted` state variable is true, which depends on `useSession()` resolving. This means the entire navbar is invisible during the session fetch.

### Solution

Remove the `!mounted` early return. Render the full navbar structure immediately. Only the auth button area should be session-dependent:

- While `sessionQuery.isPending`: render a skeleton placeholder (small pill matching the auth button dimensions)
- When `sessionQuery.data?.session` exists: render the "Log Out" button
- When no session: render the "Log In" button

**Hydration strategy:** Since `SiteNavbar` is already a `'use client'` component, and `useSession()` returns `isPending: true` on the initial client render, rendering a skeleton while `isPending` is true produces a consistent client render. The server does not render client components' initial state — Next.js streams the client component boundary. No `suppressHydrationWarning` needed. Just render skeleton when `isPending`, real button when resolved.

### Files

- Modify: `src/shared/components/navigation/site-navbar.tsx`

### Behavior

| State | Navbar | Auth Area |
|---|---|---|
| Initial render (SSR) | Full navbar visible | Empty or skeleton |
| Client hydration (session loading) | Full navbar visible | Skeleton placeholder |
| Session resolved (logged in) | Full navbar visible | "Log Out" button |
| Session resolved (not logged in) | Full navbar visible | "Log In" button |

---

## 3. Fix 2: Mobile Popover Close on Navigation

### Problem

`PopoverNav` (`src/shared/components/navigation/popover-nav.tsx`) does not close when a user clicks a navigation link. The menu stays open while the page navigates underneath it.

### Solution

When a nav item with `action: 'navigate'` is clicked inside the popover:

1. Intercept the click before navigation fires
2. Set `isPopoverOpen` to `false` — triggering the motion exit animation
3. After the exit animation completes, navigate to the target URL

For items with `action: 'readonly'` (submenu parents): do NOT close the menu — only expand/collapse the submenu as currently implemented.

### Implementation

**Step 1: Update `NavItem` to forward click events.**

Currently, `NavItem`'s `onClick` prop does not receive the native event object — it's called as `onClick?.()` without arguments. Update `NavItem` to pass the event: `onClick?.(e)`. This is necessary so the popover can call `e.preventDefault()` to stop the native `<Link>` navigation.

Update the `NavItem` props type: `onClick?: (e: React.MouseEvent) => void`

**Step 2: Use `onAnimationComplete` instead of `setTimeout`.**

The popover's exit animation uses `motion.div` with `type: 'tween'` (default duration ~300ms). Rather than hardcoding a timeout that could drift, use motion's `onAnimationComplete` callback on the popover's `AnimatePresence` exit.

In `SiteNavbar`:
```typescript
const pendingNavRef = useRef<string | null>(null)

function handlePopoverNavigate(href: string) {
  // Cancel any pending navigation from a previous rapid click
  pendingNavRef.current = href
  setIsPopoverOpen(false)
}

function handlePopoverExitComplete() {
  if (pendingNavRef.current) {
    router.push(pendingNavRef.current)
    pendingNavRef.current = null
  }
}
```

Wire `handlePopoverExitComplete` to the `AnimatePresence` `onExitComplete` callback (or the popover wrapper's `onAnimationComplete` with exit variant check).

**Step 3: Wire `PopoverNav` clicks.**

In `PopoverNav`, accept `onNavigate: (href: string) => void` prop. When rendering nav items with `action: 'navigate'`, pass:
```typescript
onClick={(e) => {
  e.preventDefault()
  onNavigate(item.href)
}}
```

**Note:** The `setIsOpen` prop is already passed to `PopoverNav` but aliased as `_setIsOpen` and unused. Rename it back to `setIsOpen` and use it, or use the new `onNavigate` pattern instead.

**Race condition handling:** The `pendingNavRef` pattern above naturally handles rapid double-clicks — the second click overwrites the pending href, so only the last-clicked destination fires after the exit animation.

### Files

- Modify: `src/shared/components/navigation/nav-item.tsx` — forward click event object in `onClick` prop
- Modify: `src/shared/components/navigation/popover-nav.tsx` — accept `onNavigate` prop, wire to nav link clicks
- Modify: `src/shared/components/navigation/site-navbar.tsx` — pass `onNavigate` handler, handle `onExitComplete`

---

## 4. Fix 3: Submenu Parent Page Jump

### Problem

`NavItem` (`src/shared/components/navigation/nav-item.tsx`) renders all items as `<a>` elements. For `action: 'readonly'` items (submenu parents), it sets `href="#"`. Clicking these causes the browser to scroll to the top of the page.

### Solution

Change `NavItem` to render a `<button>` element when `item.action === 'readonly'`, instead of an `<a>` element. The click handler already toggles the submenu — only the HTML element needs to change.

The button should be styled identically to the current anchor:
- Same padding, font, color, cursor
- `type="button"` to prevent form submission
- No `href` at all — buttons don't have `href`

For items with `action: 'navigate'`, continue rendering as `<a>` (or Next.js `Link`) as-is.

**Keyboard note:** This is an accessibility improvement. `<button>` activates on both Enter and Space, while `<a href="#">` only activates on Enter. The change is semantically correct — submenu toggles are interactive controls, not navigation links.

### Files

- Modify: `src/shared/components/navigation/nav-item.tsx`

---

## 5. Fix 4: Centralized Routing

### Problem

`ROOTS` (`src/shared/config/roots.ts`) only defines routes for portfolio and dashboard pages. Marketing routes (`/services/*`, `/about`, `/blog`, `/contact`, `/community/*`) are hardcoded strings in components and constants files. This caused the Luxury Renovations card to link to `/services/renovations` (doesn't exist) instead of `/services/luxury-renovations`.

### Solution

#### A. Extend ROOTS with all marketing routes

Add to the `landing` section of `ROOTS`:

```typescript
// New additions:
services: () => '/services',
servicesPillar: (pillarSlug: string) => `/services/${pillarSlug}`,
servicesTrade: (pillarSlug: string, tradeSlug: string) => `/services/${pillarSlug}/${tradeSlug}`,
about: () => '/about',
experience: () => '/experience',
blog: () => '/blog',
contact: () => '/contact',
communityCommitment: () => '/community/commitment',
communityJoin: () => '/community/join',
```

Keep the existing `portfolio()`, `portfolioProjects()`, `portfolioTestimonials()` methods.

#### B. Update all hardcoded URLs

Every file that contains a hardcoded marketing route string must be updated to use `ROOTS.landing.*`.

| File | Line(s) | Current Hardcoded Value | Replace With |
|------|---------|------------------------|--------------|
| `src/shared/constants/company/services.ts` | ~34, ~56 | `href` getter / `/services/renovations` | `ROOTS.landing.servicesPillar(slug)` for each service |
| `src/shared/constants/nav-items/marketing.ts` | Multiple | `/services/*`, `/community/*`, `/experience`, `/about`, `/blog` | `ROOTS.landing.*()` equivalents |
| `src/features/landing/ui/components/home/home-hero.tsx` | ~143 | `/portfolio` | `ROOTS.landing.portfolioProjects()` |
| `src/features/landing/ui/components/home/home-hero.tsx` | ~line | `/contact` | `ROOTS.landing.contact()` |
| `src/features/landing/ui/components/about/about-hero.tsx` | ~98 | `/contact` | `ROOTS.landing.contact()` |
| `src/features/landing/ui/components/about/about-hero.tsx` | ~108 | `/portfolio` | `ROOTS.landing.portfolioProjects()` |
| `src/features/landing/ui/components/about/credentials.tsx` | ~171 | `/contact` | `ROOTS.landing.contact()` |
| `src/features/landing/ui/components/home/photo-card.tsx` | ~15 | `/portfolio` | `ROOTS.landing.portfolioProjects()` |
| `src/features/landing/ui/components/services/services-hero.tsx` | Multiple | `/contact`, `/portfolio/projects` | `ROOTS.landing.contact()`, `ROOTS.landing.portfolioProjects()` |
| `src/features/landing/ui/views/services-overview-view.tsx` | Multiple | `/services/energy-efficient-construction`, `/services/luxury-renovations`, `/contact` | `ROOTS.landing.servicesPillar('...')`, `ROOTS.landing.contact()` |
| `src/features/landing/ui/views/pillar-view.tsx` | Multiple | `/contact` | `ROOTS.landing.contact()` |
| `src/features/landing/ui/components/services/trade-hero.tsx` | Multiple | `/services`, `/contact` | `ROOTS.landing.services()`, `ROOTS.landing.contact()` |
| `src/features/landing/ui/components/services/programs-teaser.tsx` | ~line | `/contact` | `ROOTS.landing.contact()` |
| `src/shared/components/navigation/site-navbar.tsx` | ~330 | `/contact` | `ROOTS.landing.contact()` |
| `src/features/landing/ui/components/services/trade-card.tsx` | ~line | `` `/services/${pillarSlug}/${trade.slug}` `` | `ROOTS.landing.servicesTrade(pillarSlug, trade.slug)` |

#### C. Fix the broken Luxury Renovations href

In `src/shared/constants/company/services.ts`, the Luxury Renovations entry uses a hardcoded `href: '/services/renovations'` which is wrong. The first service uses a `get href()` getter, while the rest use plain strings — inconsistent.

**Fix approach:** Remove the `as const` assertion from the `services` array (if present) since `ROOTS.*()` calls return `string`, which is incompatible with const narrowing. Then compute `href` at definition time for each service entry: `href: ROOTS.landing.servicesPillar('luxury-renovations')`. Apply consistently to all 4 services — no getters, no hardcoded strings. Import `ROOTS` from `@/shared/config/roots`.

---

## 6. Testing Checklist

After implementation, verify:

- [ ] Navbar renders instantly on page load (no blank flash)
- [ ] Auth button area shows skeleton, then resolves to correct state
- [ ] Mobile: clicking a nav link closes the menu with animation, then navigates
- [ ] Mobile: clicking a submenu parent expands the submenu, does NOT close menu
- [ ] Desktop + Mobile: clicking a submenu parent does NOT scroll the page to top
- [ ] Luxury Renovations card on homepage links to `/services/luxury-renovations`
- [ ] All `/portfolio` links go to `/portfolio/projects` (not bare `/portfolio`)
- [ ] All CTA "Schedule Consultation" buttons link to `/contact`
- [ ] Navigation dropdown hrefs all work correctly
- [ ] No hardcoded URL strings remain in component files (all use `ROOTS.*`)
- [ ] `pnpm lint` passes
