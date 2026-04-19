'use client'

import type { ReactNode } from 'react'

import type { MeetingParticipantRole } from '@/shared/constants/enums'

import { CrownIcon } from 'lucide-react'
import React, { createContext, useMemo } from 'react'

import { EmailAction } from '@/shared/components/contact-actions/ui/email-action'
import { PhoneAction } from '@/shared/components/contact-actions/ui/phone-action'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip'
import { getInitials } from '@/shared/entities/users/lib/get-initials'
import { getUserColorToken } from '@/shared/entities/users/lib/get-user-color'
import { cn } from '@/shared/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface UserOverviewCardUser {
  id: string
  name: string | null
  image: string | null
  /** Optional — enables the Email slot and Email contact action. */
  email?: string | null
  /** Optional — enables the Phone slot and Phone contact action. */
  phone?: string | null
}

/**
 * Parent-enriched contextual metadata. Populated by consumers like
 * `ParticipantsSlot` to surface situational info (role in this meeting,
 * ownership) without the card itself reaching into meeting context.
 */
export interface UserOverviewCardMeta {
  role?: MeetingParticipantRole
  /** Convenience flag — derived from role='owner' but overridable. */
  isOwner?: boolean
}

export type UserAvatarSize = 'xs' | 'sm' | 'md' | 'lg'

const AVATAR_SIZE_CLASSES: Record<UserAvatarSize, string> = {
  xs: 'size-5',
  sm: 'size-6',
  md: 'size-8',
  lg: 'size-10',
}

const AVATAR_FALLBACK_TEXT: Record<UserAvatarSize, string> = {
  xs: 'text-[8px]',
  sm: 'text-[10px]',
  md: 'text-xs',
  lg: 'text-sm',
}

const ROLE_LABELS: Record<MeetingParticipantRole, string> = {
  owner: 'Owner',
  co_owner: 'Co-owner',
  helper: 'Helper',
}

// ── Context ────────────────────────────────────────────────────────────────────

interface UserOverviewCardContextValue {
  user: UserOverviewCardUser
  meta: UserOverviewCardMeta
}

const UserOverviewCardContext = createContext<UserOverviewCardContextValue | null>(null)

function useUserOverviewCard() {
  const ctx = React.use(UserOverviewCardContext)
  if (!ctx) {
    throw new Error('UserOverviewCard sub-components must be used within <UserOverviewCard>')
  }
  return ctx
}

// ── Root ───────────────────────────────────────────────────────────────────────

interface UserOverviewCardRootProps {
  user: UserOverviewCardUser
  /** Parent-enriched metadata. Optional — slots gracefully render nothing when absent. */
  meta?: UserOverviewCardMeta
  children: ReactNode
  className?: string
}

function UserOverviewCardRoot({ user, meta, children, className }: UserOverviewCardRootProps) {
  const resolvedMeta = useMemo<UserOverviewCardMeta>(
    () => ({
      ...meta,
      isOwner: meta?.isOwner ?? meta?.role === 'owner',
    }),
    [meta],
  )
  const value = useMemo<UserOverviewCardContextValue>(
    () => ({ user, meta: resolvedMeta }),
    [user, resolvedMeta],
  )
  return (
    <UserOverviewCardContext value={value}>
      <div className={className}>{children}</div>
    </UserOverviewCardContext>
  )
}

// ── Primitive slots ────────────────────────────────────────────────────────────

interface AvatarSlotProps {
  size?: UserAvatarSize
  /** Wrap the avatar in a hover tooltip showing the user's name. Default: false. */
  withTooltip?: boolean
  className?: string
}

function AvatarSlot({ size = 'sm', withTooltip = false, className }: AvatarSlotProps) {
  const { user } = useUserOverviewCard()
  const displayName = user.name ?? 'Unknown'
  const color = getUserColorToken(user.id)

  const avatar = (
    <Avatar className={cn(AVATAR_SIZE_CLASSES[size], 'shrink-0', className)}>
      <AvatarImage src={user.image ?? undefined} alt={displayName} />
      <AvatarFallback className={cn('font-medium', AVATAR_FALLBACK_TEXT[size], color.bg, color.text)}>
        {getInitials(displayName)}
      </AvatarFallback>
    </Avatar>
  )

  if (!withTooltip) {
    return avatar
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{avatar}</span>
      </TooltipTrigger>
      <TooltipContent side="top">{displayName}</TooltipContent>
    </Tooltip>
  )
}

function NameSlot({ className }: { className?: string }) {
  const { user } = useUserOverviewCard()
  return (
    <span className={cn('truncate', className)}>
      {user.name ?? 'Unknown'}
    </span>
  )
}

function EmailSlot({ className }: { className?: string }) {
  const { user } = useUserOverviewCard()
  if (!user.email) {
    return null
  }
  return (
    <span className={cn('truncate', className)}>
      {user.email}
    </span>
  )
}

function PhoneSlot({ className }: { className?: string }) {
  const { user } = useUserOverviewCard()
  if (!user.phone) {
    return null
  }
  return (
    <span className={cn('truncate', className)}>
      {user.phone}
    </span>
  )
}

/**
 * Role indicator — only renders when `meta.role` was provided by the parent
 * (e.g. rendered inside a meeting context via `ParticipantsSlot`). Owner gets
 * a crown; co_owner/helper get a compact text badge.
 */
function RoleSlot({ className }: { className?: string }) {
  const { meta } = useUserOverviewCard()
  if (!meta.role) {
    return null
  }
  if (meta.isOwner) {
    return (
      <span
        aria-label={ROLE_LABELS.owner}
        className={cn(
          'inline-flex items-center justify-center text-amber-400',
          className,
        )}
      >
        <CrownIcon className="size-3.5" strokeWidth={2.25} />
      </span>
    )
  }
  return (
    <span
      className={cn(
        'text-[10px] font-medium uppercase tracking-wide text-muted-foreground',
        className,
      )}
    >
      {ROLE_LABELS[meta.role]}
    </span>
  )
}

// ── Composed layouts ───────────────────────────────────────────────────────────

interface RowSlotProps {
  children: ReactNode
  className?: string
}

/**
 * Flex row wrapper for composing an in-line user summary (avatar + text stack
 * + trailing actions). Children compose freely; use with Avatar + Name + any
 * trailing content.
 */
function RowSlot({ children, className }: RowSlotProps) {
  return (
    <div className={cn('flex items-center gap-2 min-w-0', className)}>
      {children}
    </div>
  )
}

interface ContactActionsSlotProps {
  /** Which actions to include. Defaults to whatever data is available on `user`. */
  include?: ReadonlyArray<'phone' | 'email'>
  className?: string
}

/**
 * Call + Email button cluster. Hides each action when the underlying
 * `user.phone` / `user.email` field is absent — no need to guard at the call
 * site. Reuses the shared `contact-actions` primitives so formatting +
 * copy/edit dropdowns match customer contact surfaces.
 */
function ContactActionsSlot({ include = ['phone', 'email'], className }: ContactActionsSlotProps) {
  const { user } = useUserOverviewCard()
  const phoneEnabled = include.includes('phone') && !!user.phone
  const emailEnabled = include.includes('email') && !!user.email

  if (!phoneEnabled && !emailEnabled) {
    return null
  }

  return (
    <div className={cn('flex items-center gap-2 text-xs text-muted-foreground', className)}>
      {phoneEnabled && user.phone && <PhoneAction phone={user.phone} compact />}
      {emailEnabled && user.email && <EmailAction email={user.email} compact />}
    </div>
  )
}

// ── Stack (multi-user static slot) ─────────────────────────────────────────────

interface StackSlotProps {
  users: UserOverviewCardUser[]
  /** Max avatars to render before showing a `+N` overflow badge. Default: 3. */
  max?: number
  size?: UserAvatarSize
  /** Per-avatar hover tooltips with the user's name. Default: true. */
  withTooltip?: boolean
  className?: string
}

function StackSlot({ users, max = 3, size = 'sm', withTooltip = true, className }: StackSlotProps) {
  const visible = users.slice(0, max)
  const overflow = users.length - visible.length

  if (users.length === 0) {
    return null
  }

  return (
    <div className={cn('flex -space-x-1.5', className)}>
      {visible.map(user => (
        <UserOverviewCardRoot
          key={user.id}
          user={user}
          className="rounded-full ring-2 ring-background"
        >
          <AvatarSlot size={size} withTooltip={withTooltip} />
        </UserOverviewCardRoot>
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            AVATAR_SIZE_CLASSES[size],
            AVATAR_FALLBACK_TEXT[size],
            'inline-flex items-center justify-center rounded-full bg-muted font-medium text-muted-foreground ring-2 ring-background shrink-0',
          )}
        >
          {`+${overflow}`}
        </span>
      )}
    </div>
  )
}

// ── Inline list (static multi-user slot) ───────────────────────────────────────

interface InlineListSlotProps {
  users: UserOverviewCardUser[]
  /** Separator between pairs. Default: `/`. */
  separator?: string
  /**
   * Which form of the name to show next to each avatar. `first` takes the
   * first whitespace-delimited token; `full` uses `user.name`. Default: `first`.
   */
  mode?: 'first' | 'full'
  size?: UserAvatarSize
  className?: string
}

function firstToken(name: string | null): string {
  if (!name) {
    return 'Unknown'
  }
  const [first] = name.trim().split(/\s+/)
  return first || 'Unknown'
}

/**
 * Inline user summary: `[avatar] Oliver / [avatar] Sean`. One avatar per user
 * (not stacked), each paired with its first name. Avatar fallback uses the
 * stable per-user color token; the name text stays at `text-foreground` to
 * keep label legibility crisp and avoid competing with the avatar hue.
 *
 * Use when space allows names to be shown inline (schedule card summary row,
 * breadcrumb-style attribution). Use `UserOverviewCard.Stack` when space only
 * permits overlapping avatars.
 */
function InlineListSlot({ users, separator = '/', mode = 'first', size = 'xs', className }: InlineListSlotProps) {
  if (users.length === 0) {
    return null
  }
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 min-w-0 text-xs', className)}>
      {users.map((user, idx) => {
        const label = mode === 'first' ? firstToken(user.name) : (user.name ?? 'Unknown')
        return (
          <span key={user.id} className="inline-flex items-center gap-1 min-w-0">
            <UserOverviewCardRoot user={user} className="inline-flex items-center gap-1 min-w-0">
              <AvatarSlot size={size} />
              <span className="truncate font-medium text-foreground">{label}</span>
            </UserOverviewCardRoot>
            {idx < users.length - 1 && (
              <span aria-hidden="true" className="text-muted-foreground/50">{separator}</span>
            )}
          </span>
        )
      })}
    </span>
  )
}

// ── Compound export ────────────────────────────────────────────────────────────

export const UserOverviewCard = Object.assign(UserOverviewCardRoot, {
  Avatar: AvatarSlot,
  Name: NameSlot,
  Email: EmailSlot,
  Phone: PhoneSlot,
  Role: RoleSlot,
  Row: RowSlot,
  ContactActions: ContactActionsSlot,
  Stack: StackSlot,
  InlineList: InlineListSlot,
})
