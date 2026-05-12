import type { ReactNode } from 'react'
import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import { DrawnUnderline } from './drawn-underline'
import { EditorialEyebrow } from './editorial-eyebrow'

interface TrailingLink {
  label: string
  href: string
}

interface SectionHeadingProps {
  eyebrow: string
  chapter?: string
  children: ReactNode
  trailing?: TrailingLink
}

export function SectionHeading({ eyebrow, chapter, children, trailing }: SectionHeadingProps) {
  return (
    <div className="flex flex-col gap-6 mb-12 lg:mb-20 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex flex-col items-center text-center space-y-4 max-w-xl mx-auto lg:mx-0 lg:items-start lg:text-left">
        <EditorialEyebrow chapter={chapter}>{eyebrow}</EditorialEyebrow>
        <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl leading-[1.1] tracking-[-0.01em] text-foreground">
          {children}
        </h2>
      </div>
      {trailing
        ? (
            <Link
              href={trailing.href}
              className="group inline-flex items-center gap-2 self-center lg:self-end text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground transition-colors duration-200"
            >
              <DrawnUnderline>{trailing.label}</DrawnUnderline>
              <ArrowUpRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          )
        : null}
    </div>
  )
}
