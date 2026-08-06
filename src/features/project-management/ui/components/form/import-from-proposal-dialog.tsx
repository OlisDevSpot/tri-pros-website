'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { ImageDownIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/dialog'
import { cn } from '@/shared/lib/utils'
import { useTRPC } from '@/trpc/helpers'

interface Props {
  projectId: string
  onImported: () => void
}

interface ProposalMediaItem {
  id: number
  name: string
  mimeType: string
  url: string | null
}

interface ProposalGroupProps {
  proposalId: string
  proposalLabel: string
  items: ProposalMediaItem[]
  selected: Set<number>
  onToggle: (id: number) => void
  onToggleAll: (ids: number[]) => void
}

function ProposalGroup({ proposalLabel, items, selected, onToggle, onToggleAll }: ProposalGroupProps) {
  const ids = items.map(item => item.id)
  const allSelected = ids.length > 0 && ids.every(id => selected.has(id))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium truncate">{proposalLabel || 'Untitled proposal'}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs h-7"
          onClick={() => onToggleAll(ids)}
        >
          {allSelected ? 'Deselect all' : 'Select all'}
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {items.map((item) => {
          const isSelected = selected.has(item.id)
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(item.id)}
              className={cn(
                'group relative aspect-square overflow-hidden rounded-md border bg-muted',
                isSelected && 'ring-2 ring-primary ring-offset-1',
              )}
            >
              {item.url && (
                // Presigned private-bucket URL — not a next/image-optimizable source.
                <img src={item.url} alt={item.name} className="h-full w-full object-cover" />
              )}
              <div className="absolute top-1 left-1">
                <Checkbox checked={isSelected} onCheckedChange={() => onToggle(item.id)} className="bg-background/90" />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function ImportFromProposalDialog({ projectId, onImported }: Props) {
  const trpc = useTRPC()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(() => new Set())

  const { data: groups, isLoading } = useQuery({
    ...trpc.projectsRouter.media.listImportableProposalMedia.queryOptions({ projectId }),
    enabled: open,
  })

  const importMutation = useMutation(
    trpc.projectsRouter.media.importFromProposal.mutationOptions({
      onSuccess: (res) => {
        toast.success(`Imported ${res.imported} photo${res.imported === 1 ? '' : 's'}`)
        onImported()
        setOpen(false)
        setSelected(new Set())
      },
      onError: () => toast.error('Failed to import photos'),
    }),
  )

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      }
      else {
        next.add(id)
      }
      return next
    })
  }

  function toggleAll(ids: number[]) {
    setSelected((prev) => {
      const allSelected = ids.length > 0 && ids.every(id => prev.has(id))
      const next = new Set(prev)
      if (allSelected) {
        ids.forEach(id => next.delete(id))
      }
      else {
        ids.forEach(id => next.add(id))
      }
      return next
    })
  }

  function handleImport() {
    if (selected.size === 0) {
      return
    }
    importMutation.mutate({ projectId, proposalMediaFileIds: [...selected] })
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setSelected(new Set())
    }
  }

  const hasItems = (groups ?? []).some(group => group.items.length > 0)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <ImageDownIcon className="mr-1.5 h-3.5 w-3.5" />
          Import from proposal
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import from proposal</DialogTitle>
          <DialogDescription>
            Copy photos from this project&apos;s proposals into the project&apos;s media.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto">
          {isLoading && (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading proposal photos...</p>
          )}

          {!isLoading && !hasItems && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No importable photos found on this project&apos;s proposals.
            </p>
          )}

          {!isLoading && groups?.filter(group => group.items.length > 0).map(group => (
            <ProposalGroup
              key={group.proposalId}
              proposalId={group.proposalId}
              proposalLabel={group.proposalLabel}
              items={group.items}
              selected={selected}
              onToggle={toggle}
              onToggleAll={toggleAll}
            />
          ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={selected.size === 0 || importMutation.isPending}
          >
            {importMutation.isPending ? 'Importing...' : `Import ${selected.size} selected`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
