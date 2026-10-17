'use client'

import type { MeetingRep } from '@/shared/modules/meetings/core/types'

import { AwardIcon } from 'lucide-react'

import { PhoneAction } from '@/shared/components/contact-actions/ui/phone-action'
import { companyInfo, companyPhone } from '@/shared/constants/company'
import { UserOverviewCard } from '@/shared/entities/users/components/overview-card'
import { cn } from '@/shared/lib/utils'

export function MeetingRepsCard({ reps }: { reps: MeetingRep[] }) {
  const duo = reps.length > 1

  return (
    <div className="grid w-full gap-2 rounded-2xl bg-card px-3.5 py-3 text-foreground shadow-lg @min-[700px]/proposal:w-fit @min-[700px]/proposal:min-w-90 @min-[700px]/proposal:py-3.5 @min-[700px]/proposal:pr-5 @min-[700px]/proposal:pl-3.5">
      <p className="text-sm text-muted-foreground">{reps.length === 0 ? `Your ${companyInfo.nickname} team` : duo ? 'Your team' : 'Your consultant'}</p>
      {reps.length === 0
        ? companyPhone && <PhoneAction phone={companyPhone} className="text-sm font-bold text-muted-foreground" />
        : (
            <div className={cn('grid', duo && '@min-[700px]/proposal:grid-cols-[auto_auto]')}>
              {reps.map((rep, i) => (
                // A rep carries no id to a share link; the email is unique and already on the payload.
                <UserOverviewCard
                  key={rep.email}
                  user={{ id: rep.email, name: rep.name, image: rep.headshotUrl, email: rep.email, phone: rep.phone }}
                  className={cn('flex min-w-0 items-center gap-3.5', i > 0 && 'mt-2.5 border-t border-border pt-2.5 @min-[700px]/proposal:mt-0 @min-[700px]/proposal:ml-5 @min-[700px]/proposal:border-t-0 @min-[700px]/proposal:border-l @min-[700px]/proposal:pt-0 @min-[700px]/proposal:pl-5')}
                >
                  {/* Every rep's initials share the primary tint, not each user's colour. */}
                  <UserOverviewCard.Avatar
                    size={duo ? 'xl' : '2xl'}
                    className={cn(duo && '@min-[700px]/proposal:size-14')}
                    fallbackClassName="border border-primary/20 bg-row-selected font-sans font-semibold text-primary"
                  />
                  <div className="grid min-w-0 gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <UserOverviewCard.Name className="font-sans text-lg leading-tight font-semibold" />
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-row-selected px-2 py-1 text-xs leading-none font-bold tracking-[0.06em] text-primary">
                        <AwardIcon className="size-3" aria-hidden />
                        Senior rep
                      </span>
                    </div>
                    <UserOverviewCard.ContactActions include={['phone']} compact={false} className="text-sm font-bold" />
                  </div>
                </UserOverviewCard>
              ))}
            </div>
          )}
    </div>
  )
}
