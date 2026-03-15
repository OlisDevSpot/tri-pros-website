'use client'

import type { CustomerProfileData } from '@/features/pipeline/types'

import {
  customerProfileLabels,
  financialProfileLabels,
  propertyProfileLabels,
} from '@/features/pipeline/constants/profile-field-labels'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'

interface Props {
  customer: CustomerProfileData['customer']
}

export function CustomerProfileDetails({ customer }: Props) {
  return (
    <div className="space-y-4">
      <ProfileCard
        title="Customer Profile"
        data={customer.customerProfileJSON}
        labels={customerProfileLabels}
      />
      <ProfileCard
        title="Property Profile"
        data={customer.propertyProfileJSON}
        labels={propertyProfileLabels}
      />
      <ProfileCard
        title="Financial Profile"
        data={customer.financialProfileJSON}
        labels={financialProfileLabels}
      />
    </div>
  )
}

function ProfileCard({ title, data, labels }: {
  title: string
  data: Record<string, unknown> | null
  labels: Record<string, string>
}) {
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

function formatProfileValue(value: unknown): string {
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }
  if (typeof value === 'number') {
    return String(value)
  }
  if (Array.isArray(value)) {
    return value.map(v => (typeof v === 'object' && v !== null && 'accessor' in v) ? String(v.accessor) : String(v)).join(', ')
  }
  return String(value)
}
