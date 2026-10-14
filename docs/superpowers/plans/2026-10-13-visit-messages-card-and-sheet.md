# Visit messages: card meter, visit sheet and conversation components (plan 3a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every eligible meeting card shows how confirmed its visit is (three strips), and one click opens a visit sheet with the text sequence and the full homeowner conversation, using conversation components plan 3b reuses.

**Architecture:** Part A builds everything that needs no new data: shared prerequisites, tokens, pure libraries with `scripts/verify-*.ts` tests, and presentational components that take typed props. The types Part A defines are the contract the backend returns. A USER GATE follows: the owner builds the §5 data access. Part B wires the card part, the hosted sheet, the conversation tab and the polling hooks, then a read-only Playwright probe verifies them.

**Tech Stack:** Next.js 15, React 19, tRPC + TanStack Query (`useTRPC` from `@/trpc/helpers`), Tailwind 4.3, shadcn new-york primitives, shadcn chat items (`message`, `bubble`, `marker`, `message-scroller` on `@shadcn/react@0.3.1`), Radix (via `radix-ui`), CASL (`useAbility`), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-13-visit-messages-control-and-conversations-design.md` (APPROVED 2026-10-13). Research note: `docs/plans/2026-10-12-messaging-ui-components-research.md`. Studies: https://claude.ai/artifact/KGiVahYKFHCMAkPLwmn5zF (round 7).

**Plan 3b** (the Conversations page, nav, dock, list, details sheet) is a separate plan. It reuses `ConversationThread`, `ConversationComposer`, `QuickMessagesManageSheet`, the quick-message libs and the hooks built here.

## Global Constraints

- **Tooling:** pnpm only. NEVER `pnpm build`. Verification is `pnpm tsc`, `pnpm lint`, `pnpm theme:check`, the `scripts/verify-*.ts` scripts, and the Playwright probe.
- **Git, the shared tree:** work on local `main`, a dirty workbench other sessions also use.
  - Never `git stash`, `git checkout -- .`, `git restore`, `git reset`, `git add -A`, `git add .` or `git add -u`.
  - Commit only by explicit path, in one Bash call (timeout ≥ 400000; the pre-commit hook takes about 110 s): `git add <paths> && git commit -m "<msg>" -- <paths>`.
  - End each message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - The "Commit" step of each task runs **only if the owner chose commit-per-task at the execution handoff**; otherwise leave the changes uncommitted and move on.
- **Data:** no DB writes for testing (dev included), no seeding, no `db:push` from any task. Verification never sends a text: the probe intercepts every write and aborts it.
- **Off-limits files:** read-only for every task here, because they are the owner's gate work (§5):
  - `src/trpc/**`
  - any `dal/` folder
  - `src/shared/db/schema/**`
  - `src/shared/domains/permissions/**`
  - every `service.ts` and `*.service.ts`
  - `src/shared/entities/customers/types/pipeline-item.ts`
  - `src/shared/entities/meetings/dal/**`

  Also do not edit `CONTEXT.md`, `docs/ubiquitous-language.md` or `docs/plans/2026-10-01-sales-lifecycle-rules-map.md` (another session has edits in flight). A task that seems to need any of these stops and reports.
- **Coding conventions:**
  - One React component per file. The `MeetingOverviewCard` compound's parts stay in `overview-card.tsx`, the existing exception.
  - No file-level constants in component files; they go in `constants/`.
  - Named exports; a props `interface` per component; `cn` from `@/shared/lib/utils`; app paths only via `ROOTS`.
  - Comments say why, never what: no banners, and no citing this plan or the spec in code.
- **Placement:** texting is VoIP. Conversation code lives in `src/shared/services/voip/{components,constants,hooks,lib,types}/`, and visit-message code in `src/shared/modules/meetings/messages/{components,constants,hooks,lib}/` (spec §4.4, §8).
- **Company facts** come only from `src/shared/constants/company/`, through the existing templates. This plan adds none.
- **Design system (spec §4.6):** both schemes, tokens only, no literal colours in class names. Status colour only through `toneClasses(tone)` from `@/shared/constants/status-tones`. The elevation rules by element:

  | Element | Classes |
  |---|---|
  | Page surface or sheet | `bg-card border rounded-xl shadow-xs` |
  | Panel inside a panel (reply area, step rows, Manage rows, editors) | another `bg-card` + `border`, which climbs a rung by itself |
  | Buttons and chips | `variant="outline"` (`bg-control` + `border-control-border`) |
  | Fields | the `Input` / `Textarea` / `InputGroup` primitives (they sink) |
  | Menus | `Popover` / `Command` (top rung) |
  | Tabs | the `Tabs` primitive |
  | Their bubble | `bg-muted` + `border` |
  | Our bubble | `bg-bubble-ours` |

- **Motion:** only the sheet primitive's own open and close and the Popover's pop, none under `prefers-reduced-motion`. No fades.
- **Breakpoint:** `lg` is the one switch, through `ResponsiveSheet` / `useIsBelowLg`.
- **Research note rules:**
  - Use the shadcn chat items as the messaging primitives.
  - No Vercel AI Elements (reserved for the future assistant).
  - Do not use the `tinted` bubble variant (it needs Safari 18+).
- **Freshness:** poll the open sheet and the open thread every 5 s (TanStack pauses in a hidden tab). Lists refetch on window focus (the TanStack default).
- **Verification recipe (UI tasks):**
  1. Run `ss -ltnp | grep -E ':(3000|3001)'` first. If a dev server is running, use it; never kill another session's server.
  2. The port comes from `.env.local` `PORT` (default 3000).
  3. Before judging CSS on a long-running server, stop *your own* server, `rm -rf .next`, and restart it.
  4. Playwright auth: `GET /api/dev/playwright-session?secret=$DEV_LOGIN_SECRET&redirect=<path>`.
  5. Viewports: 1440×900, 1024×768, 820×1180 and 390×844, light and dark.
  6. Screenshots go to `.playwright-mcp/`.

## Plan rulings on the spec

Each of these is a call the spec leaves open or one the code forces. The owner sees them here before execution.

1. **No `--bubble-theirs` token.** The ladder resolves `var()` where a token is declared: a `--bubble-theirs: var(--muted)` on `:root` would freeze at rung 1. Their bubble uses `bg-muted` + `border` directly (spec §4.6), and only `--bubble-ours` / `--bubble-ours-foreground` are added (§4.4, §9.6).
2. **The four chat items are written from the registry JSON, not through the CLI.** The CLI would add an npm package literally named `cn` and offer to overwrite our `button.tsx`. A fetch with the imports rewritten gives the same files without either (§9.3, §9.5).
3. **Only `scroll-fade-b` is copied** into `globals.css`, the one `scroll-fade` utility the items use. Nothing uses `shimmer`, so it is not added (§9.4).
4. **Tailwind 4.3 ships `scrollbar-gutter-stable`, `scrollbar-gutter-both` and `scrollbar-none`** (verified by compiling 4.3.3).
   - Our two gutter utilities are identical to the built-ins and are deleted (§9.1).
   - Our `scrollbar-none` stays: Tailwind merges it with the built-in, and it adds the `::-webkit-scrollbar` rule Safari before 18.2 needs.
5. **`ConversationThread` is presentational.** "Takes a thread id or a meeting id" (§4.4) is its data hook, `useConversationThread({ meetingId } | { threadId })`.
6. **`ResponsiveSheet` gains only `bodyClassName`.** Radix Tabs must wrap the tab list and the panels, so the visit sheet lays out its own header row, tabs and reply box inside the body.
7. **The two automatic kinds share one row file**, `visit-automatic-step.tsx`, because their UI is identical. The summary and the invite each get their own.
8. **An office confirmation's status line** reads `Confirmed by the office · {day}`. §3.1 lists the text and page wordings only, but the meter's `via` includes `office`.
9. **The calendar invite after the summary went out with no invite** reads `Not sent: there is no email on file`, with **Edit email**.
10. **The editors' field chips use the existing token labels** (`Specialist name`, `Coordinator name`), not new short names, so one vocabulary covers `[Field]` text.
11. **The "Visit messages" action also shows in ⋯ menus**, hidden on any meeting that carries no meter.
12. **Contract details beyond §5.1** are the shapes the UI reads, and the USER GATE lists them in full:
    - per-step wording and actors;
    - `vars`, `texting`, `phoneChangedSinceFailure`, `threadMessageCount` and the invite on the sheet read;
    - the thread read accepting `{ meetingId }`.

## Review Focus

- **A homeowner reply arriving while the visit sheet is open must not flip the tab.** The reader stays where they are. Pinned by Task 14's poll-intercept check.
- **A fast double Enter in the reply box must send once.** Pinned by Task 14's send-intercept check (the request is aborted, nothing is sent).
- **Clicking the strips on a card opens the visit sheet only**, never the card's own View (the customer profile). Pinned by Task 14's single-dialog check.
- **A long unbroken visit link in a bubble must wrap at 390 px**, with no sideways scroll in the thread. Pinned by Task 14's overflow check.
- **A mistyped `[Field]` label must warn**, never vanish silently into the text. Pinned by Task 3's and Task 4's unit tests.

---

# Part A: no new data

### Task 1: Shared prerequisites (Tailwind 4.3, `@shadcn/react`, button sizes, chat primitives)

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`
- Modify: `src/app/(frontend)/globals.css` (around line 1158, the scrollbar utilities)
- Modify: `src/shared/components/ui/button.tsx:27-34` (sizes)
- Create: `src/shared/components/ui/message.tsx`, `bubble.tsx`, `marker.tsx`, `message-scroller.tsx`

**Interfaces:**
- Produces:
  - Button sizes `icon-sm` (`size-8`) and `icon-xs` (`size-6`).
  - From `@/shared/components/ui/message`: `MessageGroup`, `Message` (`align?: 'start' | 'end'`), `MessageAvatar`, `MessageContent`, `MessageHeader`, `MessageFooter`.
  - From `bubble`: `BubbleGroup`, `Bubble` (`variant`, `align`), `BubbleContent` (`asChild`), `BubbleReactions`.
  - From `marker`: `Marker` (`variant?: 'default' | 'separator' | 'border'`), `MarkerIcon`, `MarkerContent`, `markerVariants`.
  - From `message-scroller`: `MessageScrollerProvider` (`autoScroll`, `defaultScrollPosition`), `MessageScroller`, `MessageScrollerViewport` (`preserveScrollOnPrepend`), `MessageScrollerContent` (default `role="log"`), `MessageScrollerItem` (`messageId`), `MessageScrollerButton`, `useMessageScroller`.

- [ ] **Step 1: Update Tailwind inside its `^4` range and confirm the version**

```bash
pnpm update tailwindcss @tailwindcss/postcss
pnpm ls tailwindcss @tailwindcss/postcss
```
Expected: both at `4.3.x` (4.3.3 on 2026-10-13). `package.json` keeps `"^4"`, and only the lockfile moves.

- [ ] **Step 2: Add `@shadcn/react`**

```bash
pnpm add @shadcn/react@0.3.1
```
Expected: `"@shadcn/react": "0.3.1"` (or `^0.3.1`) in `dependencies`.

- [ ] **Step 3: Delete our two gutter utilities, which Tailwind 4.3 now ships with identical CSS**

In `src/app/(frontend)/globals.css`, delete this whole block (the comment and both utilities):

```css
/* Inner scroll containers: the html-level gutter rule never reaches them, and a
   classic scrollbar appearing narrows the content by ~10px. `stable` reserves the
   gutter on overflow auto/hidden/scroll alike, so pair it only with the element that
   scrolls. `both` keeps centered content centered. */
@utility scrollbar-gutter-stable {
  scrollbar-gutter: stable;
}
@utility scrollbar-gutter-both {
  scrollbar-gutter: stable both-edges;
}
```

Keep `@utility scrollbar-none` and its comment, and add one line to that comment so it reads:

```css
/* Data scrollers (tables, boards, the schedule) scroll by touch, trackpad or wheel with no bar: a
   classic desktop bar takes layout room the overlay bars on phones never do. Tailwind's own
   scrollbar-none merges with this; the WebKit rule is for Safari before 18.2. */
```

- [ ] **Step 4: Add the `scroll-fade-b` utility (copied verbatim from `shadcn@4.21.4` `dist/tailwind.css`)**

Append to `src/app/(frontend)/globals.css`, directly after the `@utility scrollbar-none { … }` block:

```css
/* The message scroller fades its last line under the reply box; copied from shadcn's tailwind.css,
   which this app does not import. */
@property --scroll-fade-b {
  syntax: "<length-percentage>";
  inherits: false;
  initial-value: 0px;
}
@property --scroll-fade-mask {
  syntax: "*";
  inherits: false;
}
@theme inline {
  @keyframes scroll-fade-reveal-b {
    from {
      --scroll-fade-b: var(--_scroll-fade-size-b, var(--scroll-fade-size, min(12%, calc(var(--spacing) * 10))));
    }
    to {
      --scroll-fade-b: 0px;
    }
  }
}
@utility scroll-fade-b {
  --_scroll-fade-size-b: var(
    --scroll-fade-b-size,
    var(--scroll-fade-size, min(12%, calc(var(--spacing) * 10)))
  );
  --scroll-fade-mask: linear-gradient(
    to bottom,
    #000 0,
    #000 calc(100% - var(--scroll-fade-b, 0px)),
    transparent 100%
  );
  -webkit-mask-image: var(--scroll-fade-mask);
  mask-image: var(--scroll-fade-mask);
  -webkit-mask-composite: source-in;
  mask-composite: intersect;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;

  @supports (animation-timeline: scroll()) {
    animation: scroll-fade-reveal-b 1ms ease-in-out;
    animation-timeline: scroll(self y);
    animation-range: calc(
        100% - var(--scroll-fade-reveal, calc(var(--spacing) * 24))
      )
      100%;
    animation-fill-mode: both;
  }

  @supports not (animation-timeline: scroll()) {
    --scroll-fade-b: var(--_scroll-fade-size-b);
  }
}
```

- [ ] **Step 5: Add the two icon button sizes**

In `src/shared/components/ui/button.tsx`, replace the `icon:` size line:

```ts
        icon: 'size-9 [--press-scale:0.9]',
```
with:
```ts
        'icon': 'size-9 [--press-scale:0.9]',
        'icon-sm': 'size-8 [--press-scale:0.9]',
        'icon-xs': 'size-6 rounded-sm [--press-scale:0.9] [&_svg:not([class*="size-"])]:size-3.5',
```
Quote the existing keys only if lint asks for consistent quoting (`pnpm eslint --fix` decides).

- [ ] **Step 6: Write the four chat items from the registry, with our imports**

```bash
for item in message bubble marker message-scroller; do
  curl -fsSL "https://ui.shadcn.com/r/styles/new-york-v4/$item.json" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).files[0].content))' \
  | sed -e 's#from "cn"#from "@/shared/lib/utils"#' \
        -e 's#"@/registry/new-york-v4/ui/button"#"@/shared/components/ui/button"#' \
  > "src/shared/components/ui/$item.tsx"
done
pnpm eslint --fix src/shared/components/ui/message.tsx src/shared/components/ui/bubble.tsx src/shared/components/ui/marker.tsx src/shared/components/ui/message-scroller.tsx
```

- [ ] **Step 7: Check the written files match what this plan expects**

```bash
grep -n "from 'cn'\|registry" src/shared/components/ui/{message,bubble,marker,message-scroller}.tsx
grep -n "^export" src/shared/components/ui/{message,bubble,marker,message-scroller}.tsx
grep -n "scroll-fade-b\|scrollbar-thin\|inset-s-1/2\|icon-sm" src/shared/components/ui/message-scroller.tsx
```
Expected:
- The first grep prints nothing.
- The exports match the Interfaces list above. If the registry has changed and an export is missing or renamed, STOP and report.
- The third grep finds all four classes.

- [ ] **Step 8: Static checks**

Run: `pnpm tsc && pnpm lint && pnpm theme:check`
Expected: all pass.

`grep -rn "scrollbar-gutter-stable" src --include=*.tsx | head -3` still lists users; they now get Tailwind's built-in.

- [ ] **Step 9: Visual check that the gutter and scrollbar utilities still apply**

With the dev server, open `/dashboard/schedule` and any page with a `ResponsiveSheet` (a meeting's ⋯ → Notes). In DevTools, check that the sheet body element's computed `scrollbar-gutter` is `stable`.

- [ ] **Step 10: Commit** (only if commit-per-task was chosen)

```bash
git add package.json pnpm-lock.yaml "src/app/(frontend)/globals.css" src/shared/components/ui/button.tsx src/shared/components/ui/message.tsx src/shared/components/ui/bubble.tsx src/shared/components/ui/marker.tsx src/shared/components/ui/message-scroller.tsx && git commit -m "feat(ui): shadcn chat primitives on Tailwind 4.3, icon-sm/icon-xs button sizes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- package.json pnpm-lock.yaml "src/app/(frontend)/globals.css" src/shared/components/ui/button.tsx src/shared/components/ui/message.tsx src/shared/components/ui/bubble.tsx src/shared/components/ui/marker.tsx src/shared/components/ui/message-scroller.tsx
```

---

### Task 2: Bubble tokens and our bubble variants

**Files:**
- Modify: `src/app/(frontend)/globals.css` (light block after line 118, dark block after line 455, `@theme inline` after line 789)
- Modify: `scripts/check-theme-contrast.ts` (the `pairs` array)
- Modify: `src/shared/components/ui/bubble.tsx` (`bubbleVariants`)

**Interfaces:**
- Consumes: `bubble.tsx` from Task 1.
- Produces:
  - `Bubble` variants `ours`, `theirs` and `scheduled`, plus the shipped `destructive`.
  - The utilities `bg-bubble-ours` and `text-bubble-ours-foreground`.

- [ ] **Step 1: Add the failing contrast pair**

In `scripts/check-theme-contrast.ts`, directly after the line `{ label: 'button label on primary', fg: '--primary-foreground', bg: '--primary', min: 4.5 },` add:

```ts
  // Our texts in a thread are white on a solid green, iOS style; a lighter green drops the ink under 4.5:1.
  { label: 'text on our message bubble', fg: '--bubble-ours-foreground', bg: '--bubble-ours', min: 4.5 },
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm theme:check`
Expected: FAIL, because the tokens are not defined yet (the script reports the missing token or a failing pair).

- [ ] **Step 3: Add the tokens**

In `src/app/(frontend)/globals.css`, after the light block's `  --status-danger-dot: oklch(0.61 0.2 27);` add:

```css
  /* Our side of a text thread. Solid, so white ink holds 4.5:1 on any rung. */
  --bubble-ours: oklch(0.52 0.13 152);
  --bubble-ours-foreground: oklch(1 0 0);
```

After the dark block's `  --status-danger-dot: oklch(0.7 0.17 27);` add:

```css
  --bubble-ours: oklch(0.5 0.12 152);
  --bubble-ours-foreground: oklch(1 0 0);
```

In `@theme inline`, after `  --color-status-danger-dot: var(--status-danger-dot);` add:

```css
  --color-bubble-ours: var(--bubble-ours);
  --color-bubble-ours-foreground: var(--bubble-ours-foreground);
```

- [ ] **Step 4: Run the check**

Run: `pnpm theme:check`
Expected: `all N checks pass`. If the new pair fails in a scheme, lower that scheme's `--bubble-ours` lightness by 0.02 and run again until it passes.

- [ ] **Step 5: Add the variants**

In `src/shared/components/ui/bubble.tsx`, inside `bubbleVariants` → `variants.variant`, add after `destructive: …,`:

```ts
        // Ours and theirs, iOS style: a solid green under white ink, and one rung above the thread
        // surface with its edge. `scheduled` is a text that has not gone out yet.
        ours: '*:data-[slot=bubble-content]:bg-bubble-ours *:data-[slot=bubble-content]:text-bubble-ours-foreground',
        theirs: '*:data-[slot=bubble-content]:border-border *:data-[slot=bubble-content]:bg-muted *:data-[slot=bubble-content]:text-foreground',
        scheduled: '*:data-[slot=bubble-content]:border-dashed *:data-[slot=bubble-content]:border-border-strong *:data-[slot=bubble-content]:bg-transparent *:data-[slot=bubble-content]:text-muted-foreground',
```

- [ ] **Step 6: Static checks**

Run: `pnpm tsc && pnpm lint && pnpm theme:check`
Expected: all pass.

- [ ] **Step 7: Commit** (only if commit-per-task was chosen)

```bash
git add "src/app/(frontend)/globals.css" scripts/check-theme-contrast.ts src/shared/components/ui/bubble.tsx && git commit -m "feat(ui): bubble-ours token and ours/theirs/scheduled bubble variants

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- "src/app/(frontend)/globals.css" scripts/check-theme-contrast.ts src/shared/components/ui/bubble.tsx
```

---

### Task 3: VoIP text libraries (field labels, failure copy, quick messages, thread days)

**Files:**
- Modify: `src/shared/services/voip/lib/sms-merge-template.ts`
- Create:
  - `src/shared/services/voip/types/conversation.ts`
  - `src/shared/services/voip/constants/twilio-failure-copy.ts`
  - `src/shared/services/voip/constants/texting-blocked-copy.ts`
  - `src/shared/services/voip/constants/quick-message-defaults.ts`
  - `src/shared/services/voip/constants/quick-message-tokens.ts`
  - `src/shared/services/voip/constants/conversation-copy.ts`
  - `src/shared/services/voip/lib/twilio-failure-copy.ts`
  - `src/shared/services/voip/lib/sms-editor-copy.ts`
  - `src/shared/services/voip/lib/quick-messages.ts`
  - `src/shared/services/voip/lib/thread-days.ts`
  - `src/shared/services/voip/lib/describe-conversation-message.ts`
  - `src/shared/services/voip/lib/insert-text.ts`
  - `src/shared/modules/meetings/messages/lib/sample-visit-message-vars.ts`
- Test: `scripts/verify-conversation-text.ts`

**Interfaces:**
- Consumes: `VISIT_MESSAGE_TOKENS`, `VisitMessageVars`, `renderVisitMessage`, `formatBusinessClock`, `formatBusinessTime`, `businessDayKey`, `countSmsSegments`, and the step titles `VISIT_STEP_TITLES` (created in Task 4; this task creates the constants file `visit-step-copy.ts` ahead of time, see Step 3).
- Produces: every export below, with exactly these names. Tasks 6–9 and 13 import them.

- [ ] **Step 1: Write the failing test**

Create `scripts/verify-conversation-text.ts`:

```ts
/* eslint-disable no-console */
import type { QuickMessage } from '@/shared/services/voip/types/conversation'

import assert from 'node:assert/strict'

import { VISIT_MESSAGE_TOKENS } from '@/shared/modules/meetings/messages/constants/templates'
import { sampleVisitMessageVars } from '@/shared/modules/meetings/messages/lib/sample-visit-message-vars'
import { QUICK_MESSAGE_DEFAULTS } from '@/shared/services/voip/constants/quick-message-defaults'
import { messageFooter, messageHeader } from '@/shared/services/voip/lib/describe-conversation-message'
import { insertText } from '@/shared/services/voip/lib/insert-text'
import {
  checkQuickMessage,
  emptyVisitMessageVars,
  fillQuickMessage,
  moveQuickMessage,
  pickQuickChips,
  quickContextFor,
  quickMenuGroups,
} from '@/shared/services/voip/lib/quick-messages'
import { keepFieldsMessage, segmentCountCopy, unknownFieldWarning } from '@/shared/services/voip/lib/sms-editor-copy'
import { fromFieldLabels, resolveMergeSections, toFieldLabels, unknownFieldLabels } from '@/shared/services/voip/lib/sms-merge-template'
import { groupThreadDays } from '@/shared/services/voip/lib/thread-days'
import { twilioFailureCopy } from '@/shared/services/voip/lib/twilio-failure-copy'

const vars = sampleVisitMessageVars()

// Field labels
assert.equal(toFieldLabels('Hi {{first_name}} at {{visit_time}} {{nope}}', VISIT_MESSAGE_TOKENS), 'Hi [First name] at [Visit time] {{nope}}')
assert.equal(fromFieldLabels('Hi [first name] at [Visit time] [Visit tme]', VISIT_MESSAGE_TOKENS), 'Hi {{first_name}} at {{visit_time}} [Visit tme]')
assert.deepEqual(unknownFieldLabels('Hi [First name], see you [Visit tme] [Visit tme]', VISIT_MESSAGE_TOKENS), ['[Visit tme]'])
const sectioned = 'A{{#specialist_name}} with {{specialist_name}}{{/specialist_name}}{{^specialist_name}} soon{{/specialist_name}}'
assert.equal(resolveMergeSections(sectioned, VISIT_MESSAGE_TOKENS, { ...vars, specialistName: null }), 'A soon')
assert.equal(resolveMergeSections(sectioned, VISIT_MESSAGE_TOKENS, vars), 'A with {{specialist_name}}')
assert.equal(fromFieldLabels(toFieldLabels('{{visit_link}} {{visit_date}}', VISIT_MESSAGE_TOKENS), VISIT_MESSAGE_TOKENS), '{{visit_link}} {{visit_date}}')

// Editor copy
assert.equal(unknownFieldWarning('[Visit tme]'), '[Visit tme] isn\'t a field, so it goes out exactly as typed.')
assert.equal(keepFieldsMessage([]), null)
assert.equal(keepFieldsMessage(['[Visit link]']), 'Keep [Visit link]: this text needs it.')
assert.equal(keepFieldsMessage(['[Specialist name]', '[Arrival window]', '[Visit link]']), 'Keep [Specialist name], [Arrival window] and [Visit link]: this text needs them.')
assert.equal(segmentCountCopy('a'.repeat(160)), '160 characters · 1 text')
assert.equal(segmentCountCopy('a'.repeat(161)), '161 characters · 2 texts')
assert.equal(segmentCountCopy('Hi 👋'), '5 characters · 1 text (an emoji makes each text hold 70 characters)')

// Twilio copy
assert.equal(twilioFailureCopy('twilio:30006'), 'landline or can\'t receive texts')
assert.equal(twilioFailureCopy('21610'), 'they opted out (STOP)')
assert.equal(twilioFailureCopy('twilio:30004'), 'they opted out (STOP)')
assert.equal(twilioFailureCopy('30007'), 'blocked by the carrier as spam')
assert.equal(twilioFailureCopy('twilio:12345'), 'the carrier didn\'t deliver it (Twilio 12345)')
assert.equal(twilioFailureCopy('send_error'), 'the send failed')
assert.equal(twilioFailureCopy(null), 'the send failed')

// Quick messages
const messages: QuickMessage[] = QUICK_MESSAGE_DEFAULTS.map((draft, index) => ({ ...draft, id: draft.command, sortOrder: index }))
const visit = { meetingId: 'm1', vars, confirmed: false }
const customer = { id: 'c1', firstName: 'Maria' }
const outbound = { type: 'message' as const, id: 'o', direction: 'outbound' as const, source: { type: 'automatic' as const }, body: 'x', status: 'delivered' as const, at: '2026-10-09T17:00:00.000Z', failureReason: null, yesMatch: null }
const inbound = { ...outbound, id: 'i', direction: 'inbound' as const, source: { type: 'homeowner' as const }, status: 'received' as const, at: '2026-10-09T18:00:00.000Z' }

assert.equal(quickContextFor({ customer: null, visit: null, items: [] }).state, 'unknown_number')
assert.equal(quickContextFor({ customer, visit: null, items: [] }).state, 'no_visit')
assert.equal(quickContextFor({ customer, visit, items: [outbound, inbound] }).state, 'waiting_reply')
assert.equal(quickContextFor({ customer, visit, items: [inbound, outbound] }).state, 'unconfirmed')
assert.equal(quickContextFor({ customer, visit: { ...visit, confirmed: true }, items: [] }).state, 'confirmed')

const unconfirmed = { state: 'unconfirmed' as const, vars }
assert.deepEqual(pickQuickChips(messages, unconfirmed).map(message => message.command), ['confirm', 'link', 'joining', 'how'])
assert.deepEqual(pickQuickChips(messages, { ...unconfirmed, vars: { ...vars, visitLink: '' } }).map(message => message.command), ['confirm', 'joining'])
assert.deepEqual(pickQuickChips(messages, { state: 'waiting_reply', vars }).map(message => message.command), ['newtime', 'moved', 'link'])
assert.deepEqual(pickQuickChips(messages, { state: 'unknown_number', vars: emptyVisitMessageVars(null) }).map(message => message.command), ['who'])

const unknownMenu = quickMenuGroups(messages, { state: 'unknown_number', vars: emptyVisitMessageVars(null) }, '')
assert.deepEqual(unknownMenu.map(group => group.groupName), ['Confirm', 'Reschedule', 'Before the visit', 'Unknown number'])
const confirmItem = unknownMenu[0].items.find(item => item.message.command === 'confirm')
assert.equal(confirmItem?.disabledReason, 'Needs a visit')
assert.equal(unknownMenu[0].items.find(item => item.message.command === 'joining')?.disabledReason, null)
assert.deepEqual(quickMenuGroups(messages, unconfirmed, 'res').flatMap(group => group.items.map(item => item.message.command)), ['link'])

assert.equal(
  fillQuickMessage(messages[0].body, vars),
  'Hi Maria, just checking we\'re still on for Wed, Oct 7 at 10:00 AM. Reply YES to confirm.',
)
assert.deepEqual(moveQuickMessage(messages, 'link', -1).slice(0, 3), ['link', 'confirm', 'joining'])
assert.deepEqual(moveQuickMessage(messages, 'confirm', -1).slice(0, 3), ['confirm', 'link', 'joining'])

const taken = checkQuickMessage({ name: 'Again', command: '/Confirm', groupName: 'Confirm', text: 'See you [Visit tme]' }, messages, null)
assert.equal(taken.draft.command, 'confirm')
assert.equal(taken.errors.command, 'That command is taken by Ask to confirm.')
assert.deepEqual(taken.warnings, ['[Visit tme] isn\'t a field, so it goes out exactly as typed.'])
assert.equal(checkQuickMessage({ name: 'Ask to confirm', command: 'confirm', groupName: 'Confirm', text: 'Hi [First name]' }, messages, 'confirm').errors.command, undefined)
assert.equal(checkQuickMessage({ name: '', command: 'x', groupName: '', text: '' }, messages, null).errors.name, 'Give it a name.')
assert.equal(checkQuickMessage({ name: 'a', command: 'x', groupName: 'g', text: 'b' }, messages, null).errors.command, 'Use 2 to 20 lowercase letters, numbers or dashes.')
assert.equal(checkQuickMessage({ name: 'a', command: 'ab', groupName: 'g', text: 'Hi [First name]' }, messages, null).draft.body, 'Hi {{first_name}}')

// Thread days and message lines
const days = groupThreadDays([outbound, inbound, { ...inbound, id: 'i2', at: '2026-10-13T18:00:00.000Z' }], new Date('2026-10-13T20:00:00.000Z'))
assert.deepEqual(days.map(day => day.label), ['Friday, Oct 9', 'Today'])
assert.equal(days[0].items.length, 2)
assert.equal(messageHeader({ type: 'visit_message', kind: 'visit_summary', sentByFirstName: 'Dana' }), 'Visit summary · sent by Dana')
assert.equal(messageHeader({ type: 'visit_message', kind: 'confirmation_reply', sentByFirstName: null }), 'Automatic reply')
assert.equal(messageHeader({ type: 'staff', firstName: 'Dana' }), 'Dana')
assert.equal(messageHeader({ type: 'homeowner' }), null)
assert.deepEqual(messageFooter(outbound), { text: '10:00 AM · Delivered', failed: false })
assert.deepEqual(messageFooter({ ...outbound, status: 'queued' }), { text: 'Sending…', failed: false })
assert.deepEqual(messageFooter({ ...outbound, status: 'undelivered', failureReason: 'twilio:30006' }), { text: '10:00 AM · Not delivered: landline or can\'t receive texts', failed: true })
assert.deepEqual(messageFooter(inbound), { text: '11:00 AM', failed: false })

assert.deepEqual(insertText('Hi there', 3, 8, '[First name]'), { value: 'Hi [First name]', caret: 15 })

console.log('✅ conversation text helpers verified')
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm tsx --import ./scripts/lib/stub-server-only.mjs scripts/verify-conversation-text.ts`
Expected: FAIL with "Cannot find module" for the new files.

- [ ] **Step 3: Write the types and constants**

Create `src/shared/services/voip/types/conversation.ts`:

```ts
import type { VoipMessageStatus } from '@/shared/constants/enums/voip'
import type { MeetingMessageKind, PausableVisitMessageKind } from '@/shared/modules/meetings/messages/constants/kinds'
import type { VisitMessageVars } from '@/shared/modules/meetings/messages/types'
import type { TextingBlockedReason } from '@/shared/services/voip/constants/texting-blocked-copy'

export interface QuickMessageDraft {
  command: string
  name: string
  groupName: string
  /** In `{{token}}` form, like the visit-message templates. */
  body: string
}

export interface QuickMessage extends QuickMessageDraft {
  id: string
  sortOrder: number
}

export type QuickMessageThreadState = 'unknown_number' | 'waiting_reply' | 'unconfirmed' | 'confirmed' | 'no_visit'

export interface QuickMessageContext {
  state: QuickMessageThreadState
  /** Empty strings for whatever the thread does not have, so a quick message that needs it is held back. */
  vars: VisitMessageVars
}

export interface QuickMenuItem {
  message: QuickMessage
  disabledReason: string | null
}

export interface QuickMenuGroup {
  groupName: string
  items: QuickMenuItem[]
}

/** Who a text came from, as the bubble's header names it. */
export type ConversationSource
  = | { type: 'visit_message', kind: MeetingMessageKind, sentByFirstName: string | null }
    | { type: 'staff', firstName: string }
    | { type: 'automatic' }
    | { type: 'homeowner' }

export interface ConversationMessageItem {
  type: 'message'
  id: string
  direction: 'inbound' | 'outbound'
  source: ConversationSource
  body: string
  status: VoipMessageStatus
  at: string
  /** A Twilio code or a recorded reason, when the text did not arrive. */
  failureReason: string | null
  /** For an inbound YES: whether it confirmed a visit. Null for every other text. */
  yesMatch: 'matched' | 'unmatched' | null
}

export interface ConversationEventItem {
  type: 'event'
  id: string
  event: 'visit_page_opened'
  at: string
}

export type ConversationItem = ConversationMessageItem | ConversationEventItem

/** A visit text still to go out, shown at the end of the thread. */
export interface ComingUpItem {
  kind: PausableVisitMessageKind
  meetingId: string
  plannedFor: string
  /** Rendered for this visit, as it would go out now. */
  body: string
}

/** One conversation on a line, oldest first. The visit sheet and the Conversations page both read this shape. */
export interface ConversationThreadData {
  /** Null until the first text with this number. */
  threadId: string | null
  customer: { id: string, firstName: string } | null
  visit: { meetingId: string, vars: VisitMessageVars, confirmed: boolean } | null
  items: ConversationItem[]
  comingUp: ComingUpItem[]
  texting: { ok: true } | { ok: false, reason: TextingBlockedReason }
}

export type ConversationThreadInput = { meetingId: string } | { threadId: string }
```

Create `src/shared/services/voip/constants/texting-blocked-copy.ts`:

```ts
export const textingBlockedReasons = ['no_main_line', 'landline', 'opted_out', 'no_phone'] as const
export type TextingBlockedReason = (typeof textingBlockedReasons)[number]

/** The reply box's placeholder while texting this number cannot work. */
export const TEXTING_BLOCKED_COPY: Record<TextingBlockedReason, string> = {
  no_main_line: 'No main line is configured.',
  landline: 'This number can\'t receive texts',
  opted_out: 'They replied STOP. Texting is off.',
  no_phone: 'There is no phone on file.',
}
```

Create `src/shared/services/voip/constants/twilio-failure-copy.ts`:

```ts
/** The Twilio error codes a dispatcher can act on, in words they would use. */
export const TWILIO_FAILURE_COPY: Record<string, string> = {
  30006: 'landline or can\'t receive texts',
  21610: 'they opted out (STOP)',
  30004: 'they opted out (STOP)',
  30003: 'the phone is off or unreachable',
  30005: 'unknown or inactive number',
  30007: 'blocked by the carrier as spam',
}
```

Create `src/shared/services/voip/constants/quick-message-defaults.ts`:

```ts
import type { QuickMessageDraft, QuickMessageThreadState } from '@/shared/services/voip/types/conversation'

export const QUICK_MESSAGE_GROUPS = ['Confirm', 'Reschedule', 'Before the visit', 'Unknown number'] as const

/** The seed and the "Reset to defaults" set. The team changes the wording live in Manage. */
export const QUICK_MESSAGE_DEFAULTS: readonly QuickMessageDraft[] = [
  { groupName: 'Confirm', command: 'confirm', name: 'Ask to confirm', body: 'Hi {{first_name}}, just checking we\'re still on for {{visit_date}} at {{visit_time}}. Reply YES to confirm.' },
  { groupName: 'Confirm', command: 'link', name: 'Resend visit page', body: 'Here\'s your visit page with the agenda and everything you need: {{visit_link}}' },
  { groupName: 'Confirm', command: 'joining', name: 'Who\'s joining?', body: 'Will anyone else be joining us for the visit? We like to make sure everyone who\'ll be part of the decision can be there.' },
  { groupName: 'Reschedule', command: 'newtime', name: 'Offer another time', body: 'No problem! What day and time work better for you?' },
  { groupName: 'Reschedule', command: 'moved', name: 'Moved, confirm new time', body: 'Done! You\'re now set for {{visit_date}} at {{visit_time}}. Reply YES to confirm.' },
  { groupName: 'Before the visit', command: 'how', name: 'How the visit works', body: 'Your specialist is assigned closer to the visit, and you\'ll get their name the morning of. The agenda is on your visit page: {{visit_link}}' },
  { groupName: 'Unknown number', command: 'who', name: 'Who is this?', body: 'Hi! Thanks for your reply. Who am I texting with? I\'ll find your visit.' },
]

/** Which quick messages a thread's chips offer, in order. The first ones the thread can fill show. */
export const QUICK_MESSAGE_CHIP_COMMANDS: Record<QuickMessageThreadState, readonly string[]> = {
  unknown_number: ['who'],
  waiting_reply: ['newtime', 'moved', 'link'],
  unconfirmed: ['confirm', 'link', 'joining', 'how'],
  confirmed: ['joining', 'how', 'link'],
  no_visit: [],
}

export const QUICK_MESSAGE_CHIP_LIMIT = 4

export const QUICK_MESSAGE_COMMAND_PATTERN = /^[a-z0-9-]{2,20}$/

export const QUICK_MESSAGES_RESET_CONFIRM = {
  title: 'Reset quick messages?',
  message: 'This puts back the default quick messages for the whole team. Messages you added or changed are replaced.',
}

export const QUICK_MESSAGES_DELETE_CONFIRM = {
  title: 'Delete this quick message?',
  message: 'It goes for the whole team.',
}
```

Create `src/shared/services/voip/constants/quick-message-tokens.ts`:

```ts
import type { VisitMessageVars } from '@/shared/modules/meetings/messages/types'
import type { MergeToken } from '@/shared/services/voip/lib/sms-merge-template'

import { VISIT_MESSAGE_TOKENS } from '@/shared/modules/meetings/messages/constants/templates'

/** Quick messages fill from the thread's visit. The visit note is said once, in the summary. */
export const QUICK_MESSAGE_TOKENS: readonly MergeToken<VisitMessageVars>[] = VISIT_MESSAGE_TOKENS.filter(token => token.token !== 'visit_note')

export const QUICK_MESSAGE_FIELD_LABELS = QUICK_MESSAGE_TOKENS.map(token => token.label)

/** The fields only a visit can fill. A thread without one says "Needs a visit". */
export const VISIT_FIELD_TOKENS: readonly string[] = ['coordinator_name', 'specialist_name', 'visit_date', 'visit_time', 'arrival_window', 'visit_link']
```

Create `src/shared/modules/meetings/messages/constants/visit-step-copy.ts` now (Task 4 extends it; the voip copy below reuses its titles):

```ts
import type { VisitMessageSequenceKind } from '@/shared/modules/meetings/messages/constants/kinds'

export const VISIT_STEP_TITLES: Record<VisitMessageSequenceKind, string> = {
  visit_summary: 'Visit summary',
  day_before_reminder: 'Day-before reminder',
  rep_confirmation: 'Rep confirmation',
}
```

Create `src/shared/services/voip/constants/conversation-copy.ts`:

```ts
import type { MeetingMessageKind } from '@/shared/modules/meetings/messages/constants/kinds'
import type { ConversationEventItem } from '@/shared/services/voip/types/conversation'

import { VISIT_STEP_TITLES } from '@/shared/modules/meetings/messages/constants/visit-step-copy'

export const CONVERSATION_KIND_LABELS: Record<MeetingMessageKind, string> = {
  ...VISIT_STEP_TITLES,
  confirmation_reply: 'Automatic reply',
  visit_cancellation: 'Visit cancellation',
  homeowner_reply: 'Reply',
}

export const CONVERSATION_EVENT_COPY: Record<ConversationEventItem['event'], string> = {
  visit_page_opened: 'Opened their visit page',
}

export const CONVERSATION_YES_COPY = {
  matched: 'Matched as YES: visit confirmed',
  unmatched: 'Not matched to a visit, so no automatic reply went out.',
} as const

export const COMPOSER_HELPER = 'From the main line · Enter to send, Shift+Enter for a new line'

export const COMPOSER_READ_ONLY = 'You can read this conversation but not reply.'
```

- [ ] **Step 4: Write the libraries**

In `src/shared/services/voip/lib/sms-merge-template.ts`:

(a) Below the `TAG_PATTERN` line add:

```ts
// An editor shows `{{visit_time}}` as `[Visit time]`, which is easier to type around.
const FIELD_LABEL_PATTERN = /\[([^[\]\n]{1,40})\]/g
```

(b) Replace the whole `function render<TVars>(…) { … }` with:

```ts
function resolveSections<TVars>(body: string, tokens: readonly MergeToken<TVars>[], valueOf: (token: MergeToken<TVars>) => string): string {
  return body.replace(SECTION_PATTERN, (match, mark: string, name: string, inner: string) => {
    const token = tokens.find(candidate => candidate.token === name)
    if (!token) {
      return match
    }
    const hasValue = valueOf(token).trim().length > 0
    return hasValue === (mark === '#') ? inner : ''
  })
}

function render<TVars>(body: string, tokens: readonly MergeToken<TVars>[], valueOf: (token: MergeToken<TVars>) => string): string {
  return resolveSections(body, tokens, valueOf).replace(MERGE_TOKEN_PATTERN, (match, name: string) => {
    const token = tokens.find(candidate => candidate.token === name)
    return token ? valueOf(token) : match
  })
}

function findByLabel<TVars>(tokens: readonly MergeToken<TVars>[], label: string): MergeToken<TVars> | undefined {
  const wanted = label.trim().toLowerCase()
  return tokens.find(token => token.label.toLowerCase() === wanted)
}
```

(c) Append at the end of the file:

```ts
/** Keeps or drops each section for these values and leaves plain tokens in place, so an edit starts from what this visit would get. */
export function resolveMergeSections<TVars>(body: string, tokens: readonly MergeToken<TVars>[], vars: TVars): string {
  return resolveSections(body, tokens, token => token.resolve(vars))
}

/** `{{visit_time}}` → `[Visit time]`. A token with no label stays as typed. */
export function toFieldLabels<TVars>(body: string, tokens: readonly MergeToken<TVars>[]): string {
  return body.replace(MERGE_TOKEN_PATTERN, (match, name: string) => {
    const token = tokens.find(candidate => candidate.token === name)
    return token ? `[${token.label}]` : match
  })
}

/** `[Visit time]` → `{{visit_time}}`, matched without regard to case. A label that names no field stays literal. */
export function fromFieldLabels<TVars>(text: string, tokens: readonly MergeToken<TVars>[]): string {
  return text.replace(FIELD_LABEL_PATTERN, (match, label: string) => {
    const token = findByLabel(tokens, label)
    return token ? `{{${token.token}}}` : match
  })
}

/** Bracketed words that name no field, once each. They would go out exactly as typed. */
export function unknownFieldLabels<TVars>(text: string, tokens: readonly MergeToken<TVars>[]): string[] {
  return [...new Set([...text.matchAll(FIELD_LABEL_PATTERN)].filter(match => !findByLabel(tokens, match[1])).map(match => match[0]))]
}
```

Create `src/shared/services/voip/lib/twilio-failure-copy.ts`:

```ts
import { TWILIO_FAILURE_COPY } from '@/shared/services/voip/constants/twilio-failure-copy'

/** Why a text did not arrive, in plain words. Takes a Twilio code or a recorded reason (`twilio:30006`, `send_error`). */
export function twilioFailureCopy(reason: string | null): string {
  const code = reason?.replace(/^twilio:/, '') ?? ''
  if (TWILIO_FAILURE_COPY[code]) {
    return TWILIO_FAILURE_COPY[code]
  }
  return /^\d+$/.test(code) ? `the carrier didn't deliver it (Twilio ${code})` : 'the send failed'
}
```

Create `src/shared/services/voip/lib/sms-editor-copy.ts`:

```ts
import { countSmsSegments } from '@/shared/services/voip/lib/sms-segments'

export function unknownFieldWarning(label: string): string {
  return `${label} isn't a field, so it goes out exactly as typed.`
}

/** "Keep [Visit link] and [Visit time]: this text needs them." Null when nothing is missing. */
export function keepFieldsMessage(labels: readonly string[]): string | null {
  if (labels.length === 0) {
    return null
  }
  const list = labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`
  return `Keep ${list}: this text needs ${labels.length === 1 ? 'it' : 'them'}.`
}

/** "161 characters · 2 texts", with the reason when an emoji puts the text on 70-character segments. */
export function segmentCountCopy(body: string): string {
  const { chars, segments, encoding } = countSmsSegments(body)
  const count = `${chars} characters · ${segments} ${segments === 1 ? 'text' : 'texts'}`
  return encoding === 'ucs2' ? `${count} (an emoji makes each text hold 70 characters)` : count
}
```

Create `src/shared/modules/meetings/messages/lib/sample-visit-message-vars.ts`:

```ts
import type { VisitMessageVars } from '@/shared/modules/meetings/messages/types'

import { VISIT_MESSAGE_TOKENS } from '@/shared/modules/meetings/messages/constants/templates'

function sample(token: string): string {
  return VISIT_MESSAGE_TOKENS.find(candidate => candidate.token === token)?.sample ?? ''
}

/** The tokens' own samples as one visit, for previews that have no real visit behind them. */
export function sampleVisitMessageVars(): VisitMessageVars {
  return {
    firstName: sample('first_name'),
    coordinatorName: sample('coordinator_name'),
    specialistName: sample('specialist_name'),
    visitDate: sample('visit_date'),
    visitTime: sample('visit_time'),
    arrivalWindow: sample('arrival_window'),
    visitLink: sample('visit_link'),
    visitNote: '',
  }
}
```

Create `src/shared/services/voip/lib/quick-messages.ts`:

```ts
import type { VisitMessageVars } from '@/shared/modules/meetings/messages/types'
import type { MergeToken } from '@/shared/services/voip/lib/sms-merge-template'
import type {
  ConversationThreadData,
  QuickMenuGroup,
  QuickMessage,
  QuickMessageContext,
  QuickMessageDraft,
} from '@/shared/services/voip/types/conversation'

import { renderVisitMessage } from '@/shared/modules/meetings/messages/lib/render-visit-message'
import {
  QUICK_MESSAGE_CHIP_COMMANDS,
  QUICK_MESSAGE_CHIP_LIMIT,
  QUICK_MESSAGE_COMMAND_PATTERN,
  QUICK_MESSAGE_GROUPS,
} from '@/shared/services/voip/constants/quick-message-defaults'
import { QUICK_MESSAGE_TOKENS, VISIT_FIELD_TOKENS } from '@/shared/services/voip/constants/quick-message-tokens'
import { unknownFieldWarning } from '@/shared/services/voip/lib/sms-editor-copy'
import { findSectionErrors, fromFieldLabels, listMergeTokens, resolveMergeSections, unknownFieldLabels } from '@/shared/services/voip/lib/sms-merge-template'

export interface QuickMessageCheck {
  draft: QuickMessageDraft
  errors: Partial<Record<'name' | 'command' | 'groupName' | 'body', string>>
  warnings: string[]
}

export function emptyVisitMessageVars(firstName: string | null): VisitMessageVars {
  return { firstName: firstName ?? '', specialistName: null, coordinatorName: null, visitDate: '', visitTime: '', arrivalWindow: '', visitLink: '', visitNote: '' }
}

/** What a thread can fill and which chips suit it. An unanswered homeowner text outranks the visit's own state. */
export function quickContextFor(thread: Pick<ConversationThreadData, 'customer' | 'visit' | 'items'>): QuickMessageContext {
  const vars = thread.visit?.vars ?? emptyVisitMessageVars(thread.customer?.firstName ?? null)
  if (!thread.customer) {
    return { state: 'unknown_number', vars }
  }
  if (!thread.visit) {
    return { state: 'no_visit', vars }
  }
  const last = thread.items.findLast(item => item.type === 'message')
  if (last?.type === 'message' && last.direction === 'inbound') {
    return { state: 'waiting_reply', vars }
  }
  return { state: thread.visit.confirmed ? 'confirmed' : 'unconfirmed', vars }
}

// Sections drop out on their own when their field is empty, so only plain fields can leave a hole.
function missingTokens(body: string, vars: VisitMessageVars): MergeToken<VisitMessageVars>[] {
  return listMergeTokens(resolveMergeSections(body, QUICK_MESSAGE_TOKENS, vars)).flatMap((name) => {
    const token = QUICK_MESSAGE_TOKENS.find(candidate => candidate.token === name)
    return token && token.resolve(vars).trim() === '' ? [token] : []
  })
}

export function quickDisabledReason(message: Pick<QuickMessage, 'body'>, context: QuickMessageContext): string | null {
  const missing = missingTokens(message.body, context.vars)
  if (missing.length === 0) {
    return null
  }
  const noVisit = context.state === 'unknown_number' || context.state === 'no_visit'
  if (noVisit && missing.some(token => VISIT_FIELD_TOKENS.includes(token.token))) {
    return 'Needs a visit'
  }
  return `Needs ${missing.map(token => token.label).join(' and ')}`
}

export function fillQuickMessage(body: string, vars: VisitMessageVars): string {
  return renderVisitMessage(body, vars, { stopLine: false })
}

/** Groups in the team's order, then any group the team added, each sorted by its saved order. */
export function groupQuickMessages(messages: readonly QuickMessage[]): { groupName: string, items: QuickMessage[] }[] {
  const ordered = [...messages].sort((a, b) => a.sortOrder - b.sortOrder)
  const names = [...new Set<string>([...QUICK_MESSAGE_GROUPS, ...ordered.map(message => message.groupName)])]
  return names
    .map(groupName => ({ groupName, items: ordered.filter(message => message.groupName === groupName) }))
    .filter(group => group.items.length > 0)
}

export function pickQuickChips(messages: readonly QuickMessage[], context: QuickMessageContext): QuickMessage[] {
  return QUICK_MESSAGE_CHIP_COMMANDS[context.state]
    .flatMap(command => messages.filter(message => message.command === command))
    .filter(message => quickDisabledReason(message, context) === null)
    .slice(0, QUICK_MESSAGE_CHIP_LIMIT)
}

export function quickMenuGroups(messages: readonly QuickMessage[], context: QuickMessageContext, query: string): QuickMenuGroup[] {
  const wanted = query.trim().toLowerCase()
  return groupQuickMessages(messages)
    .map(group => ({
      groupName: group.groupName,
      items: group.items
        .filter(message => !wanted || message.command.includes(wanted) || message.name.toLowerCase().includes(wanted))
        .map(message => ({ message, disabledReason: quickDisabledReason(message, context) })),
    }))
    .filter(group => group.items.length > 0)
}

/** The full order after moving one quick message a place within its group, as `reorder` takes it. */
export function moveQuickMessage(messages: readonly QuickMessage[], id: string, direction: -1 | 1): string[] {
  const groups = groupQuickMessages(messages).map(group => group.items.map(message => message.id))
  for (const ids of groups) {
    const from = ids.indexOf(id)
    const to = from + direction
    if (from !== -1 && to >= 0 && to < ids.length) {
      ids.splice(to, 0, ...ids.splice(from, 1))
    }
  }
  return groups.flat()
}

/** Checks the Manage editor's fields, taking the text in `[Field]` form. The server checks again on save. */
export function checkQuickMessage(
  input: { name: string, command: string, groupName: string, text: string },
  others: readonly QuickMessage[],
  editingId: string | null,
): QuickMessageCheck {
  const command = input.command.trim().replace(/^\//, '').toLowerCase()
  const body = fromFieldLabels(input.text.trim(), QUICK_MESSAGE_TOKENS)
  const errors: QuickMessageCheck['errors'] = {}

  if (!input.name.trim()) {
    errors.name = 'Give it a name.'
  }
  if (!QUICK_MESSAGE_COMMAND_PATTERN.test(command)) {
    errors.command = 'Use 2 to 20 lowercase letters, numbers or dashes.'
  }
  else {
    const taken = others.find(message => message.command === command && message.id !== editingId)
    if (taken) {
      errors.command = `That command is taken by ${taken.name}.`
    }
  }
  if (!input.groupName.trim()) {
    errors.groupName = 'Pick a group.'
  }
  const sectionErrors = findSectionErrors(body)
  if (!body) {
    errors.body = 'The text is empty.'
  }
  else if (sectionErrors.length > 0) {
    errors.body = sectionErrors.join(' ')
  }

  return {
    draft: { name: input.name.trim(), command, groupName: input.groupName.trim(), body },
    errors,
    warnings: unknownFieldLabels(input.text, QUICK_MESSAGE_TOKENS).map(unknownFieldWarning),
  }
}
```

Create `src/shared/services/voip/lib/thread-days.ts`:

```ts
import type { ConversationItem } from '@/shared/services/voip/types/conversation'

import { businessDayKey, formatBusinessTime } from '@/shared/lib/business-time'

export interface ThreadDay {
  key: string
  label: string
  items: ConversationItem[]
}

/** Splits an oldest-first thread into business days, each labelled for its day separator. */
export function groupThreadDays(items: readonly ConversationItem[], now: Date): ThreadDay[] {
  const today = businessDayKey(now)
  const days: ThreadDay[] = []
  for (const item of items) {
    const key = businessDayKey(new Date(item.at))
    let day = days.at(-1)
    if (day?.key !== key) {
      day = { key, label: key === today ? 'Today' : formatBusinessTime(item.at, { weekday: 'long', month: 'short', day: 'numeric' }), items: [] }
      days.push(day)
    }
    day.items.push(item)
  }
  return days
}
```

Create `src/shared/services/voip/lib/describe-conversation-message.ts`:

```ts
import type { ConversationMessageItem, ConversationSource, ConversationThreadData } from '@/shared/services/voip/types/conversation'

import { formatBusinessClock } from '@/shared/lib/business-time'
import { CONVERSATION_KIND_LABELS } from '@/shared/services/voip/constants/conversation-copy'
import { twilioFailureCopy } from '@/shared/services/voip/lib/twilio-failure-copy'

export function messageHeader(source: ConversationSource): string | null {
  switch (source.type) {
    case 'visit_message':
      return source.sentByFirstName
        ? `${CONVERSATION_KIND_LABELS[source.kind]} · sent by ${source.sentByFirstName}`
        : CONVERSATION_KIND_LABELS[source.kind]
    case 'staff':
      return source.firstName
    case 'automatic':
      return 'Automatic reply'
    case 'homeowner':
      return null
  }
}

export function messageFooter(item: ConversationMessageItem): { text: string, failed: boolean } {
  const time = formatBusinessClock(item.at)
  if (item.direction === 'inbound') {
    return { text: time, failed: false }
  }
  switch (item.status) {
    case 'delivered':
      return { text: `${time} · Delivered`, failed: false }
    case 'sent':
      return { text: `${time} · Sent`, failed: false }
    case 'failed':
    case 'undelivered':
      return { text: `${time} · Not delivered: ${twilioFailureCopy(item.failureReason)}`, failed: true }
    default:
      return { text: 'Sending…', failed: false }
  }
}

export function emptyThreadCopy(thread: Pick<ConversationThreadData, 'customer' | 'visit'>): string {
  const none = `No texts with ${thread.customer?.firstName ?? 'this number'} yet.`
  return thread.visit ? `${none} The visit summary will be the first.` : none
}
```

Create `src/shared/services/voip/lib/insert-text.ts`:

```ts
/** The value with `text` typed over the selection, and where the caret lands after it. */
export function insertText(value: string, selectionStart: number, selectionEnd: number, text: string): { value: string, caret: number } {
  return { value: value.slice(0, selectionStart) + text + value.slice(selectionEnd), caret: selectionStart + text.length }
}
```

- [ ] **Step 5: Run the test to see it pass**

Run: `pnpm tsx --import ./scripts/lib/stub-server-only.mjs scripts/verify-conversation-text.ts`
Expected: `✅ conversation text helpers verified`.

Also re-run the existing suite, since `sms-merge-template.ts` changed: `pnpm tsx --import ./scripts/lib/stub-server-only.mjs scripts/verify-visit-messages.ts`. Expected: it passes as before.

- [ ] **Step 6: Static checks**

Run: `pnpm eslint --fix <every file this task created or changed> && pnpm tsc && pnpm lint`
Expected: pass.

- [ ] **Step 7: Commit** (only if commit-per-task was chosen) every file in this task's **Files** list, in one pathspec commit: `feat(voip): field labels, failure copy, quick-message and thread helpers`.

---

### Task 4: Visit meter and step libraries

**Files:**
- Modify: `src/shared/modules/meetings/messages/types.ts` (append), `src/shared/modules/meetings/messages/constants/visit-step-copy.ts` (extend)
- Create:
  - `src/shared/modules/meetings/messages/constants/visit-meter.ts`
  - `src/shared/modules/meetings/messages/constants/visit-editor.ts`
  - `src/shared/modules/meetings/messages/lib/format-visit-when.ts`
  - `src/shared/modules/meetings/messages/lib/derive-visit-meter.ts`
  - `src/shared/modules/meetings/messages/lib/visit-meter-copy.ts`
  - `src/shared/modules/meetings/messages/lib/decide-default-tab.ts`
  - `src/shared/modules/meetings/messages/lib/describe-visit-step.ts`
  - `src/shared/modules/meetings/messages/lib/check-visit-message-edit.ts`
- Test: `scripts/verify-visit-meter.ts`

**Interfaces:**
- Consumes (Task 3): `twilioFailureCopy`, `fromFieldLabels`, `toFieldLabels`, `unknownFieldLabels`, `unknownFieldWarning`, `TextingBlockedReason`.
- Produces:
  - Types `VisitMeter`, `VisitMeterDetail`, `VisitMeterFacts`, `VisitMeterSignal`, `VisitMeterStrip`, `VisitSheetStep`, `VisitSheetData`, `VisitStepActionId`, `VisitStepView`, `VisitInviteView`, `VisitSheetTab`, `VisitStepPanel`, `VisitStepHandlers`.
  - `deriveVisitMeter(facts)`, `meterStrips(meter)`, `meterAriaLabel(meter)`, `meterStatusLine(meter)`, `meterLegendLabels(meter)`, `decideDefaultTab(meter)`.
  - `describeVisitStep(step, now)`, `describeInvite(invite, summary)`, `isAutomaticStep(step)`, `stepReasonCopy(reason)`.
  - `checkVisitMessageEdit(key, text)`, `formatVisitDay(at)`, `formatVisitWhen(at)`.
  - Constants `VISIT_EDITOR_FIELD_LABELS`, `VISIT_INVITE_COPY`, `VISIT_RESEND_CONFIRM`, `VISIT_SEND_AGAIN_BLOCKED`.

- [ ] **Step 1: Write the failing test**

Create `scripts/verify-visit-meter.ts`:

```ts
/* eslint-disable no-console */
import type { VisitMeterDetail, VisitMeterFacts, VisitSheetStep } from '@/shared/modules/meetings/messages/types'

import assert from 'node:assert/strict'

import { VISIT_MESSAGE_TEMPLATE_DEFAULTS } from '@/shared/modules/meetings/messages/constants/templates'
import { checkVisitMessageEdit } from '@/shared/modules/meetings/messages/lib/check-visit-message-edit'
import { decideDefaultTab } from '@/shared/modules/meetings/messages/lib/decide-default-tab'
import { deriveVisitMeter } from '@/shared/modules/meetings/messages/lib/derive-visit-meter'
import { describeInvite, describeVisitStep, isAutomaticStep } from '@/shared/modules/meetings/messages/lib/describe-visit-step'
import { formatVisitWhen } from '@/shared/modules/meetings/messages/lib/format-visit-when'
import { meterAriaLabel, meterLegendLabels, meterStatusLine, meterStrips } from '@/shared/modules/meetings/messages/lib/visit-meter-copy'

const FRI_9AM = '2026-10-09T16:00:00.000Z'
const SAT_1109 = '2026-10-10T18:09:00.000Z'
const MON_6PM = '2026-10-12T01:00:00.000Z'

const facts: VisitMeterFacts = {
  summary: null,
  firstPageOpenAt: null,
  visitPageLive: false,
  homeownerConfirmedAt: null,
  homeownerConfirmedVia: null,
  confirmedAt: null,
  lastInbound: null,
  lastOutboundAt: null,
  reminder: { state: 'scheduled', plannedFor: MON_6PM, skipReason: null },
}

// deriveVisitMeter
assert.equal(deriveVisitMeter(facts).texted, 'not_sent')
assert.equal(deriveVisitMeter({ ...facts, summary: { status: 'pending', voipStatus: null, at: FRI_9AM } }).texted, 'sending')
assert.equal(deriveVisitMeter({ ...facts, summary: { status: 'sent', voipStatus: 'queued', at: FRI_9AM } }).texted, 'sending')
assert.equal(deriveVisitMeter({ ...facts, summary: { status: 'sent', voipStatus: 'sent', at: FRI_9AM } }).texted, 'delivered')
assert.equal(deriveVisitMeter({ ...facts, summary: { status: 'sent', voipStatus: 'undelivered', at: FRI_9AM } }).texted, 'failed')
assert.equal(deriveVisitMeter({ ...facts, summary: { status: 'failed', voipStatus: null, at: FRI_9AM } }).texted, 'failed')
const delivered = deriveVisitMeter({ ...facts, summary: { status: 'sent', voipStatus: 'delivered', at: FRI_9AM } })
assert.equal(delivered.textedAt, FRI_9AM)
assert.deepEqual(delivered.nextReminder, { at: MON_6PM })
assert.equal(deriveVisitMeter({ ...facts, reminder: { state: 'scheduled', plannedFor: MON_6PM, skipReason: 'paused' } }).nextReminder, 'skipped')
assert.equal(deriveVisitMeter({ ...facts, reminder: { state: 'skipped', plannedFor: MON_6PM, skipReason: null } }).nextReminder, 'skipped')
assert.equal(deriveVisitMeter({ ...facts, reminder: { state: 'sent', plannedFor: MON_6PM, skipReason: null } }).nextReminder, null)
assert.deepEqual(deriveVisitMeter({ ...facts, homeownerConfirmedAt: SAT_1109, homeownerConfirmedVia: 'sms_reply' }).confirmed, { via: 'sms_reply', at: SAT_1109 })
assert.deepEqual(deriveVisitMeter({ ...facts, confirmedAt: SAT_1109 }).confirmed, { via: 'office', at: SAT_1109 })
assert.deepEqual(deriveVisitMeter({ ...facts, lastInbound: { body: 'Thursday?', at: SAT_1109 }, lastOutboundAt: FRI_9AM }).waitingReply, { text: 'Thursday?', at: SAT_1109 })
assert.equal(deriveVisitMeter({ ...facts, lastInbound: { body: 'ok', at: FRI_9AM }, lastOutboundAt: SAT_1109 }).waitingReply, null)

// Strips, aria-label, status line
const meter = (patch: Partial<VisitMeterDetail>): VisitMeterDetail => ({ ...deriveVisitMeter(facts), ...patch })
assert.deepEqual(meterStrips(meter({})).map(strip => strip.tone), ['attention', 'idle', 'idle'])
assert.deepEqual(meterStrips(meter({ texted: 'delivered' })).map(strip => strip.tone), ['success', 'idle', 'pending'])
assert.deepEqual(meterStrips(meter({ texted: 'delivered', visitPageLive: true })).map(strip => strip.tone), ['success', 'pending', 'pending'])
assert.deepEqual(meterStrips(meter({ texted: 'delivered', opened: true, waitingReply: { text: 'Thu?', at: SAT_1109 } })).map(strip => strip.tone), ['success', 'success', 'action'])
assert.deepEqual(meterStrips(meter({ texted: 'sending' })).map(strip => strip.tone), ['pending', 'idle', 'idle'])
assert.deepEqual(meterStrips(meter({ texted: 'failed' })).map(strip => strip.tone), ['danger', 'idle', 'idle'])
assert.equal(meterAriaLabel(meter({ texted: 'delivered', opened: true })), '2 of 3 signals: Texted yes, Opened page yes, Confirmed not yet')
assert.equal(meterAriaLabel(meter({ texted: 'delivered', waitingReply: { text: 'x', at: SAT_1109 } })), '1 of 3 signals: Texted yes, Opened page not yet, Confirmed replied, no YES')

assert.deepEqual(meterStatusLine(meter({ texted: 'failed' })), { text: 'Visit summary failed', tone: 'danger' })
assert.deepEqual(meterStatusLine(meter({})), { text: 'Visit summary not sent', tone: 'attention' })
assert.deepEqual(meterStatusLine(meter({ texted: 'sending' })), { text: 'Sending visit summary…', tone: 'info' })
assert.deepEqual(meterStatusLine(meter({ texted: 'delivered', waitingReply: { text: 'Can we\n do  Thursday?', at: SAT_1109 } })), { text: 'Replied: "Can we do Thursday?"', tone: 'action' })
assert.deepEqual(meterStatusLine(meter({ texted: 'delivered', confirmed: { via: 'sms_reply', at: FRI_9AM } })), { text: 'Confirmed by text · Fri', tone: 'success' })
assert.deepEqual(meterStatusLine(meter({ texted: 'delivered', confirmed: { via: 'in_app', at: FRI_9AM } })), { text: 'Confirmed on the page · Fri', tone: 'success' })
assert.deepEqual(meterStatusLine(meter({ texted: 'delivered', confirmed: { via: 'office', at: FRI_9AM } })), { text: 'Confirmed by the office · Fri', tone: 'success' })
assert.deepEqual(meterStatusLine(meter({ texted: 'delivered' })), { text: 'Awaiting YES · reminder Sun 6:00 PM', tone: 'pending' })
assert.deepEqual(meterStatusLine(meter({ texted: 'delivered', nextReminder: 'skipped' })), { text: 'Awaiting YES · reminder skipped', tone: 'pending' })
assert.deepEqual(meterStatusLine(meter({ texted: 'delivered', nextReminder: null })), { text: 'Awaiting YES', tone: 'pending' })

assert.equal(formatVisitWhen(SAT_1109), 'Sat 11:09 AM')
assert.deepEqual(meterLegendLabels(meter({ texted: 'delivered', textedAt: FRI_9AM, openedAt: SAT_1109, opened: true })), { texted: 'Delivered Fri', opened: 'Sat 11:09 AM', confirmed: 'Not yet' })
assert.deepEqual(meterLegendLabels(meter({ texted: 'delivered', waitingReply: { text: 'x', at: SAT_1109 } })).confirmed, 'Replied, no YES')
assert.equal(decideDefaultTab(meter({})), 'sequence')
assert.equal(decideDefaultTab(meter({ waitingReply: { text: 'x', at: SAT_1109 } })), 'conversation')

// Steps
const step = (patch: Partial<VisitSheetStep>): VisitSheetStep => ({
  kind: 'visit_summary',
  plannedFor: null,
  state: 'not_sent',
  reason: 'never_sent',
  skipReason: null,
  late: false,
  variant: null,
  row: null,
  templateKey: 'visit_summary',
  body: VISIT_MESSAGE_TEMPLATE_DEFAULTS.visit_summary,
  overridden: false,
  sentBody: null,
  deliveredAt: null,
  sentByFirstName: null,
  skippedBy: null,
  ...patch,
})
const now = new Date('2026-10-11T20:00:00.000Z')
const row = { kind: 'visit_summary' as const, channel: 'sms' as const, status: 'sent' as const, reason: null, forScheduledFor: MON_6PM, createdAt: FRI_9AM }

assert.deepEqual(describeVisitStep(step({}), now), { title: 'Visit summary', status: 'Not sent yet', tone: 'attention', meta: [], actions: ['send', 'view', 'edit'], edited: false })
assert.equal(describeVisitStep(step({ reason: 'time_changed' }), now).status, 'Not sent for the new time')
assert.equal(describeVisitStep(step({ overridden: true }), now).edited, true)
assert.deepEqual(
  describeVisitStep(step({ state: 'sent', reason: null, row, deliveredAt: SAT_1109, sentByFirstName: 'Dana' }), now),
  { title: 'Visit summary', status: 'Delivered Sat 11:09 AM · Sent by Dana', tone: 'success', meta: [], actions: ['view', 'resend'], edited: false },
)
assert.equal(describeVisitStep(step({ state: 'failed', reason: 'twilio:30006', row }), now).status, 'Failed: landline or can\'t receive texts')
assert.deepEqual(describeVisitStep(step({ state: 'failed', reason: 'twilio:30006', row }), now).actions, ['view', 'editPhone', 'sendAgain'])
assert.equal(describeVisitStep(step({ state: 'failed', reason: 'sms_disabled', row }), now).status, 'Failed: texting is switched off here')
assert.equal(describeVisitStep(step({ kind: 'day_before_reminder', templateKey: 'day_before_reminder_unconfirmed', state: 'failed', reason: 'run_error', row }), now).status, 'Failed: the scheduled run hit an error')

const reminder = (patch: Partial<VisitSheetStep>) => step({ kind: 'day_before_reminder', templateKey: 'day_before_reminder_unconfirmed', plannedFor: MON_6PM, state: 'scheduled', reason: null, variant: 'unconfirmed', ...patch })
assert.deepEqual(describeVisitStep(reminder({}), now), { title: 'Day-before reminder', status: 'Sends Sun 6:00 PM', tone: 'pending', meta: ['Asks them to reply YES.'], actions: ['view', 'edit', 'skip'], edited: false })
assert.equal(describeVisitStep(reminder({ skipReason: 'paused' }), now).status, 'Won\'t send: this text is paused for the team')
assert.deepEqual(describeVisitStep(reminder({ state: 'due', late: true }), now).actions, ['skip'])
assert.equal(describeVisitStep(reminder({ state: 'due', late: true }), now).status, 'Late: the run has not sent it')
const skippedRow = { ...row, kind: 'day_before_reminder' as const, status: 'skipped' as const, reason: 'manual' }
const skipped = describeVisitStep(reminder({ state: 'skipped', reason: 'manual', row: skippedRow, skippedBy: { firstName: 'Dana', at: FRI_9AM } }), now)
assert.equal(skipped.status, 'Skipped by Dana')
assert.deepEqual(skipped.actions, ['undo'])
assert.ok(skipped.meta.includes('Undo before it is due and it goes out as planned.'))
assert.deepEqual(describeVisitStep(reminder({ state: 'skipped', reason: 'manual', row: skippedRow, skippedBy: null }), new Date('2026-10-13T00:00:00.000Z')).actions, [])
assert.equal(describeVisitStep(step({ kind: 'rep_confirmation', templateKey: 'rep_confirmation', state: 'not_applicable', reason: 'no_rep' }), now).status, 'Won\'t send: no specialist is on the visit')
assert.equal(isAutomaticStep(reminder({})), true)
assert.equal(isAutomaticStep(step({})), false)

// Invite
assert.equal(describeInvite({ invitedAt: null, refusedAt: null }, step({})).status, 'Goes out with the visit summary')
assert.equal(describeInvite({ invitedAt: FRI_9AM, refusedAt: null }, step({})).status, 'Sent Fri 9:00 AM')
assert.equal(describeInvite({ invitedAt: FRI_9AM, refusedAt: SAT_1109 }, step({})).editEmail, true)
assert.equal(describeInvite({ invitedAt: null, refusedAt: null }, step({ state: 'sent', row })).status, 'Not sent: there is no email on file')

// The per-visit editor's check
const rep = checkVisitMessageEdit('rep_confirmation', 'Morning [First name], see you between [Arrival window].')
assert.deepEqual(rep.missing, ['[Specialist name]', '[Visit link]'])
assert.equal(rep.body, 'Morning {{first_name}}, see you between {{arrival_window}}.')
const typo = checkVisitMessageEdit('confirmation_reply', 'Thanks [First name]! See you [Visit date] at [Visit tme].')
assert.deepEqual(typo.missing, ['[Visit time]'])
assert.ok(typo.warnings.includes('[Visit tme] isn\'t a field, so it goes out exactly as typed.'))
const pronoun = checkVisitMessageEdit('day_before_reminder_unconfirmed', 'Hi [First name], he will see you at [Visit time]: [Visit link]. Reply YES')
assert.deepEqual(pronoun.missing, [])
assert.ok(pronoun.warnings.includes('Name the specialist with [Specialist name] instead of a pronoun.'))
assert.deepEqual(checkVisitMessageEdit('confirmation_reply', '').errors, ['The text is empty.'])

console.log('✅ visit meter, steps and editor check verified')
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm tsx --import ./scripts/lib/stub-server-only.mjs scripts/verify-visit-meter.ts`
Expected: FAIL ("Cannot find module").

- [ ] **Step 3: Append the types**

In `src/shared/modules/meetings/messages/types.ts`:
- add `VisitMessageTemplateKey` to the existing `import type { … } from '@/shared/modules/meetings/messages/constants/kinds'` list;
- add these imports;
- append the types:

```ts
import type { VoipMessageStatus } from '@/shared/constants/enums/voip'
import type { StatusTone } from '@/shared/constants/status-tones'
import type { TextingBlockedReason } from '@/shared/services/voip/constants/texting-blocked-copy'
```

```ts
/** The homeowner's three signals for a visit, in the order they happen. A list computes it in one batched query. */
export interface VisitMeter {
  texted: 'not_sent' | 'sending' | 'delivered' | 'failed'
  opened: boolean
  /** False until the home visit page ships, so the Opened strip never waits on a page nobody can open. */
  visitPageLive: boolean
  confirmed: { via: HomeownerConfirmation | 'office', at: string } | null
  /** An inbound text with nothing sent after it. */
  waitingReply: { text: string, at: string } | null
  nextReminder: { at: string } | null | 'skipped'
}

/** The meter with the times the visit sheet prints under each strip. */
export interface VisitMeterDetail extends VisitMeter {
  textedAt: string | null
  openedAt: string | null
}

/** What `deriveVisitMeter` reads. The DAL gathers these per meeting, for its current time. */
export interface VisitMeterFacts {
  /** The summary's row for the current time, with Twilio's latest status for its text. `at` is when it was delivered, else when it was sent. */
  summary: { status: 'pending' | 'sent' | 'failed', voipStatus: VoipMessageStatus | null, at: string } | null
  firstPageOpenAt: string | null
  visitPageLive: boolean
  homeownerConfirmedAt: string | null
  homeownerConfirmedVia: HomeownerConfirmation | null
  confirmedAt: string | null
  lastInbound: { body: string, at: string } | null
  lastOutboundAt: string | null
  reminder: Pick<VisitMessageStep, 'state' | 'plannedFor' | 'skipReason'> | null
}

export type VisitMeterSignal = 'texted' | 'opened' | 'confirmed'

export interface VisitMeterStrip {
  signal: VisitMeterSignal
  label: string
  tone: StatusTone
  /** How the aria-label says this signal: "yes", "not yet", "sending", "failed", "replied, no YES". */
  spoken: string
  done: boolean
}

/** A step as the visit sheet reads it: the planner's step plus its wording and who did what. */
export interface VisitSheetStep extends VisitMessageStep {
  templateKey: VisitMessageTemplateKey
  /** The per-visit override if there is one, else the team template, in `{{token}}` form. */
  body: string
  overridden: boolean
  /** The text exactly as it went out, once sent. */
  sentBody: string | null
  deliveredAt: string | null
  sentByFirstName: string | null
  skippedBy: { firstName: string | null, at: string } | null
}

export interface VisitSheetData {
  meetingId: string
  customerId: string | null
  customerName: string | null
  scheduledFor: string
  meter: VisitMeterDetail
  steps: VisitSheetStep[]
  invite: { invitedAt: string | null, refusedAt: string | null }
  /** This visit's values, for the editor's preview. */
  vars: VisitMessageVars
  /** False while the phone that failed is still the one on file, so Send again would fail the same way. */
  phoneChangedSinceFailure: boolean
  texting: { ok: true } | { ok: false, reason: TextingBlockedReason }
  threadMessageCount: number
}

export type VisitStepActionId = 'send' | 'resend' | 'sendAgain' | 'view' | 'edit' | 'skip' | 'undo' | 'editPhone'

export interface VisitStepView {
  title: string
  status: string
  tone: StatusTone
  meta: string[]
  actions: VisitStepActionId[]
  /** An editable step whose text was changed for this visit. */
  edited: boolean
}

export interface VisitInviteView {
  status: string
  meta: string | null
  tone: StatusTone
  editEmail: boolean
}

export type VisitSheetTab = 'sequence' | 'conversation'

export type VisitStepPanel = 'view' | 'edit' | null

export interface VisitStepHandlers {
  onSend: (mode: 'send' | 'resend') => Promise<void>
  onSkip: (kind: PausableVisitMessageKind) => void
  onUndo: (kind: PausableVisitMessageKind) => void
  onSaveText: (kind: VisitMessageSequenceKind, body: string) => Promise<void>
  onResetText: (kind: VisitMessageSequenceKind) => Promise<void>
  onEditPhone: () => void
  onEditEmail: () => void
}
```

- [ ] **Step 4: Write the constants**

Create `src/shared/modules/meetings/messages/constants/visit-meter.ts`:

```ts
import type { VisitMeterSignal } from '@/shared/modules/meetings/messages/types'

export const VISIT_METER_SIGNALS = [
  { signal: 'texted', label: 'Texted' },
  { signal: 'opened', label: 'Opened page' },
  { signal: 'confirmed', label: 'Confirmed' },
] as const satisfies readonly { signal: VisitMeterSignal, label: string }[]
```

Create `src/shared/modules/meetings/messages/constants/visit-editor.ts`:

```ts
import { VISIT_MESSAGE_TOKENS } from '@/shared/modules/meetings/messages/constants/templates'

/** The fields the per-visit editor offers as chips. The visit note is set on the meeting, not typed into a text. */
export const VISIT_EDITOR_FIELD_LABELS = VISIT_MESSAGE_TOKENS.filter(token => token.token !== 'visit_note').map(token => token.label)
```

Replace the contents of `src/shared/modules/meetings/messages/constants/visit-step-copy.ts` with:

```ts
import type { VisitMessageSequenceKind } from '@/shared/modules/meetings/messages/constants/kinds'

export const VISIT_STEP_TITLES: Record<VisitMessageSequenceKind, string> = {
  visit_summary: 'Visit summary',
  day_before_reminder: 'Day-before reminder',
  rep_confirmation: 'Rep confirmation',
}

/** Planner reasons and skip reasons in a dispatcher's words. A Twilio code goes through `twilioFailureCopy`. */
export const VISIT_STEP_REASON_COPY: Record<string, string> = {
  project_meeting: 'this is a project meeting',
  outcome_decided: 'the visit already has an outcome',
  no_rep: 'no specialist is on the visit',
  before_9am: 'the visit starts before 9:00 AM',
  booked_after_run: 'the visit was booked after this text was due',
  no_record: 'nothing went out when it was due',
  send_interrupted: 'the send was interrupted',
  send_error: 'the send failed',
  run_error: 'the scheduled run hit an error',
  no_main_line: 'no main line is configured',
  sms_disabled: 'texting is switched off here',
  booked_after_noon: 'the visit summary went out after noon the day before',
  paused: 'this text is paused for the team',
  no_phone: 'there is no phone on file',
  dnc: 'the customer is on Do Not Contact',
  manual: 'skipped by hand',
}

export const VISIT_REMINDER_VARIANT_COPY = {
  unconfirmed: 'Asks them to reply YES.',
  confirmed: 'The \'see you tomorrow\' version: they already confirmed.',
} as const

export const VISIT_STEP_UNDO_META = 'Undo before it is due and it goes out as planned.'

export const VISIT_STEP_LATE = 'Late: the run has not sent it'

export const VISIT_SEND_AGAIN_BLOCKED = 'Change the phone first: this number did not take the text.'

export const VISIT_INVITE_COPY = {
  title: 'Calendar invite',
  pending: 'Goes out with the visit summary',
  sentMeta: 'Google added them as a guest, so time changes and a cancellation reach them from Google.',
  refused: 'Google rejected the email on file',
  refusedMeta: 'The event is on the calendar without them; fix the email and the next sync adds them.',
  noEmail: 'Not sent: there is no email on file',
} as const

export const VISIT_RESEND_CONFIRM = {
  title: 'Resend the visit summary?',
  message: 'They get the visit summary again, with their visit page link.',
}
```

- [ ] **Step 5: Write the libraries**

Create `src/shared/modules/meetings/messages/lib/format-visit-when.ts`:

```ts
import { formatBusinessTime } from '@/shared/lib/business-time'

// Intl can print a narrow no-break space before AM/PM; copy and tests compare plain spaces.
function plain(text: string): string {
  return text.replace(/[  ]/g, ' ')
}

/** "Fri" */
export function formatVisitDay(at: string): string {
  return formatBusinessTime(at, { weekday: 'short' })
}

/** "Sat 11:09 AM" */
export function formatVisitWhen(at: string): string {
  return plain(formatBusinessTime(at, { weekday: 'short', hour: 'numeric', minute: '2-digit' }))
}
```

Create `src/shared/modules/meetings/messages/lib/derive-visit-meter.ts`:

```ts
import type { VisitMeter, VisitMeterDetail, VisitMeterFacts } from '@/shared/modules/meetings/messages/types'

function textedFrom(summary: VisitMeterFacts['summary']): VisitMeter['texted'] {
  if (!summary) {
    return 'not_sent'
  }
  if (summary.status === 'failed' || summary.voipStatus === 'failed' || summary.voipStatus === 'undelivered') {
    return 'failed'
  }
  // Many carriers never return a delivery receipt, so a text Twilio handed on (`sent`) counts as delivered.
  if (summary.status === 'pending' || summary.voipStatus === 'queued') {
    return 'sending'
  }
  return 'delivered'
}

function reminderFrom(reminder: VisitMeterFacts['reminder']): VisitMeter['nextReminder'] {
  if (!reminder) {
    return null
  }
  if (reminder.state === 'skipped') {
    return 'skipped'
  }
  if ((reminder.state === 'scheduled' || reminder.state === 'due') && reminder.plannedFor) {
    return reminder.skipReason ? 'skipped' : { at: reminder.plannedFor }
  }
  return null
}

/** The meter from one meeting's facts. Pure, so the list query and the visit sheet read the same answer. */
export function deriveVisitMeter(facts: VisitMeterFacts): VisitMeterDetail {
  const texted = textedFrom(facts.summary)
  const confirmed = facts.homeownerConfirmedAt
    ? { via: facts.homeownerConfirmedVia ?? 'in_app', at: facts.homeownerConfirmedAt }
    : facts.confirmedAt ? { via: 'office' as const, at: facts.confirmedAt } : null
  const reply = facts.lastInbound
  const unanswered = reply !== null && (facts.lastOutboundAt === null || Date.parse(reply.at) > Date.parse(facts.lastOutboundAt))

  return {
    texted,
    textedAt: texted === 'delivered' ? facts.summary?.at ?? null : null,
    opened: facts.firstPageOpenAt !== null,
    openedAt: facts.firstPageOpenAt,
    visitPageLive: facts.visitPageLive,
    confirmed,
    waitingReply: unanswered ? { text: reply.body, at: reply.at } : null,
    nextReminder: reminderFrom(facts.reminder),
  }
}
```

Create `src/shared/modules/meetings/messages/lib/visit-meter-copy.ts`:

```ts
import type { StatusTone } from '@/shared/constants/status-tones'
import type { VisitMeter, VisitMeterDetail, VisitMeterSignal, VisitMeterStrip } from '@/shared/modules/meetings/messages/types'

import { VISIT_METER_SIGNALS } from '@/shared/modules/meetings/messages/constants/visit-meter'
import { formatVisitDay, formatVisitWhen } from '@/shared/modules/meetings/messages/lib/format-visit-when'

type StripState = Pick<VisitMeterStrip, 'tone' | 'spoken' | 'done'>

const DONE: StripState = { tone: 'success', spoken: 'yes', done: true }

const TEXTED_STATE: Record<VisitMeter['texted'], StripState> = {
  delivered: DONE,
  sending: { tone: 'pending', spoken: 'sending', done: false },
  failed: { tone: 'danger', spoken: 'failed', done: false },
  // Orange, not grey: the office owes this one.
  not_sent: { tone: 'attention', spoken: 'not yet', done: false },
}

const CONFIRMED_BY: Record<NonNullable<VisitMeter['confirmed']>['via'], string> = {
  sms_reply: 'Confirmed by text',
  in_app: 'Confirmed on the page',
  office: 'Confirmed by the office',
}

function stripState(meter: VisitMeter, signal: VisitMeterSignal): StripState {
  const delivered = meter.texted === 'delivered'
  if (signal === 'texted') {
    return TEXTED_STATE[meter.texted]
  }
  if (signal === 'opened') {
    return meter.opened ? DONE : { tone: delivered && meter.visitPageLive ? 'pending' : 'idle', spoken: 'not yet', done: false }
  }
  if (meter.confirmed) {
    return DONE
  }
  if (meter.waitingReply) {
    return { tone: 'action', spoken: 'replied, no YES', done: false }
  }
  return { tone: delivered ? 'pending' : 'idle', spoken: 'not yet', done: false }
}

export function meterStrips(meter: VisitMeter): VisitMeterStrip[] {
  return VISIT_METER_SIGNALS.map(({ signal, label }) => ({ signal, label, ...stripState(meter, signal) }))
}

/** "2 of 3 signals: Texted yes, Opened page not yet, Confirmed not yet" */
export function meterAriaLabel(meter: VisitMeter): string {
  const strips = meterStrips(meter)
  const done = strips.filter(strip => strip.done).length
  return `${done} of ${strips.length} signals: ${strips.map(strip => `${strip.label} ${strip.spoken}`).join(', ')}`
}

/** The card's one line. First match wins, in the order a dispatcher has to act on them. */
export function meterStatusLine(meter: VisitMeter): { text: string, tone: StatusTone } {
  if (meter.texted === 'failed') {
    return { text: 'Visit summary failed', tone: 'danger' }
  }
  if (meter.texted === 'not_sent') {
    return { text: 'Visit summary not sent', tone: 'attention' }
  }
  if (meter.texted === 'sending') {
    return { text: 'Sending visit summary…', tone: 'info' }
  }
  if (meter.waitingReply) {
    return { text: `Replied: "${meter.waitingReply.text.replace(/\s+/g, ' ').trim()}"`, tone: 'action' }
  }
  if (meter.confirmed) {
    return { text: `${CONFIRMED_BY[meter.confirmed.via]} · ${formatVisitDay(meter.confirmed.at)}`, tone: 'success' }
  }
  if (meter.nextReminder === 'skipped') {
    return { text: 'Awaiting YES · reminder skipped', tone: 'pending' }
  }
  return { text: meter.nextReminder ? `Awaiting YES · reminder ${formatVisitWhen(meter.nextReminder.at)}` : 'Awaiting YES', tone: 'pending' }
}

/** The words under each strip in the visit sheet: "Delivered Fri", "Sat 11:09 AM", "Not yet". */
export function meterLegendLabels(meter: VisitMeterDetail): Record<VisitMeterSignal, string> {
  const texted: Record<VisitMeter['texted'], string> = {
    delivered: meter.textedAt ? `Delivered ${formatVisitDay(meter.textedAt)}` : 'Delivered',
    sending: 'Sending…',
    failed: 'Failed',
    not_sent: 'Not yet',
  }
  return {
    texted: texted[meter.texted],
    opened: meter.openedAt ? formatVisitWhen(meter.openedAt) : 'Not yet',
    confirmed: meter.confirmed ? formatVisitWhen(meter.confirmed.at) : meter.waitingReply ? 'Replied, no YES' : 'Not yet',
  }
}
```

Create `src/shared/modules/meetings/messages/lib/decide-default-tab.ts`:

```ts
import type { VisitMeter, VisitSheetTab } from '@/shared/modules/meetings/messages/types'

/** A reply waiting for an answer opens the conversation; anything else opens the sequence. */
export function decideDefaultTab(meter: VisitMeter): VisitSheetTab {
  return meter.waitingReply ? 'conversation' : 'sequence'
}
```

Create `src/shared/modules/meetings/messages/lib/describe-visit-step.ts`:

```ts
import type { StatusTone } from '@/shared/constants/status-tones'
import type { PausableVisitMessageKind } from '@/shared/modules/meetings/messages/constants/kinds'
import type {
  VisitInviteView,
  VisitSheetData,
  VisitSheetStep,
  VisitStepActionId,
  VisitStepView,
} from '@/shared/modules/meetings/messages/types'

import { pausableVisitMessageKinds } from '@/shared/modules/meetings/messages/constants/kinds'
import {
  VISIT_INVITE_COPY,
  VISIT_REMINDER_VARIANT_COPY,
  VISIT_STEP_LATE,
  VISIT_STEP_REASON_COPY,
  VISIT_STEP_TITLES,
  VISIT_STEP_UNDO_META,
} from '@/shared/modules/meetings/messages/constants/visit-step-copy'
import { formatVisitWhen } from '@/shared/modules/meetings/messages/lib/format-visit-when'
import { twilioFailureCopy } from '@/shared/services/voip/lib/twilio-failure-copy'

export function stepReasonCopy(reason: string | null): string {
  if (!reason) {
    return 'no reason was recorded'
  }
  return VISIT_STEP_REASON_COPY[reason] ?? twilioFailureCopy(reason)
}

export function isAutomaticStep(step: VisitSheetStep): step is VisitSheetStep & { kind: PausableVisitMessageKind } {
  return (pausableVisitMessageKinds as readonly string[]).includes(step.kind)
}

/** One sequence row's words, tone and buttons, from the planner's state (§7.5's state table). */
export function describeVisitStep(step: VisitSheetStep, now: Date): VisitStepView {
  const isSummary = step.kind === 'visit_summary'
  const live = step.state === 'scheduled' || step.state === 'due'
  const meta: string[] = []
  if (step.kind === 'day_before_reminder' && step.variant && live && !step.skipReason) {
    meta.push(VISIT_REMINDER_VARIANT_COPY[step.variant])
  }
  const editable = isSummary ? step.state === 'not_sent' : step.state === 'scheduled' && !step.skipReason
  const view = (status: string, tone: StatusTone, actions: VisitStepActionId[]): VisitStepView => ({
    title: VISIT_STEP_TITLES[step.kind],
    status,
    tone,
    meta,
    actions,
    edited: editable && step.overridden,
  })

  switch (step.state) {
    case 'sent': {
      const at = step.deliveredAt ?? step.row?.createdAt ?? null
      const by = isSummary && step.sentByFirstName ? ` · Sent by ${step.sentByFirstName}` : ''
      return view(`${step.deliveredAt ? 'Delivered' : 'Sent'}${at ? ` ${formatVisitWhen(at)}` : ''}${by}`, 'success', isSummary ? ['view', 'resend'] : ['view'])
    }
    case 'sending':
      return view('Sending…', 'info', ['view'])
    case 'failed':
      return view(`Failed: ${stepReasonCopy(step.reason)}`, 'danger', isSummary ? ['view', 'editPhone', 'sendAgain'] : ['view'])
    case 'skipped': {
      if (step.row?.reason !== 'manual') {
        return view(`Skipped: ${stepReasonCopy(step.reason)}`, 'idle', [])
      }
      const canUndo = step.plannedFor !== null && now.getTime() < Date.parse(step.plannedFor)
      if (canUndo) {
        meta.push(VISIT_STEP_UNDO_META)
      }
      return view(`Skipped by ${step.skippedBy?.firstName ?? 'a teammate'}`, 'idle', canUndo ? ['undo'] : [])
    }
    case 'scheduled':
      if (step.skipReason) {
        return view(`Won't send: ${stepReasonCopy(step.skipReason)}`, 'idle', ['view'])
      }
      return view(`Sends ${step.plannedFor ? formatVisitWhen(step.plannedFor) : 'soon'}`, 'pending', ['view', 'edit', 'skip'])
    case 'due':
      if (step.skipReason) {
        return view(`Won't send: ${stepReasonCopy(step.skipReason)}`, 'idle', [])
      }
      return view(step.late ? VISIT_STEP_LATE : 'Sending now', step.late ? 'attention' : 'info', ['skip'])
    case 'not_applicable':
      return view(`Won't send: ${stepReasonCopy(step.reason)}`, 'idle', [])
    case 'not_sent':
      if (isSummary) {
        return view(step.reason === 'time_changed' ? 'Not sent for the new time' : 'Not sent yet', 'attention', ['send', 'view', 'edit'])
      }
      return view(`Not sent: ${stepReasonCopy(step.reason)}`, 'idle', [])
  }
}

export function describeInvite(invite: VisitSheetData['invite'], summary: VisitSheetStep | undefined): VisitInviteView {
  if (invite.refusedAt) {
    return { status: VISIT_INVITE_COPY.refused, meta: VISIT_INVITE_COPY.refusedMeta, tone: 'danger', editEmail: true }
  }
  if (invite.invitedAt) {
    return { status: `Sent ${formatVisitWhen(invite.invitedAt)}`, meta: VISIT_INVITE_COPY.sentMeta, tone: 'success', editEmail: false }
  }
  if (summary?.state === 'sent') {
    return { status: VISIT_INVITE_COPY.noEmail, meta: null, tone: 'idle', editEmail: true }
  }
  return { status: VISIT_INVITE_COPY.pending, meta: null, tone: 'idle', editEmail: false }
}
```

Create `src/shared/modules/meetings/messages/lib/check-visit-message-edit.ts`:

```ts
import type { VisitMessageTemplateKey } from '@/shared/modules/meetings/messages/constants/kinds'

import { VISIT_MESSAGE_REQUIRED_TOKENS, VISIT_MESSAGE_TOKENS } from '@/shared/modules/meetings/messages/constants/templates'
import { validateVisitMessageTemplate } from '@/shared/modules/meetings/messages/lib/validate-visit-message-template'
import { unknownFieldWarning } from '@/shared/services/voip/lib/sms-editor-copy'
import { fromFieldLabels, listMergeTokens, toFieldLabels, unknownFieldLabels } from '@/shared/services/voip/lib/sms-merge-template'

export interface VisitMessageEditCheck {
  /** The edit in `{{token}}` form, ready to save. */
  body: string
  /** Required fields the edit removed, as `[Label]`. */
  missing: string[]
  errors: string[]
  warnings: string[]
}

/** The validator's verdict on a `[Field]`-form edit, with its messages in the same `[Field]` words the editor shows. */
export function checkVisitMessageEdit(key: VisitMessageTemplateKey, text: string): VisitMessageEditCheck {
  const body = fromFieldLabels(text, VISIT_MESSAGE_TOKENS)
  const { errors, warnings } = validateVisitMessageTemplate(key, body)
  const used = listMergeTokens(body)
  const missing = VISIT_MESSAGE_REQUIRED_TOKENS[key]
    .filter(token => !used.includes(token))
    .map(token => `[${VISIT_MESSAGE_TOKENS.find(candidate => candidate.token === token)?.label ?? token}]`)

  return {
    body,
    missing,
    errors: errors.filter(issue => issue.code !== 'missing_token').map(issue => toFieldLabels(issue.message, VISIT_MESSAGE_TOKENS)),
    warnings: [
      ...warnings.map(issue => toFieldLabels(issue.message, VISIT_MESSAGE_TOKENS)),
      ...unknownFieldLabels(text, VISIT_MESSAGE_TOKENS).map(unknownFieldWarning),
    ],
  }
}
```

- [ ] **Step 6: Run the test to see it pass**

Run: `pnpm tsx --import ./scripts/lib/stub-server-only.mjs scripts/verify-visit-meter.ts`
Expected: `✅ visit meter, steps and editor check verified`.

A date assertion can fail if the week changes. The fixtures are fixed instants: `MON_6PM` (01:00 UTC on Mon Oct 12) is Sun Oct 11, 6:00 PM in Los Angeles, which is why the expected copy says "Sun 6:00 PM". Fix the code, not the fixture, unless the fixture's own arithmetic is wrong.

- [ ] **Step 7: Static checks**

Run: `pnpm eslint --fix <every file in Files> && pnpm tsc && pnpm lint`
Expected: pass.

- [ ] **Step 8: Commit** (only if commit-per-task was chosen) every file in **Files**: `feat(visit-messages): meter, step and editor-check libraries`.

---

### Task 5: The meter components

**Files:**
- Create: `src/shared/modules/meetings/messages/components/visit-meter.tsx`, `src/shared/modules/meetings/messages/components/visit-meter-legend.tsx`

**Interfaces:**
- Consumes: `meterStrips`, `meterAriaLabel`, `meterStatusLine`, `meterLegendLabels` (Task 4); `toneClasses`.
- Produces:
  - `VisitMeter({ meter: VisitMeter, variant?: 'line' | 'strips', className? })`, with the strips at 16 × 6 px in `line` and full width in `strips`;
  - `VisitMeterLegend({ meter: VisitMeterDetail, className? })`.

- [ ] **Step 1: Write `visit-meter.tsx`**

```tsx
import type { ComponentProps } from 'react'

import type { VisitMeter as VisitMeterData } from '@/shared/modules/meetings/messages/types'

import { toneClasses } from '@/shared/constants/status-tones'
import { cn } from '@/shared/lib/utils'
import { meterAriaLabel, meterStatusLine, meterStrips } from '@/shared/modules/meetings/messages/lib/visit-meter-copy'

interface VisitMeterProps extends Omit<ComponentProps<'div'>, 'children'> {
  meter: VisitMeterData
  /** `strips` for tight views (the schedule): no words, the aria-label carries them. */
  variant?: 'line' | 'strips'
}

export function VisitMeter({ meter, variant = 'line', className, ...props }: VisitMeterProps) {
  const strips = meterStrips(meter)
  const bar = (
    <span aria-hidden className={cn('flex shrink-0 gap-1', variant === 'strips' && 'w-full')}>
      {strips.map(strip => (
        <span
          key={strip.signal}
          className={cn('h-1.5 rounded-full', variant === 'strips' ? 'flex-1' : 'w-4', toneClasses(strip.tone).dot)}
        />
      ))}
    </span>
  )

  if (variant === 'strips') {
    return (
      <div role="img" aria-label={meterAriaLabel(meter)} className={cn('flex h-3 items-center', className)} {...props}>
        {bar}
      </div>
    )
  }

  const line = meterStatusLine(meter)
  return (
    <div role="group" aria-label={meterAriaLabel(meter)} className={cn('flex h-5 min-w-0 items-center gap-2', className)} {...props}>
      {bar}
      <span className={cn('min-w-0 truncate text-xs', toneClasses(line.tone).text)}>{line.text}</span>
    </div>
  )
}
```

- [ ] **Step 2: Write `visit-meter-legend.tsx`**

```tsx
import type { VisitMeterDetail } from '@/shared/modules/meetings/messages/types'

import { toneClasses } from '@/shared/constants/status-tones'
import { cn } from '@/shared/lib/utils'
import { meterAriaLabel, meterLegendLabels, meterStrips } from '@/shared/modules/meetings/messages/lib/visit-meter-copy'

interface VisitMeterLegendProps {
  meter: VisitMeterDetail
  className?: string
}

export function VisitMeterLegend({ meter, className }: VisitMeterLegendProps) {
  const labels = meterLegendLabels(meter)
  return (
    <ol aria-label={meterAriaLabel(meter)} className={cn('grid grid-cols-3 gap-2', className)}>
      {meterStrips(meter).map(strip => (
        <li key={strip.signal} className="min-w-0 space-y-1">
          <span aria-hidden className={cn('block h-1.5 rounded-full', toneClasses(strip.tone).dot)} />
          <p className="truncate text-xs font-medium">{strip.label}</p>
          <p className={cn('truncate text-xs', strip.done ? 'text-muted-foreground' : toneClasses(strip.tone).text)}>{labels[strip.signal]}</p>
        </li>
      ))}
    </ol>
  )
}
```

- [ ] **Step 3: Static checks**

Run: `pnpm eslint --fix src/shared/modules/meetings/messages/components/visit-meter.tsx src/shared/modules/meetings/messages/components/visit-meter-legend.tsx && pnpm tsc && pnpm lint`
Expected: pass. The components render once Tasks 12 and 13 wire them; there is no route for them before that.

- [ ] **Step 4: Commit** (only if commit-per-task was chosen) both files: `feat(visit-messages): meter strips and legend`.

---

### Task 6: Thread components

**Files:**
- Create in `src/shared/services/voip/components/`: `conversation-message.tsx`, `conversation-event.tsx`, `conversation-coming-up.tsx`, `conversation-thread.tsx`

**Interfaces:**
- Consumes:
  - from Task 1: `Message*`, `Bubble*`, `Marker*`, `MessageScroller*`;
  - from Task 3: `messageHeader`, `messageFooter`, `emptyThreadCopy`, `groupThreadDays`, `CONVERSATION_*` copy;
  - from Task 4: `formatVisitWhen`.
- Produces: `ConversationThread({ thread: ConversationThreadData, canUpdate: boolean, onEditComingUp(item), onSkipComingUp(item), className? })`. Plan 3b reuses it unchanged.

- [ ] **Step 1: Write `conversation-message.tsx`**

```tsx
import type { ConversationMessageItem } from '@/shared/services/voip/types/conversation'

import { CheckIcon, InfoIcon } from 'lucide-react'

import { Bubble, BubbleContent } from '@/shared/components/ui/bubble'
import { Marker, MarkerContent, MarkerIcon } from '@/shared/components/ui/marker'
import { Message, MessageContent, MessageFooter, MessageHeader } from '@/shared/components/ui/message'
import { cn } from '@/shared/lib/utils'
import { CONVERSATION_YES_COPY } from '@/shared/services/voip/constants/conversation-copy'
import { messageFooter, messageHeader } from '@/shared/services/voip/lib/describe-conversation-message'

interface ConversationMessageProps {
  item: ConversationMessageItem
}

export function ConversationMessage({ item }: ConversationMessageProps) {
  const align = item.direction === 'outbound' ? 'end' : 'start'
  const header = messageHeader(item.source)
  const footer = messageFooter(item)
  const variant = footer.failed ? 'destructive' : align === 'end' ? 'ours' : 'theirs'

  return (
    <Message align={align}>
      <MessageContent>
        {header && <MessageHeader>{header}</MessageHeader>}
        <Bubble align={align} variant={variant}>
          <BubbleContent className="whitespace-pre-wrap wrap-anywhere">{item.body}</BubbleContent>
        </Bubble>
        <MessageFooter className={cn(footer.failed && 'text-destructive-text')}>{footer.text}</MessageFooter>
        {item.yesMatch && (
          <Marker className="text-xs">
            <MarkerIcon>{item.yesMatch === 'matched' ? <CheckIcon /> : <InfoIcon />}</MarkerIcon>
            <MarkerContent>{CONVERSATION_YES_COPY[item.yesMatch]}</MarkerContent>
          </Marker>
        )}
      </MessageContent>
    </Message>
  )
}
```

- [ ] **Step 2: Write `conversation-event.tsx`**

```tsx
import type { ConversationEventItem } from '@/shared/services/voip/types/conversation'

import { EyeIcon } from 'lucide-react'

import { Marker, MarkerContent, MarkerIcon } from '@/shared/components/ui/marker'
import { toneClasses } from '@/shared/constants/status-tones'
import { formatBusinessClock } from '@/shared/lib/business-time'
import { cn } from '@/shared/lib/utils'
import { CONVERSATION_EVENT_COPY } from '@/shared/services/voip/constants/conversation-copy'

interface ConversationEventProps {
  item: ConversationEventItem
}

export function ConversationEvent({ item }: ConversationEventProps) {
  return (
    <Marker className={cn('justify-center text-xs', toneClasses('success').text)}>
      <MarkerIcon><EyeIcon /></MarkerIcon>
      <MarkerContent>{`${CONVERSATION_EVENT_COPY[item.event]} · ${formatBusinessClock(item.at)}`}</MarkerContent>
    </Marker>
  )
}
```

- [ ] **Step 3: Write `conversation-coming-up.tsx`**

```tsx
import type { ComingUpItem } from '@/shared/services/voip/types/conversation'

import { Bubble, BubbleContent } from '@/shared/components/ui/bubble'
import { Button } from '@/shared/components/ui/button'
import { Marker, MarkerContent } from '@/shared/components/ui/marker'
import { Message, MessageContent, MessageFooter, MessageHeader } from '@/shared/components/ui/message'
import { formatVisitWhen } from '@/shared/modules/meetings/messages/lib/format-visit-when'
import { CONVERSATION_KIND_LABELS } from '@/shared/services/voip/constants/conversation-copy'

interface ConversationComingUpProps {
  items: ComingUpItem[]
  canUpdate: boolean
  onEdit: (item: ComingUpItem) => void
  onSkip: (item: ComingUpItem) => void
}

export function ConversationComingUp({ items, canUpdate, onEdit, onSkip }: ConversationComingUpProps) {
  return (
    <section aria-label="Coming up" className="space-y-3">
      <Marker variant="separator"><MarkerContent>Coming up</MarkerContent></Marker>
      {items.map(item => (
        <Message key={`${item.meetingId}-${item.kind}`} align="end">
          <MessageContent>
            <MessageHeader>{`${CONVERSATION_KIND_LABELS[item.kind]} · scheduled`}</MessageHeader>
            <Bubble align="end" variant="scheduled">
              <BubbleContent className="whitespace-pre-wrap wrap-anywhere">{item.body}</BubbleContent>
            </Bubble>
            <MessageFooter className="flex-wrap gap-1">
              <span>{`${formatVisitWhen(item.plannedFor)}: goes out automatically`}</span>
              <Button type="button" size="sm" variant="ghost" className="h-7 px-2" disabled={!canUpdate} onClick={() => onEdit(item)}>Edit text</Button>
              <Button type="button" size="sm" variant="ghost" className="h-7 px-2" disabled={!canUpdate} onClick={() => onSkip(item)}>Skip</Button>
            </MessageFooter>
          </MessageContent>
        </Message>
      ))}
    </section>
  )
}
```

- [ ] **Step 4: Write `conversation-thread.tsx`**

```tsx
'use client'

import type { ComingUpItem, ConversationThreadData } from '@/shared/services/voip/types/conversation'

import { Fragment, useMemo } from 'react'

import { Marker, MarkerContent } from '@/shared/components/ui/marker'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/shared/components/ui/message-scroller'
import { ConversationComingUp } from '@/shared/services/voip/components/conversation-coming-up'
import { ConversationEvent } from '@/shared/services/voip/components/conversation-event'
import { ConversationMessage } from '@/shared/services/voip/components/conversation-message'
import { emptyThreadCopy } from '@/shared/services/voip/lib/describe-conversation-message'
import { groupThreadDays } from '@/shared/services/voip/lib/thread-days'

interface ConversationThreadProps {
  thread: ConversationThreadData
  canUpdate: boolean
  onEditComingUp: (item: ComingUpItem) => void
  onSkipComingUp: (item: ComingUpItem) => void
  className?: string
}

export function ConversationThread({ thread, canUpdate, onEditComingUp, onSkipComingUp, className }: ConversationThreadProps) {
  const days = useMemo(() => groupThreadDays(thread.items, new Date()), [thread.items])

  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="end">
      <MessageScroller className={className}>
        <MessageScrollerViewport aria-label={`Texts with ${thread.customer?.firstName ?? 'this number'}`} preserveScrollOnPrepend>
          <MessageScrollerContent className="gap-4 p-4">
            {thread.items.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">{emptyThreadCopy(thread)}</p>
            )}
            {days.map(day => (
              <Fragment key={day.key}>
                <MessageScrollerItem messageId={`day-${day.key}`}>
                  <Marker variant="separator"><MarkerContent>{day.label}</MarkerContent></Marker>
                </MessageScrollerItem>
                {day.items.map(item => (
                  <MessageScrollerItem key={item.id} messageId={item.id}>
                    {item.type === 'message' ? <ConversationMessage item={item} /> : <ConversationEvent item={item} />}
                  </MessageScrollerItem>
                ))}
              </Fragment>
            ))}
            {thread.comingUp.length > 0 && (
              <MessageScrollerItem messageId="coming-up">
                <ConversationComingUp items={thread.comingUp} canUpdate={canUpdate} onEdit={onEditComingUp} onSkip={onSkipComingUp} />
              </MessageScrollerItem>
            )}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  )
}
```

- [ ] **Step 5: Static checks**

Run: `pnpm eslint --fix src/shared/services/voip/components/*.tsx && pnpm tsc && pnpm lint`
Expected: pass.

- [ ] **Step 6: Commit** (only if commit-per-task was chosen) the four files: `feat(voip): conversation thread on shadcn message-scroller`.

---

### Task 7: The reply box (composer, chips, `/` menu)

**Files:**
- Create:
  - `src/shared/services/voip/lib/conversation-drafts.ts`
  - `src/shared/services/voip/hooks/use-conversation-draft.ts`
  - `src/shared/services/voip/components/quick-message-chips.tsx`
  - `src/shared/services/voip/components/quick-message-menu.tsx`
  - `src/shared/services/voip/components/conversation-composer.tsx`

**Interfaces:**
- Consumes: `pickQuickChips`, `quickMenuGroups`, `fillQuickMessage`, `toFieldLabels`, `QUICK_MESSAGE_TOKENS`, `COMPOSER_HELPER` (Task 3); `InputGroup*`, `Popover*`, `Command*`.
- Produces: `ConversationComposer({ threadKey, firstName, quickMessages, context, disabledReason, onSend(body): Promise<void>, onManage(), className? })`.
  - Enter sends; Shift+Enter adds a new line.
  - A chip or `/` item fills the box and never sends.
  - `onSend` rejecting keeps the draft.

- [ ] **Step 1: Write the draft store and hook**

`src/shared/services/voip/lib/conversation-drafts.ts`:

```ts
/** Unsent replies by thread, for this tab's life, so moving between threads never loses typing. */
export const conversationDrafts = new Map<string, string>()
```

`src/shared/services/voip/hooks/use-conversation-draft.ts`:

```ts
'use client'

import { useCallback, useState } from 'react'

import { conversationDrafts } from '@/shared/services/voip/lib/conversation-drafts'

/** The thread's draft. Remount the caller with `key={threadKey}` when the thread changes. */
export function useConversationDraft(threadKey: string) {
  const [draft, setDraftState] = useState(() => conversationDrafts.get(threadKey) ?? '')

  const setDraft = useCallback((value: string) => {
    setDraftState(value)
    if (value) {
      conversationDrafts.set(threadKey, value)
    }
    else {
      conversationDrafts.delete(threadKey)
    }
  }, [threadKey])

  return [draft, setDraft] as const
}
```

- [ ] **Step 2: Write `quick-message-chips.tsx`**

```tsx
import type { QuickMessage } from '@/shared/services/voip/types/conversation'

import { Button } from '@/shared/components/ui/button'

interface QuickMessageChipsProps {
  chips: QuickMessage[]
  onPick: (message: QuickMessage) => void
  onManage: () => void
}

export function QuickMessageChips({ chips, onPick, onManage }: QuickMessageChipsProps) {
  return (
    <div role="toolbar" aria-label="Quick messages" className="flex gap-1.5 overflow-x-auto scrollbar-none">
      {chips.map(message => (
        <Button key={message.id} type="button" size="sm" variant="outline" className="h-7 shrink-0 rounded-full px-3 text-xs" onClick={() => onPick(message)}>
          {message.name}
        </Button>
      ))}
      <Button type="button" size="sm" variant="ghost" className="h-7 shrink-0 rounded-full px-3 text-xs" onClick={onManage}>
        Manage…
      </Button>
    </div>
  )
}
```

- [ ] **Step 3: Write `quick-message-menu.tsx`**

```tsx
'use client'

import type { ReactNode } from 'react'

import type { QuickMenuGroup, QuickMessage } from '@/shared/services/voip/types/conversation'

import { SettingsIcon } from 'lucide-react'

import { Command, CommandGroup, CommandItem, CommandList, CommandSeparator } from '@/shared/components/ui/command'
import { Popover, PopoverAnchor, PopoverContent } from '@/shared/components/ui/popover'
import { QUICK_MESSAGE_TOKENS } from '@/shared/services/voip/constants/quick-message-tokens'
import { toFieldLabels } from '@/shared/services/voip/lib/sms-merge-template'

interface QuickMessageMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  groups: QuickMenuGroup[]
  activeCommand: string | null
  onActiveCommandChange: (command: string) => void
  onPick: (message: QuickMessage) => void
  onManage: () => void
  /** The reply box the menu opens above. Focus stays there, so typing keeps filtering and the arrow keys come from it. */
  children: ReactNode
}

export function QuickMessageMenu({ open, onOpenChange, groups, activeCommand, onActiveCommandChange, onPick, onManage, children }: QuickMessageMenuProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>{children}</PopoverAnchor>
      <PopoverContent
        side="top"
        align="start"
        className="w-(--radix-popover-trigger-width) p-0"
        onOpenAutoFocus={event => event.preventDefault()}
        onCloseAutoFocus={event => event.preventDefault()}
      >
        <Command shouldFilter={false} value={activeCommand ?? ''} onValueChange={onActiveCommandChange}>
          <CommandList>
            {groups.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">No quick message matches.</p>}
            {groups.map(group => (
              <CommandGroup key={group.groupName} heading={group.groupName}>
                {group.items.map(({ message, disabledReason }) => (
                  <CommandItem
                    key={message.id}
                    value={message.command}
                    disabled={disabledReason !== null}
                    onSelect={() => onPick(message)}
                    className="flex-col items-start gap-0.5"
                  >
                    <span className="flex w-full items-baseline gap-2">
                      <span className="font-medium">{`/${message.command}`}</span>
                      <span className="min-w-0 flex-1 truncate">{message.name}</span>
                      {disabledReason && <span className="shrink-0 text-xs text-muted-foreground">{disabledReason}</span>}
                    </span>
                    <span className="w-full truncate text-xs text-muted-foreground">{toFieldLabels(message.body, QUICK_MESSAGE_TOKENS)}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
            <CommandSeparator />
            <CommandGroup>
              <CommandItem value="__manage" onSelect={onManage}>
                <SettingsIcon />
                Manage quick messages…
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 4: Write `conversation-composer.tsx`**

```tsx
'use client'

import type { KeyboardEvent } from 'react'

import type { QuickMessage, QuickMessageContext } from '@/shared/services/voip/types/conversation'

import { ArrowUpIcon } from 'lucide-react'
import { useRef, useState } from 'react'

import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupText, InputGroupTextarea } from '@/shared/components/ui/input-group'
import { cn } from '@/shared/lib/utils'
import { QuickMessageChips } from '@/shared/services/voip/components/quick-message-chips'
import { QuickMessageMenu } from '@/shared/services/voip/components/quick-message-menu'
import { COMPOSER_HELPER } from '@/shared/services/voip/constants/conversation-copy'
import { useConversationDraft } from '@/shared/services/voip/hooks/use-conversation-draft'
import { fillQuickMessage, pickQuickChips, quickMenuGroups } from '@/shared/services/voip/lib/quick-messages'

interface ConversationComposerProps {
  /** Keys the in-memory draft. Remount with `key` when it changes. */
  threadKey: string
  firstName: string | null
  quickMessages: readonly QuickMessage[]
  context: QuickMessageContext
  /** Why texting is off (STOP, a landline, no main line, read-only). The box is disabled while set. */
  disabledReason: string | null
  /** Rejects when the send failed; the draft then stays. */
  onSend: (body: string) => Promise<void>
  onManage: () => void
  className?: string
}

export function ConversationComposer({ threadKey, firstName, quickMessages, context, disabledReason, onSend, onManage, className }: ConversationComposerProps) {
  const [draft, setDraft] = useConversationDraft(threadKey)
  const [menuDismissed, setMenuDismissed] = useState(false)
  const [activeCommand, setActiveCommand] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  // State lags a fast second Enter; the ref does not, so one burst of key presses sends once.
  const sendingRef = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const query = /^\/(\S*)$/.exec(draft)?.[1] ?? null
  const groups = query === null ? [] : quickMenuGroups(quickMessages, context, query)
  const choices = groups.flatMap(group => group.items).filter(item => item.disabledReason === null).map(item => item.message)
  const menuOpen = query !== null && !menuDismissed && disabledReason === null
  const active = choices.find(message => message.command === activeCommand) ?? choices[0] ?? null

  function fill(message: QuickMessage) {
    const value = fillQuickMessage(message.body, context.vars)
    setDraft(value)
    setActiveCommand(null)
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(value.length, value.length)
    })
  }

  async function send() {
    const body = draft.trim()
    if (!body || sendingRef.current || disabledReason !== null) {
      return
    }
    sendingRef.current = true
    setSending(true)
    try {
      await onSend(body)
      setDraft('')
    }
    catch {
      // The caller's toast says what failed; the draft stays so nothing typed is lost.
    }
    finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) {
      return
    }
    if (menuOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault()
      if (choices.length > 0) {
        const index = active ? choices.indexOf(active) : -1
        const step = event.key === 'ArrowDown' ? 1 : -1
        setActiveCommand(choices[(index + step + choices.length) % choices.length].command)
      }
      return
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (menuOpen) {
        if (active) {
          fill(active)
        }
        return
      }
      void send()
    }
  }

  return (
    <div className={cn('space-y-2 rounded-xl border bg-card p-2 shadow-xs', className)}>
      {disabledReason === null && (
        <QuickMessageChips chips={pickQuickChips(quickMessages, context)} onPick={fill} onManage={onManage} />
      )}
      <QuickMessageMenu
        open={menuOpen}
        onOpenChange={open => !open && setMenuDismissed(true)}
        groups={groups}
        activeCommand={active?.command ?? null}
        onActiveCommandChange={setActiveCommand}
        onPick={fill}
        onManage={onManage}
      >
        <InputGroup>
          <InputGroupTextarea
            ref={textareaRef}
            aria-label="Reply"
            rows={1}
            className="max-h-40 min-h-10"
            value={draft}
            placeholder={disabledReason ?? `Text ${firstName ?? 'them'}, or type / for quick messages`}
            disabled={disabledReason !== null}
            onChange={(event) => {
              setDraft(event.target.value)
              setMenuDismissed(false)
              setActiveCommand(null)
            }}
            onKeyDown={handleKeyDown}
          />
          <InputGroupAddon align="block-end" className="justify-between gap-2">
            <InputGroupText className="min-w-0 truncate text-xs">{COMPOSER_HELPER}</InputGroupText>
            <InputGroupButton
              size="icon-sm"
              variant="default"
              aria-label="Send"
              disabled={disabledReason !== null || sending || draft.trim() === ''}
              onClick={() => void send()}
            >
              <ArrowUpIcon />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </QuickMessageMenu>
    </div>
  )
}
```

The Popover owns Escape: while the menu is open, Escape goes to the Popover's layer, which calls `onOpenChange(false)`, and the sheet behind it stays open.

- [ ] **Step 5: Static checks**

Run: `pnpm eslint --fix <the five files> && pnpm tsc && pnpm lint`
Expected: pass.

- [ ] **Step 6: Commit** (only if commit-per-task was chosen) the five files: `feat(voip): reply box with quick-message chips and slash menu`.

---

### Task 8: Quick messages Manage sheet (presentational)

**Files:**
- Create:
  - `src/shared/services/voip/components/merge-field-chips.tsx`
  - `src/shared/services/voip/components/quick-message-editor.tsx`
  - `src/shared/services/voip/components/quick-messages-manage-sheet.tsx`

**Interfaces:**
- Consumes: `checkQuickMessage`, `fillQuickMessage`, `groupQuickMessages`, `moveQuickMessage`, `insertText`, `toFieldLabels`, `QUICK_MESSAGE_*` (Task 3); `sampleVisitMessageVars`; `ResponsiveSheet`; `useConfirm`.
- Produces:
  - `MergeFieldChips({ labels, onInsert(label), disabled? })`, which Task 9 reuses;
  - `QuickMessagesManageSheet({ open, onOpenChange, messages, canUpdate, onCreate, onUpdate, onDelete, onReorder, onReset })`, where every handler returns `Promise<void>` and rejects on failure.

- [ ] **Step 1: Write `merge-field-chips.tsx`**

```tsx
import { Button } from '@/shared/components/ui/button'

interface MergeFieldChipsProps {
  labels: readonly string[]
  /** Called with the bare label; the caller types `[Label]` at the cursor. */
  onInsert: (label: string) => void
  disabled?: boolean
}

export function MergeFieldChips({ labels, onInsert, disabled }: MergeFieldChipsProps) {
  return (
    <div role="toolbar" aria-label="Insert a field" className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Insert</span>
      {labels.map(label => (
        <Button key={label} type="button" size="sm" variant="outline" disabled={disabled} className="h-7 rounded-full px-2.5 text-xs" onClick={() => onInsert(label)}>
          {label}
        </Button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Write `quick-message-editor.tsx`**

```tsx
'use client'

import type { QuickMessage, QuickMessageDraft } from '@/shared/services/voip/types/conversation'

import { useId, useRef, useState } from 'react'

import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/shared/components/ui/input-group'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { toneClasses } from '@/shared/constants/status-tones'
import { sampleVisitMessageVars } from '@/shared/modules/meetings/messages/lib/sample-visit-message-vars'
import { MergeFieldChips } from '@/shared/services/voip/components/merge-field-chips'
import { QUICK_MESSAGE_GROUPS } from '@/shared/services/voip/constants/quick-message-defaults'
import { QUICK_MESSAGE_FIELD_LABELS, QUICK_MESSAGE_TOKENS } from '@/shared/services/voip/constants/quick-message-tokens'
import { insertText } from '@/shared/services/voip/lib/insert-text'
import { checkQuickMessage, fillQuickMessage, groupQuickMessages } from '@/shared/services/voip/lib/quick-messages'
import { toFieldLabels } from '@/shared/services/voip/lib/sms-merge-template'

interface QuickMessageEditorProps {
  /** Null for a new quick message. */
  message: QuickMessage | null
  messages: readonly QuickMessage[]
  onSave: (draft: QuickMessageDraft) => Promise<void>
  /** Null when there is nothing to delete yet. */
  onDelete: (() => Promise<void>) | null
  onCancel: () => void
}

export function QuickMessageEditor({ message, messages, onSave, onDelete, onCancel }: QuickMessageEditorProps) {
  const id = useId()
  const [name, setName] = useState(message?.name ?? '')
  const [command, setCommand] = useState(message?.command ?? '')
  const [groupName, setGroupName] = useState<string>(message?.groupName ?? QUICK_MESSAGE_GROUPS[0])
  const [text, setText] = useState(() => toFieldLabels(message?.body ?? '', QUICK_MESSAGE_TOKENS))
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const check = checkQuickMessage({ name, command, groupName, text }, messages, message?.id ?? null)
  const sample = sampleVisitMessageVars()
  const hasErrors = Object.keys(check.errors).length > 0
  const show = (field: keyof typeof check.errors) => (touched || field === 'command') ? check.errors[field] : undefined

  function insertField(label: string) {
    const textarea = textareaRef.current
    const next = insertText(text, textarea?.selectionStart ?? text.length, textarea?.selectionEnd ?? text.length, `[${label}]`)
    setText(next.value)
    requestAnimationFrame(() => {
      textarea?.focus()
      textarea?.setSelectionRange(next.caret, next.caret)
    })
  }

  async function save() {
    setTouched(true)
    if (hasErrors) {
      return
    }
    setSaving(true)
    try {
      await onSave(check.draft)
    }
    catch {
      // The caller's toast says what failed; the editor stays open with the text.
    }
    finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3 shadow-xs">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-name`}>Name</Label>
          <Input id={`${id}-name`} value={name} aria-invalid={Boolean(show('name'))} onChange={event => setName(event.target.value)} />
          {show('name') && <p className="text-xs text-destructive-text">{show('name')}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-command`}>Command</Label>
          <InputGroup>
            <InputGroupAddon><InputGroupText>/</InputGroupText></InputGroupAddon>
            <InputGroupInput id={`${id}-command`} value={command} aria-invalid={Boolean(show('command'))} onChange={event => setCommand(event.target.value)} />
          </InputGroup>
          {command && show('command') && <p className="text-xs text-destructive-text">{show('command')}</p>}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-group`}>Group</Label>
        <Input id={`${id}-group`} list={`${id}-groups`} value={groupName} aria-invalid={Boolean(show('groupName'))} onChange={event => setGroupName(event.target.value)} />
        <datalist id={`${id}-groups`}>
          {groupQuickMessages(messages).map(group => <option key={group.groupName} value={group.groupName} />)}
        </datalist>
        {show('groupName') && <p className="text-xs text-destructive-text">{show('groupName')}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-text`}>Text</Label>
        <MergeFieldChips labels={QUICK_MESSAGE_FIELD_LABELS} onInsert={insertField} />
        <Textarea ref={textareaRef} id={`${id}-text`} rows={4} value={text} aria-invalid={Boolean(show('body'))} onChange={event => setText(event.target.value)} />
        {show('body') && <p className="text-xs text-destructive-text">{show('body')}</p>}
        {check.warnings.map(warning => <p key={warning} className={`text-xs ${toneClasses('attention').text}`}>{warning}</p>)}
      </div>
      <div className="space-y-1 rounded-md bg-muted p-3">
        <p className="text-xs font-medium text-muted-foreground">{`What ${sample.firstName} gets`}</p>
        <p className="whitespace-pre-wrap wrap-anywhere text-sm">{fillQuickMessage(check.draft.body, sample)}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>Save for the team</Button>
        {onDelete && (
          <Button type="button" size="sm" variant="ghost" className="text-destructive-text" disabled={saving} onClick={() => void onDelete()}>Delete</Button>
        )}
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write `quick-messages-manage-sheet.tsx`**

```tsx
'use client'

import type { QuickMessage, QuickMessageDraft } from '@/shared/services/voip/types/conversation'

import { ArrowDownIcon, ArrowUpIcon, PencilIcon, PlusIcon } from 'lucide-react'
import { useState } from 'react'

import { ResponsiveSheet } from '@/shared/components/dialogs/sheets/responsive-sheet'
import { Button } from '@/shared/components/ui/button'
import { useConfirm } from '@/shared/hooks/use-confirm'
import { QuickMessageEditor } from '@/shared/services/voip/components/quick-message-editor'
import { QUICK_MESSAGES_DELETE_CONFIRM, QUICK_MESSAGES_RESET_CONFIRM } from '@/shared/services/voip/constants/quick-message-defaults'
import { QUICK_MESSAGE_TOKENS } from '@/shared/services/voip/constants/quick-message-tokens'
import { groupQuickMessages, moveQuickMessage } from '@/shared/services/voip/lib/quick-messages'
import { toFieldLabels } from '@/shared/services/voip/lib/sms-merge-template'

interface QuickMessagesManageSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  messages: readonly QuickMessage[]
  canUpdate: boolean
  onCreate: (draft: QuickMessageDraft) => Promise<void>
  onUpdate: (id: string, draft: QuickMessageDraft) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onReorder: (ids: string[]) => Promise<void>
  onReset: () => Promise<void>
}

export function QuickMessagesManageSheet({ open, onOpenChange, messages, canUpdate, onCreate, onUpdate, onDelete, onReorder, onReset }: QuickMessagesManageSheetProps) {
  const [editing, setEditing] = useState<QuickMessage | 'new' | null>(null)
  const [ResetDialog, confirmReset] = useConfirm(QUICK_MESSAGES_RESET_CONFIRM)
  const [DeleteDialog, confirmDelete] = useConfirm(QUICK_MESSAGES_DELETE_CONFIRM)

  async function save(draft: QuickMessageDraft) {
    if (editing === 'new') {
      await onCreate(draft)
    }
    else if (editing) {
      await onUpdate(editing.id, draft)
    }
    setEditing(null)
  }

  async function remove(message: QuickMessage) {
    if (await confirmDelete()) {
      await onDelete(message.id)
      setEditing(null)
    }
  }

  async function reset() {
    if (await confirmReset()) {
      // A rejected reset has already said why in a toast; the list stays as it was.
      await onReset().catch(() => {})
    }
  }

  const footer = editing === null && canUpdate
    ? (
        <div className="flex w-full flex-wrap justify-between gap-2">
          <Button type="button" variant="outline" onClick={() => setEditing('new')}>
            <PlusIcon />
            New quick message
          </Button>
          <Button type="button" variant="ghost" onClick={() => void reset()}>Reset to defaults</Button>
        </div>
      )
    : undefined

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Quick messages"
      description="Shared by the whole team. Type / in a reply to use one."
      footer={footer}
      sheetClassName="sm:max-w-md"
    >
      <ResetDialog />
      <DeleteDialog />
      {editing !== null
        ? (
            <QuickMessageEditor
              message={editing === 'new' ? null : editing}
              messages={messages}
              onSave={save}
              onDelete={editing === 'new' ? null : () => remove(editing)}
              onCancel={() => setEditing(null)}
            />
          )
        : (
            <div className="space-y-4">
              {groupQuickMessages(messages).map(group => (
                <section key={group.groupName} aria-label={group.groupName} className="space-y-1.5">
                  <h3 className="text-xs font-medium text-muted-foreground">{group.groupName}</h3>
                  <ul className="divide-y rounded-lg border bg-card shadow-xs">
                    {group.items.map((message, index) => (
                      <li key={message.id} className="flex items-center gap-1.5 p-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">
                            <span className="font-medium">{`/${message.command}`}</span>
                            {` ${message.name}`}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{toFieldLabels(message.body, QUICK_MESSAGE_TOKENS)}</p>
                        </div>
                        {canUpdate && (
                          <>
                            <Button type="button" size="icon-xs" variant="ghost" aria-label={`Move ${message.name} up`} disabled={index === 0} onClick={() => void onReorder(moveQuickMessage(messages, message.id, -1)).catch(() => {})}>
                              <ArrowUpIcon />
                            </Button>
                            <Button type="button" size="icon-xs" variant="ghost" aria-label={`Move ${message.name} down`} disabled={index === group.items.length - 1} onClick={() => void onReorder(moveQuickMessage(messages, message.id, 1)).catch(() => {})}>
                              <ArrowDownIcon />
                            </Button>
                            <Button type="button" size="icon-xs" variant="ghost" aria-label={`Edit ${message.name}`} onClick={() => setEditing(message)}>
                              <PencilIcon />
                            </Button>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
    </ResponsiveSheet>
  )
}
```

The handlers (Task 11) show a toast on failure before they reject. The `.catch(() => {})` calls only stop a second, unhandled report.

- [ ] **Step 4: Static checks**

Run: `pnpm eslint --fix <the three files> && pnpm tsc && pnpm lint`
Expected: pass.

- [ ] **Step 5: Commit** (only if commit-per-task was chosen) the three files: `feat(voip): quick messages Manage sheet and editor`.

---

### Task 9: The per-visit text editor

**Files:**
- Create: `src/shared/modules/meetings/messages/components/visit-message-text-editor.tsx`

**Interfaces:**
- Consumes:
  - from Task 4: `checkVisitMessageEdit`, `VISIT_EDITOR_FIELD_LABELS`;
  - from Task 3: `keepFieldsMessage`, `segmentCountCopy`, `resolveMergeSections`, `toFieldLabels`, `insertText`, `MergeFieldChips` (Task 8);
  - `renderVisitMessage`, `VISIT_MESSAGE_TOKENS`.
- Produces: `VisitMessageTextEditor({ templateKey, body, vars, overridden, canUpdate, onSave(body), onReset(), onCancel() })`.

- [ ] **Step 1: Write the component**

```tsx
'use client'

import type { VisitMessageTemplateKey } from '@/shared/modules/meetings/messages/constants/kinds'
import type { VisitMessageVars } from '@/shared/modules/meetings/messages/types'

import { useId, useRef, useState } from 'react'

import { Button } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { toneClasses } from '@/shared/constants/status-tones'
import { VISIT_MESSAGE_TOKENS } from '@/shared/modules/meetings/messages/constants/templates'
import { VISIT_EDITOR_FIELD_LABELS } from '@/shared/modules/meetings/messages/constants/visit-editor'
import { checkVisitMessageEdit } from '@/shared/modules/meetings/messages/lib/check-visit-message-edit'
import { renderVisitMessage } from '@/shared/modules/meetings/messages/lib/render-visit-message'
import { MergeFieldChips } from '@/shared/services/voip/components/merge-field-chips'
import { insertText } from '@/shared/services/voip/lib/insert-text'
import { keepFieldsMessage, segmentCountCopy } from '@/shared/services/voip/lib/sms-editor-copy'
import { resolveMergeSections, toFieldLabels } from '@/shared/services/voip/lib/sms-merge-template'

interface VisitMessageTextEditorProps {
  templateKey: VisitMessageTemplateKey
  /** The step's current wording, in `{{token}}` form. */
  body: string
  vars: VisitMessageVars
  overridden: boolean
  canUpdate: boolean
  /** Rejects when the save failed; the editor then stays open. */
  onSave: (body: string) => Promise<void>
  onReset: () => Promise<void>
  onCancel: () => void
}

export function VisitMessageTextEditor({ templateKey, body, vars, overridden, canUpdate, onSave, onReset, onCancel }: VisitMessageTextEditorProps) {
  const id = useId()
  // Sections are settled for this visit before editing, so staff edit the words this homeowner would get.
  const [initialText] = useState(() => toFieldLabels(resolveMergeSections(body, VISIT_MESSAGE_TOKENS, vars), VISIT_MESSAGE_TOKENS))
  const [text, setText] = useState(initialText)
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const check = checkVisitMessageEdit(templateKey, text)
  const keep = keepFieldsMessage(check.missing)
  const preview = renderVisitMessage(check.body, vars, { stopLine: false })
  const counter = templateKey === 'visit_summary'
    ? `${segmentCountCopy(preview)} · the opt-out line is added automatically`
    : segmentCountCopy(preview)

  function insertField(label: string) {
    const textarea = textareaRef.current
    const next = insertText(text, textarea?.selectionStart ?? text.length, textarea?.selectionEnd ?? text.length, `[${label}]`)
    setText(next.value)
    requestAnimationFrame(() => {
      textarea?.focus()
      textarea?.setSelectionRange(next.caret, next.caret)
    })
  }

  async function run(action: () => Promise<void>) {
    setSaving(true)
    try {
      await action()
    }
    catch {
      // The caller's toast says what failed; the editor stays open with the text.
    }
    finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3 shadow-xs">
      <Label htmlFor={`${id}-text`} className="sr-only">Text for this visit</Label>
      <MergeFieldChips labels={VISIT_EDITOR_FIELD_LABELS} onInsert={insertField} disabled={!canUpdate} />
      <Textarea
        ref={textareaRef}
        id={`${id}-text`}
        rows={6}
        value={text}
        aria-describedby={`${id}-issues`}
        aria-invalid={keep !== null || check.errors.length > 0}
        onChange={event => setText(event.target.value)}
      />
      <div id={`${id}-issues`} className="space-y-1 text-xs">
        {keep && <p className="text-destructive-text">{keep}</p>}
        {check.errors.map(error => <p key={error} className="text-destructive-text">{error}</p>)}
        {check.warnings.map(warning => <p key={warning} className={toneClasses('attention').text}>{warning}</p>)}
      </div>
      <div className="space-y-1 rounded-md bg-muted p-3">
        <p className="text-xs font-medium text-muted-foreground">{`What ${vars.firstName} gets`}</p>
        <p className="whitespace-pre-wrap wrap-anywhere text-sm">{preview}</p>
        <p className="text-xs text-muted-foreground">{counter}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!canUpdate || saving || keep !== null || check.errors.length > 0}
          onClick={() => void run(() => onSave(check.body))}
        >
          Save for this visit
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canUpdate || saving}
          onClick={() => overridden ? void run(onReset) : setText(initialText)}
        >
          Reset to default
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Static checks**

Run: `pnpm eslint --fix src/shared/modules/meetings/messages/components/visit-message-text-editor.tsx && pnpm tsc && pnpm lint`
Expected: pass.

- [ ] **Step 3: Commit** (only if commit-per-task was chosen) the file: `feat(visit-messages): per-visit text editor`.

---

### Task 10: Sequence rows

**Files:**
- Create in `src/shared/modules/meetings/messages/components/`:
  - `visit-step-row.tsx`
  - `visit-step-actions.tsx`
  - `visit-summary-step.tsx`
  - `visit-invite-step.tsx`
  - `visit-automatic-step.tsx`
  - `visit-message-steps.tsx`

**Interfaces:**
- Consumes: `describeVisitStep`, `describeInvite`, `isAutomaticStep`, `VISIT_*` copy (Task 4); `VisitMessageTextEditor` (Task 9); `TEXTING_BLOCKED_COPY` (Task 3); `renderVisitMessage`.
- Produces: `VisitMessageSteps({ data: VisitSheetData, canUpdate, sending, initialEdit: VisitMessageSequenceKind | null, handlers: VisitStepHandlers })`.

- [ ] **Step 1: Write `visit-step-row.tsx`**

```tsx
import type { ReactNode } from 'react'

import type { StatusTone } from '@/shared/constants/status-tones'

import { toneClasses } from '@/shared/constants/status-tones'
import { cn } from '@/shared/lib/utils'

interface VisitStepRowProps {
  title: string
  status: string
  tone: StatusTone
  meta: string[]
  /** Shows "Edited for this visit · Reset to default". */
  edited?: boolean
  canUpdate?: boolean
  onResetEdit?: () => void
  actions?: ReactNode
  children?: ReactNode
}

export function VisitStepRow({ title, status, tone, meta, edited, canUpdate, onResetEdit, actions, children }: VisitStepRowProps) {
  return (
    <li className="space-y-2.5 rounded-lg border bg-card p-3 shadow-xs">
      <div className="flex items-start gap-2.5">
        <span aria-hidden className={cn('mt-1.5 size-2 shrink-0 rounded-full', toneClasses(tone).dot)} />
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm font-medium">{title}</p>
          <p className={cn('text-sm', toneClasses(tone).text)}>{status}</p>
          {meta.map(line => <p key={line} className="text-xs text-muted-foreground">{line}</p>)}
          {edited && (
            <p className="text-xs text-muted-foreground">
              Edited for this visit ·
              {' '}
              <button type="button" className="cursor-pointer underline underline-offset-2 hover:text-foreground disabled:cursor-default disabled:no-underline" disabled={!canUpdate} onClick={onResetEdit}>
                Reset to default
              </button>
            </p>
          )}
        </div>
      </div>
      {actions && <div className="pl-4.5">{actions}</div>}
      {children}
    </li>
  )
}
```

- [ ] **Step 2: Write `visit-step-actions.tsx`**

```tsx
import type { VisitStepActionId, VisitStepPanel } from '@/shared/modules/meetings/messages/types'

import { SendIcon } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'

interface VisitStepActionsProps {
  actions: VisitStepActionId[]
  panel: VisitStepPanel
  onPanelChange: (panel: VisitStepPanel) => void
  canUpdate: boolean
  /** A send in flight, or texting is off for this number. */
  sendDisabled?: boolean
  /** The failed phone is still the one on file. */
  sendAgainDisabled?: boolean
  onSend?: (mode: 'send' | 'resend') => void
  onSkip?: () => void
  onUndo?: () => void
  onEditPhone?: () => void
}

export function VisitStepActions({ actions, panel, onPanelChange, canUpdate, sendDisabled, sendAgainDisabled, onSend, onSkip, onUndo, onEditPhone }: VisitStepActionsProps) {
  if (actions.length === 0) {
    return null
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {actions.map((action) => {
        switch (action) {
          case 'send':
            return (
              <Button key={action} type="button" size="sm" disabled={!canUpdate || sendDisabled} onClick={() => onSend?.('send')}>
                <SendIcon />
                Send visit summary
              </Button>
            )
          case 'resend':
            return <Button key={action} type="button" size="sm" variant="outline" disabled={!canUpdate || sendDisabled} onClick={() => onSend?.('resend')}>Resend</Button>
          case 'sendAgain':
            return <Button key={action} type="button" size="sm" disabled={!canUpdate || sendDisabled || sendAgainDisabled} onClick={() => onSend?.('send')}>Send again</Button>
          case 'view':
            return (
              <Button key={action} type="button" size="sm" variant="outline" aria-expanded={panel === 'view'} onClick={() => onPanelChange(panel === 'view' ? null : 'view')}>
                {panel === 'view' ? 'Hide text' : 'View text'}
              </Button>
            )
          case 'edit':
            return (
              <Button key={action} type="button" size="sm" variant="outline" disabled={!canUpdate} aria-expanded={panel === 'edit'} onClick={() => onPanelChange(panel === 'edit' ? null : 'edit')}>
                Edit text
              </Button>
            )
          case 'skip':
            return <Button key={action} type="button" size="sm" variant="outline" disabled={!canUpdate} onClick={onSkip}>Skip</Button>
          case 'undo':
            return <Button key={action} type="button" size="sm" variant="outline" disabled={!canUpdate} onClick={onUndo}>Undo</Button>
          case 'editPhone':
            return <Button key={action} type="button" size="sm" variant="outline" disabled={!canUpdate} onClick={onEditPhone}>Edit phone</Button>
        }
      })}
    </div>
  )
}
```

- [ ] **Step 3: Write `visit-summary-step.tsx`**

```tsx
'use client'

import type { VisitMessageVars, VisitSheetStep, VisitStepHandlers, VisitStepPanel } from '@/shared/modules/meetings/messages/types'

import { VisitMessageTextEditor } from '@/shared/modules/meetings/messages/components/visit-message-text-editor'
import { VisitStepActions } from '@/shared/modules/meetings/messages/components/visit-step-actions'
import { VisitStepRow } from '@/shared/modules/meetings/messages/components/visit-step-row'
import { VISIT_SEND_AGAIN_BLOCKED } from '@/shared/modules/meetings/messages/constants/visit-step-copy'
import { describeVisitStep } from '@/shared/modules/meetings/messages/lib/describe-visit-step'
import { renderVisitMessage } from '@/shared/modules/meetings/messages/lib/render-visit-message'

interface VisitSummaryStepProps {
  step: VisitSheetStep
  vars: VisitMessageVars
  now: Date
  canUpdate: boolean
  sending: boolean
  /** Copy for why texting this number is off; null when it works. */
  textingBlocked: string | null
  phoneChangedSinceFailure: boolean
  panel: VisitStepPanel
  onPanelChange: (panel: VisitStepPanel) => void
  handlers: VisitStepHandlers
}

export function VisitSummaryStep({ step, vars, now, canUpdate, sending, textingBlocked, phoneChangedSinceFailure, panel, onPanelChange, handlers }: VisitSummaryStepProps) {
  const view = describeVisitStep(step, now)
  const sends = view.actions.some(action => action === 'send' || action === 'resend' || action === 'sendAgain')
  const meta = [
    ...view.meta,
    ...(sends && textingBlocked ? [textingBlocked] : []),
    ...(view.actions.includes('sendAgain') && !phoneChangedSinceFailure ? [VISIT_SEND_AGAIN_BLOCKED] : []),
  ]

  return (
    <VisitStepRow
      title={view.title}
      status={view.status}
      tone={view.tone}
      meta={meta}
      edited={view.edited}
      canUpdate={canUpdate}
      onResetEdit={() => void handlers.onResetText(step.kind).catch(() => {})}
      actions={(
        <VisitStepActions
          actions={view.actions}
          panel={panel}
          onPanelChange={onPanelChange}
          canUpdate={canUpdate}
          sendDisabled={sending || textingBlocked !== null}
          sendAgainDisabled={!phoneChangedSinceFailure}
          onSend={mode => void handlers.onSend(mode)}
          onEditPhone={handlers.onEditPhone}
        />
      )}
    >
      {panel === 'view' && (
        <p className="whitespace-pre-wrap wrap-anywhere rounded-md bg-muted p-3 text-sm">
          {step.sentBody ?? renderVisitMessage(step.body, vars, { stopLine: false })}
        </p>
      )}
      {panel === 'edit' && (
        <VisitMessageTextEditor
          templateKey={step.templateKey}
          body={step.body}
          vars={vars}
          overridden={step.overridden}
          canUpdate={canUpdate}
          onSave={async (body) => {
            await handlers.onSaveText(step.kind, body)
            onPanelChange(null)
          }}
          onReset={async () => {
            await handlers.onResetText(step.kind)
            onPanelChange(null)
          }}
          onCancel={() => onPanelChange(null)}
        />
      )}
    </VisitStepRow>
  )
}
```

- [ ] **Step 4: Write `visit-invite-step.tsx`**

```tsx
import type { VisitSheetData, VisitSheetStep } from '@/shared/modules/meetings/messages/types'

import { Button } from '@/shared/components/ui/button'
import { VisitStepRow } from '@/shared/modules/meetings/messages/components/visit-step-row'
import { VISIT_INVITE_COPY } from '@/shared/modules/meetings/messages/constants/visit-step-copy'
import { describeInvite } from '@/shared/modules/meetings/messages/lib/describe-visit-step'

interface VisitInviteStepProps {
  invite: VisitSheetData['invite']
  summary: VisitSheetStep | undefined
  canUpdate: boolean
  onEditEmail: () => void
}

export function VisitInviteStep({ invite, summary, canUpdate, onEditEmail }: VisitInviteStepProps) {
  const view = describeInvite(invite, summary)
  return (
    <VisitStepRow
      title={VISIT_INVITE_COPY.title}
      status={view.status}
      tone={view.tone}
      meta={view.meta ? [view.meta] : []}
      actions={view.editEmail
        ? <Button type="button" size="sm" variant="outline" disabled={!canUpdate} onClick={onEditEmail}>Edit email</Button>
        : undefined}
    />
  )
}
```

- [ ] **Step 5: Write `visit-automatic-step.tsx`**

```tsx
'use client'

import type { PausableVisitMessageKind } from '@/shared/modules/meetings/messages/constants/kinds'
import type { VisitMessageVars, VisitSheetStep, VisitStepHandlers, VisitStepPanel } from '@/shared/modules/meetings/messages/types'

import { VisitMessageTextEditor } from '@/shared/modules/meetings/messages/components/visit-message-text-editor'
import { VisitStepActions } from '@/shared/modules/meetings/messages/components/visit-step-actions'
import { VisitStepRow } from '@/shared/modules/meetings/messages/components/visit-step-row'
import { describeVisitStep } from '@/shared/modules/meetings/messages/lib/describe-visit-step'
import { renderVisitMessage } from '@/shared/modules/meetings/messages/lib/render-visit-message'

interface VisitAutomaticStepProps {
  step: VisitSheetStep & { kind: PausableVisitMessageKind }
  vars: VisitMessageVars
  now: Date
  canUpdate: boolean
  panel: VisitStepPanel
  onPanelChange: (panel: VisitStepPanel) => void
  handlers: VisitStepHandlers
}

export function VisitAutomaticStep({ step, vars, now, canUpdate, panel, onPanelChange, handlers }: VisitAutomaticStepProps) {
  const view = describeVisitStep(step, now)
  return (
    <VisitStepRow
      title={view.title}
      status={view.status}
      tone={view.tone}
      meta={view.meta}
      edited={view.edited}
      canUpdate={canUpdate}
      onResetEdit={() => void handlers.onResetText(step.kind).catch(() => {})}
      actions={(
        <VisitStepActions
          actions={view.actions}
          panel={panel}
          onPanelChange={onPanelChange}
          canUpdate={canUpdate}
          onSkip={() => handlers.onSkip(step.kind)}
          onUndo={() => handlers.onUndo(step.kind)}
        />
      )}
    >
      {panel === 'view' && (
        <p className="whitespace-pre-wrap wrap-anywhere rounded-md bg-muted p-3 text-sm">
          {step.sentBody ?? renderVisitMessage(step.body, vars, { stopLine: false })}
        </p>
      )}
      {panel === 'edit' && (
        <VisitMessageTextEditor
          templateKey={step.templateKey}
          body={step.body}
          vars={vars}
          overridden={step.overridden}
          canUpdate={canUpdate}
          onSave={async (body) => {
            await handlers.onSaveText(step.kind, body)
            onPanelChange(null)
          }}
          onReset={async () => {
            await handlers.onResetText(step.kind)
            onPanelChange(null)
          }}
          onCancel={() => onPanelChange(null)}
        />
      )}
    </VisitStepRow>
  )
}
```

- [ ] **Step 6: Write `visit-message-steps.tsx`**

```tsx
'use client'

import type { VisitMessageSequenceKind } from '@/shared/modules/meetings/messages/constants/kinds'
import type { VisitSheetData, VisitStepHandlers, VisitStepPanel } from '@/shared/modules/meetings/messages/types'

import { Fragment, useState } from 'react'

import { VisitAutomaticStep } from '@/shared/modules/meetings/messages/components/visit-automatic-step'
import { VisitInviteStep } from '@/shared/modules/meetings/messages/components/visit-invite-step'
import { VisitSummaryStep } from '@/shared/modules/meetings/messages/components/visit-summary-step'
import { isAutomaticStep } from '@/shared/modules/meetings/messages/lib/describe-visit-step'
import { TEXTING_BLOCKED_COPY } from '@/shared/services/voip/constants/texting-blocked-copy'

interface VisitMessageStepsProps {
  data: VisitSheetData
  canUpdate: boolean
  sending: boolean
  /** Opens this step's editor on mount, for "Edit text" on a coming-up text in the Conversation tab. */
  initialEdit: VisitMessageSequenceKind | null
  handlers: VisitStepHandlers
}

export function VisitMessageSteps({ data, canUpdate, sending, initialEdit, handlers }: VisitMessageStepsProps) {
  const [open, setOpen] = useState<{ kind: VisitMessageSequenceKind, panel: NonNullable<VisitStepPanel> } | null>(
    initialEdit ? { kind: initialEdit, panel: 'edit' } : null,
  )
  const now = new Date()
  const textingBlocked = data.texting.ok ? null : TEXTING_BLOCKED_COPY[data.texting.reason]
  const panelOf = (kind: VisitMessageSequenceKind): VisitStepPanel => open?.kind === kind ? open.panel : null
  const panelSetter = (kind: VisitMessageSequenceKind) => (panel: VisitStepPanel) => setOpen(panel ? { kind, panel } : null)

  return (
    <ol aria-label="Visit texts" className="space-y-2">
      {data.steps.map(step => isAutomaticStep(step)
        ? (
            <VisitAutomaticStep
              key={step.kind}
              step={step}
              vars={data.vars}
              now={now}
              canUpdate={canUpdate}
              panel={panelOf(step.kind)}
              onPanelChange={panelSetter(step.kind)}
              handlers={handlers}
            />
          )
        : (
            <Fragment key={step.kind}>
              <VisitSummaryStep
                step={step}
                vars={data.vars}
                now={now}
                canUpdate={canUpdate}
                sending={sending}
                textingBlocked={textingBlocked}
                phoneChangedSinceFailure={data.phoneChangedSinceFailure}
                panel={panelOf(step.kind)}
                onPanelChange={panelSetter(step.kind)}
                handlers={handlers}
              />
              <VisitInviteStep invite={data.invite} summary={step} canUpdate={canUpdate} onEditEmail={handlers.onEditEmail} />
            </Fragment>
          ))}
    </ol>
  )
}
```

- [ ] **Step 7: Static checks**

Run: `pnpm eslint --fix src/shared/modules/meetings/messages/components/visit-*.tsx && pnpm tsc && pnpm lint`
Expected: pass.

- [ ] **Step 8: Commit** (only if commit-per-task was chosen) the six files: `feat(visit-messages): sequence rows`.

---

## USER GATE: the owner runs this before Part B

Part B reads and writes through the procedures below. It does not start until each item exists on dev and `pnpm tsc` passes with them.

The input and output types are the ones Tasks 3 and 4 defined:
- `src/shared/modules/meetings/messages/types.ts`
- `src/shared/services/voip/types/conversation.ts`

Copy them exactly. A field the backend cannot fill is a contract change: tell the executor before Part B starts.

**Reads**

1. **`visitMeter: VisitMeter | null`** on:
   - `MeetingListRow` (`listMeetings`, `src/shared/entities/meetings/dal/server/queries.ts`);
   - `CustomerPipelineItem.meetingVisitMeter` (`src/shared/entities/customers/types/pipeline-item.ts` and `pipeline-items.ts`).

   Rules:
   - one batched query per list, built with `deriveVisitMeter(facts)` (Task 4);
   - `null` for project meetings, decided outcomes, past visits and any row that is not eligible (`isVisitMessageEligible`);
   - `visitPageLive` is `false` until plan 4 ships.
2. **`meetingsRouter.messages.forMeeting({ meetingId: uuid }) → VisitSheetData`**, on `visitMessagesProcedure`. It needs a new `meetingsRouter.messages` sub-router. Fill-ins:
   - `steps` come from `planVisitMessages` plus the override, template, actor and Twilio joins;
   - `meter` is `deriveVisitMeter` with times;
   - `vars` comes from `buildVisitMessageVars`;
   - `texting` reports a missing main line, a 30006 landline, or a STOP as the matching `TextingBlockedReason`;
   - `threadMessageCount` counts the main-line thread's texts with this customer.
3. **`voipRouter.conversations.thread(ConversationThreadInput) → ConversationThreadData`**, on `visitMessagesProcedure`, in a new `voipRouter`.
   - `{ meetingId }` resolves to the main-line thread with that meeting's customer. `threadId` is `null` when there are no texts yet.
   - Visibility per line follows spec §5.4: super-admin every line, dispatcher the main line.
4. **`quickMessagesRouter.list() → QuickMessage[]`**, sorted by `sortOrder`.

**Writes** (each on `visitMessagesWriteProcedure`)

5. `meetingsRouter.messages.skip({ meetingId, kind: PausableVisitMessageKind })` and `.unskip(same)`, as spec §7.5 of the 2026-09-29 spec.
6. `meetingsRouter.messages.setOverride({ meetingId, kind: VisitMessageSequenceKind, body })` and `.clearOverride({ meetingId, kind })`. The body is validated with `validateVisitMessageTemplate` for the step's template key.
7. `voipRouter.conversations.send({ threadId, body } | { customerId, body })`. It sends from the thread's line, or the main line for a new thread, with `actorUserId`.
8. `quickMessagesRouter.create(QuickMessageDraft)`, `.update({ id } & QuickMessageDraft)`, `.delete({ id })`, `.reorder({ ids: string[] })` and `.resetDefaults()`, re-seeding from `QUICK_MESSAGE_DEFAULTS` (Task 3). A duplicate command returns a `CONFLICT` whose message is `That command is taken by {name}.`

**Permissions and schema**

9. `VisitMessages` `read` + `update` granted to `dispatcher` (`src/shared/domains/permissions/rules/dispatcher.ts`).
10. The §5.3 tables and columns pushed to dev with `pnpm db:push:dev`: `voip_threads` (with backfill), `quick_messages` (seeded), `visit_message_overrides`, `meetings.homeowner_invite_refused_at` / `_reason`, and `visit_page_opens`.
11. The senders use the override body when one exists, and `handOffVisit` moves overrides.

**Gate check:**
- `pnpm tsc` passes;
- `pnpm tsx --import ./scripts/lib/stub-server-only.mjs scripts/verify-visit-meter.ts` still passes;
- in the browser, `/api/trpc/meetingsRouter.messages.forMeeting?input=…` returns data for a dev meeting.

---

# Part B: wiring (after the USER GATE)

### Task 11: The Conversation tab

**Files:**
- Create:
  - `src/shared/services/voip/hooks/use-conversation-thread.ts`
  - `src/shared/services/voip/hooks/use-send-conversation-text.ts`
  - `src/shared/services/voip/hooks/use-quick-messages.ts`
  - `src/shared/modules/meetings/messages/components/visit-conversation-tab.tsx`

**Interfaces:**
- Consumes: the gate's `voipRouter.conversations.thread` / `.send` and `quickMessagesRouter.*`; `ConversationThread` (Task 6); `ConversationComposer` (Task 7); `QuickMessagesManageSheet` (Task 8); `quickContextFor`, `TEXTING_BLOCKED_COPY`, `COMPOSER_READ_ONLY` (Task 3).
- Produces:
  - `VisitConversationTab({ meetingId, canUpdate, onEditText(kind), onSkip(kind) })`;
  - the hooks `useConversationThread(input | null)`, `useSendConversationText()` and `useQuickMessages()`, which plan 3b reuses.

- [ ] **Step 1: Write `use-conversation-thread.ts`**

```ts
'use client'

import type { ConversationThreadInput } from '@/shared/services/voip/types/conversation'

import { skipToken, useQuery } from '@tanstack/react-query'

import { useTRPC } from '@/trpc/helpers'

/** The open thread, polled every 5 s while the tab is visible (realtime stays in the meeting flow). */
export function useConversationThread(input: ConversationThreadInput | null) {
  const trpc = useTRPC()
  return useQuery(trpc.voipRouter.conversations.thread.queryOptions(input ?? skipToken, { refetchInterval: 5000 }))
}
```

- [ ] **Step 2: Write `use-send-conversation-text.ts`**

```ts
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useInvalidation } from '@/shared/dal/client/hooks/use-invalidation'
import { useTRPC } from '@/trpc/helpers'

export function useSendConversationText() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { invalidateMeeting } = useInvalidation()

  return useMutation(trpc.voipRouter.conversations.send.mutationOptions({
    onError: error => toast.error(error.message),
    onSettled: () => {
      void queryClient.invalidateQueries(trpc.voipRouter.conversations.thread.pathFilter())
      void queryClient.invalidateQueries(trpc.meetingsRouter.messages.forMeeting.pathFilter())
      // An answered reply changes the cards' meter line.
      invalidateMeeting()
    },
  }))
}
```

- [ ] **Step 3: Write `use-quick-messages.ts`**

```ts
'use client'

import type { QuickMessageDraft } from '@/shared/services/voip/types/conversation'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useTRPC } from '@/trpc/helpers'

/** The team's quick messages and their verbs. Each verb rejects on failure, after its toast, so an editor can stay open. */
export function useQuickMessages() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const list = useQuery(trpc.quickMessagesRouter.list.queryOptions())
  const options = {
    onError: (error: { message: string }) => toast.error(error.message),
    onSettled: () => {
      void queryClient.invalidateQueries(trpc.quickMessagesRouter.list.pathFilter())
    },
  }
  const create = useMutation(trpc.quickMessagesRouter.create.mutationOptions(options))
  const update = useMutation(trpc.quickMessagesRouter.update.mutationOptions(options))
  const remove = useMutation(trpc.quickMessagesRouter.delete.mutationOptions(options))
  const reorder = useMutation(trpc.quickMessagesRouter.reorder.mutationOptions(options))
  const reset = useMutation(trpc.quickMessagesRouter.resetDefaults.mutationOptions(options))

  return {
    messages: list.data ?? [],
    create: async (draft: QuickMessageDraft) => {
      await create.mutateAsync(draft)
    },
    update: async (id: string, draft: QuickMessageDraft) => {
      await update.mutateAsync({ id, ...draft })
    },
    remove: async (id: string) => {
      await remove.mutateAsync({ id })
    },
    reorder: async (ids: string[]) => {
      await reorder.mutateAsync({ ids })
    },
    reset: async () => {
      await reset.mutateAsync()
    },
  }
}
```

- [ ] **Step 4: Write `visit-conversation-tab.tsx`**

```tsx
'use client'

import type { PausableVisitMessageKind } from '@/shared/modules/meetings/messages/constants/kinds'

import { useState } from 'react'

import { Skeleton } from '@/shared/components/ui/skeleton'
import { ConversationComposer } from '@/shared/services/voip/components/conversation-composer'
import { ConversationThread } from '@/shared/services/voip/components/conversation-thread'
import { QuickMessagesManageSheet } from '@/shared/services/voip/components/quick-messages-manage-sheet'
import { COMPOSER_READ_ONLY } from '@/shared/services/voip/constants/conversation-copy'
import { TEXTING_BLOCKED_COPY } from '@/shared/services/voip/constants/texting-blocked-copy'
import { useConversationThread } from '@/shared/services/voip/hooks/use-conversation-thread'
import { useQuickMessages } from '@/shared/services/voip/hooks/use-quick-messages'
import { useSendConversationText } from '@/shared/services/voip/hooks/use-send-conversation-text'
import { quickContextFor } from '@/shared/services/voip/lib/quick-messages'

interface VisitConversationTabProps {
  meetingId: string
  canUpdate: boolean
  /** "Edit text" on a coming-up text: the sheet switches to Sequence with that step's editor open. */
  onEditText: (kind: PausableVisitMessageKind) => void
  onSkip: (kind: PausableVisitMessageKind) => void
}

export function VisitConversationTab({ meetingId, canUpdate, onEditText, onSkip }: VisitConversationTabProps) {
  const thread = useConversationThread({ meetingId })
  const quick = useQuickMessages()
  const send = useSendConversationText()
  const [manageOpen, setManageOpen] = useState(false)

  if (thread.isError) {
    return <p className="p-4 text-sm text-destructive-text">{`Couldn't load the texts. ${thread.error.message}`}</p>
  }
  if (!thread.data) {
    return (
      <div aria-busy="true" aria-label="Loading texts" className="flex-1 space-y-3 p-4">
        <Skeleton className="h-16 w-2/3" />
        <Skeleton className="ml-auto h-24 w-3/4" />
      </div>
    )
  }

  const data = thread.data
  const target = data.threadId ? { threadId: data.threadId } : data.customer ? { customerId: data.customer.id } : null
  const disabledReason = !canUpdate
    ? COMPOSER_READ_ONLY
    : !data.texting.ok
        ? TEXTING_BLOCKED_COPY[data.texting.reason]
        : target === null ? TEXTING_BLOCKED_COPY.no_phone : null
  const threadKey = data.threadId ?? `meeting:${meetingId}`

  return (
    <>
      <ConversationThread
        thread={data}
        canUpdate={canUpdate}
        onEditComingUp={item => onEditText(item.kind)}
        onSkipComingUp={item => onSkip(item.kind)}
        className="min-h-0 flex-1"
      />
      <div className="shrink-0 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <ConversationComposer
          key={threadKey}
          threadKey={threadKey}
          firstName={data.customer?.firstName ?? null}
          quickMessages={quick.messages}
          context={quickContextFor(data)}
          disabledReason={disabledReason}
          onSend={async (body) => {
            if (target) {
              await send.mutateAsync({ ...target, body })
            }
          }}
          onManage={() => setManageOpen(true)}
        />
      </div>
      <QuickMessagesManageSheet
        open={manageOpen}
        onOpenChange={setManageOpen}
        messages={quick.messages}
        canUpdate={canUpdate}
        onCreate={quick.create}
        onUpdate={quick.update}
        onDelete={quick.remove}
        onReorder={quick.reorder}
        onReset={quick.reset}
      />
    </>
  )
}
```

- [ ] **Step 5: Static checks**

Run: `pnpm eslint --fix <the four files> && pnpm tsc && pnpm lint`
Expected: pass.

- [ ] **Step 6: Browser check (read-only, after Task 12 hosts the sheet)**

Open a visit sheet whose meeting has texts, switch to Conversation, and check:
- our bubbles are green with white ink; theirs are grey, a rung up, with an edge;
- day separators read `Friday, Oct 9` … `Today`;
- the coming-up texts are dashed at the end;
- typing `/` lists the groups with "Needs a visit" items dimmed;
- a chip fills the box and does not send;
- **Manage…** opens the Quick messages sheet;
- at 390, only the messages scroll and the reply box sits flush above the bottom edge.

Do not press Enter on real text, and do not save in Manage: Task 14 covers those with intercepts.

- [ ] **Step 7: Commit** (only if commit-per-task was chosen) the four files: `feat(voip): conversation hooks and the visit sheet's Conversation tab`.

---

### Task 12: The visit sheet, hosted once by `MeetingActionsHost`

**Files:**
- Modify:
  - `src/shared/components/dialogs/sheets/responsive-sheet.tsx` (add `bodyClassName`)
  - `src/shared/entities/meetings/constants/actions.ts` (add `visitMessages`)
  - `src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx` (`onVisitMessages`, `visitMeter` on the entity)
  - `src/shared/modules/meetings/core/components/meeting-actions-host.tsx` (host the sheet)
- Create:
  - `src/shared/modules/meetings/messages/lib/visit-sheet-optimistic.ts`
  - `src/shared/modules/meetings/messages/hooks/use-visit-message-actions.ts`
  - `src/shared/modules/meetings/messages/components/visit-sheet-skeleton.tsx`
  - `src/shared/modules/meetings/messages/components/visit-sheet-body.tsx`
  - `src/shared/modules/meetings/messages/components/visit-messages-sheet.tsx`
- Test: extend `scripts/verify-visit-meter.ts`

**Interfaces:**
- Consumes: the gate's `forMeeting`, `skip`, `unskip`, `setOverride`, `clearOverride` and `sendVisitSummary`; `VisitMessageSteps` (Task 10); `VisitMeterLegend` (Task 5); `VisitConversationTab` (Task 11).
- Produces:
  - `MEETING_ACTIONS.visitMessages` (`id: 'visitMessages'`);
  - the override `onVisitMessages(entity)`;
  - `VisitMessagesSheet({ meetingId, open, onOpenChange, onOpenMeeting })`;

- [ ] **Step 1: Add the failing optimistic tests**

Append to `scripts/verify-visit-meter.ts`, before the final `console.log`:

```ts
// Optimistic skip and undo
const sheet = {
  meetingId: 'm1',
  customerId: 'c1',
  customerName: 'Maria Lopez',
  scheduledFor: '2026-10-13T17:00:00.000Z',
  meter: meter({ texted: 'delivered', nextReminder: { at: MON_6PM } }),
  steps: [step({}), reminder({})],
  invite: { invitedAt: null, refusedAt: null },
  vars: { firstName: 'Maria', specialistName: null, coordinatorName: null, visitDate: 'Tue, Oct 13', visitTime: '10:00 AM', arrivalWindow: '10:00 and 10:30 AM', visitLink: 'https://x', visitNote: '' },
  phoneChangedSinceFailure: false,
  texting: { ok: true as const },
  threadMessageCount: 1,
}
const skippedSheet = applySkip(sheet, 'day_before_reminder', now)
assert.equal(skippedSheet.steps[1].state, 'skipped')
assert.equal(skippedSheet.steps[1].row?.reason, 'manual')
assert.equal(skippedSheet.meter.nextReminder, 'skipped')
assert.equal(describeVisitStep(skippedSheet.steps[1], now).status, 'Skipped by you')
assert.equal(skippedSheet.steps[0], sheet.steps[0])
const undone = applyUnskip(skippedSheet, 'day_before_reminder')
assert.equal(undone.steps[1].state, 'scheduled')
assert.equal(undone.steps[1].row, null)
assert.deepEqual(undone.meter.nextReminder, { at: MON_6PM })
```

and add the import:

```ts
import { applySkip, applyUnskip } from '@/shared/modules/meetings/messages/lib/visit-sheet-optimistic'
```

Run: `pnpm tsx --import ./scripts/lib/stub-server-only.mjs scripts/verify-visit-meter.ts`
Expected: FAIL ("Cannot find module").

- [ ] **Step 2: Write `visit-sheet-optimistic.ts`**

```ts
import type { PausableVisitMessageKind } from '@/shared/modules/meetings/messages/constants/kinds'
import type { VisitSheetData, VisitSheetStep } from '@/shared/modules/meetings/messages/types'

/** The sheet as it will read once a skip lands, so the row changes on click. The settle refetch replaces it. */
export function applySkip(data: VisitSheetData, kind: PausableVisitMessageKind, now: Date): VisitSheetData {
  const at = now.toISOString()
  return {
    ...data,
    meter: kind === 'day_before_reminder' ? { ...data.meter, nextReminder: 'skipped' } : data.meter,
    steps: data.steps.map((step): VisitSheetStep => step.kind !== kind
      ? step
      : {
          ...step,
          state: 'skipped',
          reason: 'manual',
          skipReason: null,
          row: { kind, channel: 'sms', status: 'skipped', reason: 'manual', forScheduledFor: data.scheduledFor, createdAt: at },
          skippedBy: { firstName: 'you', at },
        }),
  }
}

export function applyUnskip(data: VisitSheetData, kind: PausableVisitMessageKind): VisitSheetData {
  const step = data.steps.find(candidate => candidate.kind === kind)
  return {
    ...data,
    meter: kind === 'day_before_reminder' ? { ...data.meter, nextReminder: step?.plannedFor ? { at: step.plannedFor } : null } : data.meter,
    steps: data.steps.map((candidate): VisitSheetStep => candidate.kind !== kind
      ? candidate
      : { ...candidate, state: 'scheduled', reason: null, row: null, skippedBy: null }),
  }
}
```

Run the test again. Expected: `✅ visit meter, steps and editor check verified`.

- [ ] **Step 3: Add `bodyClassName` to `ResponsiveSheet`**

In `responsive-sheet.tsx`:
- Add to `ResponsiveSheetProps`, after `drawerClassName`:

```ts
  /** Classes for the body, for content that lays out and scrolls itself (tabs with their own scroller). */
  bodyClassName?: string
```
- Add `bodyClassName,` to the destructured props.
- The Drawer body becomes:

```tsx
          <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-gutter-stable px-4', footer === undefined ? 'pb-[max(1rem,env(safe-area-inset-bottom))]' : 'pb-4', bodyClassName)}>{children}</div>
```
- The Sheet body becomes:

```tsx
        <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-gutter-stable px-4 pb-4', bodyClassName)}>{children}</div>
```

- [ ] **Step 4: Add the action**

In `src/shared/entities/meetings/constants/actions.ts`:
- add `MessageSquareTextIcon` to the lucide import;
- after the `notes` entry add:

```ts
  visitMessages: {
    id: 'visitMessages',
    label: 'Visit messages',
    icon: MessageSquareTextIcon,
    permission: ['read', 'VisitMessages'],
  },
```

In `src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx`:
- add `import type { VisitMeter } from '@/shared/modules/meetings/messages/types'`.
- In `interface MeetingEntity` add:

```ts
  /** Present on rows that load the meter; the Visit messages action hides on the rest. */
  visitMeter?: VisitMeter | null
```
- In `MeetingActionOverrides<T>` add, after `onEditNotes?`:

```ts
  onVisitMessages?: (entity: T) => void
```
- In `configs`, directly after the `onEditNotes` spread line, add:

```ts
    ...(overrides.onVisitMessages
      ? [{ action: MEETING_ACTIONS.visitMessages, onAction: overrides.onVisitMessages, hidden: (entity: T) => !entity.visitMeter }]
      : []),
```

- [ ] **Step 5: Write `use-visit-message-actions.ts`**

```ts
'use client'

import type { PausableVisitMessageKind, VisitMessageSequenceKind } from '@/shared/modules/meetings/messages/constants/kinds'
import type { VisitSheetData, VisitStepHandlers } from '@/shared/modules/meetings/messages/types'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useInvalidation } from '@/shared/dal/client/hooks/use-invalidation'
import { useConfirm } from '@/shared/hooks/use-confirm'
import { VISIT_RESEND_CONFIRM } from '@/shared/modules/meetings/messages/constants/visit-step-copy'
import { applySkip, applyUnskip } from '@/shared/modules/meetings/messages/lib/visit-sheet-optimistic'
import { useTRPC } from '@/trpc/helpers'

/** The visit sheet's verbs. Skip and Undo change the cached sheet at once; the rest settle by refetching. */
export function useVisitMessageActions(meetingId: string) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { invalidateMeeting } = useInvalidation()
  const sheetKey = trpc.meetingsRouter.messages.forMeeting.queryKey({ meetingId })
  const [ResendConfirmDialog, confirmResend] = useConfirm(VISIT_RESEND_CONFIRM)

  function settle() {
    void queryClient.invalidateQueries({ queryKey: sheetKey })
    invalidateMeeting({ meetingId })
  }

  async function optimistic(update: (data: VisitSheetData) => VisitSheetData) {
    await queryClient.cancelQueries({ queryKey: sheetKey })
    const previous = queryClient.getQueryData(sheetKey)
    if (previous) {
      queryClient.setQueryData(sheetKey, update(previous))
    }
    return { previous }
  }

  function rollback(context: { previous: VisitSheetData | undefined } | undefined) {
    if (context?.previous) {
      queryClient.setQueryData(sheetKey, context.previous)
    }
  }

  const sendSummary = useMutation(trpc.meetingsRouter.business.sendVisitSummary.mutationOptions({
    onSuccess: () => toast.success('Visit summary sent'),
    onError: error => toast.error(error.message),
    onSettled: settle,
  }))
  const skip = useMutation(trpc.meetingsRouter.messages.skip.mutationOptions({
    onMutate: ({ kind }) => optimistic(data => applySkip(data, kind, new Date())),
    onError: (error, _input, context) => {
      rollback(context)
      toast.error(error.message)
    },
    onSettled: settle,
  }))
  const unskip = useMutation(trpc.meetingsRouter.messages.unskip.mutationOptions({
    onMutate: ({ kind }) => optimistic(data => applyUnskip(data, kind)),
    onError: (error, _input, context) => {
      rollback(context)
      toast.error(error.message)
    },
    onSettled: settle,
  }))
  const setOverride = useMutation(trpc.meetingsRouter.messages.setOverride.mutationOptions({
    onSuccess: () => toast.success('Saved for this visit'),
    onError: error => toast.error(error.message),
    onSettled: settle,
  }))
  const clearOverride = useMutation(trpc.meetingsRouter.messages.clearOverride.mutationOptions({
    onSuccess: () => toast.success('Back to the default text'),
    onError: error => toast.error(error.message),
    onSettled: settle,
  }))

  const handlers: Omit<VisitStepHandlers, 'onEditPhone' | 'onEditEmail'> = {
    onSend: async (mode) => {
      if (mode === 'resend' && !(await confirmResend())) {
        return
      }
      sendSummary.mutate({ meetingId })
    },
    onSkip: (kind: PausableVisitMessageKind) => skip.mutate({ meetingId, kind }),
    onUndo: (kind: PausableVisitMessageKind) => unskip.mutate({ meetingId, kind }),
    onSaveText: async (kind: VisitMessageSequenceKind, body: string) => {
      await setOverride.mutateAsync({ meetingId, kind, body })
    },
    onResetText: async (kind: VisitMessageSequenceKind) => {
      await clearOverride.mutateAsync({ meetingId, kind })
    },
  }

  return { handlers, sending: sendSummary.isPending, ResendConfirmDialog }
}
```

- [ ] **Step 6: Write `visit-sheet-skeleton.tsx`**

```tsx
import { Skeleton } from '@/shared/components/ui/skeleton'

export function VisitSheetSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading visit texts" className="space-y-2 px-4 pb-4">
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-9 w-48" />
      {[0, 1, 2, 3].map(row => <Skeleton key={row} className="h-20 w-full rounded-lg" />)}
    </div>
  )
}
```

- [ ] **Step 7: Write `visit-sheet-body.tsx`**

```tsx
'use client'

import type { VisitMessageSequenceKind } from '@/shared/modules/meetings/messages/constants/kinds'
import type { VisitSheetData, VisitSheetTab } from '@/shared/modules/meetings/messages/types'

import { useState } from 'react'

import { Button } from '@/shared/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { toneClasses } from '@/shared/constants/status-tones'
import { useAbility } from '@/shared/domains/permissions/client'
import { CustomerProfileModal } from '@/shared/entities/customers/components/profile/customer-profile-modal'
import { openModal } from '@/shared/lib/open-modal'
import { cn } from '@/shared/lib/utils'
import { VisitConversationTab } from '@/shared/modules/meetings/messages/components/visit-conversation-tab'
import { VisitMessageSteps } from '@/shared/modules/meetings/messages/components/visit-message-steps'
import { VisitMeterLegend } from '@/shared/modules/meetings/messages/components/visit-meter-legend'
import { useVisitMessageActions } from '@/shared/modules/meetings/messages/hooks/use-visit-message-actions'
import { decideDefaultTab } from '@/shared/modules/meetings/messages/lib/decide-default-tab'

interface VisitSheetBodyProps {
  /** The first data the sheet loaded. The tab is chosen from it once; polls update the rows, never the tab. */
  data: VisitSheetData
  onOpenMeeting: () => void
}

export function VisitSheetBody({ data, onOpenMeeting }: VisitSheetBodyProps) {
  const ability = useAbility()
  const canUpdate = ability.can('update', 'VisitMessages')
  // A useState initializer reads the meter once; a reply arriving while the sheet is open must not move the reader.
  const [tab, setTab] = useState<VisitSheetTab>(() => decideDefaultTab(data.meter))
  const [editKind, setEditKind] = useState<VisitMessageSequenceKind | null>(null)
  const { handlers, sending, ResendConfirmDialog } = useVisitMessageActions(data.meetingId)

  function openProfile() {
    if (data.customerId) {
      openModal({ accessor: 'CustomerProfile', Component: CustomerProfileModal, props: { customerId: data.customerId, defaultTab: 'overview' as const } })
    }
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        setTab(value as VisitSheetTab)
        setEditKind(null)
      }}
      className="min-h-0 flex-1 gap-0"
    >
      <ResendConfirmDialog />
      <div className="space-y-3 px-4">
        <div className="flex items-start gap-3">
          <VisitMeterLegend meter={data.meter} className="flex-1" />
          <Button type="button" size="sm" variant="outline" onClick={onOpenMeeting}>Open meeting</Button>
        </div>
        <TabsList variant="underline">
          <TabsTrigger value="sequence">Sequence</TabsTrigger>
          <TabsTrigger value="conversation">
            {`Conversation (${data.threadMessageCount})`}
            {data.meter.waitingReply && (
              <>
                <span aria-hidden className={cn('size-2 rounded-full', toneClasses('action').dot)} />
                <span className="sr-only">, a reply is waiting</span>
              </>
            )}
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="sequence" className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-gutter-stable px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <VisitMessageSteps
          data={data}
          canUpdate={canUpdate}
          sending={sending}
          initialEdit={editKind}
          handlers={{ ...handlers, onEditPhone: openProfile, onEditEmail: openProfile }}
        />
      </TabsContent>
      <TabsContent value="conversation" className="flex min-h-0 flex-1 flex-col">
        <VisitConversationTab
          meetingId={data.meetingId}
          canUpdate={canUpdate}
          onEditText={(kind) => {
            setEditKind(kind)
            setTab('sequence')
          }}
          onSkip={handlers.onSkip}
        />
      </TabsContent>
    </Tabs>
  )
}
```

`data` is a prop that keeps updating with each poll; only the tab's initial value is frozen.

- [ ] **Step 8: Write `visit-messages-sheet.tsx`**

```tsx
'use client'

import { skipToken, useQuery } from '@tanstack/react-query'

import { ResponsiveSheet } from '@/shared/components/dialogs/sheets/responsive-sheet'
import { formatBusinessClock, formatBusinessDay } from '@/shared/lib/business-time'
import { VisitSheetBody } from '@/shared/modules/meetings/messages/components/visit-sheet-body'
import { VisitSheetSkeleton } from '@/shared/modules/meetings/messages/components/visit-sheet-skeleton'
import { useTRPC } from '@/trpc/helpers'

interface VisitMessagesSheetProps {
  /** Kept while the sheet closes, so its exit plays with the content still in it. */
  meetingId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The host's View action for this meeting. */
  onOpenMeeting: (meeting: { id: string, customerId: string | null }) => void
}

export function VisitMessagesSheet({ meetingId, open, onOpenChange, onOpenMeeting }: VisitMessagesSheetProps) {
  const trpc = useTRPC()
  const sheet = useQuery(trpc.meetingsRouter.messages.forMeeting.queryOptions(
    open && meetingId ? { meetingId } : skipToken,
    { refetchInterval: 5000 },
  ))
  const data = sheet.data

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={data?.customerName ?? 'Visit messages'}
      description={data ? `${formatBusinessDay(data.scheduledFor)} · ${formatBusinessClock(data.scheduledFor)}` : undefined}
      sheetClassName="sm:max-w-lg"
      drawerClassName="h-[92svh]"
      bodyClassName="flex flex-col overflow-hidden px-0 pb-0"
    >
      {data
        ? (
            <VisitSheetBody
              key={data.meetingId}
              data={data}
              onOpenMeeting={() => {
                onOpenChange(false)
                onOpenMeeting({ id: data.meetingId, customerId: data.customerId })
              }}
            />
          )
        : sheet.isError
          ? <p className="px-4 text-sm text-destructive-text">{`Couldn't load the visit texts. ${sheet.error.message}`}</p>
          : <VisitSheetSkeleton />}
    </ResponsiveSheet>
  )
}
```

- [ ] **Step 9: Host the sheet**

In `src/shared/modules/meetings/core/components/meeting-actions-host.tsx`:
- add imports:

```ts
import { isClickAction } from '@/shared/components/entities/entity-actions/types'
import { MEETING_ACTIONS } from '@/shared/entities/meetings/constants/actions'
import { VisitMessagesSheet } from '@/shared/modules/meetings/messages/components/visit-messages-sheet'
```
- after the `notesMeetingId` state add:

```ts
  const [visitMessages, setVisitMessages] = useState<{ meetingId: string, open: boolean } | null>(null)
```
- in the `useMeetingActionConfigs({ … })` call, after `onEditNotes: …,` add:

```ts
    onVisitMessages: entity => setVisitMessages({ meetingId: entity.id, open: true }),
```
- after the `{notesMeetingId && ( … )}` block add:

```tsx
      <VisitMessagesSheet
        meetingId={visitMessages?.meetingId ?? null}
        open={visitMessages?.open ?? false}
        onOpenChange={open => setVisitMessages(current => current && { ...current, open })}
        onOpenMeeting={(meeting) => {
          const view = actions.find(config => config.action.id === MEETING_ACTIONS.view.id)
          if (view && isClickAction(view)) {
            view.onAction(meeting)
          }
        }}
      />
```

- [ ] **Step 10: Static checks and the unit tests**

Run:
```bash
pnpm eslint --fix <every file in Files> && pnpm tsc && pnpm lint
pnpm tsx --import ./scripts/lib/stub-server-only.mjs scripts/verify-visit-meter.ts
```
Expected: pass.

- [ ] **Step 11: Browser check, desktop and phone**

Open `/dashboard/meetings`, open a meeting's ⋯ menu, and pick **Visit messages** (Task 13 adds the meter click).
- The sheet opens from the right at 1440 and as a bottom drawer at 390.
- The legend sits above the underline tabs, and the rows climb a rung inside the sheet.
- Open meeting closes the sheet and runs the page's View.
- Do not click Send, Skip, Undo or Save: they write. Task 14 checks those with intercepted requests.

- [ ] **Step 12: Commit** (only if commit-per-task was chosen) every file in **Files**: `feat(visit-messages): visit sheet hosted by the meeting actions host`.

---

### Task 13: The card part and its three placements

**Files:**
- Modify: `src/shared/entities/meetings/components/overview-card.tsx` (data field, the `VisitMeter` part, the compound export)
- Modify: `src/features/schedule-management/types/index.ts`, `src/features/meeting-flow/lib/to-calendar-event.ts`
- Modify: `src/features/schedule-management/ui/components/meeting-card.tsx`, `src/features/customer-pipelines/ui/components/customer-kanban-card.tsx`, `src/features/agent-dashboard/ui/components/dashboard-meeting-card.tsx`

**Interfaces:**
- Consumes: `MEETING_ACTIONS.visitMessages` and the host's `onVisitMessages` (Task 12); `VisitMeter` (Task 5); `meterAriaLabel`; the gate's `visitMeter` / `meetingVisitMeter` fields.
- Produces:
  - `MeetingOverviewCard.VisitMeter({ variant?: 'line' | 'strips', className? })`, which renders nothing without `meeting.visitMeter` or without `read VisitMessages`;
  - `ScheduleMeetingEvent.visitMeter: VisitMeter | null`.

- [ ] **Step 1: The data field and the part**

In `overview-card.tsx`:
- add imports:

```ts
import type { VisitMeter as VisitMeterData } from '@/shared/modules/meetings/messages/types'
```
```ts
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip'
import { VisitMeter } from '@/shared/modules/meetings/messages/components/visit-meter'
import { meterAriaLabel } from '@/shared/modules/meetings/messages/lib/visit-meter-copy'
```
- in `MeetingOverviewCardData`'s object type, after `proposals?: MeetingOverviewCardProposal[]` add:

```ts
      /** Null or absent where no meter applies (project meetings, decided or past visits, lists that do not load it). */
      visitMeter?: VisitMeterData | null
```
- add this part above `// ── Compound export`:

```tsx
// ── VisitMeter sub-component ───────────────────────────────────────────────────
// Its click is the Visit messages action, so it opens the visit sheet and never the card's own View.

function VisitMeterPart({ variant = 'line', className }: { variant?: 'line' | 'strips', className?: string }) {
  const { meeting, actions } = useMeetingOverviewCard()
  const ability = useAbility()
  if (!meeting.visitMeter || ability.cannot(...MEETING_ACTIONS.visitMessages.permission)) {
    return null
  }
  const label = meterAriaLabel(meeting.visitMeter)
  const button = (
    <button
      type="button"
      aria-label={`Visit messages. ${label}`}
      className={cn('flex w-full min-w-0 cursor-pointer items-center rounded-sm text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50', className)}
      onClick={(event) => {
        event.stopPropagation()
        const config = actions.find(candidate => candidate.action.id === MEETING_ACTIONS.visitMessages.id)
        if (config && isClickAction(config)) {
          config.onAction(meeting)
        }
      }}
    >
      <VisitMeter meter={meeting.visitMeter} variant={variant} className="w-full" />
    </button>
  )
  if (variant === 'line') {
    return button
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
```
- in `Object.assign(MeetingOverviewCardRoot, { … })` add `VisitMeter: VisitMeterPart,` after `Actions,`.

If `ability.cannot(...permission)` does not type-check, use `!ability.can(...MEETING_ACTIONS.visitMessages.permission)`, the form `use-meeting-action-configs.tsx` already uses.

- [ ] **Step 2: The schedule mapping**

In `src/features/schedule-management/types/index.ts`:
- add `import type { VisitMeter } from '@/shared/modules/meetings/messages/types'`;
- inside `ScheduleMeetingEvent`, after `createdAt: string`, add:

```ts
  visitMeter: VisitMeter | null
```

In `src/features/meeting-flow/lib/to-calendar-event.ts`, after `createdAt: meeting.createdAt,` add:

```ts
    visitMeter: meeting.visitMeter,
```

Run `pnpm tsc`. Any other builder of a `ScheduleMeetingEvent` object literal now fails. Add `visitMeter` from that builder's row, or `null` where the row has none.

- [ ] **Step 3: Place the strips on the schedule card**

In `src/features/schedule-management/ui/components/meeting-card.tsx`:
- in `meetingData`, after `customerZip: event.customerZip,` add `visitMeter: event.visitMeter,`;
- directly after the Row 2 `<MeetingOverviewCard.Fields … />` element add:

```tsx
      <MeetingOverviewCard.VisitMeter variant="strips" />
```

- [ ] **Step 4: Place the line on the kanban meeting sub-card**

In `src/features/customer-pipelines/ui/components/customer-kanban-card.tsx`:
- in the fresh-pipeline `MeetingOverviewCard` `meeting={{ … }}` object, after `proposals: item.proposals as MeetingOverviewCardProposal[],` add:

```ts
                visitMeter: item.meetingVisitMeter,
```
- directly after the meeting time badge's closing `: null}`, before `{/* Individual proposal rows */}`, add:

```tsx
              <MeetingOverviewCard.VisitMeter />
```

- [ ] **Step 5: Place the line on the dashboard card**

In `src/features/agent-dashboard/ui/components/dashboard-meeting-card.tsx`, directly before the closing `</MeetingOverviewCard>`, add:

```tsx
      <MeetingOverviewCard.VisitMeter className="mt-1.5" />
```
`row` is a `MeetingListRow`, which carries `visitMeter` after the gate.

- [ ] **Step 6: Static checks**

Run: `pnpm eslint --fix <every file in Files> && pnpm tsc && pnpm lint && pnpm theme:check`
Expected: pass.

- [ ] **Step 7: Browser check**

Run the verification recipe at 1440 and 390, light and dark.
- **Schedule:** a card shows three strips filling its width, with no words, and the hover tooltip spells out the signals.
- **Pipeline (Fresh):** the meeting sub-card shows the strips plus one status line.
- **Dashboard:** the agenda card shows the line.
- **Click:** clicking the strips opens the visit sheet, and the customer profile does not open.
- Screenshot each surface to `.playwright-mcp/` for the owner's eye check.

- [ ] **Step 8: Commit** (only if commit-per-task was chosen) every file in **Files**: `feat(meetings): visit meter on schedule, pipeline and dashboard cards`.

---

### Task 14: Read-only Playwright probe and audits

**Files:**
- Create: `scripts/verify-visit-messages-ui.mjs`

**Interfaces:**
- Consumes: everything above, on the running dev server, with dev data that has upcoming meetings carrying a `visitMeter`.

- [ ] **Step 1: Write the probe**

```js
// Read-only UI probe for the visit meter and the visit sheet, against the running dev server.
// It never writes: every mutation it triggers is intercepted and aborted before it leaves the browser.
import process from 'node:process'
import { chromium } from 'playwright'

process.loadEnvFile('.env.local')
const secret = process.env.DEV_LOGIN_SECRET
if (!secret) {
  console.error('DEV_LOGIN_SECRET is missing from .env.local')
  process.exit(1)
}
const BASE = `http://localhost:${process.env.PORT ?? 3000}`
const OUT = '.playwright-mcp'
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 820, height: 1180 },
  { width: 390, height: 844 },
]
const INTERACTIVE = new Set([1440, 390])
const failures = []

// Playwright's errors quote the URL, which carries the secret.
const redact = text => String(text).replaceAll(encodeURIComponent(secret), '***').replaceAll(secret, '***')

function check(ok, label) {
  console.log(`${ok ? '✅' : '❌'} ${label}`)
  if (!ok) {
    failures.push(label)
  }
}

async function signIn(page, redirect) {
  try {
    await page.goto(`${BASE}/api/dev/playwright-session?secret=${encodeURIComponent(secret)}&redirect=${encodeURIComponent(redirect)}`, { timeout: 180000 })
  }
  catch (error) {
    throw new Error(redact(error.message))
  }
}

// Any write the probe could trigger is aborted; the count proves how many left the client.
async function blockWrites(page) {
  const writes = { send: 0, other: 0 }
  await page.route(/\/api\/trpc\/.*(voipRouter\.conversations\.send|meetingsRouter\.messages\.(skip|unskip|setOverride|clearOverride)|meetingsRouter\.business\.sendVisitSummary|quickMessagesRouter\.(create|update|delete|reorder|resetDefaults))/, async (route) => {
    if (route.request().url().includes('voipRouter.conversations.send')) {
      writes.send++
    }
    else {
      writes.other++
    }
    await new Promise(resolve => setTimeout(resolve, 800))
    await route.abort()
  })
  return writes
}

const browser = await chromium.launch()

for (const scheme of ['light', 'dark']) {
  for (const viewport of VIEWPORTS) {
    const tag = `${scheme}-${viewport.width}`
    const context = await browser.newContext({ viewport, colorScheme: scheme })
    await context.addInitScript(value => localStorage.setItem('theme', value), scheme)
    const page = await context.newPage()
    const writes = await blockWrites(page)

    // 1. Schedule: strips only, with the spoken label.
    await signIn(page, '/dashboard/schedule')
    const strips = page.locator('button[aria-label^="Visit messages."]').first()
    if (await strips.count() === 0) {
      console.log(`⚠️  ${tag}: no schedule card with a meter this week; skipping the schedule checks`)
    }
    else {
      const label = await strips.getAttribute('aria-label')
      check(/\d of 3 signals: Texted .+, Opened page .+, Confirmed .+/.test(label ?? ''), `${tag} schedule meter aria-label names the three signals`)
      check((await strips.innerText()).trim() === '', `${tag} schedule meter shows strips only`)
    }

    // 2. Pipeline: the line variant; equal heights across states.
    await page.goto(`${BASE}/dashboard/pipeline/fresh`)
    const lines = page.locator('button[aria-label^="Visit messages."]')
    await lines.first().waitFor({ timeout: 20000 }).catch(() => {})
    const count = await lines.count()
    if (count === 0) {
      console.log(`⚠️  ${tag}: no pipeline card with a meter; skipping the sheet checks`)
      await context.close()
      continue
    }
    const heights = new Set(await lines.evaluateAll(nodes => nodes.map(node => Math.round(node.getBoundingClientRect().height))))
    check(heights.size === 1, `${tag} pipeline meter rows are one height (${[...heights].join(', ')})`)
    const line = lines.first()
    const statusText = (await line.innerText()).trim()
    check(statusText.length > 0, `${tag} pipeline meter shows a status line`)

    // 3. The sheet: a click opens it and nothing else; the tab follows the reply state.
    await line.click()
    const dialog = page.getByRole('dialog')
    await dialog.first().waitFor()
    check(await dialog.count() === 1, `${tag} meter click opens one dialog (the visit sheet only)`)
    const expected = statusText.startsWith('Replied:') ? 'Conversation' : 'Sequence'
    const selected = page.getByRole('tab', { selected: true })
    check((await selected.innerText()).startsWith(expected), `${tag} sheet opens on ${expected}`)
    await page.screenshot({ path: `${OUT}/visit-sheet-${tag}-open.png` })

    if (INTERACTIVE.has(viewport.width) && expected === 'Sequence') {
      // Review Focus: a reply arriving on a poll must not flip the tab.
      await page.route(/meetingsRouter\.messages\.forMeeting/, async (route) => {
        const response = await route.fetch()
        const body = (await response.text()).replace('"waitingReply":null', '"waitingReply":{"text":"Can we do Thursday?","at":"2026-10-13T17:00:00.000Z"}')
        await route.fulfill({ response, body })
      })
      await page.waitForTimeout(6500)
      check((await page.getByRole('tab', { selected: true }).innerText()).startsWith('Sequence'), `${tag} a reply arriving mid-view leaves the tab on Sequence`)
      check(await page.getByText('Replied, no YES').count() > 0, `${tag} the poll did reach the sheet (legend shows the reply)`)
      await page.unroute(/meetingsRouter\.messages\.forMeeting/)

      // The sheet does not remount on Skip: mark the node, click Skip (aborted), check the mark survives.
      const list = page.locator('ol[aria-label="Visit texts"]')
      await list.evaluate((node) => {
        node.dataset.probe = 'kept'
      })
      const skip = page.getByRole('button', { name: 'Skip', exact: true }).first()
      if (await skip.count() > 0) {
        await skip.click()
        await page.waitForTimeout(1500)
        check(await page.locator('ol[aria-label="Visit texts"][data-probe="kept"]').count() === 1, `${tag} Skip updates rows without remounting the sheet`)
      }

      // The editor blocks Save without the required fields and counts an emoji's segments.
      const edit = page.getByRole('button', { name: 'Edit text' }).first()
      if (await edit.count() > 0) {
        await edit.click()
        const textarea = page.getByRole('textbox').last()
        await textarea.fill('Hi [First name] 👋')
        check(await page.getByRole('button', { name: 'Save for this visit' }).isDisabled(), `${tag} Save stays disabled without the required fields`)
        check(await page.getByText(/^Keep \[/).count() > 0, `${tag} the editor names the fields to keep`)
        check(await page.getByText(/each text hold 70 characters/).count() > 0, `${tag} an emoji switches the counter to 70-character texts`)
        await page.getByRole('button', { name: 'Cancel' }).click()
      }
    }

    // 4. Conversation: log role, no sideways scroll, slash menu, single send.
    await page.getByRole('tab', { name: /^Conversation/ }).click()
    const log = page.getByRole('log')
    await log.waitFor({ timeout: 20000 })
    const viewportNode = page.locator('[data-slot="message-scroller-viewport"]')
    const overflow = await viewportNode.evaluate(node => node.scrollWidth - node.clientWidth)
    check(overflow <= 1, `${tag} the thread has no sideways scroll (${overflow}px)`)
    await page.screenshot({ path: `${OUT}/visit-sheet-${tag}-conversation.png` })

    const reply = page.getByRole('textbox', { name: 'Reply' })
    if (INTERACTIVE.has(viewport.width) && await reply.isEnabled()) {
      await reply.fill('/')
      check(await page.getByRole('listbox').count() > 0, `${tag} / opens the quick-message menu`)
      await page.keyboard.press('Escape')
      check(await page.getByRole('dialog').count() === 1, `${tag} Escape closes the menu and keeps the sheet`)
      await reply.fill('probe text, never sent')
      await reply.press('Enter')
      await reply.press('Enter')
      await page.waitForTimeout(2000)
      check(writes.send === 1, `${tag} a double Enter sends once (${writes.send} request, aborted)`)
      check(await reply.inputValue() === 'probe text, never sent', `${tag} a failed send keeps the draft`)
      await reply.fill('')

      if (viewport.width === 390) {
        const gap = await page.evaluate(() => {
          const box = document.querySelector('[data-slot="input-group"]')?.closest('.rounded-xl')
          const sheet = box?.closest('[role="dialog"]')
          if (!box || !sheet) {
            return null
          }
          return Math.round(sheet.getBoundingClientRect().bottom - box.getBoundingClientRect().bottom)
        })
        check(gap !== null && gap <= 40, `${tag} the reply box sits at the bottom of the drawer (${gap}px incl. safe area)`)
        const pageScrolled = await page.evaluate(() => document.scrollingElement.scrollTop)
        await log.hover()
        await page.mouse.wheel(0, -600)
        check(await page.evaluate(() => document.scrollingElement.scrollTop) === pageScrolled, `${tag} scrolling the thread does not scroll the page`)
      }
    }

    // 5. Elevation: the sheet differs from the page, rows differ from the sheet, each has an edge.
    await page.getByRole('tab', { name: 'Sequence' }).click()
    const surfaces = await page.evaluate(() => {
      const sheet = document.querySelector('[role="dialog"]')
      const row = document.querySelector('ol[aria-label="Visit texts"] > li')
      const style = node => node && getComputedStyle(node)
      return {
        page: getComputedStyle(document.body).backgroundColor,
        sheet: style(sheet)?.backgroundColor,
        row: style(row)?.backgroundColor,
        rowEdge: style(row)?.borderTopWidth,
      }
    })
    check(surfaces.sheet !== surfaces.page, `${tag} the sheet sits off the page (${surfaces.sheet} vs ${surfaces.page})`)
    check(surfaces.row !== surfaces.sheet, `${tag} a step row climbs a rung inside the sheet (${surfaces.row} vs ${surfaces.sheet})`)
    check(surfaces.rowEdge !== '0px', `${tag} a step row has an edge`)
    await page.screenshot({ path: `${OUT}/visit-sheet-${tag}-sequence.png` })

    check(writes.other <= 1, `${tag} no write left the browser except the aborted Skip`)
    await context.close()
  }
}

await browser.close()
if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`)
  process.exit(1)
}
console.log('\n✅ visit messages UI verified')
```

- [ ] **Step 2: Run it against the dev server**

Run: `node scripts/verify-visit-messages-ui.mjs`
Expected: `✅ visit messages UI verified`.

A `⚠️` line means the dev data has no card for that check; report it rather than seeding data. Fix the code for each `❌`, never the check, unless the check reads the DOM wrong (then fix the selector and say so in the report).

- [ ] **Step 3: Audits**

1. `pnpm tsc && pnpm lint && pnpm theme:check`, plus both verify scripts. Everything passes.
2. Review the `.playwright-mcp/visit-sheet-*` screenshots in both schemes and at every viewport:
   - each surface reads as its own rung (sheet, rows, editor, reply area);
   - nothing is flat;
   - nothing overflows at 390.

   This feeds the owner's eye check; it does not replace it.
3. Keyboard, at 1440, with no mouse:
   - Tab reaches the meter button, and Enter opens the sheet;
   - the arrow keys move between the tabs;
   - in the reply box, `/` then arrow keys then Enter fills a quick message;
   - Escape closes the menu, then the sheet, and focus returns to the meter button.
4. Reduced motion: emulate `prefers-reduced-motion: reduce` and open the sheet. The primitives' motion respects it, and nothing this plan added animates.
5. Report every `⚠️` from the probe as a data gap for the owner's hands-on check (spec §7).

- [ ] **Step 4: Commit** (only if commit-per-task was chosen) `scripts/verify-visit-messages-ui.mjs`: `test(visit-messages): read-only UI probe for the meter and the visit sheet`.

---

## Hands-on (owner)

On a phone and a laptop: one booking call (send the summary and walk through the link), one day-before scan (the schedule strips, then the sheet), and one reply (answer with a chip, then with `/`). Then Manage: add, edit, reorder and reset quick messages, and check that a second browser sees each change after a reload (team-wide; the probe never writes, so this is the only check of it). Then plan 3b.
