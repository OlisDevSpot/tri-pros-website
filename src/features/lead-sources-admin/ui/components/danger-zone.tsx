'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Input } from '@/shared/components/ui/input'
import { Switch } from '@/shared/components/ui/switch'
import { useLeadSourceActions } from '@/shared/entities/lead-sources/hooks/use-lead-source-actions'
import { useConfirm } from '@/shared/hooks/use-confirm'

interface DangerZoneProps {
  leadSourceId: string
  slug: string
  isActive: boolean
  customerCount: number
}

export function DangerZone({ leadSourceId, slug, isActive, customerCount }: DangerZoneProps) {
  const router = useRouter()
  const { toggleActive, archiveLeadSource, deleteLeadSource } = useLeadSourceActions()

  const [ArchiveConfirmDialog, confirmArchive] = useConfirm({
    title: 'Archive this lead source?',
    message: 'It will be hidden from the lead-source list. Existing customers stay attached.',
  })

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const canDelete = customerCount === 0
  const deleteMatch = deleteText === slug

  const onPause = (next: boolean) => {
    toggleActive.mutate({ id: leadSourceId, isActive: next })
  }

  const onArchive = async () => {
    const ok = await confirmArchive()
    if (!ok) {
      return
    }
    archiveLeadSource.mutate({ id: leadSourceId }, {
      onSuccess: () => router.push('/dashboard/lead-sources'),
    })
  }

  const onDelete = () => {
    deleteLeadSource.mutate({ id: leadSourceId }, {
      onSuccess: () => {
        setDeleteOpen(false)
        router.push('/dashboard/lead-sources')
      },
      onError: (err) => {
        toast.error(err.message || 'Failed to delete')
      },
    })
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Danger zone
      </h3>
      <div className="flex flex-col rounded-lg border border-destructive/40">
        <ArchiveConfirmDialog />

        <Row
          title="Pause intake"
          description="Stops new submissions to this source's intake URL. Existing customers stay attached."
        >
          <Switch
            checked={isActive}
            disabled={toggleActive.isPending}
            onCheckedChange={next => onPause(next)}
            aria-label={isActive ? 'Pause intake' : 'Resume intake'}
            className="data-[state=checked]:bg-emerald-500"
          />
        </Row>

        <div className="border-t border-border/40" aria-hidden="true" />

        <Row
          title="Archive"
          description="Hide from the lead-source list. Data is preserved and can be restored."
        >
          <Button
            variant="outline"
            size="sm"
            onClick={onArchive}
            disabled={archiveLeadSource.isPending}
            className="border-destructive/60 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            {archiveLeadSource.isPending ? 'Archiving…' : 'Archive'}
          </Button>
        </Row>

        <div className="border-t border-destructive/20" aria-hidden="true" />

        <Row
          title="Delete"
          description={
            canDelete
              ? 'Permanent. Removes this lead source completely.'
              : `${customerCount} ${customerCount === 1 ? 'customer is' : 'customers are'} still attached. Reassign or archive instead.`
          }
        >
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            disabled={!canDelete}
          >
            Delete…
          </Button>
        </Row>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete lead source?</DialogTitle>
            <DialogDescription>
              Type
              {' '}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{slug}</code>
              {' '}
              to confirm. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteText}
            onChange={e => setDeleteText(e.target.value)}
            placeholder={slug}
            spellCheck={false}
            autoCapitalize="off"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!deleteMatch || deleteLeadSource.isPending}
              onClick={onDelete}
            >
              {deleteLeadSource.isPending ? 'Deleting…' : 'Delete permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function Row({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
