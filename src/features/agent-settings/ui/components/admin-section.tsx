import { RadioTowerIcon, UsersIcon } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { ROOTS } from '@/shared/config/roots'

interface AdminSectionProps {
  onNavigate: (path: string) => void
}

export function AdminSection({ onNavigate }: AdminSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin</CardTitle>
        <CardDescription>Super-admin tools and quick actions.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => onNavigate(ROOTS.dashboard.leadSources())}>
            <RadioTowerIcon className="size-4" />
            Lead Sources
          </Button>
          <Button variant="outline" disabled onClick={() => onNavigate(ROOTS.dashboard.team())}>
            <UsersIcon className="size-4" />
            Team Overview
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
