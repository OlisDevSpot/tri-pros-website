'use client'

import type { MeetingCalendarEvent } from '@/features/meetings/types'
import type { MeetingStatus } from '@/shared/types/enums'

import { CopyIcon, MoreHorizontalIcon, PencilIcon, PlayIcon, TrashIcon } from 'lucide-react'

import { programAccentMap } from '@/features/meetings/constants/program-accent-map'
import { MEETING_PROGRAMS } from '@/features/meetings/constants/programs'
import { useSession } from '@/shared/auth/client'
import { AddressAction } from '@/shared/components/contact-actions/ui/address-action'
import { PhoneAction } from '@/shared/components/contact-actions/ui/phone-action'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip'
import { cn } from '@/shared/lib/utils'

const STATUS_DOT_COLORS: Record<MeetingStatus, string> = {
  in_progress: 'bg-sky-500',
  completed: 'bg-emerald-500',
  converted: 'bg-violet-500',
}

const STATUS_BG_TINTS: Record<MeetingStatus, string> = {
  in_progress: 'bg-sky-500/5',
  completed: 'bg-emerald-500/5',
  converted: 'bg-violet-500/5',
}

interface MeetingCalendarCardProps {
  event: MeetingCalendarEvent
  onNavigate: (meetingId: string) => void
  onEdit: (meetingId: string) => void
  onStart: (meetingId: string) => void
  onDuplicate: (meetingId: string) => void
  onDelete: (meetingId: string) => void
}

export function MeetingCalendarCard({
  event,
  onNavigate,
  onEdit,
  onStart,
  onDuplicate,
  onDelete,
}: MeetingCalendarCardProps) {
  const { data: session } = useSession()
  const userRole = session?.user?.role

  const program = MEETING_PROGRAMS.find(p => p.accessor === event.program)

  const formattedAddress = [event.customerAddress, event.customerCity]
    .filter(Boolean)
    .join(', ')

  return (
    <div
      className={cn(
        'group relative flex flex-col gap-1 rounded-md border p-2 text-xs cursor-pointer transition-colors hover:border-foreground/20',
        STATUS_BG_TINTS[event.status],
      )}
      onClick={() => onNavigate(event.meetingId)}
    >
      {/* Row 1: Status dot + program badge */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className={cn(
            'h-2 w-2 shrink-0 rounded-full',
            STATUS_DOT_COLORS[event.status],
          )}
        />
        {program && (
          <Badge
            className={cn(
              'text-[10px] px-1.5 py-0 leading-4 truncate',
              programAccentMap[program.accentColor].badge,
            )}
          >
            {program.name}
          </Badge>
        )}
      </div>

      {/* Row 2: Customer name */}
      {event.customerName && (
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="font-medium truncate leading-tight">
              {event.customerName}
            </p>
          </TooltipTrigger>
          <TooltipContent side="top" align="start">
            {event.customerName}
          </TooltipContent>
        </Tooltip>
      )}

      {/* Row 3: Phone + actions menu */}
      <div className="flex items-center justify-between gap-1">
        {event.customerPhone
          ? (
              <div
                className="min-w-0 text-muted-foreground"
                onClick={e => e.stopPropagation()}
              >
                <PhoneAction phone={event.customerPhone} className="text-[11px]" />
              </div>
            )
          : (
              <div />
            )}
        <div
          className={cn(
            'shrink-0 opacity-0 transition-opacity',
            'group-hover:opacity-100',
          )}
          onClick={e => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreHorizontalIcon className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(event.meetingId)}>
                <PencilIcon className="h-3.5 w-3.5" />
                Edit Setup
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStart(event.meetingId)}>
                <PlayIcon className="h-3.5 w-3.5" />
                Start Meeting
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(event.meetingId)}>
                <CopyIcon className="h-3.5 w-3.5" />
                Duplicate
              </DropdownMenuItem>
              {userRole === 'super-admin' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onDelete(event.meetingId)}
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Row 4: Address */}
      {formattedAddress && (
        <div
          className="text-muted-foreground min-w-0"
          onClick={e => e.stopPropagation()}
        >
          <AddressAction address={formattedAddress} className="text-[11px]" />
        </div>
      )}
    </div>
  )
}
