# P0 Navigation UX Fixes — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four broken navigation UX patterns — session-blocked navbar, non-closing mobile menu, page-jumping submenus, and hardcoded/broken links.

**Architecture:** All fixes are scoped to existing files. Task 1 extends the centralized `ROOTS` config. Task 2 fixes `NavItem` semantics (button for readonly + event forwarding). Task 3 removes the navbar session gate. Task 4 wires the popover close-on-navigate flow. Task 5 replaces all hardcoded URLs with `ROOTS.*` calls.

**Tech Stack:** Next.js 15, better-auth (`useSession`), motion/react (`AnimatePresence`), nuqs

**Spec:** `docs/superpowers/specs/2026-03-18-p0-navigation-ux-fixes.md`

---

## File Map

### Modified Files

| File | Changes |
|------|---------|
| `src/shared/config/roots.ts` | Add marketing route functions to `landing` section |
| `src/shared/components/navigation/nav-item.tsx` | Render `<button>` for readonly items; forward click event to `onClick` |
| `src/shared/components/navigation/site-navbar.tsx` | Remove `!mounted` guard; add `pendingNavRef` + `handlePopoverExitComplete`; replace hardcoded `/contact` |
| `src/shared/components/navigation/popover-nav.tsx` | Accept `onNavigate` prop; wire nav link clicks to call it; rename `_setIsOpen` |
| `src/shared/constants/company/services.ts` | Replace all `href` with `ROOTS.landing.servicesPillar(slug)`; remove `as const` |
| `src/shared/constants/nav-items/marketing.ts` | Replace all hardcoded hrefs with `ROOTS.landing.*()` |
| `src/features/landing/ui/components/home/home-hero.tsx` | Replace `/portfolio` and `/contact` with `ROOTS` |
| `src/features/landing/ui/components/home/photo-card.tsx` | Replace `/portfolio` with `ROOTS` |
| `src/features/landing/ui/components/about/about-hero.tsx` | Replace `/portfolio` and `/contact` with `ROOTS` |
| `src/features/landing/ui/components/about/credentials.tsx` | Replace `/contact` with `ROOTS` |
| `src/features/landing/ui/components/services/services-hero.tsx` | Replace `/contact` and `/portfolio/projects` with `ROOTS` |
| `src/features/landing/ui/views/services-overview-view.tsx` | Replace pillar hrefs and `/contact` with `ROOTS` |
| `src/features/landing/ui/views/pillar-view.tsx` | Replace `/contact` with `ROOTS` |
| `src/features/landing/ui/components/services/trade-hero.tsx` | Replace `/services` and `/contact` with `ROOTS` |
| `src/features/landing/ui/components/services/programs-teaser.tsx` | Replace `/contact` with `ROOTS` |
| `src/features/landing/ui/components/services/trade-card.tsx` | Replace template literal with `ROOTS.landing.servicesTrade()` |

---

## Task 1: Extend ROOTS with Marketing Routes

**Files:**
- Modify: `src/shared/config/roots.ts`

- [ ] **Step 1: Read the current `roots.ts`**

Read `src/shared/config/roots.ts` to understand the existing pattern. The `landing` section currently has `portfolio`, `portfolioProjects`, `portfolioTestimonials`. Each uses `generateUrl()` with optional `Options` parameter.

- [ ] **Step 2: Add marketing route functions**

Add these to the `landing` section of `APP_ROOTS`, following the exact same pattern as the existing portfolio entries:

```typescript
landing: {
  // Existing:
  portfolio: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/portfolio', options),
  portfolioProjects: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/portfolio/projects', options),
  portfolioTestimonials: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/portfolio/testimonials', options),
  // New:
  services: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/services', options),
  servicesPillar: (pillarSlug: string, options?: Parameters<typeof generateUrl>[1]) => generateUrl(`/services/${pillarSlug}`, options),
  servicesTrade: (pillarSlug: string, tradeSlug: string, options?: Parameters<typeof generateUrl>[1]) => generateUrl(`/services/${pillarSlug}/${tradeSlug}`, options),
  about: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/about', options),
  experience: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/experience', options),
  blog: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/blog', options),
  contact: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/contact', options),
  communityCommitment: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/community/commitment', options),
  communityJoin: (options?: Parameters<typeof generateUrl>[1]) => generateUrl('/community/join', options),
},
```

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: No errors on `roots.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/shared/config/roots.ts
git commit -m "feat(routing): add marketing routes to centralized ROOTS config"
```

---

## Task 2: Fix NavItem — Button for Readonly + Event Forwarding

**Files:**
- Modify: `src/shared/components/navigation/nav-item.tsx`

- [ ] **Step 1: Read the current `nav-item.tsx`**

Read `src/shared/components/navigation/nav-item.tsx`. Key observations:
- Line 14: `onClick?: () => void` — does NOT accept event
- Line 53-55: `onClick={() => { onClick?.() })` — fires without event
- Line 58-78: Always renders `<Link>` — even for `action: 'readonly'` with `href="#"`

- [ ] **Step 2: Update the `onClick` type to accept the event**

Change line 14 from:
```typescript
onClick?: () => void
```
to:
```typescript
onClick?: (e: React.MouseEvent) => void
```

- [ ] **Step 3: Forward the event in the click handler**

Change line 53-55 from:
```typescript
onClick={() => {
  onClick?.()
}}
```
to:
```typescript
onClick={(e) => {
  onClick?.(e)
}}
```

- [ ] **Step 4: Render `<button>` for readonly items, `<Link>` for navigate items**

Replace the single `<Link>` element (lines 58-78) with a conditional:

```typescript
{item.action === 'readonly'
  ? (
    <button
      type="button"
      className={cn(
        'relative inline-block px-6 py-3 2xl:px-8 2xl:py-4 hover:text-foreground/70 transition-colors duration-200 font-medium cursor-default',
        scrolled ? 'text-foreground' : 'text-foreground',
        isActive ? 'text-primary hover:text-primary' : '',
      )}
    >
      <div className="flex gap-2 items-center w-fit">
        {item.name}
        {item.subItems.length > 0 && (
          <ChevronUpIcon
            className={cn(
              'size-4 transition-transform -mr-2',
              selectedItemIndex === index || isActive ? 'rotate-180' : '',
            )}
          />
        )}
      </div>
    </button>
  )
  : (
    <Link
      href={item.href}
      className={cn(
        'relative inline-block px-6 py-3 2xl:px-8 2xl:py-4 hover:text-foreground/70 transition-colors duration-200 font-medium',
        scrolled ? 'text-foreground' : 'text-foreground',
        isActive ? 'text-primary hover:text-primary' : '',
      )}
    >
      <div className="flex gap-2 items-center w-fit">
        {item.name}
      </div>
    </Link>
  )}
```

This eliminates `href="#"` entirely. The chevron only shows for readonly items (which always have `subItems`).

**Note:** The `<button>` does NOT need its own `onClick` handler. Click events bubble from the button up to the parent `motion.div`, which already calls `onClick?.(e)`. All click handling remains on the parent wrapper — the button is purely for semantic correctness.

- [ ] **Step 5: Run lint**

Run: `pnpm lint`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/shared/components/navigation/nav-item.tsx
git commit -m "fix(nav): use button for submenu parents, forward click events"
```

---

## Task 3: Fix Navbar Session Blocking

**Files:**
- Modify: `src/shared/components/navigation/site-navbar.tsx`

- [ ] **Step 1: Read the current `site-navbar.tsx`**

Key lines to understand:
- Line 46: `const { data: session, isPending } = useSession()`
- Line 49: `const [mounted, setMounted] = useState(false)`
- Lines 88-92: `useEffect` that sets `mounted = true` when `isPending` becomes false
- Lines 103-104: `if (!mounted) return null` — THIS IS THE PROBLEM

- [ ] **Step 2: Remove the `mounted` state and its effect**

Delete:
- Line 49: `const [mounted, setMounted] = useState(false)`
- Lines 88-92: The entire `useEffect` that sets `mounted`
- Lines 103-104: `if (!mounted) return null`

- [ ] **Step 3: Replace the auth button area with a conditional on `isPending`**

Find the auth button section (around lines 247-274, inside the `!isMobile && matches['2xl']` block). Currently it checks `isPending` and shows a `SpinnerLoader2`. This pattern is already correct — it just wasn't reachable because the whole component returned `null`.

Verify that the existing `isPending ? <SpinnerLoader2 /> : <AuthButton>` pattern at lines 247-274 still works correctly now that the early return is removed. It should — the spinner shows while session loads, then the real button appears.

- [ ] **Step 4: Run lint**

Run: `pnpm lint`
Expected: No errors. The `mounted` variable and its effect are fully removed.

- [ ] **Step 5: Commit**

```bash
git add src/shared/components/navigation/site-navbar.tsx
git commit -m "fix(nav): remove session-blocking mounted guard from navbar"
```

---

## Task 4: Fix Popover Close on Navigation

**Files:**
- Modify: `src/shared/components/navigation/site-navbar.tsx`
- Modify: `src/shared/components/navigation/popover-nav.tsx`

- [ ] **Step 1: Add `pendingNavRef` and handlers to `SiteNavbar`**

In `src/shared/components/navigation/site-navbar.tsx`:

Add `useRef` to imports (already imported). Add `useRouter` from `next/navigation`:

```typescript
import { usePathname, useRouter } from 'next/navigation'
```

Inside the `SiteNavbar` function, add:

```typescript
const router = useRouter()
const pendingNavRef = useRef<string | null>(null)

function handlePopoverNavigate(href: string) {
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

- [ ] **Step 2: Wire `onExitComplete` to `PopoverNav`'s internal `AnimatePresence`**

**Important:** Do NOT put `onExitComplete` on the overlay `AnimatePresence` in `site-navbar.tsx` (lines 120-132). That overlay is shared between the desktop dropdown and the mobile popover — putting it there would cause false navigation triggers when the desktop menu closes.

Instead, add an `onExitComplete` prop to `PopoverNav`. In `popover-nav.tsx`, forward it to the component's own `AnimatePresence` (line 39):

```typescript
// In PopoverNav's interface, add:
onExitComplete?: () => void

// In PopoverNav's AnimatePresence (line 39):
<AnimatePresence onExitComplete={onExitComplete}>
```

Then in `site-navbar.tsx`, pass it:
```typescript
<PopoverNav
  isOpen={isPopoverOpen}
  setIsOpen={setIsPopoverOpen}
  navItems={getPopoverNavItems()}
  onNavigate={handlePopoverNavigate}
  onExitComplete={handlePopoverExitComplete}
/>
```

- [ ] **Step 3: Pass `onNavigate` to `PopoverNav`**

Update the `PopoverNav` render (around line 397-401):

```typescript
<PopoverNav
  isOpen={isPopoverOpen}
  setIsOpen={setIsPopoverOpen}
  navItems={getPopoverNavItems()}
  onNavigate={handlePopoverNavigate}
/>
```

- [ ] **Step 4: Update `PopoverNav` to accept and use `onNavigate`**

In `src/shared/components/navigation/popover-nav.tsx`:

Update the interface (line 18-22):
```typescript
interface MobileNavProps {
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  navItems: Partial<Record<DynamicNavSections, NavItemsGroup>>
  onNavigate: (href: string) => void
  onExitComplete?: () => void
}
```

Destructure `onNavigate` and `onExitComplete` (rename `_setIsOpen` back to `setIsOpen` while we're here):
```typescript
export function PopoverNav({
  isOpen,
  setIsOpen,
  navItems,
  onNavigate,
  onExitComplete,
}: MobileNavProps) {
```

Also update the `AnimatePresence` on line 39 to forward `onExitComplete`:
```typescript
<AnimatePresence onExitComplete={onExitComplete}>
```

- [ ] **Step 5: Wire nav link clicks to `onNavigate`**

For top-level items with `action: 'navigate'` (the `tpr-internal` and `marketing-links` sections), update the `onClick` handlers.

For `tpr-internal` items (around line 57-65): The current `onClick` only toggles submenus. For items with `action: 'navigate'`, add the `onNavigate` call:

```typescript
onClick={(e) => {
  if (item.action === 'navigate') {
    e.preventDefault()
    onNavigate(item.href)
  } else {
    setSelectedAgentItemIndex(prev => prev === index ? null : index)
  }
}}
```

Apply the same pattern for `marketing-links` items (around line 92-98):

```typescript
onClick={(e) => {
  if (item.action === 'navigate') {
    e.preventDefault()
    onNavigate(item.href)
  } else {
    setSelectedMarketingItemIndex(prev => prev === index ? null : index)
  }
}}
```

For **sub-items** (the expanded submenu links, around lines 76-83 and 110-120), these are always `action: 'navigate'`. Add `onNavigate`:

```typescript
<NavItem
  key={subItem.name}
  item={subItem}
  index={subItemIndex}
  isActive={false}
  onClick={(e) => {
    e.preventDefault()
    onNavigate(subItem.href)
  }}
  selectedItemIndex={null}
/>
```

- [ ] **Step 6: Run lint**

Run: `pnpm lint`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/shared/components/navigation/site-navbar.tsx src/shared/components/navigation/popover-nav.tsx
git commit -m "fix(nav): close mobile popover with exit animation before navigating"
```

---

## Task 5: Replace All Hardcoded URLs with ROOTS

**Files:**
- Modify: 12 files (see file map above)

This task is mechanical — find and replace hardcoded URL strings with `ROOTS.landing.*()` calls. Each file needs `import { ROOTS } from '@/shared/config/roots'` added (if not already present).

- [ ] **Step 1: Fix `marketing.ts` FIRST — update `ServiceSlugs` type before changing hrefs**

**This must come before `services.ts` changes** to avoid intermediate type errors.

Read `src/shared/constants/nav-items/marketing.ts`. The `ServiceSlugs` type (lines 80-83) is derived from nav item `href` template literals. Since `ROOTS.*()` returns `string`, the derivation will break. Replace the type machinery with a manual union:

```typescript
// DELETE lines 80-83 (ServiceSlugsRaw, RemoveServices, ServiceSlugs derivation)
// REPLACE with:
export type ServiceSlugs = 'energy-efficient-construction' | 'luxury-renovations' | 'commercial' | 'design-build'
```

Then replace all hardcoded hrefs (the `as const satisfies NavItem[]` can stay since `ROOTS.*()` returns `string` which satisfies `NavItem`'s `href: string`):

```typescript
// Experience:
href: ROOTS.landing.experience(),

// About:
href: ROOTS.landing.about(),

// Community:
{ name: 'Community Commitment', href: ROOTS.landing.communityCommitment(), action: 'navigate' },
{ name: 'Join Our Efforts', href: ROOTS.landing.communityJoin(), action: 'navigate' },

// Services:
{ name: 'Energy-Efficient Construction', href: ROOTS.landing.servicesPillar('energy-efficient-construction'), action: 'navigate' },
{ name: 'Luxury Renovations', href: ROOTS.landing.servicesPillar('luxury-renovations'), action: 'navigate' },
{ name: 'Design-Build Services', href: ROOTS.landing.servicesPillar('design-build'), action: 'navigate' },
{ name: 'Commercial Projects', href: ROOTS.landing.servicesPillar('commercial'), action: 'navigate' },

// Blog:
href: ROOTS.landing.blog(),
```

- [ ] **Step 2: Fix `services.ts` — the broken Luxury Renovations href**

Read `src/shared/constants/company/services.ts`. Currently:
- Line 34-36: Energy uses `get href() { return \`/services/\${this.slug}\` }` (getter)
- Line 56: Luxury uses `href: '/services/renovations'` (WRONG — hardcoded, incorrect slug)
- Lines 76, 96: Commercial and Design-Build also use hardcoded strings

Add `import { ROOTS } from '@/shared/config/roots'`. Replace ALL four `href` values consistently (no getters, no hardcoded strings):

```typescript
// Service 1 - energy-efficient-construction (replace getter):
href: ROOTS.landing.servicesPillar('energy-efficient-construction'),

// Service 2 - luxury-renovations (FIX THE BROKEN LINK):
href: ROOTS.landing.servicesPillar('luxury-renovations'),

// Service 3 - commercial:
href: ROOTS.landing.servicesPillar('commercial'),

// Service 4 - design-build:
href: ROOTS.landing.servicesPillar('design-build'),
```

Remove `as const` from line 99 if it causes type errors with the `ROOTS.*()` return values.

- [ ] **Step 3: Fix landing and shared component files**

For each of these files, add `import { ROOTS } from '@/shared/config/roots'` (if not present) and replace hardcoded hrefs:

**`home-hero.tsx`:** Replace `/contact` → `ROOTS.landing.contact()`, `/portfolio` → `ROOTS.landing.portfolioProjects()`

**`photo-card.tsx`:** Replace `/portfolio` → `ROOTS.landing.portfolioProjects()`. **Note:** This file uses `router.push('/portfolio')`, not an `href` attribute — replace the string inside `router.push()`.

**`about-hero.tsx`:** Replace `/contact` → `ROOTS.landing.contact()`, `/portfolio` → `ROOTS.landing.portfolioProjects()`

**`credentials.tsx`:** Replace `/contact` → `ROOTS.landing.contact()`

**`services-hero.tsx`:** Replace `/contact` → `ROOTS.landing.contact()`, `/portfolio/projects` → `ROOTS.landing.portfolioProjects()`

**`services-overview-view.tsx`:** Replace `/services/energy-efficient-construction` → `ROOTS.landing.servicesPillar('energy-efficient-construction')`, `/services/luxury-renovations` → `ROOTS.landing.servicesPillar('luxury-renovations')`, `/contact` → `ROOTS.landing.contact()`

**`pillar-view.tsx`:** Replace `/contact` → `ROOTS.landing.contact()`

**`trade-hero.tsx`:** Replace `/services` → `ROOTS.landing.services()`, `/contact` → `ROOTS.landing.contact()`

**`programs-teaser.tsx`:** Replace `/contact` → `ROOTS.landing.contact()`

**`trade-card.tsx`:** Replace `` `/services/${pillarSlug}/${trade.slug}` `` → `ROOTS.landing.servicesTrade(pillarSlug, trade.slug)`

**`site-navbar.tsx`:** Replace `/contact` (around line 330) → `ROOTS.landing.contact()`. The `ROOTS` import may already exist from Task 4 changes.

- [ ] **Step 4: Run lint**

Run: `pnpm lint`
Expected: No errors. Fix any import ordering issues the linter catches.

- [ ] **Step 5: Verify no hardcoded marketing URLs remain**

Search the codebase for any remaining hardcoded marketing routes:

```bash
grep -r "href=\"/services\|href=\"/contact\|href=\"/about\|href=\"/experience\|href=\"/blog\|href=\"/community\|href=\"/portfolio" src/ --include="*.tsx" --include="*.ts" -l
```

Expected: Only `roots.ts` itself should contain these path strings. If any other files appear, fix them.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "fix(routing): centralize all marketing URLs via ROOTS, fix broken Luxury Renovations link"
```

---

## Task 6: Final Verification

- [ ] **Step 1: Run full lint**

```bash
pnpm lint
```

Expected: Clean (only pre-existing migration JSON warnings).

- [ ] **Step 2: Manual testing checklist**

Verify in the browser (`pnpm dev`):

- [ ] Navbar renders instantly on page load — no blank flash
- [ ] Auth button area shows skeleton/spinner, then resolves
- [ ] Mobile: clicking a nav link closes the menu with smooth exit animation, THEN navigates
- [ ] Mobile: clicking a submenu parent (Services, Community, Portfolio) expands submenu, does NOT close menu
- [ ] Desktop + Mobile: clicking a submenu parent does NOT scroll page to top
- [ ] Homepage: Luxury Renovations card links to `/services/luxury-renovations` (not `/services/renovations`)
- [ ] All `/portfolio` links go to `/portfolio/projects`
- [ ] All "Schedule Consultation" CTAs link to `/contact`
- [ ] Navigation dropdown hrefs all work

- [ ] **Step 3: Commit if any polish was needed**

```bash
git add -A
git commit -m "chore(nav): final polish for P0 navigation fixes"
```
