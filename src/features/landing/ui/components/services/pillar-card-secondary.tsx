import Link from 'next/link'

import { Button } from '@/shared/components/ui/button'

interface PillarCardSecondaryProps {
  description: string
  href: string
  title: string
}

export function PillarCardSecondary({ description, href, title }: PillarCardSecondaryProps) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-4 rounded-xl border border-border/50 bg-muted/30 p-6 transition-all duration-300 hover:border-border hover:bg-muted/50 hover:shadow-md"
    >
      <h3 className="text-xl font-semibold text-foreground">
        {title}
      </h3>

      <p className="text-muted-foreground leading-relaxed">
        {description}
      </p>

      <div className="mt-auto pt-2">
        <Button variant="outline" size="sm" className="pointer-events-none">
          Contact Us to Discuss
        </Button>
      </div>
    </Link>
  )
}
