# Participant Management UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy single-rep `AssignRepDialog` and orphaned `MeetingOwnerSelect` with a participant-aware UX: an inline owner/co-owner picker (Popover + cmdk) plus a Manage Participants modal for helpers.

**Architecture:** Two coordinated surfaces, both consuming the existing `meetings.manageParticipants` mutation. Inline picker = fast path for owner+co-owner. Modal = robust fallback for helpers and bulk. Built on Radix Popover + shadcn `Command` (cmdk) for accessibility-correct keyboard and focus handling.

**Tech Stack:** Next.js 15, Tailwind v4, shadcn/ui (Radix primitives), cmdk, lucide-react, TanStack Query + tRPC, sonner.

**Spec:** `docs/superpowers/specs/2026-04-18-participant-management-ux-design.md`

**Verification model (no test runner in this repo):** Each task ends with `pnpm tsc` + `pnpm lint` + commit. Final UI smoke check is Task 12. Per project convention (`memory/feedback-no-build.md`): NEVER run `pnpm build`.

---

## File Structure

### New files (all under `src/shared/entities/meetings/components/`)

```
participant-picker/
  participant-role-icon.tsx           # Crown icon, two states (filled/outline)
  current-participant-row.tsx         # One assigned participant row (owner or co_owner)
  available-participant-row.tsx       # One search result row
  use-participant-picker-mutations.tsx # Hook bundling all 3 manageParticipants flows w/ optimistic updates
  participant-picker-content.tsx      # Popover body composition
  participant-picker-trigger.tsx      # Avatar-group button (default + compact variants)
  participant-picker.tsx              # Public component composing Popover + Trigger + Content
  index.ts                            # Re-exports ParticipantPicker
manage-participants-modal/
  add-participant-row.tsx             # Search-result row inside modal (any role addable)
  participants-list.tsx               # Grouped list of all current participants in modal
  manage-participants-modal.tsx       # Modal shell using BaseModal
  index.ts                            # Re-exports ManageParticipantsModal
```

### Modified files

```
src/trpc/routers/meetings.router.ts                                 # add getParticipants query
src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx   # swap AssignRepDialog import
src/features/meeting-flow/ui/views/meetings-view.tsx                # swap dialog
src/features/schedule-management/ui/views/schedule-view.tsx         # swap dialog
src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx # swap dialog
src/features/meeting-flow/ui/components/table/index.tsx             # swap dialog + use compact picker in owner column
src/features/meeting-flow/ui/views/meeting-flow.tsx                 # mount default picker in detail header
```

### Deleted files

```
src/shared/entities/meetings/components/assign-rep-dialog.tsx
src/features/meeting-flow/ui/components/meeting-owner-select.tsx
```

---

## Task 1: Add `getParticipants` tRPC query

The picker needs a server query that returns the current participant rows (with user join) for a given meeting. The DAL helper `getParticipantsForMeeting` already exists.

**Files:**
- Modify: `src/trpc/routers/meetings.router.ts`

- [ ] **Step 1: Add the import for the existing DAL helper**

In `src/trpc/routers/meetings.router.ts`, the import block already includes participant DAL helpers. Add `getParticipantsForMeeting` to the named imports:

```typescript
import {
  addParticipant,
  countParticipantsByRole,
  getParticipantByRole,
  getParticipantsForMeeting,
  removeParticipant,
  updateParticipantRole,
  userParticipatesInMeeting,
} from '@/shared/dal/server/meetings/participants'
```

- [ ] **Step 2: Add the `getParticipants` procedure**

Insert this procedure just below `getInternalUsers` (around line 270) so related queries cluster together:

```typescript
  // Returns all participants for a meeting with user info (name, email, image).
  // Used by the inline ParticipantPicker and ManageParticipantsModal.
  getParticipants: agentProcedure
    .input(z.object({ meetingId: z.string().uuid() }))
    .query(async ({ input }) => {
      return getParticipantsForMeeting(input.meetingId)
    }),
```

- [ ] **Step 3: Verify**

```bash
pnpm tsc
```

Expected: No errors. The new procedure should appear in the inferred router type.

- [ ] **Step 4: Commit**

```bash
git add src/trpc/routers/meetings.router.ts
git commit -m "feat(meetings): add getParticipants tRPC query for participant UI"
```

---

## Task 2: Build `participant-role-icon.tsx`

A pure presentational component for the crown icon with two states. No data, no logic — just visual.

**Files:**
- Create: `src/shared/entities/meetings/components/participant-picker/participant-role-icon.tsx`

- [ ] **Step 1: Create the file**

```tsx
'use client'

import { Crown } from 'lucide-react'

import { cn } from '@/shared/lib/utils'

interface ParticipantRoleIconProps {
  /** True when this participant is the meeting's primary owner. */
  isOwner: boolean
  className?: string
}

/**
 * Single-icon role indicator. Filled (gold-on-primary) when owner; outlined and
 * muted when co_owner / available-to-promote. Renders inert content only — the
 * caller wraps it in a button when interactive.
 */
export function ParticipantRoleIcon({ isOwner, className }: ParticipantRoleIconProps) {
  if (isOwner) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex size-7 items-center justify-center rounded-md bg-primary text-amber-300',
          className,
        )}
      >
        <Crown className="size-4" strokeWidth={2} />
      </span>
    )
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-7 items-center justify-center rounded-md text-muted-foreground/30',
        'group-hover:text-primary group-hover:bg-accent group-focus-visible:text-primary group-focus-visible:bg-accent',
        'motion-safe:transition-colors',
        className,
      )}
    >
      <Crown className="size-4" strokeWidth={1.5} />
    </span>
  )
}
```

- [ ] **Step 2: Verify**

```bash
pnpm tsc && pnpm lint --no-warnings
```

Expected: No errors related to this file.

- [ ] **Step 3: Commit**

```bash
git add src/shared/entities/meetings/components/participant-picker/participant-role-icon.tsx
git commit -m "feat(participants): add ParticipantRoleIcon — single crown, two states"
```

---

## Task 3: Build `current-participant-row.tsx`

One row in the popover's "Current" section. Pure props in / events out.

**Files:**
- Create: `src/shared/entities/meetings/components/participant-picker/current-participant-row.tsx`

- [ ] **Step 1: Create the file**

```tsx
'use client'

import { Loader2, X } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip'
import { cn } from '@/shared/lib/utils'

import { ParticipantRoleIcon } from './participant-role-icon'

interface CurrentParticipantRowProps {
  userId: string
  name: string
  email: string | null
  image: string | null
  role: 'owner' | 'co_owner'
  /** Disable the remove button (last owner protection). */
  removeDisabled: boolean
  /** Disabled-state explanation, shown in tooltip when removeDisabled is true. */
  removeDisabledReason?: string
  /** True while a mutation targeting this row is in flight. */
  isPending: boolean
  /** Click handler for the crown icon (only meaningful for co_owner — promote). */
  onPromote: () => void
  /** Click handler for the remove (✕) button. */
  onRemove: () => void
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function CurrentParticipantRow({
  name,
  email,
  image,
  role,
  removeDisabled,
  removeDisabledReason,
  isPending,
  onPromote,
  onRemove,
}: CurrentParticipantRowProps) {
  const isOwner = role === 'owner'
  const roleLabel = isOwner ? 'Owner' : 'Co-owner'

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border border-border bg-card p-2',
        isPending && 'pointer-events-none opacity-60',
      )}
    >
      <Avatar className="size-6 shrink-0">
        <AvatarImage src={image ?? undefined} alt="" />
        <AvatarFallback className="text-[10px] font-semibold">
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col gap-px overflow-hidden">
        <div className="truncate text-sm font-medium text-foreground">{name}</div>
        <div className="truncate text-xs text-muted-foreground">
          <span
            className={cn(
              'mr-1.5 text-[10px] font-semibold uppercase tracking-wide',
              isOwner ? 'text-primary' : 'text-teal-700 dark:text-teal-400',
            )}
          >
            {roleLabel}
          </span>
          {email}
        </div>
      </div>

      {/* Crown — interactive only when co_owner (promote action) */}
      {isOwner
        ? (
            <span title="Already owner">
              <ParticipantRoleIcon isOwner />
            </span>
          )
        : (
            <button
              type="button"
              onClick={onPromote}
              disabled={isPending}
              aria-label={`Promote ${name} to owner`}
              className="group inline-flex size-9 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <ParticipantRoleIcon isOwner={false} />
            </button>
          )}

      {/* Remove ✕ */}
      {removeDisabled
        ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  aria-label={`Cannot remove ${name} — ${removeDisabledReason ?? 'meeting needs at least one owner'}`}
                  className="inline-flex size-9 cursor-not-allowed items-center justify-center rounded-md text-muted-foreground/40"
                >
                  <X className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{removeDisabledReason ?? 'Meeting requires at least one owner'}</TooltipContent>
            </Tooltip>
          )
        : (
            <button
              type="button"
              onClick={onRemove}
              disabled={isPending}
              aria-label={`Remove ${name} from this meeting`}
              className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-safe:transition-colors"
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
            </button>
          )}
    </div>
  )
}
```

- [ ] **Step 2: Verify Tooltip exists in shadcn primitives**

```bash
ls src/shared/components/ui/tooltip.tsx
```

Expected: file exists. If not, run `pnpm dlx shadcn@latest add tooltip` and re-verify.

- [ ] **Step 3: Verify typecheck and lint**

```bash
pnpm tsc && pnpm lint
```

Expected: No errors related to this file.

- [ ] **Step 4: Commit**

```bash
git add src/shared/entities/meetings/components/participant-picker/current-participant-row.tsx
git commit -m "feat(participants): add CurrentParticipantRow component"
```

---

## Task 4: Build `available-participant-row.tsx`

One row in the search-results section.

**Files:**
- Create: `src/shared/entities/meetings/components/participant-picker/available-participant-row.tsx`

- [ ] **Step 1: Create the file**

```tsx
'use client'

import { Loader2, Plus } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import { CommandItem } from '@/shared/components/ui/command'
import { cn } from '@/shared/lib/utils'

interface AvailableParticipantRowProps {
  userId: string
  name: string
  email: string | null
  image: string | null
  /** Role this user will be added as if clicked — used in the affordance label. */
  inferredRole: 'owner' | 'co_owner'
  /** True when both slots are full; row is dimmed and click is no-op. */
  disabled: boolean
  isPending: boolean
  onAdd: () => void
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function AvailableParticipantRow({
  userId,
  name,
  email,
  image,
  inferredRole,
  disabled,
  isPending,
  onAdd,
}: AvailableParticipantRowProps) {
  return (
    <CommandItem
      // cmdk filter uses the value field; combine searchable parts so name + email both match
      value={`${name} ${email ?? ''}`}
      disabled={disabled || isPending}
      onSelect={() => {
        if (!disabled && !isPending) {
          onAdd()
        }
      }}
      className={cn(
        'group flex items-center gap-2 rounded-md p-2',
        disabled && 'opacity-50',
      )}
      aria-label={`Add ${name} as ${inferredRole === 'owner' ? 'owner' : 'co-owner'}`}
    >
      <Avatar className="size-6 shrink-0">
        <AvatarImage src={image ?? undefined} alt="" />
        <AvatarFallback className="text-[10px] font-semibold">{getInitials(name)}</AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col gap-px overflow-hidden">
        <div className="truncate text-sm font-medium text-foreground">{name}</div>
        <div className="truncate text-xs text-muted-foreground">{email}</div>
      </div>

      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground opacity-60 group-hover:opacity-100 group-data-[selected=true]:opacity-100 motion-safe:transition-opacity">
        {isPending
          ? <Loader2 className="size-3 animate-spin" />
          : (
              <>
                <Plus className="size-3" />
                {inferredRole === 'owner' ? 'add as owner' : 'add as co-owner'}
              </>
            )}
      </span>
    </CommandItem>
  )
}
```

- [ ] **Step 2: Verify**

```bash
pnpm tsc && pnpm lint
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/entities/meetings/components/participant-picker/available-participant-row.tsx
git commit -m "feat(participants): add AvailableParticipantRow component"
```

---

## Task 5: Build `use-participant-picker-mutations.tsx`

A custom hook that bundles the three optimistic mutation flows the picker needs (add, remove, promote-to-owner). Centralizes the cache-update logic per `pattern-optimistic-updates.md`.

**Files:**
- Create: `src/shared/entities/meetings/components/participant-picker/use-participant-picker-mutations.tsx`

- [ ] **Step 1: Create the file**

```tsx
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import { useInvalidation } from '@/shared/dal/client/use-invalidation'
import { useTRPC } from '@/trpc/helpers'

type ParticipantsCache = {
  id: string
  userId: string
  role: 'owner' | 'co_owner' | 'helper'
  userName: string | null
  userEmail: string | null
  userImage: string | null
}[]

interface UseParticipantPickerMutationsArgs {
  meetingId: string
}

/**
 * Bundles the 3 manageParticipants flows the inline picker uses:
 *  - add(userId, role)
 *  - remove(userId)
 *  - promoteToOwner(userId)  — atomic role swap; current owner becomes co_owner
 *
 * Tracks per-user pending state so the affected row can show a spinner.
 * Uses the optimistic pattern from memory/pattern-optimistic-updates.md.
 */
export function useParticipantPickerMutations({ meetingId }: UseParticipantPickerMutationsArgs) {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const { invalidateMeeting } = useInvalidation()
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)

  const queryOpts = trpc.meetingsRouter.getParticipants.queryOptions({ meetingId })

  const baseMutationOptions = {
    onMutate: async (input: { userId: string }) => {
      setPendingUserId(input.userId)
      await qc.cancelQueries(queryOpts)
      const previous = qc.getQueryData(queryOpts.queryKey)
      return { previous }
    },
    onError: (err: { message?: string }, _vars: { userId: string }, context: { previous: ParticipantsCache | undefined } | undefined) => {
      if (context?.previous) {
        qc.setQueryData(queryOpts.queryKey, context.previous)
      }
      toast.error(err.message || 'Couldn\'t update participant')
    },
    onSettled: () => {
      setPendingUserId(null)
      qc.invalidateQueries(queryOpts)
      invalidateMeeting()
    },
  }

  const addMutation = useMutation(
    trpc.meetingsRouter.manageParticipants.mutationOptions({
      ...baseMutationOptions,
      onMutate: async (input) => {
        const ctx = await baseMutationOptions.onMutate(input)
        // Optimistically insert a placeholder row so the popover updates instantly
        qc.setQueryData(queryOpts.queryKey, (old: ParticipantsCache | undefined) => {
          if (!old) return old
          return [
            ...old,
            {
              id: `optimistic-${input.userId}`,
              userId: input.userId,
              role: input.role!,
              userName: null,
              userEmail: null,
              userImage: null,
            },
          ]
        })
        return ctx
      },
    }),
  )

  const removeMutation = useMutation(
    trpc.meetingsRouter.manageParticipants.mutationOptions({
      ...baseMutationOptions,
      onMutate: async (input) => {
        const ctx = await baseMutationOptions.onMutate(input)
        qc.setQueryData(queryOpts.queryKey, (old: ParticipantsCache | undefined) => {
          if (!old) return old
          return old.filter(p => p.userId !== input.userId)
        })
        return ctx
      },
    }),
  )

  const promoteMutation = useMutation(
    trpc.meetingsRouter.manageParticipants.mutationOptions({
      ...baseMutationOptions,
      onMutate: async (input) => {
        const ctx = await baseMutationOptions.onMutate(input)
        qc.setQueryData(queryOpts.queryKey, (old: ParticipantsCache | undefined) => {
          if (!old) return old
          return old.map((p) => {
            if (p.userId === input.userId) return { ...p, role: 'owner' as const }
            if (p.role === 'owner') return { ...p, role: 'co_owner' as const }
            return p
          })
        })
        return ctx
      },
    }),
  )

  return {
    pendingUserId,
    add: (userId: string, role: 'owner' | 'co_owner') => {
      addMutation.mutate({ meetingId, action: 'add', userId, role })
    },
    remove: (userId: string) => {
      removeMutation.mutate({ meetingId, action: 'remove', userId })
    },
    promoteToOwner: (userId: string) => {
      promoteMutation.mutate({ meetingId, action: 'change_role', userId, role: 'owner' })
    },
  }
}
```

- [ ] **Step 2: Verify the `invalidateMeeting` exists on the invalidation hook**

```bash
grep -n "invalidateMeeting" src/shared/dal/client/use-invalidation.ts
```

Expected: A function exported. If absent, fall back to `qc.invalidateQueries({ queryKey: ['meetings'] })` and document.

- [ ] **Step 3: Verify typecheck**

```bash
pnpm tsc
```

Expected: No errors. The mutation `input` types are inferred from `manageParticipants` — verify no implicit-any.

- [ ] **Step 4: Commit**

```bash
git add src/shared/entities/meetings/components/participant-picker/use-participant-picker-mutations.tsx
git commit -m "feat(participants): add useParticipantPickerMutations hook with optimistic updates"
```

---

## Task 6: Build `participant-picker-content.tsx`

The popover body — composes Current section, search input, results, footer. Owns the search query state.

**Files:**
- Create: `src/shared/entities/meetings/components/participant-picker/participant-picker-content.tsx`

- [ ] **Step 1: Create the file**

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { Lock, Settings2 } from 'lucide-react'
import { useState } from 'react'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
} from '@/shared/components/ui/command'
import { useTRPC } from '@/trpc/helpers'

import { AvailableParticipantRow } from './available-participant-row'
import { CurrentParticipantRow } from './current-participant-row'
import { useParticipantPickerMutations } from './use-participant-picker-mutations'

interface ParticipantPickerContentProps {
  meetingId: string
  /** Called when user clicks the manage-participants link in the footer. */
  onOpenManageModal: () => void
}

export function ParticipantPickerContent({ meetingId, onOpenManageModal }: ParticipantPickerContentProps) {
  const trpc = useTRPC()
  const [search, setSearch] = useState('')

  const participantsQuery = useQuery(
    trpc.meetingsRouter.getParticipants.queryOptions({ meetingId }),
  )
  const internalUsersQuery = useQuery(
    trpc.meetingsRouter.getInternalUsers.queryOptions(),
  )

  const { pendingUserId, add, remove, promoteToOwner } = useParticipantPickerMutations({ meetingId })

  const participants = participantsQuery.data ?? []
  const owner = participants.find(p => p.role === 'owner') ?? null
  const coOwner = participants.find(p => p.role === 'co_owner') ?? null
  const helperCount = participants.filter(p => p.role === 'helper').length
  const slotsFull = !!owner && !!coOwner

  // "Available" candidates: internal users not already in the meeting
  const assignedUserIds = new Set(participants.map(p => p.userId))
  const available = (internalUsersQuery.data ?? []).filter(u => !assignedUserIds.has(u.id))

  return (
    <Command className="w-full" shouldFilter={true}>
      {/* Current section (rendered above the search via CommandList? No — outside Command for static layout) */}
      <div className="border-b border-border bg-muted/40 p-2">
        <div className="flex items-center justify-between px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground tabular-nums">
          <span>{`Current · ${participants.filter(p => p.role !== 'helper').length} of 2 max`}</span>
        </div>
        <div className="space-y-1">
          {owner && (
            <CurrentParticipantRow
              userId={owner.userId}
              name={owner.userName ?? 'Unknown'}
              email={owner.userEmail}
              image={owner.userImage}
              role="owner"
              removeDisabled
              removeDisabledReason="Promote another participant first"
              isPending={pendingUserId === owner.userId}
              onPromote={() => {}}
              onRemove={() => {}}
            />
          )}
          {coOwner && (
            <CurrentParticipantRow
              userId={coOwner.userId}
              name={coOwner.userName ?? 'Unknown'}
              email={coOwner.userEmail}
              image={coOwner.userImage}
              role="co_owner"
              removeDisabled={false}
              isPending={pendingUserId === coOwner.userId}
              onPromote={() => promoteToOwner(coOwner.userId)}
              onRemove={() => remove(coOwner.userId)}
            />
          )}
          {!owner && !coOwner && (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              No one assigned yet — search below to add.
            </p>
          )}
        </div>
        {owner && coOwner == null && (
          <p className="mt-1.5 flex items-center gap-1 px-1 text-[11px] text-muted-foreground">
            <Lock className="size-3" />
            Owner can only be removed once a co-owner is added.
          </p>
        )}
      </div>

      {/* Search */}
      <CommandInput
        placeholder="Search team to add…"
        value={search}
        onValueChange={setSearch}
      />
      <label htmlFor="participant-search" className="sr-only">
        Search team to add participants
      </label>

      {/* Results */}
      <CommandList>
        <CommandEmpty>
          No team members match
          {' '}
          <span className="font-medium">{`"${search}"`}</span>
          .
        </CommandEmpty>
        <CommandGroup>
          {available.map(u => (
            <AvailableParticipantRow
              key={u.id}
              userId={u.id}
              name={u.name ?? u.email ?? 'Unknown'}
              email={u.email}
              image={u.image}
              inferredRole={owner ? 'co_owner' : 'owner'}
              disabled={slotsFull}
              isPending={pendingUserId === u.id}
              onAdd={() => add(u.id, owner ? 'co_owner' : 'owner')}
            />
          ))}
        </CommandGroup>
      </CommandList>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border bg-muted/40 px-3 py-2">
        <span className="text-xs text-muted-foreground tabular-nums">
          {helperCount > 0 ? `+ ${helperCount} helper${helperCount === 1 ? '' : 's'}` : 'No helpers'}
        </span>
        <button
          type="button"
          onClick={onOpenManageModal}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Settings2 className="size-3.5" />
          Manage participants
        </button>
      </div>
    </Command>
  )
}
```

- [ ] **Step 2: Verify cmdk's `Command` accepts the children layout we're using**

The shadcn `Command` wraps cmdk; it expects `CommandInput` / `CommandList` to be direct children for keyboard nav to work. Putting the static "Current" section outside `CommandList` is intentional — it's not part of the searchable list.

If lint or runtime warns about misplaced children, an acceptable fallback is to wrap the popover in a plain `<div>` and use `Command` only for the search+list portion. Adjust in this step if needed.

- [ ] **Step 3: Verify typecheck and lint**

```bash
pnpm tsc && pnpm lint
```

- [ ] **Step 4: Commit**

```bash
git add src/shared/entities/meetings/components/participant-picker/participant-picker-content.tsx
git commit -m "feat(participants): add ParticipantPickerContent — popover body composition"
```

---

## Task 7: Build `participant-picker-trigger.tsx`

The button that opens the popover. Two visual variants (`default` shows names, `compact` shows avatars only).

**Files:**
- Create: `src/shared/entities/meetings/components/participant-picker/participant-picker-trigger.tsx`

- [ ] **Step 1: Create the file**

```tsx
'use client'

import { ChevronDown } from 'lucide-react'
import { forwardRef } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

interface ParticipantSummary {
  userId: string
  name: string
  image: string | null
}

interface ParticipantPickerTriggerProps {
  owner: ParticipantSummary | null
  coOwner: ParticipantSummary | null
  variant?: 'default' | 'compact'
  isLoading?: boolean
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export const ParticipantPickerTrigger = forwardRef<
  HTMLButtonElement,
  ParticipantPickerTriggerProps
>(function ParticipantPickerTrigger({ owner, coOwner, variant = 'default', isLoading = false }, ref) {
  const summary = !owner && !coOwner
    ? 'Unassigned'
    : coOwner
      ? `${owner?.name ?? '—'} + ${coOwner.name}`
      : (owner?.name ?? '—')

  const isCompact = variant === 'compact'

  return (
    <Button
      ref={ref}
      type="button"
      variant="outline"
      size="sm"
      disabled={isLoading}
      className={cn('gap-2', isCompact && 'h-8 px-2')}
    >
      <span className="flex items-center -space-x-1.5">
        {owner && (
          <Avatar className="size-5 ring-2 ring-background">
            <AvatarImage src={owner.image ?? undefined} alt="" />
            <AvatarFallback className="text-[9px]">{getInitials(owner.name)}</AvatarFallback>
          </Avatar>
        )}
        {coOwner && (
          <Avatar className="size-5 ring-2 ring-background">
            <AvatarImage src={coOwner.image ?? undefined} alt="" />
            <AvatarFallback className="text-[9px]">{getInitials(coOwner.name)}</AvatarFallback>
          </Avatar>
        )}
        {!owner && !coOwner && (
          <span className="size-5 rounded-full border border-dashed border-muted-foreground/40" />
        )}
      </span>
      {!isCompact && <span className="truncate text-xs font-medium">{summary}</span>}
      <ChevronDown className="size-3.5 text-muted-foreground" />
    </Button>
  )
})
```

- [ ] **Step 2: Verify**

```bash
pnpm tsc && pnpm lint
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/entities/meetings/components/participant-picker/participant-picker-trigger.tsx
git commit -m "feat(participants): add ParticipantPickerTrigger with default + compact variants"
```

---

## Task 8: Build `participant-picker.tsx` and barrel

Composes Trigger + Popover + Content. Owns the open state and the modal-trigger callback.

**Files:**
- Create: `src/shared/entities/meetings/components/participant-picker/participant-picker.tsx`
- Create: `src/shared/entities/meetings/components/participant-picker/index.ts`

The picker is just the popover. It emits an `onManageClick` callback when the user clicks the footer "Manage participants" link; the parent owns the modal. This keeps the picker decoupled and lets mount sites compose freely.

- [ ] **Step 1: Create `participant-picker.tsx`**

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { useTRPC } from '@/trpc/helpers'

import { ParticipantPickerContent } from './participant-picker-content'
import { ParticipantPickerTrigger } from './participant-picker-trigger'

interface ParticipantPickerProps {
  meetingId: string
  variant?: 'default' | 'compact'
  /** Called when the user clicks the footer "Manage participants" link.
   * Parent should open its ManageParticipantsModal. The picker auto-closes
   * its popover before invoking this. */
  onManageClick: () => void
}

/**
 * Inline owner/co-owner picker. Opens a popover with the current participants,
 * a search box, and a "Manage participants" link that delegates to the parent.
 */
export function ParticipantPicker({ meetingId, variant = 'default', onManageClick }: ParticipantPickerProps) {
  const trpc = useTRPC()
  const [popoverOpen, setPopoverOpen] = useState(false)

  const participantsQuery = useQuery(
    trpc.meetingsRouter.getParticipants.queryOptions({ meetingId }),
  )

  const participants = participantsQuery.data ?? []
  const owner = participants.find(p => p.role === 'owner')
  const coOwner = participants.find(p => p.role === 'co_owner')

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <ParticipantPickerTrigger
          owner={owner ? { userId: owner.userId, name: owner.userName ?? 'Unknown', image: owner.userImage } : null}
          coOwner={coOwner ? { userId: coOwner.userId, name: coOwner.userName ?? 'Unknown', image: coOwner.userImage } : null}
          variant={variant}
          isLoading={participantsQuery.isLoading}
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        collisionPadding={16}
        className="w-[min(420px,calc(100vw-2rem))] p-0"
      >
        <ParticipantPickerContent
          meetingId={meetingId}
          onOpenManageModal={() => {
            setPopoverOpen(false)
            onManageClick()
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 2: Create the barrel `index.ts`**

```ts
export { ParticipantPicker } from './participant-picker'
```

- [ ] **Step 3: Verify (clean — no cross-task dependencies)**

```bash
pnpm tsc && pnpm lint
```

Expected: clean pass.

- [ ] **Step 4: Commit**

```bash
git add src/shared/entities/meetings/components/participant-picker/participant-picker.tsx src/shared/entities/meetings/components/participant-picker/index.ts
git commit -m "feat(participants): add ParticipantPicker composition + barrel"
```

---

## Task 9: Build `ManageParticipantsModal` (with subcomponents)

The full management modal. Lighter detail than the inline picker — its job is to expose helpers and serve as a fallback.

**Files:**
- Create: `src/shared/entities/meetings/components/manage-participants-modal/add-participant-row.tsx`
- Create: `src/shared/entities/meetings/components/manage-participants-modal/participants-list.tsx`
- Create: `src/shared/entities/meetings/components/manage-participants-modal/manage-participants-modal.tsx`
- Create: `src/shared/entities/meetings/components/manage-participants-modal/index.ts`

- [ ] **Step 1: Create `add-participant-row.tsx`**

```tsx
'use client'

import { useState } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import { Button } from '@/shared/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'

interface AddParticipantRowProps {
  userId: string
  name: string
  email: string | null
  image: string | null
  /** Disable role options that have already been filled. */
  ownerSlotFilled: boolean
  coOwnerSlotFilled: boolean
  isPending: boolean
  onAdd: (role: 'owner' | 'co_owner' | 'helper') => void
}

function getInitials(name: string): string {
  return name.split(' ').map(p => p[0] ?? '').join('').slice(0, 2).toUpperCase()
}

export function AddParticipantRow({
  name,
  email,
  image,
  ownerSlotFilled,
  coOwnerSlotFilled,
  isPending,
  onAdd,
}: AddParticipantRowProps) {
  const [selectedRole, setSelectedRole] = useState<'owner' | 'co_owner' | 'helper'>('helper')

  return (
    <div className="flex items-center gap-2 rounded-md border border-border p-2">
      <Avatar className="size-7 shrink-0">
        <AvatarImage src={image ?? undefined} alt="" />
        <AvatarFallback className="text-[10px]">{getInitials(name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="truncate text-sm font-medium">{name}</div>
        <div className="truncate text-xs text-muted-foreground">{email}</div>
      </div>
      <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as typeof selectedRole)}>
        <SelectTrigger className="h-8 w-32 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="owner" disabled={ownerSlotFilled}>Owner</SelectItem>
          <SelectItem value="co_owner" disabled={coOwnerSlotFilled}>Co-owner</SelectItem>
          <SelectItem value="helper">Helper</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        disabled={isPending}
        onClick={() => onAdd(selectedRole)}
      >
        Add
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Create `participants-list.tsx`**

```tsx
'use client'

import { Loader2, X } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import { Button } from '@/shared/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'

interface ParticipantRow {
  userId: string
  name: string
  email: string | null
  image: string | null
  role: 'owner' | 'co_owner' | 'helper'
}

interface ParticipantsListProps {
  rows: ParticipantRow[]
  pendingUserId: string | null
  /** True when removal would leave the meeting with no owner. */
  isLastOwner: (userId: string) => boolean
  onRoleChange: (userId: string, newRole: 'owner' | 'co_owner' | 'helper') => void
  onRemove: (userId: string) => void
}

function getInitials(name: string): string {
  return name.split(' ').map(p => p[0] ?? '').join('').slice(0, 2).toUpperCase()
}

const ROLE_ORDER: Record<ParticipantRow['role'], number> = { owner: 0, co_owner: 1, helper: 2 }

export function ParticipantsList({ rows, pendingUserId, isLastOwner, onRoleChange, onRemove }: ParticipantsListProps) {
  const sorted = [...rows].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role])

  if (sorted.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No participants yet.</p>
  }

  return (
    <div className="space-y-2">
      {sorted.map((p) => {
        const cannotRemove = isLastOwner(p.userId)
        const isPending = pendingUserId === p.userId

        return (
          <div key={p.userId} className="flex items-center gap-2 rounded-md border border-border p-2">
            <Avatar className="size-7 shrink-0">
              <AvatarImage src={p.image ?? undefined} alt="" />
              <AvatarFallback className="text-[10px]">{getInitials(p.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="truncate text-sm font-medium">{p.name}</div>
              <div className="truncate text-xs text-muted-foreground">{p.email}</div>
            </div>
            <Select
              value={p.role}
              disabled={isPending}
              onValueChange={(v) => onRoleChange(p.userId, v as ParticipantRow['role'])}
            >
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="co_owner">Co-owner</SelectItem>
                <SelectItem value="helper">Helper</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={isPending || cannotRemove}
              aria-label={cannotRemove ? `Cannot remove ${p.name} — meeting needs at least one owner` : `Remove ${p.name}`}
              onClick={() => onRemove(p.userId)}
              className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
            </Button>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Create `manage-participants-modal.tsx`**

```tsx
'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import { BaseModal } from '@/shared/components/dialogs/base-modal'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { useInvalidation } from '@/shared/dal/client/use-invalidation'
import { useTRPC } from '@/trpc/helpers'

import { AddParticipantRow } from './add-participant-row'
import { ParticipantsList } from './participants-list'

interface ManageParticipantsModalProps {
  meetingIds: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

/**
 * Full participant management. Used as a fallback from the inline picker for
 * helper management, and as the dropdown-action target ("Manage participants…").
 *
 * v1: bulk mode iterates manageParticipants per meeting client-side.
 */
export function ManageParticipantsModal({ meetingIds, open, onOpenChange, onSuccess }: ManageParticipantsModalProps) {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const { invalidateMeeting } = useInvalidation()
  const [search, setSearch] = useState('')
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)

  // For v1 single-meeting fast path. Bulk mode reads first meeting's participants for display reference.
  const primaryMeetingId = meetingIds[0]

  const participantsQuery = useQuery({
    ...trpc.meetingsRouter.getParticipants.queryOptions({ meetingId: primaryMeetingId }),
    enabled: open && meetingIds.length === 1,
  })
  const internalUsersQuery = useQuery({
    ...trpc.meetingsRouter.getInternalUsers.queryOptions(),
    enabled: open,
  })

  const mutation = useMutation(
    trpc.meetingsRouter.manageParticipants.mutationOptions({
      onMutate: ({ userId }) => {
        setPendingUserId(userId)
      },
      onError: (err) => {
        toast.error(err.message || 'Couldn\'t update participant')
      },
      onSettled: () => {
        setPendingUserId(null)
        if (meetingIds.length === 1) {
          qc.invalidateQueries(trpc.meetingsRouter.getParticipants.queryOptions({ meetingId: primaryMeetingId }))
        }
        invalidateMeeting()
        onSuccess?.()
      },
    }),
  )

  function applyToAll(action: 'add' | 'remove' | 'change_role', userId: string, role?: 'owner' | 'co_owner' | 'helper') {
    for (const meetingId of meetingIds) {
      mutation.mutate({ meetingId, action, userId, role })
    }
  }

  const participants = participantsQuery.data ?? []
  const owner = participants.find(p => p.role === 'owner')
  const coOwner = participants.find(p => p.role === 'co_owner')
  const assignedIds = new Set(participants.map(p => p.userId))

  const available = (internalUsersQuery.data ?? []).filter((u) => {
    if (assignedIds.has(u.id)) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (u.name ?? '').toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q)
  })

  const isMulti = meetingIds.length > 1

  return (
    <BaseModal
      open={open}
      onOpenChange={onOpenChange}
      title={isMulti ? `Manage participants — ${meetingIds.length} meetings` : 'Manage participants'}
      description={isMulti ? 'Changes apply to every selected meeting.' : 'Add, remove, or change roles for this meeting\'s participants.'}
    >
      <div className="space-y-5">
        {!isMulti && (
          <section className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Current participants</Label>
            <ParticipantsList
              rows={participants.map(p => ({
                userId: p.userId,
                name: p.userName ?? 'Unknown',
                email: p.userEmail,
                image: p.userImage,
                role: p.role,
              }))}
              pendingUserId={pendingUserId}
              isLastOwner={(userId) => owner?.userId === userId && participants.filter(p => p.role === 'owner').length === 1}
              onRoleChange={(userId, newRole) => applyToAll('change_role', userId, newRole)}
              onRemove={userId => applyToAll('remove', userId)}
            />
          </section>
        )}

        <section className="space-y-2">
          <Label htmlFor="manage-search" className="text-xs uppercase tracking-wide text-muted-foreground">
            Add a participant
          </Label>
          <Input
            id="manage-search"
            placeholder="Search team…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {available.length === 0 && (
              <p className="py-3 text-center text-sm text-muted-foreground">
                {search ? `No team members match "${search}"` : 'No team members available'}
              </p>
            )}
            {available.map(u => (
              <AddParticipantRow
                key={u.id}
                userId={u.id}
                name={u.name ?? u.email ?? 'Unknown'}
                email={u.email}
                image={u.image}
                ownerSlotFilled={!!owner}
                coOwnerSlotFilled={!!coOwner}
                isPending={pendingUserId === u.id}
                onAdd={role => applyToAll('add', u.id, role)}
              />
            ))}
          </div>
        </section>
      </div>
    </BaseModal>
  )
}
```

- [ ] **Step 4: Create the barrel `index.ts`**

```ts
export { ManageParticipantsModal } from './manage-participants-modal'
```

- [ ] **Step 5: Verify `BaseModal` import path matches the project**

```bash
ls src/shared/components/dialogs/base-modal.tsx
```

If the path differs, update the import in `manage-participants-modal.tsx`.

- [ ] **Step 6: Verify typecheck and lint (full pass — no more pending imports)**

```bash
pnpm tsc && pnpm lint
```

Expected: clean pass. Any remaining errors block this task.

- [ ] **Step 7: Commit**

```bash
git add src/shared/entities/meetings/components/manage-participants-modal/
git commit -m "feat(participants): add ManageParticipantsModal with role grouping and helper support"
```

---

## Task 10: Wire into call sites — swap `AssignRepDialog` → `ManageParticipantsModal`

Replace the four `AssignRepDialog` mounts and update the action-config hook.

**Files:**
- Modify: `src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx`
- Modify: `src/features/meeting-flow/ui/views/meetings-view.tsx`
- Modify: `src/features/schedule-management/ui/views/schedule-view.tsx`
- Modify: `src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx`
- Modify: `src/features/meeting-flow/ui/components/table/index.tsx`

- [ ] **Step 1: Update `use-meeting-action-configs.tsx`**

Find the import:

```typescript
import { AssignRepDialog } from '@/shared/entities/meetings/components/assign-rep-dialog'
```

Replace with:

```typescript
import { ManageParticipantsModal } from '@/shared/entities/meetings/components/manage-participants-modal'
```

In the `InternalAssignOwnerDialog` function (around line 25-34), replace the `AssignRepDialog` JSX with:

```tsx
return (
  <ManageParticipantsModal
    meetingIds={target ? [target.meetingId] : []}
    open={!!target}
    onOpenChange={open => !open && onClose()}
  />
)
```

Note: drop the `currentRepId` prop — the new modal reads current state from its query.

- [ ] **Step 2: Update each call-site view**

For each of the four views, the import and JSX swap:

**`src/features/meeting-flow/ui/views/meetings-view.tsx`**

Replace:
```typescript
import { AssignRepDialog } from '@/shared/entities/meetings/components/assign-rep-dialog'
```
with:
```typescript
import { ManageParticipantsModal } from '@/shared/entities/meetings/components/manage-participants-modal'
```

Replace the JSX (around line 281):
```tsx
<AssignRepDialog
  meetingIds={[assignRepDialog.meetingId]}
  currentRepId={assignRepDialog.currentRepId}
  open={!!assignRepDialog}
  onOpenChange={open => !open && setAssignRepDialog(null)}
/>
```
with:
```tsx
<ManageParticipantsModal
  meetingIds={[assignRepDialog.meetingId]}
  open={!!assignRepDialog}
  onOpenChange={open => !open && setAssignRepDialog(null)}
/>
```

**`src/features/schedule-management/ui/views/schedule-view.tsx`** — same swap, around line 253.

**`src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx`** — same swap, around line 247. This call site already uses `meetingIds: string[]` (bulk-capable), so no shape change.

**`src/features/meeting-flow/ui/components/table/index.tsx`** — same swap, around line 94.

- [ ] **Step 3: Verify typecheck and lint**

```bash
pnpm tsc && pnpm lint
```

Expected: clean pass. The `currentRepId` prop drop will surface any leftover refs — fix them.

- [ ] **Step 4: Commit**

```bash
git add src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx src/features/meeting-flow/ui/views/meetings-view.tsx src/features/schedule-management/ui/views/schedule-view.tsx src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx src/features/meeting-flow/ui/components/table/index.tsx
git commit -m "refactor(meetings): replace AssignRepDialog with ManageParticipantsModal at all call sites"
```

---

## Task 11: Mount `ParticipantPicker` in surfaces

Add the inline picker to surfaces where users need quick rep changes.

**Files:**
- Modify: `src/features/meeting-flow/ui/views/meeting-flow.tsx` (detail header, default variant)
- Modify: `src/features/meeting-flow/ui/components/table/index.tsx` (owner column, compact variant)

- [ ] **Step 1: Locate the meeting-flow header region**

```bash
sed -n '1,80p' src/features/meeting-flow/ui/views/meeting-flow.tsx
```

Identify a header / sticky area suitable for the picker. If the file doesn't have a clear header, place the picker just below the existing customer-name title (above any tab/step navigation). If the file's structure makes this awkward, add a thin `<div className="flex items-center justify-between gap-2">` wrapper around the existing title and append `<ParticipantPicker meetingId={meetingId} />` to the right.

- [ ] **Step 2: Add imports and a local modal-state hook for the meeting detail header**

```typescript
import { useState } from 'react'

import { ManageParticipantsModal } from '@/shared/entities/meetings/components/manage-participants-modal'
import { ParticipantPicker } from '@/shared/entities/meetings/components/participant-picker'
```

In the component body:

```tsx
const [manageOpen, setManageOpen] = useState(false)
```

Mount inside the chosen header location:

```tsx
<ParticipantPicker meetingId={meetingId} onManageClick={() => setManageOpen(true)} />
<ManageParticipantsModal
  meetingIds={[meetingId]}
  open={manageOpen}
  onOpenChange={setManageOpen}
/>
```

- [ ] **Step 3: Mount the compact picker in the meetings table's owner column**

```bash
grep -n "ownerName\|ownerImage\|owner" src/features/meeting-flow/ui/components/table/index.tsx | head -20
```

Identify where the owner cell is rendered (likely an `<Avatar>` + `<span>` group inside a column definition). Replace with:

```tsx
<ParticipantPicker
  meetingId={row.original.id}
  variant="compact"
  onManageClick={() => setAssignRepDialog({ meetingId: row.original.id, currentOwnerId: row.original.ownerId })}
/>
```

(Reusing the existing `assignRepDialog` state that already opens `ManageParticipantsModal` after Task 10. If the table doesn't have `assignRepDialog` state in scope at the column-cell level, lift it via a column meta function or use a separate `useState` per row factory — implementer's call based on TanStack Table's render shape.)

- [ ] **Step 4: Verify typecheck and lint**

```bash
pnpm tsc && pnpm lint
```

- [ ] **Step 5: Commit**

```bash
git add src/features/meeting-flow/ui/views/meeting-flow.tsx src/features/meeting-flow/ui/components/table/index.tsx
git commit -m "feat(meetings): mount ParticipantPicker on meeting detail header and table owner column"
```

---

## Task 12: Delete legacy components and final lint

Now that nothing references them, remove the dead files.

**Files:**
- Delete: `src/shared/entities/meetings/components/assign-rep-dialog.tsx`
- Delete: `src/features/meeting-flow/ui/components/meeting-owner-select.tsx`

- [ ] **Step 1: Verify no remaining imports**

```bash
grep -rn "assign-rep-dialog\|AssignRepDialog\|MeetingOwnerSelect\|meeting-owner-select" src/
```

Expected: empty output. If anything matches, fix the reference before deleting.

- [ ] **Step 2: Delete the files**

```bash
rm src/shared/entities/meetings/components/assign-rep-dialog.tsx
rm src/features/meeting-flow/ui/components/meeting-owner-select.tsx
```

- [ ] **Step 3: Final verification**

```bash
pnpm tsc && pnpm lint
```

Expected: clean pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(meetings): remove legacy AssignRepDialog and orphaned MeetingOwnerSelect"
```

---

## Task 13: End-to-end manual smoke test

No automated tests in this repo. Walk the verification plan from the spec.

- [ ] **Step 1: Start dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Inline picker — basic flow**

- Navigate to a meeting detail page where the ParticipantPicker is mounted
- Click the trigger → popover opens, focus lands in the search input
- Click a result row → row appears in the Current section as co-owner; popover stays open

- [ ] **Step 3: Role swap**

- Click the outlined crown next to the co-owner → atomic swap: previous owner becomes co-owner, new user becomes owner
- Verify GCal event attendees on the `info@` calendar are unchanged (both still attending)

- [ ] **Step 4: Remove constraints**

- With only an owner present, hover the ✕ → tooltip "Cannot remove…"
- Add a co-owner; remove the original owner → succeeds; co-owner promoted automatically by the server, and the picker UI reflects the new owner

- [ ] **Step 5: Slots full**

- With both owner + co-owner set, search for a third person → result row dimmed; clicking is no-op
- Open Manage Participants from the footer → modal opens; add the third user as helper → footer count increments after closing

- [ ] **Step 6: Modal flow**

- Use the dropdown action "Manage participants" on a meeting card → modal opens with full role-grouped list
- Add a helper, change a role, remove a participant → mutations succeed, toasts confirm
- Verify the inline picker (if visible) reflects changes after modal close

- [ ] **Step 7: Accessibility**

- Tab through the entire popover with keyboard only — every control is reachable, focus ring is visible
- Activate the crown / ✕ / search / result rows via Enter/Space — all work
- Press Escape inside the popover → closes; focus returns to trigger
- Toggle reduced motion (System Preferences / DevTools emulation) → transitions disabled

- [ ] **Step 8: Visual / responsive**

- Light + dark mode both render correctly (no hard-coded color regressions)
- Resize viewport to 375px → popover does not overflow; collision handling works

- [ ] **Step 9: Error path**

- Throttle network in DevTools → trigger a participant change → spinner appears on the row; toast on failure if forced; cache reverts

- [ ] **Step 10: Final commit if any fixes applied during smoke test**

```bash
git add -A
git commit -m "chore(participants): smoke-test fixups"
```

If no fixes needed, skip the commit.

---

## Definition of Done

- [ ] All 13 tasks completed and committed
- [ ] `pnpm tsc` clean
- [ ] `pnpm lint` clean (warnings pre-existing in unrelated files OK)
- [ ] Smoke test (Task 13) walked through with no blocking issues
- [ ] Spec's verification plan fully covered
- [ ] No references to `AssignRepDialog` or `MeetingOwnerSelect` remain in the codebase
