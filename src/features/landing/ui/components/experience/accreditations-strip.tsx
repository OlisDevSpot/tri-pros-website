import { Fragment } from 'react'
import { experienceAccreditations } from '@/features/landing/constants/experience-accreditations'

export function AccreditationsStrip() {
  return (
    <div className="mt-12 lg:mt-16 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
      {experienceAccreditations.map((item, i) => (
        <Fragment key={item.label}>
          {i > 0
            ? <span aria-hidden className="size-1 rounded-full bg-foreground/20" />
            : null}
          <span>{item.label}</span>
        </Fragment>
      ))}
    </div>
  )
}
