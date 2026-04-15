'use client'

import type { Control } from 'react-hook-form'

import type { CustomerFormValues } from '@/shared/entities/customers/types'

import { Controller } from 'react-hook-form'

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Switch } from '@/shared/components/ui/switch'
import { formatProfileValue } from '@/shared/entities/customers/lib/format-profile-value'

interface Props {
  title: string
  data: Record<string, unknown> | null
  labels: Record<string, string>
  editMode?: boolean
  canEditField?: (field: string) => boolean
  control?: Control<CustomerFormValues>
  formPrefix?: string
  enumOptions?: Record<string, readonly string[]>
}

function isComplexValue(value: unknown): boolean {
  return Array.isArray(value) || (typeof value === 'object' && value !== null)
}

function getFieldPath(formPrefix: string | undefined, key: string): string {
  return formPrefix ? `${formPrefix}.${key}` : key
}

function isNumericField(key: string, value: unknown): boolean {
  return (
    typeof value === 'number'
    || key.endsWith('Rating')
    || key === 'age'
    || key === 'numQuotesReceived'
  )
}

export function ProfileCard({
  title,
  data,
  labels,
  editMode = false,
  canEditField,
  control,
  formPrefix,
  enumOptions,
}: Props) {
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
                {entries.map(([key, value]) => {
                  const shouldEdit = editMode && canEditField?.(key) && control && !isComplexValue(value)
                  const fieldPath = getFieldPath(formPrefix, key)

                  return (
                    <div key={key}>
                      <p className="text-xs text-muted-foreground">{labels[key] ?? key}</p>
                      {shouldEdit
                        ? (
                            <>
                              {enumOptions?.[key]
                                ? (
                                    <Controller
                                      control={control}
                                      name={fieldPath as Parameters<typeof control.register>[0]}
                                      render={({ field }) => (
                                        <Select
                                          value={field.value as string | undefined}
                                          onValueChange={field.onChange}
                                        >
                                          <SelectTrigger className="h-7 text-sm">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {enumOptions[key].map(option => (
                                              <SelectItem key={option} value={option}>
                                                {option}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      )}
                                    />
                                  )
                                : typeof value === 'boolean'
                                  ? (
                                      <Controller
                                        control={control}
                                        name={fieldPath as Parameters<typeof control.register>[0]}
                                        render={({ field }) => (
                                          <Switch
                                            checked={field.value as boolean | undefined}
                                            onCheckedChange={field.onChange}
                                          />
                                        )}
                                      />
                                    )
                                  : (
                                      <Controller
                                        control={control}
                                        name={fieldPath as Parameters<typeof control.register>[0]}
                                        render={({ field }) => (
                                          <Input
                                            {...field}
                                            value={field.value as string | number | undefined}
                                            className="h-7 text-sm"
                                            type={isNumericField(key, value) ? 'number' : 'text'}
                                          />
                                        )}
                                      />
                                    )}
                            </>
                          )
                        : (
                            <p className="text-sm font-medium">{formatProfileValue(value)}</p>
                          )}
                    </div>
                  )
                })}
              </div>
            )}
      </CardContent>
    </Card>
  )
}
