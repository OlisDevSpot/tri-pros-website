'use client'

import { useEffect, useState } from 'react'

import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { useLeadSourceActions } from '@/shared/entities/lead-sources/hooks/use-lead-source-actions'
import { useConfirm } from '@/shared/hooks/use-confirm'
import { cn } from '@/shared/lib/utils'

interface IdentityEditorProps {
  leadSourceId: string
  initialName: string
  initialSlug: string
}

export function IdentityEditor({ leadSourceId, initialName, initialSlug }: IdentityEditorProps) {
  const { updateLeadSource } = useLeadSourceActions()
  const [name, setName] = useState(initialName)
  const [slug, setSlug] = useState(initialSlug)
  const [SlugConfirmDialog, confirmSlugChange] = useConfirm({
    title: 'Change slug?',
    message: 'This rotates the intake URL. The current URL stops working immediately. Continue?',
  })

  useEffect(() => {
    // Intentional: re-sync local form state when the displayed source changes.
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setName(initialName)
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setSlug(initialSlug)
  }, [initialName, initialSlug, leadSourceId])

  const isDirty = name !== initialName || slug !== initialSlug

  const save = async () => {
    const slugChanged = slug !== initialSlug
    if (slugChanged) {
      const ok = await confirmSlugChange()
      if (!ok) {
        return
      }
    }
    updateLeadSource.mutate({
      id: leadSourceId,
      ...(name !== initialName ? { name } : {}),
      ...(slugChanged ? { slug } : {}),
    })
  }

  const revert = () => {
    setName(initialName)
    setSlug(initialSlug)
  }

  return (
    <section className="flex flex-col gap-4">
      <SlugConfirmDialog />
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Identity
        </h3>
        <div className={cn('flex items-center gap-2', !isDirty && 'invisible')}>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={revert}
            disabled={updateLeadSource.isPending}
          >
            Revert
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={save}
            disabled={updateLeadSource.isPending}
          >
            {updateLeadSource.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name">
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="QuoteMe"
            maxLength={120}
          />
        </Field>
        <Field label="Slug" hint="Lowercase, numbers, hyphens only. Changing this rotates the intake URL.">
          <Input
            value={slug}
            onChange={e => setSlug(e.target.value)}
            placeholder="quoteme"
            maxLength={64}
            spellCheck={false}
            autoCapitalize="off"
          />
        </Field>
      </div>
    </section>
  )
}

function Field({ label, hint, children }: { label: string, hint?: string, children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}
