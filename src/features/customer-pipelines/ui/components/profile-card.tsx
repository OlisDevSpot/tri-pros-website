'use client'

import { formatProfileValue } from '@/features/customer-pipelines/lib/format-profile-value'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'

interface Props {
  title: string
  data: Record<string, unknown> | null
  labels: Record<string, string>
}

export function ProfileCard({ title, data, labels }: Props) {
  const entries = data
    ? Object.entries(data).filter(([, v]) => v != null && v !== '')
    : []

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        {entries.length === 0
          ? (
              <p className="text-sm text-muted-foreground">No data collected</p>
            )
          : (
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {entries.map(([key, value]) => (
                  <div key={key}>
                    <p className="text-xs text-muted-foreground">{labels[key] ?? key}</p>
                    <p className="text-sm font-medium">{formatProfileValue(value)}</p>
                  </div>
                ))}
              </div>
            )}
      </CardContent>
    </Card>
  )
}
