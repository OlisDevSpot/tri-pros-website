'use client'

import type { Control } from 'react-hook-form'

import type { CustomerFormValues, ProfileFieldConfig } from '@/shared/entities/customers/types'

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
  fields: ProfileFieldConfig[]
  data: Record<string, unknown> | null
  editMode?: boolean
  canEditField?: (field: string) => boolean
  control?: Control<CustomerFormValues>
  formPrefix?: string
}

function getFieldPath(formPrefix: string | undefined, key: string): string {
  return formPrefix ? `${formPrefix}.${key}` : key
}

function renderEditField(
  field: ProfileFieldConfig,
  fieldPath: string,
  control: Control<CustomerFormValues>,
) {
  if (field.type === 'select' && field.options) {
    return (
      <Controller
        control={control}
        name={fieldPath as Parameters<typeof control.register>[0]}
        render={({ field: f }) => (
          <Select
            value={f.value as string | undefined}
            onValueChange={f.onChange}
          >
            <SelectTrigger className="h-7 text-sm">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              {field.options!.map(option => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    )
  }

  if (field.type === 'boolean') {
    return (
      <Controller
        control={control}
        name={fieldPath as Parameters<typeof control.register>[0]}
        render={({ field: f }) => (
          <Switch
            checked={f.value as boolean | undefined}
            onCheckedChange={f.onChange}
          />
        )}
      />
    )
  }

  return (
    <Controller
      control={control}
      name={fieldPath as Parameters<typeof control.register>[0]}
      render={({ field: f }) => (
        <Input
          {...f}
          className="h-7 text-sm"
          max={field.max}
          min={field.min}
          placeholder={field.placeholder}
          type={field.type === 'number' ? 'number' : 'text'}
          value={f.value as string | number | undefined}
        />
      )}
    />
  )
}

function renderViewValue(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return '-'
  }
  return formatProfileValue(value)
}

export function ProfileCard({
  title,
  fields,
  data,
  editMode = false,
  canEditField,
  control,
  formPrefix,
}: Props) {
  const values = data ?? {}

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          {fields.map((field) => {
            const value = (values as Record<string, unknown>)[field.id]
            const shouldEdit = editMode && canEditField?.(field.id) && control
            const fieldPath = getFieldPath(formPrefix, field.id)

            return (
              <div key={field.id}>
                <p className="text-xs text-muted-foreground">{field.label}</p>
                {shouldEdit
                  ? renderEditField(field, fieldPath, control)
                  : (
                      <p className="text-sm font-medium">{renderViewValue(value)}</p>
                    )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
