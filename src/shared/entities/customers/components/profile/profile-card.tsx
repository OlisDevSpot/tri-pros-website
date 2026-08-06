'use client'

import type { LucideIcon } from 'lucide-react'
import type { Control } from 'react-hook-form'

import type { CustomerFormValues, ProfileFieldConfig } from '@/shared/entities/customers/types'

import { ChevronDownIcon } from 'lucide-react'
import { useState } from 'react'
import { Controller } from 'react-hook-form'

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/components/ui/collapsible'
import { Input } from '@/shared/components/ui/input'
import { NumberField } from '@/shared/components/ui/number-field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Switch } from '@/shared/components/ui/switch'
import { formatProfileValue } from '@/shared/entities/customers/lib/format-profile-value'
import { cn } from '@/shared/lib/utils'

interface Props {
  title: string
  icon?: LucideIcon
  fields: ProfileFieldConfig[]
  data: Record<string, unknown> | null
  editMode?: boolean
  canEditField?: (field: string) => boolean
  control?: Control<CustomerFormValues>
  // Every section collapses so the rail stays scannable. Edit mode always
  // forces a card open so no field is un-fillable while hidden.
  collapsible?: boolean
  // Defaults to open only when the card has at least one populated field, so
  // empty sections stay tucked away until they hold something.
  defaultOpen?: boolean
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

  // Numbers route through NumberField, the single place that owns the
  // string↔number↔null boundary: it commits a `number` or `null` (never a
  // numeric string, never `undefined`), which is exactly what the profile-trio
  // upsert schema and the "null = clear" wire contract expect.
  if (field.type === 'number') {
    return (
      <Controller
        control={control}
        name={fieldPath as Parameters<typeof control.register>[0]}
        render={({ field: f }) => (
          <NumberField
            className="h-7 text-sm"
            max={field.max}
            min={field.min}
            name={f.name}
            onBlur={f.onBlur}
            onChange={f.onChange}
            placeholder={field.placeholder}
            value={f.value as number | null | undefined}
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
          placeholder={field.placeholder}
          type="text"
          // Nullish → '' keeps the input controlled (never uncontrolled/warn).
          value={(f.value ?? '') as string}
        />
      )}
    />
  )
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== ''
}

export function ProfileCard({
  title,
  icon: Icon,
  fields,
  data,
  editMode = false,
  canEditField,
  control,
  collapsible = true,
  defaultOpen,
}: Props) {
  const values = (data ?? {}) as Record<string, unknown>
  const setCount = fields.filter(field => hasValue(values[field.id])).length
  // View mode surfaces only populated fields so a sparse lead reads clean
  // instead of a wall of "-". Edit mode shows every field so nothing is
  // un-fillable.
  const visibleFields = editMode ? fields : fields.filter(field => hasValue(values[field.id]))

  const grid = (
    <CardContent className="px-4 pb-3">
      {visibleFields.length === 0
        ? (
            <p className="text-xs text-muted-foreground">Not captured yet</p>
          )
        : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
              {visibleFields.map((field) => {
                const value = values[field.id]
                const shouldEdit = editMode && canEditField?.(field.id) && control

                return (
                  <div key={field.id}>
                    <dt className="text-xs text-muted-foreground">{field.label}</dt>
                    <dd className="mt-0.5">
                      {shouldEdit
                        ? renderEditField(field, field.id, control)
                        : (
                            <span className="text-sm font-medium">
                              {hasValue(value) ? formatProfileValue(value) : '-'}
                            </span>
                          )}
                    </dd>
                  </div>
                )
              })}
            </dl>
          )}
    </CardContent>
  )

  if (collapsible) {
    return (
      <Card className="gap-0 py-0">
        <CollapsibleCard
          title={title}
          icon={Icon}
          setCount={setCount}
          defaultOpen={defaultOpen ?? setCount > 0}
          editMode={editMode}
        >
          {grid}
        </CollapsibleCard>
      </Card>
    )
  }

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="px-4 pb-2 pt-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          {Icon ? <Icon className="size-4 shrink-0 text-primary" /> : null}
          <span>{title}</span>
        </CardTitle>
      </CardHeader>
      {grid}
    </Card>
  )
}

interface CollapsibleCardProps {
  title: string
  icon?: LucideIcon
  setCount: number
  defaultOpen: boolean
  editMode: boolean
  children: React.ReactNode
}

function CollapsibleCard({ title, icon: Icon, setCount, defaultOpen, editMode, children }: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen)
  // Force open while editing so collapsed fields stay reachable.
  const isOpen = editMode || open

  return (
    <Collapsible open={isOpen} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className="group flex w-full items-center gap-2 px-4 pb-2 pt-3 text-left"
        disabled={editMode}
      >
        {Icon ? <Icon className="size-4 shrink-0 text-primary" /> : null}
        <CardTitle className="text-sm">{title}</CardTitle>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          {setCount > 0 ? setCount : null}
          <ChevronDownIcon
            className={cn(
              'size-4 transition-transform duration-200',
              isOpen && 'rotate-180',
            )}
          />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  )
}
