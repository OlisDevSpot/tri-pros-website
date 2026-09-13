'use client'

import type { MeetingOutcome } from '@/shared/constants/enums'
import type { Meeting } from '@/shared/db/schema'
import { CalendarClockIcon, CalendarSearchIcon } from 'lucide-react'
import Link from 'next/link'
import { Fragment } from 'react'
import { MEETING_FLOW_KEY_HINTS } from '@/features/meeting-flow/constants/keyboard-hints'
import { SHELL_COPY } from '@/features/meeting-flow/constants/shell-copy'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { ROOTS } from '@/shared/config/roots'
import { CANNOT_RESCHEDULE_REASON, canRescheduleFromOutcome } from '@/shared/constants/enums/meetings'
import { MEETING_OUTCOME_LABELS } from '@/shared/entities/meetings/constants/status-colors'
import { formatMeetingShortStamp } from '@/shared/lib/formatters'

interface MeetingSectionProps {
  meeting: Pick<Meeting, 'id' | 'scheduledFor' | 'meetingType' | 'meetingOutcome'>
  onReschedule: () => void
}

/** Panel section: when, type, outcome, the meeting actions, and the keyboard list. */
export function MeetingSection({ meeting, onReschedule }: MeetingSectionProps) {
  const outcome = (meeting.meetingOutcome ?? 'not_set') as MeetingOutcome
  const canReschedule = canRescheduleFromOutcome(outcome)

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">{SHELL_COPY.when}</dt>
        <dd className="font-medium tabular-nums">{formatMeetingShortStamp(meeting.scheduledFor)}</dd>
        <dt className="text-muted-foreground">{SHELL_COPY.type}</dt>
        <dd className="font-medium">{meeting.meetingType}</dd>
        <dt className="text-muted-foreground">{SHELL_COPY.outcome}</dt>
        <dd>
          <Badge variant="outline">{MEETING_OUTCOME_LABELS[outcome]}</Badge>
        </dd>
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button
          className="h-11 gap-2"
          disabled={!canReschedule}
          title={canReschedule ? undefined : CANNOT_RESCHEDULE_REASON}
          variant="outline"
          onClick={onReschedule}
        >
          <CalendarClockIcon className="size-4" />
          {SHELL_COPY.reschedule}
        </Button>
        <Button asChild className="h-11 gap-2" variant="outline">
          <Link href={ROOTS.dashboard.scheduleWithMeetingHighlight(meeting.id, meeting.scheduledFor)}>
            <CalendarSearchIcon className="size-4" />
            {SHELL_COPY.viewInSchedule}
          </Link>
        </Button>
      </div>

      <section aria-labelledby="meeting-panel-keys">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground" id="meeting-panel-keys">
          {SHELL_COPY.keyboardHeading}
        </h3>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 text-xs">
          {MEETING_FLOW_KEY_HINTS.map(hint => (
            <Fragment key={hint.label}>
              <dt className="flex gap-1">
                {hint.keys.map(key => (
                  <kbd
                    key={key}
                    className="rounded border border-border/70 bg-muted px-1.5 py-0.5 [font-family:inherit] text-xs font-medium text-muted-foreground"
                  >
                    {key}
                  </kbd>
                ))}
              </dt>
              <dd className="text-muted-foreground">{hint.label}</dd>
            </Fragment>
          ))}
        </dl>
      </section>
    </div>
  )
}
