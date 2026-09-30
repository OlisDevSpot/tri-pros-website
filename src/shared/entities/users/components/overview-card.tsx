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

export interface UserOverviewCardUser {
  id: string
  name: string | null
  image: string | null
  email?: string | null
  phone?: string | null
}

/** Supplied by the parent so the card never reaches into meeting context itself. */
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

interface UserOverviewCardRootProps {
  user: UserOverviewCardUser
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

interface AvatarSlotProps {
  size?: UserAvatarSize
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
          'inline-flex items-center justify-center text-chart-3',
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

interface RowSlotProps {
  children: ReactNode
  className?: string
}

function RowSlot({ children, className }: RowSlotProps) {
  return (
    <div className={cn('flex items-center gap-2 min-w-0', className)}>
      {children}
    </div>
  )
}

interface ContactActionsSlotProps {
  include?: ReadonlyArray<'phone' | 'email'>
  className?: string
}

/** Reuses the shared contact-actions primitives so formatting and dropdowns match customer contact surfaces. */
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

interface StackSlotProps {
  users: UserOverviewCardUser[]
  max?: number
  size?: UserAvatarSize
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

interface InlineListSlotProps {
  users: UserOverviewCardUser[]
  separator?: string
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

/** Name text stays `text-foreground` rather than the avatar hue so labels stay legible. */
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
