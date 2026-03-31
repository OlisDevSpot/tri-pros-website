import { ClipboardListIcon, UsersIcon } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'

interface AdminSectionProps {
  onNavigate: (step: string) => void
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
          <Button variant="outline" disabled onClick={() => onNavigate('intake')}>
            <ClipboardListIcon className="size-4" />
            Intake Form
          </Button>
          <Button variant="outline" disabled onClick={() => onNavigate('team')}>
            <UsersIcon className="size-4" />
            Team Overview
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
