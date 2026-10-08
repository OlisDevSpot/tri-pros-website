import Link from 'next/link'

import { Button } from '@/shared/components/ui/button'

// The negative margins keep the 44px tap target from growing the module header.
export function DashboardSeeAllLink({ href }: { href: string }) {
  return (
    <Button asChild variant="ghost" size="sm" className="-my-2 -mr-2 min-h-11 px-2 text-xs text-muted-foreground hover:text-foreground">
      <Link href={href}>See all →</Link>
    </Button>
  )
}
