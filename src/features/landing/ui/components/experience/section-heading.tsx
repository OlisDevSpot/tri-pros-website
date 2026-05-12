import type { ReactNode } from 'react'
import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import { EditorialEyebrow } from './editorial-eyebrow'

interface TrailingLink {
  label: string
  href: string
}

interface SectionHeadingProps {
  eyebrow: string
  children: ReactNode
  trailing?: TrailingLink
}

export function SectionHeading({ eyebrow, children, trailing }: SectionHeadingProps) {
  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between mb-12 lg:mb-20">
      <div className="space-y-4 max-w-xl">
        <EditorialEyebrow>{eyebrow}</EditorialEyebrow>
        <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl leading-[1.1] tracking-[-0.01em] text-foreground">
          {children}
        </h2>
      </div>
      {trailing
        ? (
            <Link
              href={trailing.href}
              className="group inline-flex items-center gap-2 self-start sm:self-end text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground transition-colors duration-200"
            >
              {trailing.label}
              <ArrowUpRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          )
        : null}
    </div>
  )
}
