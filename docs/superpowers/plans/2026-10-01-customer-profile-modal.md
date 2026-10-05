# Customer Profile Modal (identity rail and tab bar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the customer profile modal as a left identity rail on desktop and a bottom tab bar on phone, so Close and every create verb sit at the bottom edge, labeled and easy to tap.

**Architecture:** `CustomerProfileModalContent` owns the edit form, the commands, the tab and the scroller, and mounts exactly one arrangement, chosen by a shared `useMediaQuery` at `md` (768px): the desktop rail plus underline tabs, or the pinned phone hero plus a bottom tab bar. Both render the same tab panels inside one Radix `Tabs` root. Three shared primitives carry the reusable parts: a `bar` variant on the shadcn tabs, a presentational `ContactActionTrigger`, and an always-mounted `InlineSheet` (no portal, drag to close) that hosts the phone New sheet.

**Tech Stack:** Next.js 15.5, React 19 (ref as a prop), Tailwind v4.1.18, Radix Tabs / Dialog / DropdownMenu (shadcn wrappers in `src/shared/components/ui/`), class-variance-authority, react-hook-form, lucide-react, `next/link`, Playwright (`playwright` package) for verification.

**Spec:** `docs/superpowers/specs/2026-10-01-customer-profile-modal-design.md` (revised after the owner grill, 2026-10-01). Warm-up mocks: https://claude.ai/artifact/FaTVMLzSAgCRPBGormG1GF (Option B).

## Global Constraints

- Package manager pnpm. Verify with `pnpm tsc` and `pnpm exec eslint <changed paths>`; **never `pnpm build`**. Never run `pnpm lint:fix` repo-wide; fix only your own paths with `pnpm exec eslint --fix <paths>`.
- Shared working tree on `main` (the owner's live editor). Never `git stash`, `git checkout`, `git restore`, `git reset`, `git add` (any form). Commit only with `git commit -m "…" -- <explicit paths>` and confirm with `git show --stat HEAD`. Commit only if the owner chose per-task commits.
- This plan builds on uncommitted owner work already in the tree: `ROOTS.dashboard.proposals.newForMeeting` in `src/shared/config/roots.ts`, the pathname-change close in `src/shared/components/dialogs/modals/global-dialogs.tsx`, and the `next/link` changes in `customer-hero-actions.tsx` and `customer-meetings-list.tsx`. Committing `customer-meetings-list.tsx` by path also commits the owner's change in it, and a commit that uses `newForMeeting` does not build without `roots.ts`. If per-task commits were chosen, ask the controller before the first commit whether those owner changes go in first.
- Coding conventions: one React component per file; no file-level constants in component files (they go in a `constants/` folder; a cva definition goes in a sibling `*-variants.ts`, as `src/shared/components/block/block-variants.ts` does); named exports; types in `types/`; helpers in `lib/`; hooks in `hooks/`.
- Comments say why, never what. No banners, no citations of this plan or the spec in code.
- Links: every internal link is a `next/link` `Link`; `tel:`, `mailto:`, `sms:` and external URLs stay `<a>`. Nothing in this work calls the modal store's `close()` before navigating: `GlobalDialogs` closes the modal on a pathname change.
- Colors only from theme tokens (`bg-card`, `bg-muted`, `bg-popover`, `bg-background`, `border-border`, `text-muted-foreground`, `bg-primary`, `text-primary-foreground`, `bg-skeleton`). Areas that sit on the photo keep literal white/black (dark in both themes, wrapped in `dark`). Do not hand-pick oklch values. Text sizes from the Tailwind ramp only (`text-xs` and up); no `text-[…]`.
- Every transition carries `motion-reduce:transition-none`.
- Copy is unchanged from today except the new visible labels "Close" and "New".
- Breakpoint: the desktop arrangement mounts at ≥768px (`BREAKPOINTS.md` in `src/shared/constants/css-breakpoints.ts`), the phone arrangement below. Never render both and hide one with CSS.
- Files off limits: `src/shared/components/dialogs/modals/base-modal.tsx`; every file under `src/shared/components/ui/` except `tabs.tsx`; `src/shared/components/ui/sidebar-mobile-sheet.tsx`; everything under `src/trpc/` and `src/shared/db/`; `src/shared/entities/customers/dal/`; entity services; every `openModal` caller outside `src/shared/entities/customers/`.
- Verification recipe: dev server on `http://localhost:${PORT:-3000}`. Check `ss -ltnp | grep :${PORT:-3000}` before starting one; if a server is running and it is not yours, ask the controller before stopping it. Auth: `/api/dev/playwright-session?secret=<DEV_LOGIN_SECRET from .env.local>&role=super-admin&redirect=/dashboard/pipeline` (the super-admin fixture reaches pipeline cards). Open the modal by clicking the first card's name: `page.locator('[data-slot=card].cursor-pointer').first().locator('span.uppercase').first()`. When new classes do not show up: stop the dev server, `rm -rf .next`, restart.
- No data writes for testing: never save an edit, a note or a meeting from a script. Edit mode is entered and cancelled; Add note and Add meeting are the owner's hands-on check.
- Screenshots that leave the machine get personal values masked (the probe injects the mask).
- Docs (spec, plan, reports) stay uncommitted. Scripts under `.superpowers/` are gitignored and never committed.

## Review Focus

1. **One tree across the breakpoint.** Rotating a tablet or resizing a window across 768 with the modal open must swap arrangements without losing the tab, the highlighted meeting or an unsaved edit, and only one set of inputs may ever exist. Pinned by the probe's `singlePhoneInput` (Task 5) and the `resize` check in Task 6.
2. **Pinned phone hero.** Only the tab content scrolls; the hero never moves, and a tab switch starts the new tab at its top. Pinned by the probe's `heroPinned` and `tabResetsScroll` (Task 5).
3. **Drag versus tap on the New sheet.** A press on a row must still land, a short drag springs back, a drag past a quarter closes, and the click that ends a drag must not activate the row under the finger. Pinned by `primitives.mjs` (`tapLands`, `dragDoesNotClick`, Task 2) and the probe's `smallDragSnapsBack` / `dragCloses` (Task 5).
4. **Desktop size and the 640–767 band.** The dialog keeps 32px from every edge at 1024 and 1440, caps at 100rem at 1920 with equal sides, and stays fullscreen at 700 where the base modal would center it. Pinned by the probe's `size` and `fullscreen` (Task 5).
5. **Escape layering and a failed load.** Escape closes the New sheet or the proposal menu first and only then the modal; with the header X hidden, a failed profile query still offers Close. Pinned by `escStoppedBeforeDocument` (Task 2), the probe's `escClosesSheetOnly`, `menuEscKeepsModal`, `errorClose` (Task 5) and `keyboardDesktop` / `keyboardPhone` (Task 6).

---

## File structure

| File | Responsibility |
|---|---|
| `src/shared/hooks/use-media-query.ts` (new) | `useMediaQuery(query)` on `useSyncExternalStore` |
| `src/shared/components/ui/tabs.tsx` (modify) | `bar` variant for list and trigger; export `tabsTriggerVariants` |
| `src/shared/components/contact-actions/ui/contact-action-trigger-variants.ts` (new) | cva: `shape` row/round × `surface` card/image; `ContactActionSurface` type |
| `src/shared/components/contact-actions/ui/contact-action-trigger.tsx` (new) | presentational trigger, forwards every prop and its ref |
| `src/shared/constants/drag-to-close.ts` (new) | drag thresholds |
| `src/shared/constants/inline-sheet.ts` (new) | selector of the sheet's native-scroll region |
| `src/shared/hooks/use-drag-to-close.ts` (new) | drag-to-close behavior ported from `sidebar-mobile-sheet.tsx` |
| `src/shared/components/dialogs/sheets/inline-sheet.tsx` (new) | always-mounted sheet + backdrop, Escape, focus, inert |
| `src/shared/components/dialogs/sheets/inline-sheet-body.tsx` (new) | the sheet's scrollable region |
| `src/shared/entities/customers/types/profile-modal.ts` (new) | `CustomerProfileTab`, `NewSheetChoice`, `NewSheetStep`, `ProfileCommands` |
| `src/shared/entities/customers/constants/profile-modal.ts` (new) | media query, sheet ids, tab labels/icons, New sheet items |
| `src/shared/entities/customers/lib/format-profile-meeting.ts` (new) | `formatMeetingType`, `formatMeetingDate` |
| `src/shared/entities/customers/hooks/use-profile-commands.ts` (new) | permissions + Add meeting / Add note dialog state |
| `…/components/profile/customer-profile-command-dialogs.tsx` (new) | the two dialogs, mounted once |
| `…/components/profile/customer-proposal-picker.tsx` (new) | meeting list for New proposal, as menu items or a plain list of `Link`s |
| `…/components/profile/customer-contact-input-row.tsx` (new) | edit-mode input on a contact row |
| `…/components/profile/customer-contact-add-trigger.tsx` (new) | "Add address/phone/email" row |
| `…/components/profile/customer-contact-address-row.tsx` (new) | address row with `AddressAction` |
| `…/components/profile/customer-contact-phone-row.tsx` (new) | phone row / input / placeholder with `PhoneAction` |
| `…/components/profile/customer-contact-email-row.tsx` (new) | email row / input / placeholder with `EmailAction` |
| `…/components/profile/customer-contact-buttons.tsx` (new) | round call and email buttons on the photo |
| `…/components/profile/customer-edit-toggle.tsx` (new) | pencil / save-cancel (moved out of the header) |
| `…/components/profile/customer-hero-header.tsx` (rewrite) | name row + contacts for `layout: 'rail' \| 'photo'`, owns the address dialog |
| `…/components/profile/customer-profile-tab-bar-trigger.tsx` (new) | one tab of the bar, icon + label + count |
| `…/components/profile/customer-profile-new-button.tsx` (new) | raised New disc |
| `…/components/profile/customer-profile-tab-bar.tsx` (new) | 5-column bar: Close, New, tablist |
| `…/components/profile/customer-profile-new-menu.tsx` (new) | step 1 of the New sheet |
| `…/components/profile/customer-profile-new-sheet.tsx` (new) | New sheet on `InlineSheet`, steps |
| `…/components/profile/customer-profile-phone-hero.tsx` (new) | pinned photo hero |
| `…/components/profile/customer-profile-tab-panels.tsx` (new) | the three `TabsContent` panels |
| `…/components/profile/customer-profile-phone-layout.tsx` (new) | hero, scroller, tab bar, sheet |
| `…/components/profile/customer-hero-actions.tsx` (rewrite) | rail command stack |
| `…/components/profile/customer-profile-rail.tsx` (new) | desktop rail |
| `…/components/profile/customer-profile-desktop-layout.tsx` (new) | rail, underline tabs, scroller |
| `…/components/profile/customer-profile-loading-skeleton.tsx` (new) | skeleton in the new shape |
| `…/components/profile/customer-profile-modal-content.tsx` (rewrite) | state + picks one arrangement |
| `…/components/profile/customer-profile-modal.tsx` (modify) | shell size, no header actions, error Close |
| `…/components/profile/customer-profile-overview.tsx` (modify) | single column below `xl`, no inner scrollers |
| `…/components/lists/customer-meetings-list.tsx` (modify) | drop the Add Meeting popover and `customerName` |

`…` is `src/shared/entities/customers`. Verification scripts (gitignored): `.superpowers/sdd/customer-profile-modal/{probe,primitives,t6-checks}.mjs`. Temporary, never committed: `src/app/(frontend)/dev/primitives-check/page.tsx` (created and deleted inside Task 2).

---

### Task 1: Foundation (probe, media hook, types, constants, commands, picker)

**Files:**
- Create: `.superpowers/sdd/customer-profile-modal/probe.mjs` (gitignored)
- Create: `src/shared/hooks/use-media-query.ts`
- Create: `src/shared/entities/customers/types/profile-modal.ts`
- Create: `src/shared/entities/customers/constants/profile-modal.ts`
- Create: `src/shared/entities/customers/lib/format-profile-meeting.ts`
- Create: `src/shared/entities/customers/hooks/use-profile-commands.ts`
- Create: `src/shared/entities/customers/components/profile/customer-profile-command-dialogs.tsx`
- Create: `src/shared/entities/customers/components/profile/customer-proposal-picker.tsx`

**Interfaces:**
- Produces: `useMediaQuery(query: string): boolean`; types `CustomerProfileTab = 'overview' | 'meetings' | 'projects'`, `NewSheetChoice = 'proposal' | 'meeting' | 'note'`, `NewSheetStep = 'menu' | 'proposal'`, `ProfileCommands { canAddMeeting, canAddProposal, meetingOpen, noteOpen: boolean; openMeeting, openNote: () => void; setMeetingOpen, setNoteOpen: (open: boolean) => void }`; constants `PROFILE_RAIL_MEDIA_QUERY`, `PROFILE_NEW_SHEET_ID`, `PROFILE_NEW_SHEET_TITLE_ID`, `PROFILE_TAB_LABELS`, `PROFILE_TAB_ICONS`, `NEW_SHEET_ITEMS`; `formatMeetingType(t: string | null): string`, `formatMeetingDate(d: CustomerProfileMeeting['scheduledFor']): string`; `useProfileCommands(): ProfileCommands`; `<CustomerProfileCommandDialogs commands customer onMutationSuccess />`; `<CustomerProposalPicker meetings onAddMeeting presentation: 'menu' | 'list' />`.

- [ ] **Step 1: Write the probe (the failing test for the whole build)**

Create `.superpowers/sdd/customer-profile-modal/probe.mjs`:

```js
import { mkdirSync, readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const secret = readFileSync('.env.local', 'utf8').match(/^DEV_LOGIN_SECRET=(.*)$/m)[1].trim()
const BASE = `http://localhost:${process.env.PORT ?? 3000}`
const OUT = '.playwright-mcp'
mkdirSync(OUT, { recursive: true })
const VIEWPORTS = [['desktop', 1440, 900], ['laptop', 1024, 768], ['wide', 1920, 1080], ['narrow', 700, 900], ['phone', 390, 844]]
const CARD = '[data-slot=card].cursor-pointer'
const MASK = `[role=dialog] h2,[role=dialog] p,[role=dialog] dd,[role=dialog] li,[role=dialog] [title],[role=dialog] img,[role=dialog] [aria-label^="Call"],[role=dialog] [aria-label^="Email"]{filter:blur(7px)!important} body>:not([role=dialog]):not([data-slot=dialog-overlay]):not(style):not(script){filter:blur(9px)!important} nextjs-portal{display:none!important}`
const wait = ms => new Promise(r => setTimeout(r, ms))
const inBand = v => v >= 24 && v <= 40

async function signIn(page, redirect) {
  await page.goto(`${BASE}/api/dev/playwright-session?secret=${secret}&role=super-admin&redirect=${redirect}`, { timeout: 120000 })
}

async function clickFirstCard(page) {
  const card = page.locator(CARD).first()
  await card.waitFor({ timeout: 60000 })
  await card.locator('span.uppercase').first().click()
}

async function openProfile(page) {
  await signIn(page, '/dashboard/pipeline')
  await clickFirstCard(page)
  const dialog = page.getByRole('dialog').first()
  await dialog.locator('[data-profile-scroller]').waitFor({ timeout: 30000 })
  await wait(800)
  return dialog
}

async function shoot(page, file) {
  const style = await page.addStyleTag({ content: MASK })
  await page.screenshot({ path: `${OUT}/${file}` })
  await style.evaluate(el => el.remove())
}

// Drags the sheet by its handle. A slow drag keeps the release velocity well under the flick threshold.
async function dragSheet(page, sheet, dy, slow) {
  const hb = await sheet.locator('[data-inline-sheet-handle]').boundingBox()
  const x = hb.x + hb.width / 2
  const y = hb.y + hb.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  const steps = slow ? dy : 10
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x, y + (dy * i) / steps)
    if (slow) {
      await wait(20)
    }
  }
  if (slow) {
    await wait(100)
  }
  await page.mouse.up()
  await wait(450)
}

async function phoneChecks(page, dialog, r, name, w, h) {
  const bar = dialog.locator('[data-profile-tab-bar]')
  const buttons = bar.locator('button')
  const boxes = await buttons.evaluateAll(els => els.map((e) => {
    const b = e.getBoundingClientRect()
    return { label: e.textContent.trim().replace(/\d+/g, ''), x: b.x, width: b.width, height: b.height }
  }))
  r.barSlots = boxes.length === 5
  r.barTargets44 = boxes.every(b => b.width >= 44 && b.height >= 44)
  r.barOrder = boxes.sort((a, b) => a.x - b.x).map(b => b.label).join(',') === 'Close,Overview,New,Meetings,Projects'
  r.tablistValid = await bar.locator('[role=tablist]').evaluate(el => [...el.children].every(c => c.getAttribute('role') === 'tab'))
  const cb = await bar.getByRole('button', { name: 'Close', exact: true }).boundingBox()
  r.closeBottomLeft = cb.y + cb.height >= h - 100 && cb.x < w / 2

  const scroller = dialog.locator('[data-profile-scroller]')
  const hero = dialog.locator('[data-profile-hero]')
  const heroBefore = await hero.boundingBox()
  const canScroll = await scroller.evaluate(el => el.scrollHeight - el.clientHeight > 100)
  if (canScroll) {
    await scroller.evaluate(el => el.scrollTo(0, el.scrollHeight))
    await wait(300)
    const heroAfter = await hero.boundingBox()
    r.heroPinned = Math.abs(heroAfter.y - heroBefore.y) < 1 && Math.abs(heroAfter.height - heroBefore.height) < 1
  }
  else {
    r.heroPinned = 'skip: overview is shorter than the scroller'
  }
  await bar.getByRole('tab', { name: /^Meetings/ }).click()
  await wait(300)
  r.tabResetsScroll = canScroll ? (await scroller.evaluate(el => el.scrollTop)) === 0 : 'skip: overview is shorter than the scroller'
  r.noDupAddMeeting = (await dialog.getByRole('button', { name: 'Add Meeting', exact: true }).count()) === 0
  await bar.getByRole('tab', { name: /^Overview/ }).click()

  const sheet = dialog.locator('[data-inline-sheet]')
  const newButton = bar.getByRole('button', { name: 'New', exact: true })
  await newButton.click()
  await wait(400)
  r.sheetOpens = (await sheet.getAttribute('data-state')) === 'open'
  await shoot(page, `customer-profile-${name}-sheet-light.png`)
  await sheet.getByRole('button', { name: /New proposal/ }).click()
  r.pickerStep = await sheet.getByRole('button', { name: 'Back' }).isVisible()
  await sheet.getByRole('button', { name: 'Back' }).click()
  r.backToMenu = await sheet.getByRole('button', { name: /Add note/ }).isVisible()
  await page.keyboard.press('Escape')
  await wait(400)
  r.escClosesSheetOnly = (await sheet.getAttribute('data-state')) === 'closed' && await dialog.isVisible()

  await newButton.click()
  await wait(400)
  const openBox = await sheet.boundingBox()
  await dragSheet(page, sheet, 10, true)
  const afterSmall = await sheet.boundingBox()
  r.smallDragSnapsBack = (await sheet.getAttribute('data-state')) === 'open' && Math.abs(afterSmall.y - openBox.y) < 1
  await dragSheet(page, sheet, Math.round(openBox.height * 0.35), false)
  r.dragCloses = (await sheet.getAttribute('data-state')) === 'closed'

  await dialog.getByRole('button', { name: 'Edit customer' }).click()
  await wait(300)
  r.editModePhone = await dialog.getByRole('textbox', { name: 'Customer name' }).isVisible() && await bar.isVisible()
  r.singlePhoneInput = (await page.locator('input[name="phone"]').count()) === 1
  await dialog.getByRole('button', { name: 'Cancel editing' }).click()
}

async function desktopChecks(page, dialog, r, name, w, h) {
  const box = await page.locator('[data-slot=dialog-content]').first().boundingBox()
  const gaps = { left: box.x, right: w - box.x - box.width, top: box.y, bottom: h - box.y - box.height }
  // At 1920 the width cap (100rem) wins, so the sides are equal but wider than 32px.
  r.size = name === 'wide'
    ? box.height >= h * 0.9 && inBand(gaps.top) && inBand(gaps.bottom) && Math.abs(gaps.left - gaps.right) <= 2 && gaps.left >= 24
    : box.width >= w * 0.9 && box.height >= h * 0.9 && Object.values(gaps).every(inBand)
  r.railWidth = Math.round((await dialog.locator('[data-profile-rail]').boundingBox()).width) === 380
  r.mapHeight = Math.round((await dialog.locator('[data-profile-map]').boundingBox()).height) === 190
  r.underlineTabs = await dialog.locator('[data-variant="underline"]').isVisible()
  const cb = await dialog.getByRole('button', { name: /^Close/ }).boundingBox()
  r.closeBottomLeft = cb.y + cb.height >= box.y + box.height - 80 && cb.x < box.x + 380

  const trigger = dialog.getByRole('button', { name: /New proposal/ })
  const tb = await trigger.boundingBox()
  await trigger.click()
  await wait(300)
  const menu = page.getByRole('menu')
  const mb = await menu.boundingBox()
  r.menuOpensUp = mb.y + mb.height <= tb.y + 1
  await page.keyboard.press('Escape')
  await wait(300)
  r.menuEscKeepsModal = (await menu.count()) === 0 && await dialog.isVisible()
}

async function pickerNavigates(page) {
  await clickFirstCard(page)
  const dialog = page.getByRole('dialog').first()
  await dialog.locator('[data-profile-scroller]').waitFor({ timeout: 30000 })
  await dialog.getByRole('button', { name: /New proposal/ }).click()
  await wait(300)
  const menu = page.getByRole('menu')
  if (await menu.getByText('No meetings yet').count()) {
    return 'skip: the fixture customer has no meetings'
  }
  await menu.getByRole('menuitem').first().click()
  await page.waitForURL(/\/dashboard\/proposals\/new\?meetingId=/, { timeout: 60000 })
  await wait(800)
  return (await page.getByRole('dialog').count()) === 0
}

async function errorClose(browser, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } })
  const page = await ctx.newPage()
  await signIn(page, '/dashboard/pipeline')
  await page.route('**/api/trpc/**getCustomerProfile**', route => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }))
  await clickFirstCard(page)
  const dialog = page.getByRole('dialog').first()
  // The client retries a 500 before giving up, so wait for the error state rather than a fixed time.
  await dialog.getByText('Failed to load profile').waitFor({ timeout: 15000 })
  const ok = await dialog.getByRole('button', { name: 'Close', exact: true }).filter({ visible: true }).count() > 0
  await ctx.close()
  return ok
}

const results = {}
const browser = await chromium.launch()
for (const [name, w, h] of VIEWPORTS) {
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme })
    const page = await ctx.newPage()
    const r = {}
    try {
      const dialog = await openProfile(page)
      const isPhone = w < 768
      await shoot(page, `customer-profile-${name}-${scheme}.png`)
      r.topCloseHidden = await page.locator('[data-modal-close]').first().isHidden()
      if (isPhone) {
        const box = await page.locator('[data-slot=dialog-content]').first().boundingBox()
        r.fullscreen = Math.abs(box.width - w) <= 1 && Math.abs(box.height - h) <= 1
      }
      if (scheme === 'light') {
        if (isPhone) {
          await phoneChecks(page, dialog, r, name, w, h)
        }
        else {
          await desktopChecks(page, dialog, r, name, w, h)
        }
      }
      await page.keyboard.press('Escape')
      await wait(500)
      r.escClosesModal = (await page.getByRole('dialog').count()) === 0
      if (name === 'desktop' && scheme === 'light') {
        r.pickerNavigates = await pickerNavigates(page)
      }
      if (name === 'phone' && scheme === 'light') {
        r.errorClose = await errorClose(browser, w, h)
      }
    }
    catch (e) {
      r.error = String(e.message).split('\n')[0]
    }
    results[`${name}-${scheme}`] = r
    await ctx.close()
  }
}
await browser.close()
console.log(JSON.stringify(results, null, 1))
const failed = Object.entries(results).flatMap(([k, r]) => Object.entries(r).filter(([, v]) => v === false || (typeof v === 'string' && !v.startsWith('skip'))).map(([c]) => `${k}.${c}`))
console.log(failed.length ? `FAILED: ${failed.join(', ')}` : 'ALL PASS')
process.exit(failed.length ? 1 : 0)
```

- [ ] **Step 2: Run the probe against today's modal to confirm it fails**

Run: `node .superpowers/sdd/customer-profile-modal/probe.mjs`
Expected: exit 1, `FAILED:` listing `<viewport>-<scheme>.error` for every context, each error a timeout waiting for `[data-profile-scroller]` (today's modal has no such element). If it fails earlier (login, no pipeline cards, no dev server), stop and report NEEDS_CONTEXT.

- [ ] **Step 3: Write the media query hook**

Create `src/shared/hooks/use-media-query.ts`:

```ts
'use client'

import { useCallback, useSyncExternalStore } from 'react'

// Reads the query during render, so a component that mounts client-side (a dialog opened on a
// click) gets the right answer on its first render instead of rendering the wrong layout and
// correcting in an effect. During hydration React uses the server snapshot, so markup matches.
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const mql = window.matchMedia(query)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}
```

- [ ] **Step 4: Write the types**

Create `src/shared/entities/customers/types/profile-modal.ts`:

```ts
export type CustomerProfileTab = 'overview' | 'meetings' | 'projects'

export type NewSheetChoice = 'proposal' | 'meeting' | 'note'

export type NewSheetStep = 'menu' | 'proposal'

export interface ProfileCommands {
  canAddMeeting: boolean
  canAddProposal: boolean
  meetingOpen: boolean
  noteOpen: boolean
  openMeeting: () => void
  openNote: () => void
  setMeetingOpen: (open: boolean) => void
  setNoteOpen: (open: boolean) => void
}
```

`@/shared/entities/customers/types` keeps resolving to the existing `src/shared/entities/customers/types.ts` (the folder has no `index.ts`); the new file is imported by its full path.

- [ ] **Step 5: Write the constants**

Create `src/shared/entities/customers/constants/profile-modal.ts`:

```ts
import type { LucideIcon } from 'lucide-react'
import type { CustomerProfileTab, NewSheetChoice } from '@/shared/entities/customers/types/profile-modal'
import { ActivityIcon, CalendarIcon, FileTextIcon, FolderIcon, StickyNoteIcon } from 'lucide-react'
import { BREAKPOINTS } from '@/shared/constants/css-breakpoints'

// The rail needs 380px beside a usable pane; below md the profile is the phone arrangement.
export const PROFILE_RAIL_MEDIA_QUERY = `(min-width: ${BREAKPOINTS.md}px)`

export const PROFILE_NEW_SHEET_ID = 'customer-profile-new-sheet'

export const PROFILE_NEW_SHEET_TITLE_ID = 'customer-profile-new-sheet-title'

export const PROFILE_TAB_LABELS: Record<CustomerProfileTab, string> = {
  overview: 'Overview',
  meetings: 'Meetings',
  projects: 'Projects',
}

export const PROFILE_TAB_ICONS: Record<CustomerProfileTab, LucideIcon> = {
  overview: ActivityIcon,
  meetings: CalendarIcon,
  projects: FolderIcon,
}

export const NEW_SHEET_ITEMS: { id: NewSheetChoice, label: string, description?: string, icon: LucideIcon }[] = [
  { id: 'proposal', label: 'New proposal', description: 'Attach it to a meeting', icon: FileTextIcon },
  { id: 'meeting', label: 'Add meeting', icon: CalendarIcon },
  { id: 'note', label: 'Add note', icon: StickyNoteIcon },
]
```

- [ ] **Step 6: Move the meeting formatters to `lib/`**

Create `src/shared/entities/customers/lib/format-profile-meeting.ts` (same bodies as the two functions in today's `customer-hero-actions.tsx`, which Task 5 rewrites):

```ts
import type { CustomerProfileMeeting } from '@/shared/entities/customers/types'

export function formatMeetingType(t: string | null): string {
  if (!t) {
    return 'Meeting'
  }
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function formatMeetingDate(d: CustomerProfileMeeting['scheduledFor']): string {
  if (!d) {
    return 'Unscheduled'
  }
  const date = new Date(d)
  return Number.isNaN(date.getTime())
    ? 'Unscheduled'
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
```

- [ ] **Step 7: Write the commands hook**

Create `src/shared/entities/customers/hooks/use-profile-commands.ts`:

```ts
'use client'

import type { ProfileCommands } from '@/shared/entities/customers/types/profile-modal'
import { useState } from 'react'
import { useAbility } from '@/shared/domains/permissions/hooks'

// The rail and the phone New sheet are two entry points to the same verbs; holding the dialog
// state here lets CustomerProfileCommandDialogs mount each dialog once for both.
export function useProfileCommands(): ProfileCommands {
  const ability = useAbility()
  const [meetingOpen, setMeetingOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)

  return {
    canAddMeeting: ability.can('create', 'Meeting'),
    canAddProposal: ability.can('create', 'Proposal'),
    meetingOpen,
    noteOpen,
    openMeeting: () => setMeetingOpen(true),
    openNote: () => setNoteOpen(true),
    setMeetingOpen,
    setNoteOpen,
  }
}
```

- [ ] **Step 8: Write the command dialogs**

Create `src/shared/entities/customers/components/profile/customer-profile-command-dialogs.tsx`:

```tsx
'use client'

import type { CustomerProfileData } from '@/shared/entities/customers/types'
import type { ProfileCommands } from '@/shared/entities/customers/types/profile-modal'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog'
import { CreateMeetingForm } from '@/shared/entities/meetings/components/create-meeting-form'
import { QuickNoteInput } from '../timeline/quick-note-input'

interface Props {
  commands: ProfileCommands
  customer: CustomerProfileData['customer']
  onMutationSuccess: () => void
}

export function CustomerProfileCommandDialogs({ commands, customer, onMutationSuccess }: Props) {
  return (
    <>
      <Dialog onOpenChange={commands.setMeetingOpen} open={commands.meetingOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add meeting</DialogTitle>
          </DialogHeader>
          <CreateMeetingForm
            customerId={customer.id}
            customerName={customer.name}
            onCancel={() => commands.setMeetingOpen(false)}
            onSuccess={() => {
              commands.setMeetingOpen(false)
              onMutationSuccess()
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={commands.setNoteOpen} open={commands.noteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add note</DialogTitle>
          </DialogHeader>
          <QuickNoteInput
            customerId={customer.id}
            onSuccess={() => {
              commands.setNoteOpen(false)
              onMutationSuccess()
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 9: Write the proposal picker**

Create `src/shared/entities/customers/components/profile/customer-proposal-picker.tsx`:

```tsx
'use client'

import type { CustomerProfileMeeting } from '@/shared/entities/customers/types'
import { CalendarIcon, CalendarPlusIcon } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/shared/components/ui/button'
import { DropdownMenuItem, DropdownMenuLabel } from '@/shared/components/ui/dropdown-menu'
import { ROOTS } from '@/shared/config/roots'
import { formatMeetingDate, formatMeetingType } from '@/shared/entities/customers/lib/format-profile-meeting'

interface Props {
  meetings: CustomerProfileMeeting[]
  onAddMeeting: () => void
  // `menu` renders inside a DropdownMenuContent (rail); `list` renders inside the phone New sheet,
  // whose own header already names the step.
  presentation: 'menu' | 'list'
}

// A proposal always attaches to a meeting, so the picker makes that choice explicit and routes an
// empty list straight to booking one. Navigating away closes the profile (GlobalDialogs).
export function CustomerProposalPicker({ meetings, onAddMeeting, presentation }: Props) {
  const isMenu = presentation === 'menu'

  const rows = meetings.map((m) => {
    const content = (
      <>
        <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{formatMeetingType(m.meetingType)}</span>
          <span className="truncate text-xs text-muted-foreground">
            {formatMeetingDate(m.scheduledFor)}
            {m.meetingOutcome ? ` · ${m.meetingOutcome.replace(/_/g, ' ')}` : ''}
          </span>
        </span>
      </>
    )
    return isMenu
      ? (
          <DropdownMenuItem asChild key={m.id}>
            <Link className="flex cursor-pointer items-center gap-2" href={ROOTS.dashboard.proposals.newForMeeting(m.id)}>
              {content}
            </Link>
          </DropdownMenuItem>
        )
      : (
          <li key={m.id}>
            <Link
              className="flex min-h-12 w-full items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted motion-reduce:transition-none"
              href={ROOTS.dashboard.proposals.newForMeeting(m.id)}
            >
              {content}
            </Link>
          </li>
        )
  })

  const empty = (
    <div className="px-2 py-3 text-center">
      <CalendarIcon className="mx-auto mb-1.5 size-5 text-muted-foreground" />
      <p className="text-sm font-medium">No meetings yet</p>
      <p className="mb-2.5 text-xs text-muted-foreground">A proposal is built against a meeting.</p>
      {isMenu
        ? (
            <DropdownMenuItem className="cursor-pointer justify-center bg-secondary font-medium" onSelect={onAddMeeting}>
              <CalendarPlusIcon className="size-4" />
              Add a meeting first
            </DropdownMenuItem>
          )
        : (
            <Button className="h-11 w-full" onClick={onAddMeeting} variant="outline">
              <CalendarPlusIcon className="size-4" />
              Add a meeting first
            </Button>
          )}
    </div>
  )

  if (!isMenu) {
    return meetings.length === 0 ? empty : <ul className="flex flex-col gap-1">{rows}</ul>
  }

  return (
    <>
      <DropdownMenuLabel className="flex flex-col gap-0.5">
        <span>New proposal</span>
        <span className="text-xs font-normal text-muted-foreground">Attach it to a meeting</span>
      </DropdownMenuLabel>
      {meetings.length === 0 ? empty : rows}
    </>
  )
}
```

- [ ] **Step 10: Type-check and lint**

Run: `pnpm tsc && pnpm exec eslint --fix src/shared/hooks/use-media-query.ts src/shared/entities/customers/types/profile-modal.ts src/shared/entities/customers/constants/profile-modal.ts src/shared/entities/customers/lib/format-profile-meeting.ts src/shared/entities/customers/hooks/use-profile-commands.ts src/shared/entities/customers/components/profile/customer-profile-command-dialogs.tsx src/shared/entities/customers/components/profile/customer-proposal-picker.tsx`
Expected: no errors. Nothing renders these yet.

- [ ] **Step 11: Commit (only if per-task commits were chosen)**

```bash
git commit -m "feat(customers): profile modal commands, proposal picker and media query hook" -- src/shared/hooks/use-media-query.ts src/shared/entities/customers/types/profile-modal.ts src/shared/entities/customers/constants/profile-modal.ts src/shared/entities/customers/lib/format-profile-meeting.ts src/shared/entities/customers/hooks/use-profile-commands.ts src/shared/entities/customers/components/profile/customer-profile-command-dialogs.tsx src/shared/entities/customers/components/profile/customer-proposal-picker.tsx
git show --stat HEAD
```

---

### Task 2: Shared primitives (tabs `bar`, ContactActionTrigger, InlineSheet)

**Files:**
- Modify: `src/shared/components/ui/tabs.tsx` (the one `ui/` file this plan may touch)
- Create: `src/shared/components/contact-actions/ui/contact-action-trigger-variants.ts`
- Create: `src/shared/components/contact-actions/ui/contact-action-trigger.tsx`
- Create: `src/shared/constants/drag-to-close.ts`
- Create: `src/shared/constants/inline-sheet.ts`
- Create: `src/shared/hooks/use-drag-to-close.ts`
- Create: `src/shared/components/dialogs/sheets/inline-sheet.tsx`
- Create: `src/shared/components/dialogs/sheets/inline-sheet-body.tsx`
- Temporary: `src/app/(frontend)/dev/primitives-check/page.tsx` (created in Step 1, deleted in Step 10, never committed)
- Create: `.superpowers/sdd/customer-profile-modal/primitives.mjs` (gitignored)

**Interfaces:**
- Produces: `TabsList variant="bar"`, `TabsTrigger` inside it picks up the `bar` look from context; `tabsTriggerVariants({ variant: 'bar' })` for a plain button in the same bar. `contactActionTriggerVariants({ shape, surface })`, types `ContactActionTriggerVariants`, `ContactActionSurface = 'card' | 'image'`; `<ContactActionTrigger icon={LucideIcon} label={string} shape?="row"|"round" surface?="card"|"image" {...buttonProps} />`. `DRAG_TO_CLOSE`, `INLINE_SHEET_SCROLL_SELECTOR`; `useDragToClose({ backdropRef, ignoreSelector?, onOpenChange, sheetRef })`; `<InlineSheet id labelledBy open onOpenChange className?>{children}</InlineSheet>` (renders `[data-inline-sheet]`, `[data-inline-sheet-backdrop]`, `[data-inline-sheet-handle]`; honors `--inline-sheet-offset`); `<InlineSheetBody className?>`.

- [ ] **Step 1: Write the isolated check page and script (the failing test)**

Create `src/app/(frontend)/dev/primitives-check/page.tsx` (temporary fixture; it imports modules that do not exist yet):

```tsx
'use client'

import { MailIcon, PhoneIcon } from 'lucide-react'
import { useState } from 'react'
import { ContactActionTrigger } from '@/shared/components/contact-actions/ui/contact-action-trigger'
import { PhoneAction } from '@/shared/components/contact-actions/ui/phone-action'
import { InlineSheet } from '@/shared/components/dialogs/sheets/inline-sheet'
import { InlineSheetBody } from '@/shared/components/dialogs/sheets/inline-sheet-body'
import { Tabs, TabsList, TabsTrigger, tabsTriggerVariants } from '@/shared/components/ui/tabs'

export default function PrimitivesCheckPage() {
  const [open, setOpen] = useState(false)
  const [clicks, setClicks] = useState(0)

  return (
    <div className="flex min-h-dvh flex-col items-center gap-6 bg-background p-4 text-foreground">
      <div className="flex w-80 flex-col gap-2" data-check="contacts">
        <PhoneAction phone="5555550100">
          <ContactActionTrigger icon={PhoneIcon} label="(555) 555-0100" />
        </PhoneAction>
        <div className="dark flex gap-2 rounded-lg bg-black p-2">
          <PhoneAction phone="5555550100">
            <ContactActionTrigger icon={PhoneIcon} label="Call or text" shape="round" surface="image" />
          </PhoneAction>
          <ContactActionTrigger icon={MailIcon} label="Email" shape="round" surface="image" />
        </div>
      </div>

      <Tabs className="w-90" defaultValue="a">
        <nav className="grid grid-cols-5 gap-0.5 border-t border-border bg-card p-1.5" data-check="bar">
          <button className={tabsTriggerVariants({ variant: 'bar' })} type="button">Close</button>
          <button className="col-start-3 row-start-1 h-14" type="button">New</button>
          <TabsList className="col-span-4 col-start-2 row-start-1 grid grid-cols-subgrid" variant="bar">
            <TabsTrigger className="col-start-1" value="a">A</TabsTrigger>
            <TabsTrigger className="col-start-3" value="b">B</TabsTrigger>
            <TabsTrigger className="col-start-4" value="c">C</TabsTrigger>
          </TabsList>
        </nav>
      </Tabs>

      <div className="relative h-120 w-90 overflow-hidden rounded-xl border border-border bg-card p-4" data-check="frame">
        <button aria-controls="check-sheet" aria-expanded={open} onClick={() => setOpen(o => !o)} type="button">Toggle sheet</button>
        <p data-check="clicks">{clicks}</p>
        <InlineSheet id="check-sheet" labelledBy="check-sheet-title" onOpenChange={setOpen} open={open}>
          <h2 className="px-4 font-semibold" id="check-sheet-title">Check</h2>
          <button className="mx-4 h-12 rounded-lg border border-border" onClick={() => setClicks(c => c + 1)} type="button">Row</button>
          <InlineSheetBody className="px-4 pb-4">
            <p>Body</p>
          </InlineSheetBody>
        </InlineSheet>
      </div>
    </div>
  )
}
```

Create `.superpowers/sdd/customer-profile-modal/primitives.mjs`:

```js
import { chromium } from 'playwright'

const BASE = `http://localhost:${process.env.PORT ?? 3000}`
const wait = ms => new Promise(r => setTimeout(r, ms))
const r = {}
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
try {
  await page.goto(`${BASE}/dev/primitives-check`, { timeout: 120000 })
  await page.locator('[data-check=frame]').waitFor({ timeout: 60000 })
  await page.evaluate(() => {
    window.__docEscape = 0
    // Stands in for Radix's dismissable layer, which listens on document in the capture phase.
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        window.__docEscape++
      }
    }, true)
  })

  const row = page.locator('[data-check=contacts]').getByRole('button', { name: '(555) 555-0100' })
  const rowBox = await row.boundingBox()
  r.rowHeight40 = Math.round(rowBox.height) >= 40 && (await row.getAttribute('title')) === '(555) 555-0100'
  const round = page.locator('[data-check=contacts]').getByRole('button', { name: 'Call or text' })
  const roundBox = await round.boundingBox()
  r.round40 = Math.round(roundBox.width) === 40 && Math.round(roundBox.height) === 40
  await round.click()
  await wait(300)
  r.roundOpensMenu = await page.getByRole('menuitem', { name: 'Call' }).isVisible()
  await page.keyboard.press('Escape')
  await wait(300)

  const bar = page.locator('[data-check=bar]')
  r.tablistValid = await bar.locator('[role=tablist]').evaluate(el => [...el.children].every(c => c.getAttribute('role') === 'tab'))
  const order = await bar.locator('button').evaluateAll(els => els.map(e => [e.textContent.trim(), e.getBoundingClientRect().x]).sort((a, b) => a[1] - b[1]).map(([t]) => t).join(','))
  r.barOrder = order === 'Close,A,New,B,C'
  await bar.getByRole('tab', { name: 'A' }).focus()
  await page.keyboard.press('ArrowRight')
  r.arrowMovesToB = await page.evaluate(() => document.activeElement?.textContent === 'B')

  const sheet = page.locator('[data-inline-sheet]')
  const toggle = page.getByRole('button', { name: 'Toggle sheet' })
  r.inertWhenClosed = await sheet.evaluate(el => el.inert === true)
  await toggle.focus()
  await page.keyboard.press('Enter')
  await wait(400)
  r.opens = (await sheet.getAttribute('data-state')) === 'open'
  r.keyboardFocusMovesIn = await page.evaluate(() => document.activeElement?.textContent === 'Row')
  await page.keyboard.press('Escape')
  await wait(400)
  r.escClosesSheet = (await sheet.getAttribute('data-state')) === 'closed'
  r.escStoppedBeforeDocument = await page.evaluate(() => window.__docEscape === 0)
  r.focusReturns = await page.evaluate(() => document.activeElement?.textContent === 'Toggle sheet')
  await page.keyboard.press('Escape')
  r.escReachesDocumentWhenClosed = await page.evaluate(() => window.__docEscape === 1)

  await toggle.click()
  await wait(400)
  const sheetRow = sheet.getByRole('button', { name: 'Row' })
  await sheetRow.click()
  r.tapLands = (await page.locator('[data-check=clicks]').textContent()) === '1'
  const rb = await sheetRow.boundingBox()
  await page.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2)
  await page.mouse.down()
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2 + i * 8)
  }
  await page.mouse.up()
  await wait(450)
  r.dragDoesNotClick = (await page.locator('[data-check=clicks]').textContent()) === '1'
  r.dragCloses = (await sheet.getAttribute('data-state')) === 'closed'

  await toggle.click()
  await wait(400)
  await page.locator('[data-inline-sheet-backdrop]').click({ position: { x: 20, y: 20 } })
  await wait(400)
  r.backdropCloses = (await sheet.getAttribute('data-state')) === 'closed'
}
catch (e) {
  r.error = String(e.message).split('\n')[0]
}
await browser.close()
console.log(JSON.stringify(r, null, 1))
const failed = Object.entries(r).filter(([, v]) => v !== true).map(([k]) => k)
console.log(failed.length ? `FAILED: ${failed.join(', ')}` : 'ALL PASS')
process.exit(failed.length ? 1 : 0)
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `node .superpowers/sdd/customer-profile-modal/primitives.mjs`
Expected: exit 1 with `error` (the page fails to compile: the imported modules do not exist).

- [ ] **Step 3: Add the `bar` variant to the shadcn tabs**

In `src/shared/components/ui/tabs.tsx`:

1. In `tabsListVariants`, after the `underline` line, add:

```ts
      // A bottom tab bar's tab group. Layout comes from the caller (a grid that also holds plain
      // buttons beside the tabs), so this only clears the default pill track.
      bar: 'h-auto items-stretch bg-transparent p-0',
```

2. In `tabsTriggerVariants`, after the `underline` line, add:

```ts
        bar: 'h-14 min-w-0 flex-col gap-1 rounded-xl px-0 text-xs font-semibold text-muted-foreground hover:text-foreground data-[state=active]:bg-muted data-[state=active]:text-primary motion-reduce:transition-none',
```

3. Change the last line to:

```ts
export { Tabs, TabsContent, TabsList, TabsTrigger, tabsTriggerVariants }
```

`TabsTrigger` already reads the list's variant through `TabsVariantContext`, so triggers inside `<TabsList variant="bar">` get the bar look with no prop. The base trigger class (`inline-flex`, `text-sm`, `transition-[…]`) is merged by `cn`, so `flex-col`, `text-xs` and the bar padding win.

- [ ] **Step 4: Write ContactActionTrigger**

Create `src/shared/components/contact-actions/ui/contact-action-trigger-variants.ts`:

```ts
import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

// `row` is a labeled 40px line (icon + truncated text) for lists of contact details; `round` is a
// 40px icon disc for tight spots. `image` is for triggers sitting on a photo, which is dark in
// both themes, so it keeps literal white.
export const contactActionTriggerVariants = cva(
  'flex min-w-0 cursor-pointer items-center outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      shape: {
        row: 'min-h-10 w-full gap-2.5 rounded-md px-2.5 text-left text-sm font-medium',
        round: 'size-10 shrink-0 justify-center rounded-full border',
      },
      surface: {
        card: 'text-foreground hover:bg-muted [&_svg]:text-muted-foreground',
        image: 'text-white/90 hover:bg-white/10 [&_svg]:text-white/75',
      },
    },
    compoundVariants: [
      { shape: 'round', surface: 'card', class: 'border-border bg-muted hover:bg-accent [&_svg]:text-foreground' },
      { shape: 'round', surface: 'image', class: 'border-white/20 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 [&_svg]:text-white' },
    ],
    defaultVariants: { shape: 'row', surface: 'card' },
  },
)

export type ContactActionTriggerVariants = VariantProps<typeof contactActionTriggerVariants>

export type ContactActionSurface = NonNullable<ContactActionTriggerVariants['surface']>
```

Create `src/shared/components/contact-actions/ui/contact-action-trigger.tsx`:

```tsx
'use client'

import type { LucideIcon } from 'lucide-react'
import type { ComponentProps } from 'react'
import type { ContactActionTriggerVariants } from './contact-action-trigger-variants'
import { cn } from '@/shared/lib/utils'
import { contactActionTriggerVariants } from './contact-action-trigger-variants'

type ContactActionTriggerProps = Omit<ComponentProps<'button'>, 'children'> & ContactActionTriggerVariants & {
  icon: LucideIcon
  // Visible text for a row; the accessible name for a round disc, which shows no text.
  label: string
}

// Presentational only: it forwards every prop and its ref, so it can be the asChild child of
// PhoneAction, EmailAction or AddressAction (their DropdownMenuTrigger supplies the handlers).
export function ContactActionTrigger({ className, icon: Icon, label, shape, surface, type = 'button', ...props }: ContactActionTriggerProps) {
  const isRound = shape === 'round'
  return (
    <button
      aria-label={isRound ? label : undefined}
      className={cn(contactActionTriggerVariants({ shape, surface }), className)}
      title={isRound ? undefined : label}
      type={type}
      {...props}
    >
      <Icon />
      {!isRound && <span className="truncate">{label}</span>}
    </button>
  )
}
```

`PhoneAction` / `EmailAction` / `AddressAction` wrap their `children` in `DropdownMenuTrigger asChild`. In React 19 Radix's `Slot` passes the composed `ref` and its handlers as props, and this component spreads them onto the `<button>`, so no `forwardRef` is needed (same pattern as `ui/button.tsx`).

- [ ] **Step 5: Write the drag constants, the scroll selector and the drag hook**

Create `src/shared/constants/drag-to-close.ts`:

```ts
export const DRAG_TO_CLOSE = {
  // Below this the gesture is still a tap, so a press on a row or button inside the sheet lands.
  startPx: 6,
  closeDistanceRatio: 0.25,
  closeVelocityPxPerMs: 0.5,
} as const
```

Create `src/shared/constants/inline-sheet.ts`:

```ts
export const INLINE_SHEET_SCROLL_SELECTOR = '[data-inline-sheet-scroll]'
```

Create `src/shared/hooks/use-drag-to-close.ts` (the behavior of `useDragToClose` inside `src/shared/components/ui/sidebar-mobile-sheet.tsx`, generalized; do not edit that file):

```ts
'use client'

import type { RefObject } from 'react'
import { useEffect } from 'react'
import { DRAG_TO_CLOSE } from '@/shared/constants/drag-to-close'

interface Options {
  backdropRef: RefObject<HTMLElement | null>
  // A drag that starts inside this region is left to native scrolling.
  ignoreSelector?: string
  onOpenChange: (open: boolean) => void
  sheetRef: RefObject<HTMLElement | null>
}

// A downward drag moves the sheet with the pointer and fades the backdrop; letting go past a
// quarter of the sheet, or with a flick, closes it, and anything less springs back. The drag
// writes inline styles only, then hands back to the class transition, which runs from wherever
// the pointer let go.
export function useDragToClose({ backdropRef, ignoreSelector, onOpenChange, sheetRef }: Options) {
  useEffect(() => {
    const sheet = sheetRef.current
    const backdrop = backdropRef.current
    if (!sheet || !backdrop) {
      return
    }
    let start: { y: number, time: number, pointerId: number } | null = null
    let offset = 0
    let isDragging = false

    const release = () => {
      sheet.style.removeProperty('translate')
      sheet.style.removeProperty('transition')
      backdrop.style.removeProperty('opacity')
      backdrop.style.removeProperty('transition')
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!event.isPrimary || (ignoreSelector && (event.target as Element).closest(ignoreSelector))) {
        return
      }
      start = { y: event.clientY, time: event.timeStamp, pointerId: event.pointerId }
      offset = 0
    }
    const onPointerMove = (event: PointerEvent) => {
      if (!start || event.pointerId !== start.pointerId) {
        return
      }
      offset = Math.max(0, event.clientY - start.y)
      if (!isDragging) {
        if (offset < DRAG_TO_CLOSE.startPx) {
          return
        }
        isDragging = true
        sheet.setPointerCapture(event.pointerId)
        sheet.style.transition = 'none'
        backdrop.style.transition = 'none'
      }
      sheet.style.translate = `0 ${offset}px`
      backdrop.style.opacity = String(Math.max(0, 1 - offset / sheet.offsetHeight))
    }
    const onPointerEnd = (event: PointerEvent) => {
      if (!start || event.pointerId !== start.pointerId) {
        return
      }
      const velocity = offset / Math.max(1, event.timeStamp - start.time)
      const shouldClose = isDragging
        && (offset > sheet.offsetHeight * DRAG_TO_CLOSE.closeDistanceRatio || velocity > DRAG_TO_CLOSE.closeVelocityPxPerMs)
      start = null
      if (!isDragging) {
        return
      }
      isDragging = false
      // The class transition picks up from the inline position, so the sheet leaves (or returns)
      // from where the pointer let go rather than jumping first.
      requestAnimationFrame(release)
      if (shouldClose) {
        onOpenChange(false)
      }
    }
    // A drag that began on a link or button must not also activate it.
    const onClickCapture = (event: MouseEvent) => {
      if (offset >= DRAG_TO_CLOSE.startPx) {
        event.preventDefault()
        event.stopPropagation()
        offset = 0
      }
    }

    sheet.addEventListener('pointerdown', onPointerDown)
    sheet.addEventListener('pointermove', onPointerMove)
    sheet.addEventListener('pointerup', onPointerEnd)
    sheet.addEventListener('pointercancel', onPointerEnd)
    sheet.addEventListener('click', onClickCapture, true)
    return () => {
      sheet.removeEventListener('pointerdown', onPointerDown)
      sheet.removeEventListener('pointermove', onPointerMove)
      sheet.removeEventListener('pointerup', onPointerEnd)
      sheet.removeEventListener('pointercancel', onPointerEnd)
      sheet.removeEventListener('click', onClickCapture, true)
    }
  }, [backdropRef, ignoreSelector, onOpenChange, sheetRef])
}
```

- [ ] **Step 6: Write InlineSheet and InlineSheetBody**

Create `src/shared/components/dialogs/sheets/inline-sheet.tsx`:

```tsx
'use client'

import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { INLINE_SHEET_SCROLL_SELECTOR } from '@/shared/constants/inline-sheet'
import { useDragToClose } from '@/shared/hooks/use-drag-to-close'
import { cn } from '@/shared/lib/utils'

interface InlineSheetProps {
  children: ReactNode
  // Lifts the sheet off its frame's bottom edge, for a bar that stays live below it:
  // `[--inline-sheet-offset:4rem]`.
  className?: string
  // The opener carries aria-controls={id}; focus returns to it when the sheet closes.
  id: string
  labelledBy: string
  onOpenChange: (open: boolean) => void
  open: boolean
}

// A bottom sheet that renders where it is placed: the nearest positioned ancestor is its frame,
// the backdrop fills that frame and the sheet rests on its bottom edge. It is not a Radix or vaul
// modal on purpose: those write to <body> on every open and close (pointer-events, a scroll lock),
// each write restyling the whole document on the frame the sheet starts to move. This one stays
// mounted and opening it flips one attribute; the slide is a CSS transition on `translate`.
export function InlineSheet({ children, className, id, labelledBy, onOpenChange, open }: InlineSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const state = open ? 'open' : 'closed'

  useDragToClose({ backdropRef, ignoreSelector: INLINE_SHEET_SCROLL_SELECTOR, onOpenChange, sheetRef })

  useEffect(() => {
    if (!open) {
      return
    }
    const sheet = sheetRef.current
    // A keyboard press on the opener moves focus into the sheet; a tap leaves it on the opener.
    if (sheet && document.activeElement?.matches(':focus-visible')) {
      sheet.querySelector<HTMLElement>('a[href], button:not(:disabled), input, textarea, select')?.focus()
    }
    // Radix's dismissable layers listen for Escape on document in the capture phase. Window's
    // capture phase runs before document's, so stopping the event here closes only this sheet
    // and leaves the dialog around it open.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onOpenChange(false)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      // Closing makes the sheet inert; hand focus back to its opener rather than to <body>.
      if (sheet?.contains(document.activeElement)) {
        document.querySelector<HTMLElement>(`[aria-controls="${id}"]`)?.focus()
      }
    }
  }, [id, open, onOpenChange])

  return (
    <>
      <div
        aria-hidden
        className="absolute inset-0 z-20 touch-none bg-background/60 transition-opacity duration-260 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none data-[state=closed]:pointer-events-none data-[state=closed]:opacity-0"
        data-inline-sheet-backdrop
        data-state={state}
        onClick={() => onOpenChange(false)}
        ref={backdropRef}
      />
      <div
        aria-labelledby={labelledBy}
        aria-modal="false"
        className={cn(
          'absolute inset-x-0 bottom-[var(--inline-sheet-offset,0px)] z-20 flex max-h-[85%] touch-none flex-col rounded-t-2xl border-t border-border bg-popover text-popover-foreground shadow-2xl',
          // Closed, the sheet sits one travel below its place and turns invisible once the slide
          // ends; open, it turns visible at once. The curve is vaul's, like the app's other sheets.
          'invisible translate-y-[calc(100%+var(--inline-sheet-offset,0px))] [transition:translate_260ms_cubic-bezier(0.32,0.72,0,1),visibility_0s_260ms]',
          'data-[state=open]:visible data-[state=open]:translate-y-0 data-[state=open]:[transition:translate_260ms_cubic-bezier(0.32,0.72,0,1),visibility_0s]',
          'motion-reduce:transition-none',
          className,
        )}
        data-inline-sheet
        data-state={state}
        id={id}
        inert={!open}
        ref={sheetRef}
        role="dialog"
      >
        <div aria-hidden className="mx-auto mt-2.5 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-border" data-inline-sheet-handle />
        {children}
      </div>
    </>
  )
}
```

Create `src/shared/components/dialogs/sheets/inline-sheet-body.tsx`:

```tsx
'use client'

import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

interface InlineSheetBodyProps {
  children: ReactNode
  className?: string
}

// The part of an InlineSheet that may outgrow it. It scrolls natively, so a drag that starts here
// scrolls instead of closing the sheet; everywhere else on the sheet a downward drag closes it.
export function InlineSheetBody({ children, className }: InlineSheetBodyProps) {
  return (
    <div className={cn('min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain', className)} data-inline-sheet-scroll>
      {children}
    </div>
  )
}
```

`onOpenChange` is an effect dependency of both the Escape effect and the drag hook: pass a stable function (a `useState` setter, or a `useCallback`), or the listeners re-attach every render.

- [ ] **Step 7: Type-check and lint**

Run: `pnpm tsc && pnpm exec eslint --fix src/shared/components/ui/tabs.tsx src/shared/components/contact-actions/ui/contact-action-trigger-variants.ts src/shared/components/contact-actions/ui/contact-action-trigger.tsx src/shared/constants/drag-to-close.ts src/shared/constants/inline-sheet.ts src/shared/hooks/use-drag-to-close.ts src/shared/components/dialogs/sheets/inline-sheet.tsx src/shared/components/dialogs/sheets/inline-sheet-body.tsx "src/app/(frontend)/dev/primitives-check/page.tsx"`
Expected: no errors.

- [ ] **Step 8: Run the isolated check**

Run: `node .superpowers/sdd/customer-profile-modal/primitives.mjs`
Expected: `ALL PASS` (`rowHeight40`, `round40`, `roundOpensMenu`, `tablistValid`, `barOrder`, `arrowMovesToB`, `inertWhenClosed`, `opens`, `keyboardFocusMovesIn`, `escClosesSheet`, `escStoppedBeforeDocument`, `focusReturns`, `escReachesDocumentWhenClosed`, `tapLands`, `dragDoesNotClick`, `dragCloses`, `backdropCloses`). If classes look unstyled (for example the sheet is visible while closed), clear `.next` per the recipe and rerun. Fix any failure in this task's files, rerun once, and report what changed.

- [ ] **Step 9: Confirm the existing tab users are unchanged**

Run: `grep -rn 'variant="bar"\|tabsTriggerVariants' src --include=*.tsx | grep -v primitives-check`
Expected: no output (nothing else uses the new variant yet; `default` and `underline` are untouched).

- [ ] **Step 10: Delete the temporary page**

Run: `rm -r "src/app/(frontend)/dev/primitives-check" && pnpm tsc`
Expected: the folder is gone and `tsc` passes. Keep `primitives.mjs`; Task 6 can recreate the page from Step 1 if a primitive changes.

- [ ] **Step 11: Commit (only if per-task commits were chosen)**

```bash
git commit -m "feat(ui): tab bar variant, contact action trigger and inline sheet primitives" -- src/shared/components/ui/tabs.tsx src/shared/components/contact-actions/ui/contact-action-trigger-variants.ts src/shared/components/contact-actions/ui/contact-action-trigger.tsx src/shared/constants/drag-to-close.ts src/shared/constants/inline-sheet.ts src/shared/hooks/use-drag-to-close.ts src/shared/components/dialogs/sheets/inline-sheet.tsx src/shared/components/dialogs/sheets/inline-sheet-body.tsx
git show --stat HEAD
```

---

### Task 3: Contact rows and the header rewrite

**Files:**
- Create: `src/shared/entities/customers/components/profile/customer-contact-input-row.tsx`
- Create: `src/shared/entities/customers/components/profile/customer-contact-add-trigger.tsx`
- Create: `src/shared/entities/customers/components/profile/customer-contact-address-row.tsx`
- Create: `src/shared/entities/customers/components/profile/customer-contact-phone-row.tsx`
- Create: `src/shared/entities/customers/components/profile/customer-contact-email-row.tsx`
- Create: `src/shared/entities/customers/components/profile/customer-contact-buttons.tsx`
- Create: `src/shared/entities/customers/components/profile/customer-edit-toggle.tsx`
- Rewrite: `src/shared/entities/customers/components/profile/customer-hero-header.tsx`
- Modify (one prop): `src/shared/entities/customers/components/profile/customer-profile-modal-content.tsx`

**Interfaces:**
- Consumes: `ContactActionTrigger`, `contactActionTriggerVariants`, `ContactActionSurface` (Task 2).
- Produces: `<CustomerHeroHeader customer editForm layout: 'rail' | 'photo' />` (required prop); `<CustomerContactButtons customer />`; `<CustomerEditToggle editForm />`; the row components (used only by the header).

Behavior carried over from today's header: a phone shows whenever `customer.phone` is set (the DAL blanks a gated phone); "Add phone" only when `canAgentSeePhone` and `canEditContact`; "Add email" / "Add address" when `canEditContact`; edit mode swaps phone and email for inputs registered on the edit form; the address edits through `AddressEditDialog`. On the photo in view mode, phone and email are round buttons beside the name (no "Add phone/email" there; the pencil's edit mode reaches those fields). Names and long values truncate with a `title`.

- [ ] **Step 1: Edit-mode input row**

Create `customer-contact-input-row.tsx`:

```tsx
'use client'

import type { LucideIcon } from 'lucide-react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import type { ContactActionSurface } from '@/shared/components/contact-actions/ui/contact-action-trigger-variants'
import { contactActionTriggerVariants } from '@/shared/components/contact-actions/ui/contact-action-trigger-variants'
import { Input } from '@/shared/components/ui/input'
import { cn } from '@/shared/lib/utils'

interface Props {
  icon: LucideIcon
  inputProps: UseFormRegisterReturn
  label: string
  surface: ContactActionSurface
  type?: 'email' | 'tel' | 'text'
}

// Edit mode swaps a contact row for its input on the same 40px line, so the layout holds still.
export function CustomerContactInputRow({ icon: Icon, inputProps, label, surface, type = 'text' }: Props) {
  return (
    <label className={cn(contactActionTriggerVariants({ shape: 'row', surface }), 'cursor-default hover:bg-transparent')}>
      <Icon />
      <Input
        {...inputProps}
        aria-label={label}
        className={cn('h-9 text-sm', surface === 'image' && 'border-white/20 bg-white/10 text-white placeholder:text-white/50')}
        placeholder={label}
        type={type}
      />
    </label>
  )
}
```

- [ ] **Step 2: "Add …" row**

Create `customer-contact-add-trigger.tsx`:

```tsx
'use client'

import type { ContactActionSurface } from '@/shared/components/contact-actions/ui/contact-action-trigger-variants'
import { PlusIcon } from 'lucide-react'
import { ContactActionTrigger } from '@/shared/components/contact-actions/ui/contact-action-trigger'

interface Props {
  label: string
  onClick: () => void
  surface: ContactActionSurface
}

export function CustomerContactAddTrigger({ label, onClick, surface }: Props) {
  return (
    <ContactActionTrigger
      className={surface === 'card' ? 'text-muted-foreground' : 'text-white/70'}
      icon={PlusIcon}
      label={label}
      onClick={onClick}
      surface={surface}
    />
  )
}
```

- [ ] **Step 3: Address row**

Create `customer-contact-address-row.tsx`:

```tsx
'use client'

import type { ContactActionSurface } from '@/shared/components/contact-actions/ui/contact-action-trigger-variants'
import type { formatCustomerAddress } from '@/shared/lib/formatters'
import { MapPinIcon } from 'lucide-react'
import { AddressAction } from '@/shared/components/contact-actions/ui/address-action'
import { ContactActionTrigger } from '@/shared/components/contact-actions/ui/contact-action-trigger'
import { CustomerContactAddTrigger } from './customer-contact-add-trigger'

interface Props {
  address: ReturnType<typeof formatCustomerAddress>
  canEdit: boolean
  onEdit: () => void
  surface: ContactActionSurface
}

export function CustomerContactAddressRow({ address, canEdit, onEdit, surface }: Props) {
  if (!address.hasAddress) {
    return canEdit ? <CustomerContactAddTrigger label="Add address" onClick={onEdit} surface={surface} /> : null
  }

  return (
    <AddressAction address={address.singleLine} canEdit={canEdit} onEdit={onEdit}>
      <ContactActionTrigger icon={MapPinIcon} label={address.singleLine} surface={surface} />
    </AddressAction>
  )
}
```

- [ ] **Step 4: Phone row**

Create `customer-contact-phone-row.tsx`:

```tsx
'use client'

import type { ContactActionSurface } from '@/shared/components/contact-actions/ui/contact-action-trigger-variants'
import type { useCustomerEditForm } from '@/shared/entities/customers/hooks/use-customer-edit-form'
import type { CustomerProfileData } from '@/shared/entities/customers/types'
import { PhoneIcon } from 'lucide-react'
import { ContactActionTrigger } from '@/shared/components/contact-actions/ui/contact-action-trigger'
import { PhoneAction } from '@/shared/components/contact-actions/ui/phone-action'
import { formatPhone } from '@/shared/lib/phone'
import { CustomerContactAddTrigger } from './customer-contact-add-trigger'
import { CustomerContactInputRow } from './customer-contact-input-row'

interface Props {
  customer: CustomerProfileData['customer']
  editForm: ReturnType<typeof useCustomerEditForm>
  phoneUnlocked: boolean
  surface: ContactActionSurface
}

export function CustomerContactPhoneRow({ customer, editForm, phoneUnlocked, surface }: Props) {
  const canEdit = editForm.canEditContact

  if (editForm.isEditing && canEdit) {
    return <CustomerContactInputRow icon={PhoneIcon} inputProps={editForm.form.register('phone')} label="Phone" surface={surface} type="tel" />
  }

  if (customer.phone) {
    return (
      <PhoneAction canEdit={canEdit} onEdit={() => editForm.startEditing('phone')} phone={customer.phone}>
        <ContactActionTrigger icon={PhoneIcon} label={formatPhone(customer.phone)} surface={surface} />
      </PhoneAction>
    )
  }

  // The DAL blanks a gated phone, so an agent who cannot see it gets no hint that one exists.
  if (phoneUnlocked && canEdit) {
    return <CustomerContactAddTrigger label="Add phone" onClick={() => editForm.startEditing('phone')} surface={surface} />
  }

  return null
}
```

- [ ] **Step 5: Email row**

Create `customer-contact-email-row.tsx`:

```tsx
'use client'

import type { ContactActionSurface } from '@/shared/components/contact-actions/ui/contact-action-trigger-variants'
import type { useCustomerEditForm } from '@/shared/entities/customers/hooks/use-customer-edit-form'
import type { CustomerProfileData } from '@/shared/entities/customers/types'
import { MailIcon } from 'lucide-react'
import { ContactActionTrigger } from '@/shared/components/contact-actions/ui/contact-action-trigger'
import { EmailAction } from '@/shared/components/contact-actions/ui/email-action'
import { CustomerContactAddTrigger } from './customer-contact-add-trigger'
import { CustomerContactInputRow } from './customer-contact-input-row'

interface Props {
  customer: CustomerProfileData['customer']
  editForm: ReturnType<typeof useCustomerEditForm>
  surface: ContactActionSurface
}

export function CustomerContactEmailRow({ customer, editForm, surface }: Props) {
  const canEdit = editForm.canEditContact

  if (editForm.isEditing && canEdit) {
    return <CustomerContactInputRow icon={MailIcon} inputProps={editForm.form.register('email')} label="Email" surface={surface} type="email" />
  }

  if (customer.email) {
    return (
      <EmailAction canEdit={canEdit} email={customer.email} onEdit={() => editForm.startEditing('email')}>
        <ContactActionTrigger icon={MailIcon} label={customer.email} surface={surface} />
      </EmailAction>
    )
  }

  if (canEdit) {
    return <CustomerContactAddTrigger label="Add email" onClick={() => editForm.startEditing('email')} surface={surface} />
  }

  return null
}
```

- [ ] **Step 6: Round buttons for the photo**

Create `customer-contact-buttons.tsx`:

```tsx
'use client'

import type { CustomerProfileData } from '@/shared/entities/customers/types'
import { MailIcon, PhoneIcon } from 'lucide-react'
import { ContactActionTrigger } from '@/shared/components/contact-actions/ui/contact-action-trigger'
import { EmailAction } from '@/shared/components/contact-actions/ui/email-action'
import { PhoneAction } from '@/shared/components/contact-actions/ui/phone-action'
import { formatPhone } from '@/shared/lib/phone'

interface Props {
  customer: CustomerProfileData['customer']
}

// Thumb-sized call and email beside the name on the phone hero; edit mode brings back full rows.
export function CustomerContactButtons({ customer }: Props) {
  if (!customer.phone && !customer.email) {
    return null
  }

  return (
    <div className="ml-auto flex shrink-0 items-center gap-2">
      {customer.phone && (
        <PhoneAction phone={customer.phone}>
          <ContactActionTrigger icon={PhoneIcon} label={`Call or text ${formatPhone(customer.phone)}`} shape="round" surface="image" />
        </PhoneAction>
      )}
      {customer.email && (
        <EmailAction email={customer.email}>
          <ContactActionTrigger icon={MailIcon} label={`Email ${customer.email}`} shape="round" surface="image" />
        </EmailAction>
      )}
    </div>
  )
}
```

- [ ] **Step 7: Edit toggle in its own file**

Create `customer-edit-toggle.tsx` (today's in-file `EditToggle`, with 36px targets):

```tsx
'use client'

import type { useCustomerEditForm } from '@/shared/entities/customers/hooks/use-customer-edit-form'
import { CheckIcon, XIcon } from 'lucide-react'
import { InlineEditButton } from '@/shared/components/buttons/inline-edit-button'
import { Button } from '@/shared/components/ui/button'

interface Props {
  editForm: ReturnType<typeof useCustomerEditForm>
}

export function CustomerEditToggle({ editForm }: Props) {
  if (!editForm.canEdit) {
    return null
  }

  if (editForm.isEditing) {
    return (
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          aria-label="Save changes"
          className="size-9 shrink-0 rounded-full text-status-success-dot hover:bg-status-success-dot/15 hover:text-status-success-dot"
          disabled={editForm.isPending}
          onClick={editForm.handleSave}
          size="icon"
          variant="ghost"
        >
          <CheckIcon className="size-4" />
        </Button>
        <Button
          aria-label="Cancel editing"
          className="size-9 shrink-0 rounded-full text-foreground/60 hover:bg-foreground/10 hover:text-foreground"
          disabled={editForm.isPending}
          onClick={editForm.handleCancel}
          size="icon"
          variant="ghost"
        >
          <XIcon className="size-4" />
        </Button>
      </div>
    )
  }

  return <InlineEditButton ariaLabel="Edit customer" onClick={() => editForm.startEditing('name')} />
}
```

- [ ] **Step 8: Rewrite the header**

Replace the whole of `customer-hero-header.tsx`:

```tsx
'use client'

import type { useCustomerEditForm } from '@/shared/entities/customers/hooks/use-customer-edit-form'
import type { CustomerProfileData } from '@/shared/entities/customers/types'
import { useState } from 'react'
import { Input } from '@/shared/components/ui/input'
import { useAbility } from '@/shared/domains/permissions/hooks'
import { canAgentSeePhone } from '@/shared/entities/customers/lib/can-see-phone'
import { formatCustomerAddress } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'
import { AddressEditDialog } from './address-edit-dialog'
import { CustomerContactAddressRow } from './customer-contact-address-row'
import { CustomerContactButtons } from './customer-contact-buttons'
import { CustomerContactEmailRow } from './customer-contact-email-row'
import { CustomerContactPhoneRow } from './customer-contact-phone-row'
import { CustomerEditToggle } from './customer-edit-toggle'

interface Props {
  customer: CustomerProfileData['customer']
  editForm: ReturnType<typeof useCustomerEditForm>
  // `rail` sits on the card surface of the desktop rail; `photo` sits on the phone hero image.
  layout: 'rail' | 'photo'
}

export function CustomerHeroHeader({ customer, editForm, layout }: Props) {
  const ability = useAbility()
  const [addressDialogOpen, setAddressDialogOpen] = useState(false)
  const phoneUnlocked = canAgentSeePhone(ability, customer)
  const isPhoto = layout === 'photo'
  const surface = isPhoto ? 'image' : 'card'
  // The phone hero keeps call and email as discs beside the name; edit mode needs the full rows.
  const showButtons = isPhoto && !editForm.isEditing
  const address = formatCustomerAddress({ address: customer.address, city: customer.city, state: customer.state, zip: customer.zip })

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex min-w-0 items-center gap-1.5">
        {editForm.isEditing && editForm.canEditContact
          ? (
              <Input
                {...editForm.form.register('name')}
                aria-label="Customer name"
                className={cn('h-9 w-full max-w-80 text-lg font-semibold', isPhoto && 'border-white/20 bg-white/10 text-white placeholder:text-white/50')}
                placeholder="Customer name"
              />
            )
          : (
              <h2
                className={cn('min-w-0 truncate text-2xl leading-tight font-semibold tracking-tight', isPhoto ? 'text-white' : 'text-foreground')}
                title={customer.name}
              >
                {customer.name}
              </h2>
            )}
        <CustomerEditToggle editForm={editForm} />
        {showButtons && <CustomerContactButtons customer={customer} />}
      </div>

      {/* Rows carry their own hover padding; the negative margin lines their text up with the name. */}
      <div className="-mx-2.5 flex min-w-0 flex-col">
        <CustomerContactAddressRow address={address} canEdit={editForm.canEditContact} onEdit={() => setAddressDialogOpen(true)} surface={surface} />
        {!showButtons && (
          <>
            <CustomerContactPhoneRow customer={customer} editForm={editForm} phoneUnlocked={phoneUnlocked} surface={surface} />
            <CustomerContactEmailRow customer={customer} editForm={editForm} surface={surface} />
          </>
        )}
      </div>

      <AddressEditDialog
        customerId={customer.id}
        defaultAddress={address.singleLine}
        isOpen={addressDialogOpen}
        onClose={() => setAddressDialogOpen(false)}
      />
    </div>
  )
}
```

- [ ] **Step 9: Keep today's modal compiling**

`layout` is now required. In `customer-profile-modal-content.tsx` change the one call:

```tsx
            <CustomerHeroHeader customer={data.customer} editForm={editForm} />
```

to:

```tsx
            <CustomerHeroHeader customer={data.customer} editForm={editForm} layout="photo" />
```

Task 5 replaces this file.

- [ ] **Step 10: Type-check and lint**

Run: `pnpm tsc && pnpm exec eslint --fix src/shared/entities/customers/components/profile/customer-contact-*.tsx src/shared/entities/customers/components/profile/customer-edit-toggle.tsx src/shared/entities/customers/components/profile/customer-hero-header.tsx src/shared/entities/customers/components/profile/customer-profile-modal-content.tsx`
Expected: no errors.

- [ ] **Step 11: Commit (only if per-task commits were chosen)**

```bash
git commit -m "refactor(customers): profile contacts on the shared contact action trigger" -- src/shared/entities/customers/components/profile/customer-contact-input-row.tsx src/shared/entities/customers/components/profile/customer-contact-add-trigger.tsx src/shared/entities/customers/components/profile/customer-contact-address-row.tsx src/shared/entities/customers/components/profile/customer-contact-phone-row.tsx src/shared/entities/customers/components/profile/customer-contact-email-row.tsx src/shared/entities/customers/components/profile/customer-contact-buttons.tsx src/shared/entities/customers/components/profile/customer-edit-toggle.tsx src/shared/entities/customers/components/profile/customer-hero-header.tsx src/shared/entities/customers/components/profile/customer-profile-modal-content.tsx
git show --stat HEAD
```

---

### Task 4: Phone pieces (tab bar, New sheet, pinned hero)

**Files:**
- Create: `src/shared/entities/customers/components/profile/customer-profile-tab-bar-trigger.tsx`
- Create: `src/shared/entities/customers/components/profile/customer-profile-new-button.tsx`
- Create: `src/shared/entities/customers/components/profile/customer-profile-tab-bar.tsx`
- Create: `src/shared/entities/customers/components/profile/customer-profile-new-menu.tsx`
- Create: `src/shared/entities/customers/components/profile/customer-profile-new-sheet.tsx`
- Create: `src/shared/entities/customers/components/profile/customer-profile-phone-hero.tsx`

**Interfaces:**
- Consumes: `TabsList variant="bar"`, `tabsTriggerVariants`, `InlineSheet`, `InlineSheetBody` (Task 2); `ProfileCommands`, `NewSheetChoice`, `NewSheetStep`, `CustomerProfileTab`, `PROFILE_*`, `NEW_SHEET_ITEMS`, `CustomerProposalPicker` (Task 1); `CustomerHeroHeader layout="photo"` (Task 3).
- Produces: `<CustomerProfileTabBar counts={{ meetings, projects }} newSheetOpen onClose onToggleNew />` (must render inside a `Tabs` root; renders `nav[data-profile-tab-bar]`); `<CustomerProfileNewSheet commands meetings open onOpenChange />` (must sit in a positioned frame whose bottom is the tab bar's bottom); `<CustomerProfilePhoneHero customer editForm heroAddress heroView onHeroViewChange />` (renders `[data-profile-hero]`).

Layering inside the dialog (the `Tabs` root is `relative`; the dialog content is the stacking context): the sheet's backdrop and the sheet are `z-20`, the tab bar is `relative z-30`. The sheet's `--inline-sheet-offset` equals the bar's height (6 + 56 + 6px = 4.25rem, plus the bottom safe area), so it rests on the bar's top edge and slides down behind it; the bar, including the New disc turned into an ×, stays live while the sheet is open.

- [ ] **Step 1: One tab of the bar**

Create `customer-profile-tab-bar-trigger.tsx`:

```tsx
'use client'

import type { CustomerProfileTab } from '@/shared/entities/customers/types/profile-modal'
import { TabsTrigger } from '@/shared/components/ui/tabs'
import { PROFILE_TAB_ICONS, PROFILE_TAB_LABELS } from '@/shared/entities/customers/constants/profile-modal'

interface Props {
  className?: string
  count?: number
  value: CustomerProfileTab
}

export function CustomerProfileTabBarTrigger({ className, count, value }: Props) {
  const Icon = PROFILE_TAB_ICONS[value]
  const label = PROFILE_TAB_LABELS[value]
  return (
    <TabsTrigger aria-label={count ? `${label} (${count})` : label} className={className} value={value}>
      <span className="relative">
        <Icon className="size-5" />
        {count
          ? (
              <span className="absolute -top-1.5 -right-2.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-xs leading-none font-semibold text-primary-foreground">
                {count}
              </span>
            )
          : null}
      </span>
      <span className="truncate">{label}</span>
    </TabsTrigger>
  )
}
```

- [ ] **Step 2: The New disc**

Create `customer-profile-new-button.tsx`:

```tsx
'use client'

import { PlusIcon } from 'lucide-react'
import { PROFILE_NEW_SHEET_ID } from '@/shared/entities/customers/constants/profile-modal'
import { cn } from '@/shared/lib/utils'

interface Props {
  className?: string
  onToggle: () => void
  open: boolean
}

// The raised center disc: it opens the New sheet and, turned into an ×, closes it again.
export function CustomerProfileNewButton({ className, onToggle, open }: Props) {
  return (
    <button
      aria-controls={PROFILE_NEW_SHEET_ID}
      aria-expanded={open}
      className={cn(
        'relative z-10 flex h-14 min-w-0 flex-col items-center justify-end gap-1 rounded-xl text-xs font-semibold text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        className,
      )}
      onClick={onToggle}
      type="button"
    >
      <span aria-hidden className="grid size-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-card">
        <PlusIcon className={cn('size-6 transition-transform duration-200 motion-reduce:transition-none', open && 'rotate-45')} />
      </span>
      New
    </button>
  )
}
```

The slot is 56px tall with `justify-end`, so the 48px disc plus the label overflow the slot upward by 12px and the disc stands about 18px above the bar's top border.

- [ ] **Step 3: The tab bar**

Create `customer-profile-tab-bar.tsx`:

```tsx
'use client'

import { XIcon } from 'lucide-react'
import { TabsList, tabsTriggerVariants } from '@/shared/components/ui/tabs'
import { cn } from '@/shared/lib/utils'
import { CustomerProfileNewButton } from './customer-profile-new-button'
import { CustomerProfileTabBarTrigger } from './customer-profile-tab-bar-trigger'

interface Props {
  counts: { meetings: number, projects: number }
  newSheetOpen: boolean
  onClose: () => void
  onToggleNew: () => void
}

// Phone only. Close and New are plain buttons outside the tablist so it holds tabs only; the grid
// places them among the tabs: Close · Overview · New · Meetings · Projects. The tablist spans
// columns 2–5 as a subgrid and leaves its second column (the bar's third) to New.
export function CustomerProfileTabBar({ counts, newSheetOpen, onClose, onToggleNew }: Props) {
  return (
    <nav
      aria-label="Customer profile"
      className="relative z-30 grid shrink-0 grid-cols-5 gap-0.5 border-t border-border bg-card px-1.5 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))]"
      data-profile-tab-bar
    >
      <button className={cn(tabsTriggerVariants({ variant: 'bar' }), 'col-start-1 row-start-1')} onClick={onClose} type="button">
        <XIcon className="size-5" />
        Close
      </button>
      <CustomerProfileNewButton className="col-start-3 row-start-1" onToggle={onToggleNew} open={newSheetOpen} />
      <TabsList className="col-span-4 col-start-2 row-start-1 grid grid-cols-subgrid" variant="bar">
        <CustomerProfileTabBarTrigger className="col-start-1" value="overview" />
        <CustomerProfileTabBarTrigger className="col-start-3" count={counts.meetings} value="meetings" />
        <CustomerProfileTabBarTrigger className="col-start-4" count={counts.projects} value="projects" />
      </TabsList>
    </nav>
  )
}
```

The tablist spans columns 2–5 and covers column 3, where New sits; New is `relative z-10` so it stays above the tablist's box and receives taps. Tab order is Close, New, then the active tab; arrow keys move among Overview, Meetings, Projects (DOM order).

- [ ] **Step 4: New sheet, step 1**

Create `customer-profile-new-menu.tsx`:

```tsx
'use client'

import type { NewSheetChoice, ProfileCommands } from '@/shared/entities/customers/types/profile-modal'
import { NEW_SHEET_ITEMS } from '@/shared/entities/customers/constants/profile-modal'

interface Props {
  commands: ProfileCommands
  onPick: (choice: NewSheetChoice) => void
}

export function CustomerProfileNewMenu({ commands, onPick }: Props) {
  const allowed: Record<NewSheetChoice, boolean> = {
    proposal: commands.canAddProposal,
    meeting: commands.canAddMeeting,
    note: true,
  }

  return (
    <ul className="flex flex-col gap-2">
      {NEW_SHEET_ITEMS.filter(item => allowed[item.id]).map(({ description, icon: Icon, id, label }) => (
        <li key={id}>
          <button
            className="flex min-h-15 w-full items-center gap-3 rounded-xl border border-border bg-card px-3 text-left transition-colors hover:bg-muted motion-reduce:transition-none"
            onClick={() => onPick(id)}
            type="button"
          >
            <Icon className="size-5 shrink-0 text-primary" />
            <span className="flex min-w-0 flex-col">
              <span className="font-semibold">{label}</span>
              {description && <span className="text-xs text-muted-foreground">{description}</span>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 5: The New sheet**

Create `customer-profile-new-sheet.tsx`:

```tsx
'use client'

import type { CustomerProfileMeeting } from '@/shared/entities/customers/types'
import type { NewSheetChoice, NewSheetStep, ProfileCommands } from '@/shared/entities/customers/types/profile-modal'
import { ChevronLeftIcon } from 'lucide-react'
import { useState } from 'react'
import { InlineSheet } from '@/shared/components/dialogs/sheets/inline-sheet'
import { InlineSheetBody } from '@/shared/components/dialogs/sheets/inline-sheet-body'
import { Button } from '@/shared/components/ui/button'
import { PROFILE_NEW_SHEET_ID, PROFILE_NEW_SHEET_TITLE_ID } from '@/shared/entities/customers/constants/profile-modal'
import { CustomerProfileNewMenu } from './customer-profile-new-menu'
import { CustomerProposalPicker } from './customer-proposal-picker'

interface Props {
  commands: ProfileCommands
  meetings: CustomerProfileMeeting[]
  onOpenChange: (open: boolean) => void
  open: boolean
}

export function CustomerProfileNewSheet({ commands, meetings, onOpenChange, open }: Props) {
  const [step, setStep] = useState<NewSheetStep>('menu')
  const [wasOpen, setWasOpen] = useState(open)

  // Every opening starts on the menu. Resetting on open rather than on close keeps the picker on
  // screen while the sheet slides away.
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setStep('menu')
    }
  }

  function handlePick(choice: NewSheetChoice) {
    if (choice === 'proposal') {
      setStep('proposal')
      return
    }
    onOpenChange(false)
    if (choice === 'meeting') {
      commands.openMeeting()
    }
    else {
      commands.openNote()
    }
  }

  return (
    <InlineSheet
      className="[--inline-sheet-offset:calc(4.25rem+env(safe-area-inset-bottom))]"
      id={PROFILE_NEW_SHEET_ID}
      labelledBy={PROFILE_NEW_SHEET_TITLE_ID}
      onOpenChange={onOpenChange}
      open={open}
    >
      {step === 'menu'
        ? (
            <div className="px-4 pt-1 pb-4">
              <h2 className="mb-3 text-base font-semibold" id={PROFILE_NEW_SHEET_TITLE_ID}>New</h2>
              <CustomerProfileNewMenu commands={commands} onPick={handlePick} />
            </div>
          )
        : (
            <>
              <div className="flex shrink-0 items-center gap-1 px-2 pb-2">
                <Button aria-label="Back" className="size-11" onClick={() => setStep('menu')} size="icon" variant="ghost">
                  <ChevronLeftIcon className="size-5" />
                </Button>
                <div className="flex min-w-0 flex-col">
                  <h2 className="text-base font-semibold" id={PROFILE_NEW_SHEET_TITLE_ID}>New proposal</h2>
                  <span className="text-xs text-muted-foreground">Attach it to a meeting</span>
                </div>
              </div>
              <InlineSheetBody className="px-4 pb-4">
                <CustomerProposalPicker
                  meetings={meetings}
                  onAddMeeting={() => {
                    onOpenChange(false)
                    commands.openMeeting()
                  }}
                  presentation="list"
                />
              </InlineSheetBody>
            </>
          )}
    </InlineSheet>
  )
}
```

The step resets with React's "adjust state while rendering" pattern (compare with the previous `open`), not in an effect: an effect would trip `react-hooks-extra/no-direct-set-state-in-use-effect`. The menu rows sit outside `InlineSheetBody`, so a drag that starts on them closes the sheet; the picker list sits inside it, so a long list scrolls natively.

- [ ] **Step 6: The pinned phone hero**

Create `customer-profile-phone-hero.tsx`:

```tsx
'use client'

import type { HeroView } from './hero-view-toggle'
import type { useCustomerEditForm } from '@/shared/entities/customers/hooks/use-customer-edit-form'
import type { CustomerProfileData } from '@/shared/entities/customers/types'
import { CustomerAddressHero } from './customer-address-hero'
import { CustomerHeroHeader } from './customer-hero-header'
import { CustomerProfileKeyInsights } from './customer-profile-key-insights'
import { HeroViewToggle } from './hero-view-toggle'

interface Props {
  customer: CustomerProfileData['customer']
  editForm: ReturnType<typeof useCustomerEditForm>
  heroAddress: string | null
  heroView: HeroView
  onHeroViewChange: (view: HeroView) => void
}

// Pinned above the scrolling tab content, so the name and the call/email discs never scroll away.
// It sizes to its content: edit mode grows it and the content area below gives up the room.
export function CustomerProfilePhoneHero({ customer, editForm, heroAddress, heroView, onHeroViewChange }: Props) {
  return (
    <div
      className="dark relative isolate flex min-h-56 shrink-0 flex-col justify-end overflow-hidden px-4 pt-[calc(env(safe-area-inset-top)+3.25rem)] pb-4 text-white"
      data-profile-hero
    >
      <CustomerAddressHero address={heroAddress} key={heroAddress} view={heroView} />
      {heroAddress && (
        // Inline `top`: an arbitrary `top-[max(env(…),…)]` class resolved to top:0 here when
        // measured, so the safe-area offset bypasses the class.
        <div className="absolute right-3 z-10" style={{ top: 'max(env(safe-area-inset-top), 0.75rem)' }}>
          <HeroViewToggle onChange={onHeroViewChange} value={heroView} />
        </div>
      )}
      <div className="relative z-10 flex min-w-0 flex-col gap-3">
        <CustomerHeroHeader customer={customer} editForm={editForm} layout="photo" />
        <CustomerProfileKeyInsights customer={customer} />
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Type-check and lint**

Run: `pnpm tsc && pnpm exec eslint --fix src/shared/entities/customers/components/profile/customer-profile-tab-bar-trigger.tsx src/shared/entities/customers/components/profile/customer-profile-new-button.tsx src/shared/entities/customers/components/profile/customer-profile-tab-bar.tsx src/shared/entities/customers/components/profile/customer-profile-new-menu.tsx src/shared/entities/customers/components/profile/customer-profile-new-sheet.tsx src/shared/entities/customers/components/profile/customer-profile-phone-hero.tsx`
Expected: no errors. These render nowhere until Task 5.

- [ ] **Step 8: Commit (only if per-task commits were chosen)**

```bash
git commit -m "feat(customers): profile tab bar, New sheet and pinned hero for phone" -- src/shared/entities/customers/components/profile/customer-profile-tab-bar-trigger.tsx src/shared/entities/customers/components/profile/customer-profile-new-button.tsx src/shared/entities/customers/components/profile/customer-profile-tab-bar.tsx src/shared/entities/customers/components/profile/customer-profile-new-menu.tsx src/shared/entities/customers/components/profile/customer-profile-new-sheet.tsx src/shared/entities/customers/components/profile/customer-profile-phone-hero.tsx
git show --stat HEAD
```

---

### Task 5: Rail, composition (one tree), modal shell, overview, meetings list

**Files:**
- Rewrite: `src/shared/entities/customers/components/profile/customer-hero-actions.tsx`
- Create: `src/shared/entities/customers/components/profile/customer-profile-rail.tsx`
- Create: `src/shared/entities/customers/components/profile/customer-profile-tab-panels.tsx`
- Create: `src/shared/entities/customers/components/profile/customer-profile-desktop-layout.tsx`
- Create: `src/shared/entities/customers/components/profile/customer-profile-phone-layout.tsx`
- Create: `src/shared/entities/customers/components/profile/customer-profile-loading-skeleton.tsx`
- Rewrite: `src/shared/entities/customers/components/profile/customer-profile-modal-content.tsx`
- Modify: `src/shared/entities/customers/components/profile/customer-profile-modal.tsx`
- Modify: `src/shared/entities/customers/components/profile/customer-profile-overview.tsx`
- Modify: `src/shared/entities/customers/components/lists/customer-meetings-list.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1–4.
- Produces: `<CustomerHeroActions commands meetings onClose />`; `<CustomerProfileRail commands customer editForm heroAddress heroView meetings onClose onHeroViewChange />` (renders `[data-profile-rail]`, `[data-profile-map]`); `<CustomerProfileTabPanels data editForm highlightMeetingId? onMutationSuccess onOpenMeeting />`; both layouts take `{ commands, data, editForm, heroAddress, heroView, highlightMeetingId?, onClose, onHeroViewChange, onMutationSuccess, onOpenMeeting, scrollerRef: RefObject<HTMLDivElement | null> }`, and the phone one also `{ newSheetOpen, onNewSheetOpenChange }`; each renders the scroller as `[data-profile-scroller]`; `<CustomerProfileLoadingSkeleton onClose />`; `CustomerProfileModalContent` props `{ data, defaultTab?: CustomerProfileTab, heroAddress, heroView, highlightMeetingId?, onClose, onHeroViewChange, onMutationSuccess }`; `CustomerProfileModal` keeps `{ customerId, defaultTab?: CustomerProfileTab, highlightMeetingId? }` (the 13 `openModal` callers compile unchanged); `CustomerMeetingsList` loses `customerName`.

- [ ] **Step 1: Rewrite the command stack**

Replace the whole of `customer-hero-actions.tsx`:

```tsx
'use client'

import type { CustomerProfileMeeting } from '@/shared/entities/customers/types'
import type { ProfileCommands } from '@/shared/entities/customers/types/profile-modal'
import { CalendarIcon, FileTextIcon, StickyNoteIcon, XIcon } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu'
import { CustomerProposalPicker } from './customer-proposal-picker'

interface Props {
  commands: ProfileCommands
  meetings: CustomerProfileMeeting[]
  onClose: () => void
}

// The rail's foot: the deal-advancing verbs, then Close. Call, text and email stay in the contact
// rows. The menu is non-modal because the profile dialog already owns focus and scroll locking.
export function CustomerHeroActions({ commands, meetings, onClose }: Props) {
  return (
    <div className="flex shrink-0 flex-col gap-2 border-t border-border px-6 pt-4 pb-5">
      {commands.canAddProposal && (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button className="h-11 w-full">
              <FileTextIcon />
              New proposal
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width)" side="top" sideOffset={8}>
            <CustomerProposalPicker meetings={meetings} onAddMeeting={commands.openMeeting} presentation="menu" />
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <div className="grid grid-cols-2 gap-2 has-[>:only-child]:grid-cols-1">
        {commands.canAddMeeting && (
          <Button className="h-11" onClick={commands.openMeeting} variant="outline">
            <CalendarIcon />
            Add meeting
          </Button>
        )}
        <Button className="h-11" onClick={commands.openNote} variant="outline">
          <StickyNoteIcon />
          Add note
        </Button>
      </div>
      <Button className="h-10 justify-start text-muted-foreground" onClick={onClose} variant="ghost">
        <XIcon />
        Close
        <kbd className="ml-auto rounded border border-border px-1.5 text-xs font-medium">Esc</kbd>
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: The rail**

Create `customer-profile-rail.tsx`:

```tsx
'use client'

import type { HeroView } from './hero-view-toggle'
import type { useCustomerEditForm } from '@/shared/entities/customers/hooks/use-customer-edit-form'
import type { CustomerProfileData, CustomerProfileMeeting } from '@/shared/entities/customers/types'
import type { ProfileCommands } from '@/shared/entities/customers/types/profile-modal'
import { getInitials } from '@/shared/entities/users/lib/get-initials'
import { CustomerAddressHero } from './customer-address-hero'
import { CustomerHeroActions } from './customer-hero-actions'
import { CustomerHeroHeader } from './customer-hero-header'
import { CustomerProfileKeyInsights } from './customer-profile-key-insights'
import { HeroViewToggle } from './hero-view-toggle'

interface Props {
  commands: ProfileCommands
  customer: CustomerProfileData['customer']
  editForm: ReturnType<typeof useCustomerEditForm>
  heroAddress: string | null
  heroView: HeroView
  meetings: CustomerProfileMeeting[]
  onClose: () => void
  onHeroViewChange: (view: HeroView) => void
}

// Who the customer is, top to bottom, ending in what to do next. The identity block scrolls on a
// short screen; the command stack stays pinned at the foot.
export function CustomerProfileRail({ commands, customer, editForm, heroAddress, heroView, meetings, onClose, onHeroViewChange }: Props) {
  return (
    <aside className="flex min-h-0 w-95 shrink-0 flex-col border-r border-border bg-card" data-profile-rail>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="dark relative isolate h-47.5 overflow-hidden" data-profile-map>
          <CustomerAddressHero address={heroAddress} key={heroAddress} view={heroView} />
          {heroAddress && (
            <div className="absolute top-3 right-3 z-10">
              <HeroViewToggle onChange={onHeroViewChange} value={heroView} />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3 px-6 pb-5">
          <div aria-hidden className="relative z-10 -mt-8.5 grid size-17 place-items-center rounded-2xl bg-primary text-xl font-semibold text-primary-foreground shadow-lg ring-4 ring-card">
            {getInitials(customer.name) || '—'}
          </div>
          <CustomerHeroHeader customer={customer} editForm={editForm} layout="rail" />
          <CustomerProfileKeyInsights customer={customer} />
        </div>
      </div>
      <CustomerHeroActions commands={commands} meetings={meetings} onClose={onClose} />
    </aside>
  )
}
```

The avatar is `relative z-10`: the map box is positioned, so an unpositioned avatar would paint under it.

- [ ] **Step 3: The shared tab panels**

Create `customer-profile-tab-panels.tsx`:

```tsx
'use client'

import type { useCustomerEditForm } from '@/shared/entities/customers/hooks/use-customer-edit-form'
import type { CustomerProfileData } from '@/shared/entities/customers/types'
import { TabsContent } from '@/shared/components/ui/tabs'
import { CustomerMeetingsList } from '../lists/customer-meetings-list'
import { CustomerProjectsList } from '../lists/customer-projects-list'
import { CustomerProfileOverview } from './customer-profile-overview'

interface Props {
  data: CustomerProfileData
  editForm: ReturnType<typeof useCustomerEditForm>
  highlightMeetingId?: string
  onMutationSuccess: () => void
  onOpenMeeting: (meetingId: string) => void
}

export function CustomerProfileTabPanels({ data, editForm, highlightMeetingId, onMutationSuccess, onOpenMeeting }: Props) {
  return (
    <>
      <TabsContent className="mt-0 p-4 md:p-6" value="overview">
        <CustomerProfileOverview data={data} editForm={editForm} onOpenMeeting={onOpenMeeting} />
      </TabsContent>
      <TabsContent className="mt-0 p-4 md:p-6" value="meetings">
        <CustomerMeetingsList
          customerId={data.customer.id}
          highlightMeetingId={highlightMeetingId}
          meetings={data.meetings}
          onMutationSuccess={onMutationSuccess}
        />
      </TabsContent>
      <TabsContent className="mt-0 p-4 md:p-6" value="projects">
        <CustomerProjectsList data={data} highlightMeetingId={highlightMeetingId} onMutationSuccess={onMutationSuccess} />
      </TabsContent>
    </>
  )
}
```

- [ ] **Step 4: The desktop arrangement**

Create `customer-profile-desktop-layout.tsx`:

```tsx
'use client'

import type { RefObject } from 'react'
import type { HeroView } from './hero-view-toggle'
import type { useCustomerEditForm } from '@/shared/entities/customers/hooks/use-customer-edit-form'
import type { CustomerProfileData } from '@/shared/entities/customers/types'
import type { ProfileCommands } from '@/shared/entities/customers/types/profile-modal'
import { TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { PROFILE_TAB_LABELS } from '@/shared/entities/customers/constants/profile-modal'
import { CustomerProfileRail } from './customer-profile-rail'
import { CustomerProfileTabPanels } from './customer-profile-tab-panels'

interface Props {
  commands: ProfileCommands
  data: CustomerProfileData
  editForm: ReturnType<typeof useCustomerEditForm>
  heroAddress: string | null
  heroView: HeroView
  highlightMeetingId?: string
  onClose: () => void
  onHeroViewChange: (view: HeroView) => void
  onMutationSuccess: () => void
  onOpenMeeting: (meetingId: string) => void
  scrollerRef: RefObject<HTMLDivElement | null>
}

// md and up: the identity rail on the left, underline tabs and one scrolling pane on the right.
export function CustomerProfileDesktopLayout({ commands, data, editForm, heroAddress, heroView, highlightMeetingId, onClose, onHeroViewChange, onMutationSuccess, onOpenMeeting, scrollerRef }: Props) {
  return (
    <>
      <CustomerProfileRail
        commands={commands}
        customer={data.customer}
        editForm={editForm}
        heroAddress={heroAddress}
        heroView={heroView}
        meetings={data.meetings}
        onClose={onClose}
        onHeroViewChange={onHeroViewChange}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <TabsList className="shrink-0 px-6" variant="underline">
          <TabsTrigger className="min-h-13" value="overview">{PROFILE_TAB_LABELS.overview}</TabsTrigger>
          <TabsTrigger className="min-h-13" value="meetings">{`${PROFILE_TAB_LABELS.meetings} (${data.meetings.length})`}</TabsTrigger>
          <TabsTrigger className="min-h-13" value="projects">{`${PROFILE_TAB_LABELS.projects} (${data.projects.length})`}</TabsTrigger>
        </TabsList>
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-gutter-stable" data-profile-scroller ref={scrollerRef}>
          <CustomerProfileTabPanels
            data={data}
            editForm={editForm}
            highlightMeetingId={highlightMeetingId}
            onMutationSuccess={onMutationSuccess}
            onOpenMeeting={onOpenMeeting}
          />
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 5: The phone arrangement**

Create `customer-profile-phone-layout.tsx`:

```tsx
'use client'

import type { RefObject } from 'react'
import type { HeroView } from './hero-view-toggle'
import type { useCustomerEditForm } from '@/shared/entities/customers/hooks/use-customer-edit-form'
import type { CustomerProfileData } from '@/shared/entities/customers/types'
import type { ProfileCommands } from '@/shared/entities/customers/types/profile-modal'
import { CustomerProfileNewSheet } from './customer-profile-new-sheet'
import { CustomerProfilePhoneHero } from './customer-profile-phone-hero'
import { CustomerProfileTabBar } from './customer-profile-tab-bar'
import { CustomerProfileTabPanels } from './customer-profile-tab-panels'

interface Props {
  commands: ProfileCommands
  data: CustomerProfileData
  editForm: ReturnType<typeof useCustomerEditForm>
  heroAddress: string | null
  heroView: HeroView
  highlightMeetingId?: string
  newSheetOpen: boolean
  onClose: () => void
  onHeroViewChange: (view: HeroView) => void
  onMutationSuccess: () => void
  onNewSheetOpenChange: (open: boolean) => void
  onOpenMeeting: (meetingId: string) => void
  scrollerRef: RefObject<HTMLDivElement | null>
}

// Below md: the hero is pinned on top, the tab bar on the bottom edge, and only the tab content
// between them scrolls. The New sheet rises from behind the tab bar, which stays live above it.
export function CustomerProfilePhoneLayout({ commands, data, editForm, heroAddress, heroView, highlightMeetingId, newSheetOpen, onClose, onHeroViewChange, onMutationSuccess, onNewSheetOpenChange, onOpenMeeting, scrollerRef }: Props) {
  return (
    <>
      <CustomerProfilePhoneHero
        customer={data.customer}
        editForm={editForm}
        heroAddress={heroAddress}
        heroView={heroView}
        onHeroViewChange={onHeroViewChange}
      />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-profile-scroller ref={scrollerRef}>
        <CustomerProfileTabPanels
          data={data}
          editForm={editForm}
          highlightMeetingId={highlightMeetingId}
          onMutationSuccess={onMutationSuccess}
          onOpenMeeting={onOpenMeeting}
        />
      </div>
      <CustomerProfileTabBar
        counts={{ meetings: data.meetings.length, projects: data.projects.length }}
        newSheetOpen={newSheetOpen}
        onClose={onClose}
        onToggleNew={() => onNewSheetOpenChange(!newSheetOpen)}
      />
      <CustomerProfileNewSheet commands={commands} meetings={data.meetings} onOpenChange={onNewSheetOpenChange} open={newSheetOpen} />
    </>
  )
}
```

- [ ] **Step 6: Loading skeleton in the new shape**

Create `customer-profile-loading-skeleton.tsx`:

```tsx
'use client'

import { XIcon } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { tabsTriggerVariants } from '@/shared/components/ui/tabs'
import { PROFILE_RAIL_MEDIA_QUERY } from '@/shared/entities/customers/constants/profile-modal'
import { useMediaQuery } from '@/shared/hooks/use-media-query'

interface Props {
  onClose: () => void
}

// The loaded modal's geometry (rail and pane, or hero, content and tab bar), so loading ends in a
// content swap rather than a layout jump. Close is live because the header X is hidden.
export function CustomerProfileLoadingSkeleton({ onClose }: Props) {
  const isDesktop = useMediaQuery(PROFILE_RAIL_MEDIA_QUERY)

  if (isDesktop) {
    return (
      <div className="flex min-h-0 w-full flex-1">
        <div className="flex w-95 shrink-0 flex-col border-r border-border bg-card">
          <div className="h-47.5 animate-pulse bg-linear-to-br from-black/85 via-black/75 to-black" />
          <div className="flex flex-1 flex-col gap-3 px-6 pb-5">
            <div className="relative -mt-8.5 size-17 rounded-2xl bg-skeleton ring-4 ring-card" />
            <div className="h-7 w-48 animate-pulse rounded-md bg-skeleton" />
            <div className="h-5 w-64 animate-pulse rounded bg-skeleton" />
            <div className="h-5 w-40 animate-pulse rounded bg-skeleton" />
            <div className="h-5 w-56 animate-pulse rounded bg-skeleton" />
          </div>
          <div className="flex flex-col gap-2 border-t border-border px-6 pt-4 pb-5">
            <div className="h-11 animate-pulse rounded-md bg-skeleton" />
            <div className="grid grid-cols-2 gap-2">
              <div className="h-11 animate-pulse rounded-md bg-skeleton" />
              <div className="h-11 animate-pulse rounded-md bg-skeleton" />
            </div>
            <Button className="h-10 justify-start text-muted-foreground" onClick={onClose} variant="ghost">
              <XIcon />
              Close
            </Button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="h-13 shrink-0 border-b border-border" />
          <div className="flex-1 space-y-3 p-6">
            <div className="h-4 w-24 animate-pulse rounded bg-skeleton" />
            <div className="h-20 animate-pulse rounded-lg bg-skeleton" />
            <div className="h-20 animate-pulse rounded-lg bg-skeleton" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <div className="h-56 shrink-0 animate-pulse bg-linear-to-br from-black/85 via-black/75 to-black" />
      <div className="flex-1 space-y-3 p-4">
        <div className="h-4 w-24 animate-pulse rounded bg-skeleton" />
        <div className="h-20 animate-pulse rounded-lg bg-skeleton" />
        <div className="h-20 animate-pulse rounded-lg bg-skeleton" />
      </div>
      <div className="grid shrink-0 grid-cols-5 gap-0.5 border-t border-border bg-card px-1.5 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))]">
        <button className={tabsTriggerVariants({ variant: 'bar' })} onClick={onClose} type="button">
          <XIcon className="size-5" />
          Close
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Rewrite the composition**

Replace the whole of `customer-profile-modal-content.tsx`:

```tsx
'use client'

import type { HeroView } from './hero-view-toggle'
import type { CustomerProfileData } from '@/shared/entities/customers/types'
import type { CustomerProfileTab } from '@/shared/entities/customers/types/profile-modal'
import { useRef, useState } from 'react'
import { Tabs } from '@/shared/components/ui/tabs'
import { PROFILE_RAIL_MEDIA_QUERY } from '@/shared/entities/customers/constants/profile-modal'
import { useCustomerEditForm } from '@/shared/entities/customers/hooks/use-customer-edit-form'
import { useProfileCommands } from '@/shared/entities/customers/hooks/use-profile-commands'
import { useMediaQuery } from '@/shared/hooks/use-media-query'
import { CustomerProfileCommandDialogs } from './customer-profile-command-dialogs'
import { CustomerProfileDesktopLayout } from './customer-profile-desktop-layout'
import { CustomerProfilePhoneLayout } from './customer-profile-phone-layout'

interface Props {
  data: CustomerProfileData
  defaultTab?: CustomerProfileTab
  heroAddress: string | null
  heroView: HeroView
  highlightMeetingId?: string
  onClose: () => void
  onHeroViewChange: (view: HeroView) => void
  onMutationSuccess: () => void
}

// One arrangement is mounted at a time, never both hidden by CSS: the edit form registers each
// input once, Radix trigger ids stay unique, and only one hero image tree loads.
export function CustomerProfileModalContent({ data, defaultTab, heroAddress, heroView, highlightMeetingId, onClose, onHeroViewChange, onMutationSuccess }: Props) {
  const isDesktop = useMediaQuery(PROFILE_RAIL_MEDIA_QUERY)
  const editForm = useCustomerEditForm(data.customer)
  const commands = useProfileCommands()
  const [tab, setTab] = useState<CustomerProfileTab>(defaultTab ?? 'overview')
  const [activeHighlightId, setActiveHighlightId] = useState(highlightMeetingId)
  const [newSheetOpen, setNewSheetOpen] = useState(false)
  const scrollerRef = useRef<HTMLDivElement>(null)

  // A new tab starts at its top; on phone the pinned hero means the old offset would land mid-list.
  function showTab(next: CustomerProfileTab) {
    setTab(next)
    setNewSheetOpen(false)
    scrollerRef.current?.scrollTo({ top: 0 })
  }

  function handleOpenMeeting(meetingId: string) {
    setActiveHighlightId(meetingId)
    showTab('meetings')
  }

  const shared = {
    commands,
    data,
    editForm,
    heroAddress,
    heroView,
    highlightMeetingId: activeHighlightId,
    onClose,
    onHeroViewChange,
    onMutationSuccess,
    onOpenMeeting: handleOpenMeeting,
    scrollerRef,
  }

  return (
    <Tabs
      className="relative flex min-h-0 w-full flex-1 flex-col gap-0 md:flex-row"
      onValueChange={value => showTab(value as CustomerProfileTab)}
      value={tab}
    >
      {isDesktop
        ? <CustomerProfileDesktopLayout {...shared} />
        : <CustomerProfilePhoneLayout {...shared} newSheetOpen={newSheetOpen} onNewSheetOpenChange={setNewSheetOpen} />}
      <CustomerProfileCommandDialogs commands={commands} customer={data.customer} onMutationSuccess={onMutationSuccess} />
    </Tabs>
  )
}
```

- [ ] **Step 8: The modal shell**

Replace the whole of `customer-profile-modal.tsx` (it drops `headerActions`, the in-file skeleton and the `CustomerHeroActions` / `HeroViewToggle` imports):

```tsx
'use client'

import type { HeroView } from './hero-view-toggle'
import type { CustomerProfileTab } from '@/shared/entities/customers/types/profile-modal'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Modal } from '@/shared/components/dialogs/modals/base-modal'
import { ErrorState } from '@/shared/components/states/error-state'
import { Button } from '@/shared/components/ui/button'
import { useInvalidation } from '@/shared/dal/client/hooks/use-invalidation'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { cn } from '@/shared/lib/utils'
import { useTRPC } from '@/trpc/helpers'
import { CustomerProfileLoadingSkeleton } from './customer-profile-loading-skeleton'
import { CustomerProfileModalContent } from './customer-profile-modal-content'

interface Props {
  customerId: string
  defaultTab?: CustomerProfileTab
  highlightMeetingId?: string
}

export function CustomerProfileModal({ customerId, defaultTab, highlightMeetingId }: Props) {
  const isOpen = useModalStore(state => state.isOpen)
  const close = useModalStore(state => state.close)
  const trpc = useTRPC()
  const { invalidateCustomer } = useInvalidation()
  const [heroView, setHeroView] = useState<HeroView>('street')

  const profileQuery = useQuery(
    trpc.customerPipelinesRouter.getCustomerProfile.queryOptions({ customerId }),
  )

  function handleMutationSuccess() {
    invalidateCustomer()
  }

  const customerName = profileQuery.data?.customer.name
  const title = customerName ? `${customerName}'s Profile` : 'Loading Profile...'

  const customer = profileQuery.data?.customer
  const heroAddress = customer
    ? [customer.address, customer.city, customer.state, customer.zip].filter(Boolean).join(', ') || null
    : null

  return (
    <Modal
      className={cn(
        'flex flex-col overflow-hidden',
        // md and up: 32px from every viewport edge, capped so a very wide screen does not stretch the pane.
        'md:h-[calc(100dvh-4rem)] md:max-h-none md:w-[calc(100vw-4rem)] md:max-w-[100rem]',
        // The base modal turns into a centered dialog at sm, but the rail needs 768px: stay fullscreen until md.
        'sm:max-md:h-full sm:max-md:max-h-none sm:max-md:max-w-full sm:max-md:rounded-none sm:max-md:border-0',
        // Close lives in the rail and the tab bar; the header's corner X would be a second home.
        '**:data-modal-close:hidden',
      )}
      close={close}
      isOpen={isOpen}
      title={title}
    >
      <div className="flex min-h-0 w-full flex-1 flex-col" data-modal-hero>
        {profileQuery.isPending && <CustomerProfileLoadingSkeleton onClose={close} />}

        {/* A failed refetch keeps the cached data, so the error state is only for a profile that never loaded. */}
        {profileQuery.isError && !profileQuery.data && (
          <div className="flex flex-1 items-center justify-center p-6">
            <ErrorState description="Could not load customer data" title="Failed to load profile">
              <Button className="mt-4 h-11 min-w-32" onClick={close} variant="outline">Close</Button>
            </ErrorState>
          </div>
        )}

        {profileQuery.data && (
          <CustomerProfileModalContent
            data={profileQuery.data}
            defaultTab={defaultTab}
            heroAddress={heroAddress}
            heroView={heroView}
            highlightMeetingId={highlightMeetingId}
            key={profileQuery.data.customer.id}
            onClose={close}
            onHeroViewChange={setHeroView}
            onMutationSuccess={handleMutationSuccess}
          />
        )}
      </div>
    </Modal>
  )
}
```

`isError && !data`: React Query keeps `data` when a background refetch fails, so the old `isError` check rendered the error state and the content together (owner approved the fix, 2026-10-01).

Why these classes win: the base modal and `DialogContent` already carry `sm:h-auto sm:max-h-[85vh] sm:max-w-106.25 sm:max-w-lg sm:rounded-lg sm:border`. `tailwind-merge` keeps both sets (different modifiers), and Tailwind 4.1.18 emits `sm:max-md:*` after `sm:*` and `md:*` after both, so the stacked overrides apply from 640 to 767 and the `md:` sizes from 768. A plain `max-md:` would be emitted before `sm:` and lose. `md:max-h-none` is needed, or the base `sm:max-h-[85vh]` would clamp the height. Centering stays `DialogContent`'s `top-[50%] left-[50%]` + translate, so the 4rem leaves 32px on each side.

- [ ] **Step 9: Overview without inner scrollers**

In `customer-profile-overview.tsx`, keep the imports and `Props`, and replace the component with:

```tsx
export function CustomerProfileOverview({ data, editForm, onOpenMeeting }: Props) {
  // The recording is the richest artifact for an agent picking up a live lead, so it leads. The
  // pane scrolls as one; activity and qualification sit side by side only from xl, because below
  // that the rail leaves the pane too narrow for two columns.
  return (
    <div className="flex flex-col gap-4">
      {data.hasRecording && <CustomerRecordingPlayer customerId={data.customer.id} />}
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className="min-w-0 xl:w-3/5">
          <CustomerTimeline data={data} onOpenMeeting={onOpenMeeting} />
        </div>
        <div className="min-w-0 space-y-4 xl:w-2/5">
          <CustomerProfileDetails customer={data.customer} editForm={editForm} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 10: One home for Add meeting**

In `lists/customer-meetings-list.tsx` (it carries uncommitted owner edits; touch only these lines):
1. Remove the imports `useState` (`react`), `Popover, PopoverContent, PopoverTrigger` and `CreateMeetingForm`.
2. Remove `customerName: string` from `Props` and `customerName,` from the destructuring.
3. Remove the `popoverOpen` state and `handleCreateSuccess`.
4. Replace the whole `{/* Header with Add Meeting */}` block (the `div` holding the `h4` and the `Popover`) with:

```tsx
      <h4 className="text-sm font-medium text-muted-foreground">
        {`Meetings (${meetings.length})`}
      </h4>
```

Keep `PlusIcon`, `Link`, `Button`, `ROOTS` and `useAbility` (the per-meeting "Create proposal" link still uses them).

- [ ] **Step 11: Type-check and lint**

Run: `pnpm tsc && pnpm exec eslint --fix src/shared/entities/customers/components/profile src/shared/entities/customers/components/lists/customer-meetings-list.tsx src/shared/entities/customers/hooks src/shared/entities/customers/constants/profile-modal.ts src/shared/entities/customers/types/profile-modal.ts src/shared/entities/customers/lib/format-profile-meeting.ts`
Expected: no errors. Then `grep -rn "headerActions\|variant=\"mobile\"\|customerName=" src/shared/entities/customers/components/profile` returns nothing.

- [ ] **Step 12: Clear the CSS cache and run the probe**

Find the dev server (`ss -ltnp | grep :${PORT:-3000}`); stop it (ask the controller first if it is not yours), `rm -rf .next`, restart `pnpm dev` in the background, and load `/dashboard/pipeline` once.
Run: `node .superpowers/sdd/customer-profile-modal/probe.mjs`
Expected: `ALL PASS`. `skip:` values are acceptable and must be reported (`heroPinned` / `tabResetsScroll` when the fixture's overview is shorter than the scroller, `pickerNavigates` when the first card's customer has no meetings). For a failure, fix the root cause in this task's files (or the Task 2–4 files it exposes), rerun once, and report what changed.

- [ ] **Step 13: Commit (only if per-task commits were chosen)**

```bash
git commit -m "feat(customers): profile modal identity rail and phone tab bar" -- src/shared/entities/customers/components/profile/customer-hero-actions.tsx src/shared/entities/customers/components/profile/customer-profile-rail.tsx src/shared/entities/customers/components/profile/customer-profile-tab-panels.tsx src/shared/entities/customers/components/profile/customer-profile-desktop-layout.tsx src/shared/entities/customers/components/profile/customer-profile-phone-layout.tsx src/shared/entities/customers/components/profile/customer-profile-loading-skeleton.tsx src/shared/entities/customers/components/profile/customer-profile-modal-content.tsx src/shared/entities/customers/components/profile/customer-profile-modal.tsx src/shared/entities/customers/components/profile/customer-profile-overview.tsx src/shared/entities/customers/components/lists/customer-meetings-list.tsx
git show --stat HEAD
```

---

### Task 6: Responsive pass, deep link, resize, keyboard, report

**Files:**
- Create: `.superpowers/sdd/customer-profile-modal/t6-checks.mjs` (gitignored)
- Create: `.superpowers/sdd/customer-profile-modal/task-6-report.md` (gitignored)
- Modify: only files created or modified in Tasks 1–5, for defects this task finds.

**Interfaces:**
- Consumes: the finished modal.
- Produces: the report with the probe JSON, the `t6-checks` JSON, the screenshot paths and the defects fixed.

- [ ] **Step 1: Write the deep-link, resize and keyboard checks**

Create `.superpowers/sdd/customer-profile-modal/t6-checks.mjs`:

```js
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const secret = readFileSync('.env.local', 'utf8').match(/^DEV_LOGIN_SECRET=(.*)$/m)[1].trim()
const BASE = `http://localhost:${process.env.PORT ?? 3000}`
const CARD = '[data-slot=card].cursor-pointer'
const wait = ms => new Promise(r => setTimeout(r, ms))
const focusedText = page => page.evaluate(() => document.activeElement?.textContent?.trim() ?? '')

async function signIn(page, redirect) {
  await page.goto(`${BASE}/api/dev/playwright-session?secret=${secret}&role=super-admin&redirect=${redirect}`, { timeout: 120000 })
}

async function openProfile(page) {
  await signIn(page, '/dashboard/pipeline')
  const card = page.locator(CARD).first()
  await card.waitFor({ timeout: 60000 })
  await card.locator('span.uppercase').first().click()
  const dialog = page.getByRole('dialog').first()
  await dialog.locator('[data-profile-scroller]').waitFor({ timeout: 30000 })
  await wait(800)
  return dialog
}

async function deepLink(browser, w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  await signIn(page, '/dashboard/meetings')
  const actions = page.getByRole('button', { name: 'Actions' }).first()
  await actions.waitFor({ timeout: 60000 })
  await actions.click()
  await page.getByRole('menuitem', { name: 'View Meeting' }).click()
  const dialog = page.getByRole('dialog').first()
  await dialog.locator('[data-profile-scroller]').waitFor({ timeout: 30000 })
  await wait(800)
  const selected = await dialog.locator('[role=tab][aria-selected=true]').first().getAttribute('aria-label')
    ?? await dialog.locator('[role=tab][aria-selected=true]').first().textContent()
  const r = { meetingsTab: /Meetings/.test(selected ?? ''), highlighted: (await dialog.locator('.outline-primary').count()) === 1 }
  await page.close()
  return r
}

// Crossing 768 with the modal open swaps arrangements; the tab and an unsaved edit must survive.
async function resize(browser) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } })
  const dialog = await openProfile(page)
  await dialog.getByRole('tab', { name: /^Meetings/ }).click()
  await dialog.getByRole('button', { name: 'Edit customer' }).click()
  const name = dialog.getByRole('textbox', { name: 'Customer name' })
  const typed = `${await name.inputValue()} probe`
  await name.fill(typed)
  await page.setViewportSize({ width: 700, height: 900 })
  await wait(600)
  const r = {
    phoneArrangement: await dialog.locator('[data-profile-tab-bar]').isVisible() && (await dialog.locator('[data-profile-rail]').count()) === 0,
    tabKept: /Meetings/.test(await dialog.locator('[role=tab][aria-selected=true]').first().getAttribute('aria-label') ?? ''),
    editKept: (await dialog.getByRole('textbox', { name: 'Customer name' }).inputValue()) === typed,
    singleTree: (await page.locator('input[name="phone"]').count()) === 1,
  }
  await dialog.getByRole('button', { name: 'Cancel editing' }).click()
  await page.close()
  return r
}

async function keyboardDesktop(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const dialog = await openProfile(page)
  const trigger = dialog.getByRole('button', { name: /New proposal/ })
  await trigger.focus()
  await page.keyboard.press('Enter')
  await wait(300)
  const menu = page.getByRole('menu')
  const r = { menuOpens: await menu.isVisible() }
  await page.keyboard.press('Escape')
  await wait(300)
  r.escClosesMenuOnly = (await menu.count()) === 0 && await dialog.isVisible()
  r.focusBackOnTrigger = /New proposal/.test(await focusedText(page))
  await page.keyboard.press('Escape')
  await wait(500)
  r.secondEscClosesModal = (await page.getByRole('dialog').count()) === 0
  await page.close()
  return r
}

async function keyboardPhone(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const dialog = await openProfile(page)
  const bar = dialog.locator('[data-profile-tab-bar]')
  await bar.getByRole('tab', { name: /^Overview/ }).focus()
  await page.keyboard.press('ArrowRight')
  const r = { arrowMovesToMeetings: /Meetings/.test(await focusedText(page)) }
  await bar.getByRole('button', { name: 'New', exact: true }).focus()
  await page.keyboard.press('Enter')
  await wait(400)
  r.focusInSheet = /New proposal/.test(await focusedText(page))
  await page.keyboard.press('Escape')
  await wait(400)
  r.focusBackOnNew = (await focusedText(page)) === 'New'
  r.modalStillOpen = await dialog.isVisible()
  await page.close()
  return r
}

const results = {}
const browser = await chromium.launch()
for (const [key, run] of [
  ['deepLinkDesktop', () => deepLink(browser, 1440, 900)],
  ['deepLinkPhone', () => deepLink(browser, 390, 844)],
  ['resize', () => resize(browser)],
  ['keyboardDesktop', () => keyboardDesktop(browser)],
  ['keyboardPhone', () => keyboardPhone(browser)],
]) {
  try {
    results[key] = await run()
  }
  catch (e) {
    results[key] = { error: String(e.message).split('\n')[0] }
  }
}
await browser.close()
console.log(JSON.stringify(results, null, 1))
const failed = Object.entries(results).flatMap(([k, r]) => Object.entries(r).filter(([, v]) => v !== true).map(([c]) => `${k}.${c}`))
console.log(failed.length ? `FAILED: ${failed.join(', ')}` : 'ALL PASS')
process.exit(failed.length ? 1 : 0)
```

`deepLink` uses the Meetings table's row action "View Meeting", which calls `handleView` in `src/shared/entities/meetings/components/meetings-table/use-meetings-table.tsx` (`defaultTab: 'meetings'`, `highlightMeetingId`). If the table at 390px renders no "Actions" button, open the same row action from whatever the phone view shows and note it in the report.

- [ ] **Step 2: Run the probe and the checks**

Run: `node .superpowers/sdd/customer-profile-modal/probe.mjs; node .superpowers/sdd/customer-profile-modal/t6-checks.mjs`
Expected: both `ALL PASS` (probe `skip:` values allowed, reported). Save both JSON outputs into the report.

- [ ] **Step 3: Read the screenshots**

Open each `.playwright-mcp/customer-profile-{desktop,laptop,wide,narrow,phone}-{light,dark}.png` and `customer-profile-{narrow,phone}-sheet-light.png`. Note each in the report as ok or a defect:
- desktop / laptop / wide: 32px margins (wide: centered with wide sides), rail 380px with the map on top, the avatar overlapping the map edge by half its height, command stack at the rail foot with Close last and left-aligned; underline tabs at the top of the pane; overview side by side at 1440 and 1920, stacked at 1024.
- narrow / phone: fullscreen, photo hero pinned on top, tab bar on the bottom edge with Close far left and the raised New disc centered; nothing clipped by the dialog edges.
- phone sheet: the sheet rests on the bar's top edge, the bar stays above the backdrop, the disc shows ×.
- dark: the rail and the bar sit on the card rung, text contrast holds.

- [ ] **Step 4: Fix what Steps 2–3 found, in one batch**

Classify each defect (missing token, one-off, conceptual mismatch, local defect) and fix at the narrowest correct level inside the allowed files. Rerun both scripts once. Do not start a second fix round; list anything left in the report.

- [ ] **Step 5: Type-check and lint**

Run: `pnpm tsc && pnpm exec eslint src/shared/entities/customers src/shared/components/ui/tabs.tsx src/shared/components/contact-actions src/shared/components/dialogs/sheets src/shared/hooks/use-media-query.ts src/shared/hooks/use-drag-to-close.ts src/shared/constants/drag-to-close.ts src/shared/constants/inline-sheet.ts`
Expected: no errors.

- [ ] **Step 6: Commit fixes (only if per-task commits were chosen and Step 4 changed files)**

```bash
git commit -m "fix(customers): profile modal responsive pass" -- <each file changed in Step 4>
git show --stat HEAD
```

After Task 6 the controller runs `/impeccable polish src/shared/entities/customers/components/profile` (one batched round, at most one confirmation round), then asks the owner for the hands-on phone check, including Add note and Add meeting (they write data, so no script does them).

---

## Follow-ups (not in this plan)

- Run the 7 sequential DAL queries behind `getCustomerProfile` in parallel where they are independent.
- A shared `prefetchCustomerProfile` on `pointerdown` / hover for the 13 `openModal` callers.
- Move `src/shared/components/ui/sidebar-mobile-sheet.tsx` onto `InlineSheet` and `useDragToClose`.
- Move the contacts in `src/features/agent-dashboard/ui/components/action-detail-sheet.tsx` onto `ContactActionTrigger`.
- Move Add note and Add meeting into the New sheet as further steps if the centered dialogs feel heavy on a phone.
- Owner naming call on the "New" label ("Create", "Add").
- Scroll a deep-linked meeting into view on a long Meetings list.

## Self-review against the spec

- §2 decisions: one tree via `useMediaQuery` (Task 1 Step 3, Task 5 Step 7); `InlineSheet` and its reasons (Task 2 Step 6, comment in the file); pinned hero with no name strip (Task 4 Step 6, Task 5 Step 5); tab switch scrolls to top (`showTab`, Task 5 Step 7); tabs `bar` variant with Close/New outside the tablist (Task 2 Step 3, Task 4 Step 3); `ContactActionTrigger` (Task 2 Step 4, Task 3); picker `Link` + `newForMeeting`, no `close()` (Task 1 Step 9); desktop 32px / 100rem (Task 5 Step 8); overview single column below `xl` (Task 5 Step 9); header X hidden and error Close (Task 5 Step 8); rail thumbnail 380×190 (Task 5 Step 2); Close on the left (Task 4 Step 3, Task 5 Step 1).
- §4 commands: `useProfileCommands` returns state and openers only (Task 1 Step 7); dialogs mounted once (Task 1 Step 8, Task 5 Step 7); New sheet steps, gating, reset on open, Back (Task 4 Steps 4–5); removals (Task 5 Steps 8 and 10).
- §4 shared primitives: each file in Task 2, checked in isolation by `primitives.mjs`.
- §5 data access: no task touches the DAL or tRPC.
- §6 edge cases: pending skeleton with Close (Task 5 Step 6); error Close (Task 5 Step 8, probe `errorClose`); no address (address row placeholder, toggle gated on `heroAddress`); gated phone (Task 3 Step 4); zero meetings (picker empty state); no create rights (menu filter, conditional rail buttons; Add note always present); edit mode (probe `editModePhone`); crossing 768 (`t6-checks` `resize`); long values (`title` + `truncate`); deep link (`t6-checks` `deepLink*`); safe areas (bar `pb`, hero `pt`, toggle `top`).
- §7 verification: `primitives.mjs` (Task 2), probe at 1440 / 1024 / 1920 / 700 / 390 × light / dark (Tasks 1, 5, 6), deep link / resize / keyboard (Task 6), screenshots (Task 6), polish and the owner check after Task 6.
- §8 files: every listed file has a task; the temporary check page is created and deleted in Task 2.
- Code check: every code block in this plan was written as a real file over the current tree and passed `tsc` and the project's ESLint config on 2026-10-01; every arbitrary class used was compiled against Tailwind 4.1.18.
