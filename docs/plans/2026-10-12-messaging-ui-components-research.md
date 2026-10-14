# Messaging UI components: research (SMS threads + inbox)

Researched 2026-10-12, read-only. Question: which shadcn-registry library gives us a good-looking, working SMS thread (surface 1: per-visit side sheet) and a conversations inbox (surface 2: list + open thread), themed by our own tokens.

## 1. Recommendation

**Use shadcn/ui's own chat primitives** (released 2026-06-26): `message`, `bubble`, `marker`, `message-scroller`, and later `attachment` for MMS. They are official registry items in the same registry and style we already use (`new-york`). They theme only through our tokens (`--primary`, `--secondary`, `--muted`, `--border`, `--background`, `--destructive`, `--card`) and have no AI-SDK coupling. They are not chat-bot shaped either: a message is just `align="start" | "end"` with a header, a bubble and a footer, which is what an SMS thread needs.

- **Surface 1 (sheet thread).** Our `Sheet` contains `MessageScroller`, which holds one `Message` per text:
  - `MessageHeader` carries the label ("Visit summary", "Automatic reply", the staff name).
  - `Bubble` uses `default` (brand) for staff-typed texts, `tinted` or `outline` for automated ones, `secondary` or `muted` for the homeowner, and `destructive` for failed sends.
  - `MessageFooter` carries the time and delivery status. We write that ourselves with lucide icons.
  - `Marker variant="separator"` gives the day separators.
  - The composer is our existing `InputGroup` + `Textarea` + send `Button`.
- **Surface 2 (inbox).** No maintained, free shadcn inbox block exists. Build it from primitives we already have, using the legacy shadcn Mail example's layout:
  - `ResizablePanelGroup` (list | thread) on desktop, one column on phone.
  - `Tabs` for All / Needs reply, an `Input` for search, rows built from `Avatar` + `Badge`.
  - The right pane reuses the surface-1 thread component.
- **Future assistant.** Add Vercel AI Elements (`conversation`, `message`, `prompt-input`) only for the assistant pane. It is shadcn-based and uses the same tokens. It is coupled to the `ai` package types, which is fine there and not here.

Install (dry-run first; see risk 1 about `button`):
```bash
pnpm dlx shadcn@latest add message bubble marker message-scroller --dry-run
pnpm dlx shadcn@latest add message bubble marker message-scroller   # answer NO to overwriting button.tsx
pnpm dlx shadcn@latest add attachment                                # later, for MMS images
# Runtime dep pulled by message-scroller: @shadcn/react (MIT, peer react>=19, zero deps)
```
Prerequisites, all verified in section 3:
1. Bump `tailwindcss` to 4.3 or later, still inside our `^4` range.
2. Make the `scroll-fade` and `shimmer` utilities available.
3. Add the `icon-sm` and `icon-xs` button sizes.

## 2. Comparison table

| Criterion | **shadcn chat primitives** | **AI Elements** (Vercel) | **prompt-kit** | **assistant-ui** | **shadcn-chat** (jakobhoeg) | **Kibo UI** |
|---|---|---|---|---|---|---|
| Install | `shadcn add message bubble marker message-scroller attachment` | `npx ai-elements@latest add <c>` or `shadcn add https://registry.ai-sdk.dev/<c>.json` | `shadcn add "https://prompt-kit.com/c/<c>.json"` | `shadcn add https://r.assistant-ui.com/thread.json` | `npx shadcn-chat-cli add` (own CLI) | already in components.json (`@kibo-ui`) |
| License | MIT (`@shadcn/react`) | Apache-2.0 | MIT | MIT | MIT | MIT* |
| Activity | `@shadcn/react` 0.3.1 published 2026-08-31; `shadcn` CLI at 4.21.4 | npm 1.9.0 (2026-03-12); repo pushed 2026-09-01 | repo pushed 2026-09-28 | `@assistant-ui/react` 0.15.28 published 2026-10-12, 12.5k stars | **Unmaintained** (README says so); last push 2025-08-12 | active, but no chat item |
| Tailwind v4 / React 19 | v4 only. Uses `scrollbar-thin` (TW 4.3) and `inset-s-1/2` (TW 4.2). Peer `react>=19` | docs app on TW ^4.1.17; elements pkg on react 19.2.3 and `ai` ^6 | repo on TW ^4.1.7, react ^19 | peer `react ^18 \|\| ^19` | **TW ^3.3, react ^18, next 14** | n/a |
| Bubble / grouping | `Bubble` (7 variants) + `BubbleGroup`, `MessageGroup` | `Message` / `MessageContent` with user/assistant roles only | `Message`, avatar | `Thread` (roles user/assistant) | `ChatBubble` | none |
| Timestamps / status ticks | `MessageFooter` slot; docs show "Delivered" / "Read" text. No built-in ticks | none | none | none | none | `relative-time` only |
| Day separators | `Marker variant="separator"` | none | none | none | none | none |
| Stick-to-bottom / scroll button | `MessageScroller` (own engine): auto-scroll, prepend preservation, jump-to-message, `MessageScrollerButton` | `Conversation` on `use-stick-to-bottom` + scroll button | `ChatContainer` on `use-stick-to-bottom`; `ScrollButton` | built into `Thread` | `ChatMessageList` | none |
| Composer | none (use `InputGroup` + `Textarea`) | `PromptInput` (1,413 lines; types `ChatStatus`, `FileUIPart` from `ai`) | `PromptInput` (textarea + tooltip, no AI deps) | `Composer` (runtime-bound) | `ChatInput` | none |
| Attachments / MMS | `attachment` (image media, states idle → done/error) | inside `PromptInput` / `Message` (`FileUIPart`) | separate item (not checked) | attachment registry item | no | `dropzone` |
| Typing indicator | no (not needed for SMS) | `Loader` / shimmer | `Loader` | yes | yes | no |
| Virtualization | not built in; docs show a TanStack Virtual pattern | no | no | no | no | n/a |
| Theming | pure tokens. `tinted` derives from `--primary` via `oklch(from …)` | tokens; no hard-coded palette colours found | tokens; no hard-coded palette colours found | tokens | unknown | n/a |
| Accessibility | viewport `role="region"` + `aria-label`; content `role="log"` + `aria-relevant="additions"`; `Marker` with `role="status"` | `role="log"` on `Conversation` | `role="log"` on `ChatContainer` | "accessibility built in" (registry description) | unknown | n/a |
| Dependencies | `@shadcn/react`, `radix-ui` (Slot), `cva`, `cn` | `use-stick-to-bottom`, **`ai`**, **`streamdown`**, `nanoid` | `use-stick-to-bottom`; message pulls `react-markdown`, `shiki`, `marked`, `remark-*` | `@assistant-ui/react` runtime (zustand, assistant-stream, assistant-cloud…) | — | — |
| AI-SDK coupled? | **No** | **Yes** (message, prompt-input) | Partly (markdown/shiki weight; no `ai` import in the items checked) | **Yes**: a runtime model of user/assistant/tool messages | No | — |

\*Kibo licence not re-checked: its GitHub repo `haydenbleasel/kibo` now returns "Moved Permanently". Kibo has no chat, message or inbox item (its full 40-item registry was listed via the shadcn MCP).

**Inbox candidates.**
- The shadcn **Mail** example (ResizablePanelGroup + Tabs + MailList + MailDisplay) is gone from ui.shadcn.com (`/examples/mail` returns 404). Its source survives only at old tags (e.g. `shadcn@2.3.0`, Tailwind v3, imports `@/registry/new-york/ui/*`).
- **`sidebar-09`** (new-york-v4 block) is a mail-style second sidebar with `SidebarInput` search and teaser rows. It is app-shell level, so it doesn't fit inside our dashboard.
- **shadcn/studio `inbox-app-01..03`** is Pro (paid).
- **21st.dev "messaging-conversation"** needs a 21st API key and lists its licence as unknown.
- **shadcnblocks** has a "chat input" category with no confirmed blocks.

## 3. Fit with our stack

The repo (verified): `react` 19.2.4, `tailwindcss` **4.1.18** (`^4`), `shadcn` CLI 4.0.2, `radix-ui` ^1.4.3, `motion` ^12.43, `ai` ^6.0.70 (used only in `scripts/`). `components.json` uses `new-york` with `cssVariables: true`, `ui` alias `@/shared/components/ui`, `utils` alias `@/shared/lib/utils` (clsx + tailwind-merge), and registries `@wds`, `@kibo-ui`, `@magicui`. Not installed: `use-stick-to-bottom`, `react-virtuoso`, `@tanstack/react-virtual`, `@ai-sdk/react`, `streamdown`.

What adopting the shadcn primitives needs:
1. **Tailwind ≥ 4.3.** `message-scroller` uses `scrollbar-thin`, which TW 4.3.0 added (2026-05-08). It uses `inset-s-1/2`, which TW 4.2.0 added. On 4.1.18 neither class exists in the bundled lib, so the scroll button would mis-centre. Run `pnpm up tailwindcss @tailwindcss/postcss` within `^4`, or hand-swap to `left-1/2`. TW 4.3 also ships its own `scrollbar-gutter-*` utilities. That collides with our custom `@utility scrollbar-gutter-stable` (globals.css:1164), which must be deleted on upgrade.
2. **`scroll-fade-b` and `shimmer` utilities.** These live in `shadcn/tailwind.css` (`@utility scroll-fade*`, `@utility shimmer*`). Our globals.css doesn't import that file. Our installed `shadcn@4.0.2` copy of `tailwind.css` has **0** `scroll-fade` rules. Bump `shadcn` and add `@import 'shadcn/tailwind.css'`, or copy just those two utilities. Check that file's `@custom-variant data-active/data-open…` don't clash with ours (we define `dark`, `pressed`).
3. **Button sizes.** `message-scroller` defaults to `size="icon-sm"` and `attachment` to `icon-xs`. Our customised `button.tsx` has only `icon`, so either add the two sizes or pass `size="icon"`. Don't let the CLI overwrite `button.tsx`: it is customised with `pressed:` and `--press-scale`.
4. **`cn` import.** Upstream items import `cn` from the new `cn` package (changelog Sept 2026; `shadcn` latest depends on `cn` ^0.2.4). Our `cn` is `@/shared/lib/utils`. Fix any un-rewritten import by hand to `@/shared/lib/utils` (see section 5). Don't run `shadcn migrate cn` without asking: it touches the whole repo.
5. **Theming.**
   - The variants map straight onto our ladder: `default` maps to `--primary` (#03afed, so check the foreground contrast for long SMS text), `secondary` and `muted` map to `--secondary` / `--muted` (#efe7d7 / #221d17), and `outline` maps to `--border` + `--background`.
   - `tinted` uses relative colour syntax, `oklch(from var(--primary) …)`. That needs Safari ≥ 18 for the iPad PWA.
   - `BubbleReactions` rings with `ring-card`, which we won't use.
   - Per `docs/design-system/theme-conventions.md`, judge bubble fills by eye in both schemes.
6. **What we build ourselves** (data-shaped, ~small):
   - The status footer, mapping `voip_message_status` queued/sent/delivered/failed/undelivered/received to an icon + text + `failureReason` tooltip.
   - Day grouping with date-fns.
   - The automated-message label.
   - Composer submit, with optimistic `queued` rows.
   - Unread / needs-reply derivation for the inbox.
7. **Reused primitives** (all exist in `src/shared/components/ui/`): `sheet`, `scroll-area` (inbox list), `textarea`, `input-group`, `input`, `avatar`, `badge`, `tabs`, `resizable`, `tooltip`, `button`, `separator`, `skeleton`. Not present but used by upstream examples: `spinner`, `empty`, `item`, `button-group`, `kbd`.
8. **Ruled out.**
   - **AI Elements for SMS.** `Message` types `from` as `UIMessage["role"]` from `ai`, renders text through `streamdown`, and `PromptInput` is tied to `ChatStatus` / `FileUIPart`. We'd strip the AI coupling from every file.
   - **assistant-ui.** It needs its runtime (`ExternalStoreRuntime`) to wrap our tRPC data, and its user/assistant role model doesn't fit three SMS parties (homeowner, staff, automation).
   - **shadcn-chat.** Tailwind v3 / React 18 and unmaintained.

## 4. What the repo already has for texting UI

**No texting UI exists.** A grep of `src/**/*.tsx` for voip, sms, thread, MessageBubble, conversation and chat finds only unrelated hits: campaigns-admin, landing forms, email templates, and the "thread" wording in comments.

The data layer exists:
- `src/shared/db/schema/voip-messages.ts`: threads keyed by `(voipDidId, remoteE164)`; `direction`, `status` (enum `voip_message_status` in `schema/meta.ts`), `failureReason`, `sentAt` / `deliveredAt` / `failedAt`, `agentUserId`, `customerId`.
- `src/shared/entities/voip-messages/` (dal/server crud, queries, mutations; lib visibility, server-spec).
- `src/shared/services/voip/voip-messages.service.ts`.

The closest UI is `src/shared/entities/customers/components/timeline/quick-note-input.tsx`, a note composer and not a thread. Per memory, texting code belongs under VoIP (`services/voip/` now, `modules/<m>/core/` later).

## 5. Unverified

- Whether `shadcn@latest add` rewrites `import { cn } from "cn"` to our `aliases.utils`, or installs the `cn` package instead. GitHub API rate limits blocked reading the CLI transformer. Check with `--dry-run`.
- Whether the CLI prompts or silently skips when `button` (a registryDependency) already exists, and how it handles the radix vs base vs aria variant choice for a `new-york` project.
- The exact `@shadcn/react` MessageScroller props (`preserveScrollOnPrepend` placement, `aria-live` politeness): the docs fetch was truncated.
- Whether AI Elements and prompt-kit run on Tailwind 4.1 vs 4.3: their repos pin 4.1.x, but we didn't scan every class.
- assistant-ui's accessibility claims beyond its registry description.
- Kibo UI's licence and its current repo URL.
- shadcn/studio and shadcnblocks licence terms.

## 6. Sources

- shadcn registry items (raw JSON): https://ui.shadcn.com/r/styles/new-york-v4/{message,bubble,marker,message-scroller,attachment,sidebar-09}.json, index https://ui.shadcn.com/r/index.json
- shadcn docs: https://ui.shadcn.com/docs/components/message · /bubble · /message-scroller · https://ui.shadcn.com/docs/changelog
- June 2026 release mirror: https://releases.sh/release/rel_WYna2z1l_2GFHAXiPxnTn-june-2026-components-for-chat-interfaces
- shadcn tailwind.css utilities: https://github.com/shadcn-ui/ui/blob/main/packages/shadcn/src/tailwind.css
- Legacy Mail example: https://github.com/shadcn-ui/ui/tree/shadcn@2.3.0/apps/www/app/(app)/examples/mail
- Tailwind changelog (4.2.0 `inset-s-*`, 4.3.0 `scrollbar-*`): https://github.com/tailwindlabs/tailwindcss/blob/main/CHANGELOG.md
- npm: https://registry.npmjs.org/@shadcn/react · /cn · /shadcn · /ai-elements · /@assistant-ui/react · /shadcn-chat-cli · /use-stick-to-bottom · /streamdown
- AI Elements: https://github.com/vercel/ai-elements · https://registry.ai-sdk.dev/{conversation,message,prompt-input}.json
- prompt-kit: https://github.com/ibelick/prompt-kit · https://prompt-kit.com/c/{chat-container,message,prompt-input,scroll-button}.json
- assistant-ui: https://r.assistant-ui.com/{thread,thread-list}.json · https://github.com/assistant-ui/assistant-ui
- shadcn-chat: https://github.com/jakobhoeg/shadcn-chat (README + apps/www/package.json)
- shadcn/studio inbox (Pro): https://shadcnstudio.com/blocks/dashboard-and-application/inbox-app · 21st.dev: https://21st.dev/@preetsuthar17/components/messaging-conversation.md · shadcnblocks: https://www.shadcnblocks.com/blocks/chatinput
