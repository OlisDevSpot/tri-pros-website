'use client'

import type { MediaGroup, MediaItem } from '@/shared/components/media/types'
import { useQuery } from '@tanstack/react-query'
import { FileTextIcon } from 'lucide-react'
import { useMemo } from 'react'
import { MediaManager } from '@/shared/components/media/media-manager'
import { useMediaUpload } from '@/shared/components/media/use-media-upload'
import { Switch } from '@/shared/components/ui/switch'
import { useConfirm } from '@/shared/hooks/use-confirm'
import { useTRPC } from '@/trpc/helpers'
import { useProposalMedia } from '../../../dal/client/mutations/use-proposal-media'

interface Props {
  proposalId: string
}

interface ProposalMediaRow {
  id: number
  name: string
  mimeType: string
  visibility: string
  url: string | null
  blurDataUrl: string | null
  optimizationStatus: string
  sortOrder: number
  duration: number | null
  pageCount: number | null
}

function toItems(rows: ProposalMediaRow[]): MediaItem[] {
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    mimeType: r.mimeType,
    url: r.url ?? '',
    blurDataUrl: r.blurDataUrl,
    optimizationStatus: r.optimizationStatus,
    sortOrder: r.sortOrder,
  }))
}

export function ProposalMediaManager({ proposalId }: Props) {
  const trpc = useTRPC()
  const { data: rows = [] } = useQuery(trpc.proposalsRouter.media.list.queryOptions({ proposalId }))
  const media = useProposalMedia(proposalId)

  const viewById = useMemo(() => new Map(rows.map(r => [r.id, r])), [rows])

  const { upload, isUploading } = useMediaUpload({
    getUploadUrl: file => media.getUploadUrl.mutateAsync({ proposalId, filename: file.name, mimeType: file.type }),
    createRecord: ({ file, pathKey, bucket }) => media.create.mutateAsync({
      proposalId,
      pathKey,
      bucket: bucket!,
      mimeType: file.type,
      name: file.name.replace(/\.[^/.]+$/, ''),
      fileExtension: file.name.includes('.') ? `.${file.name.split('.').pop()}` : '',
    }),
  })

  const groups: MediaGroup[] = [
    { key: 'homeowner', label: 'Shown to homeowner', items: toItems(rows.filter(r => r.visibility === 'homeowner')) },
    { key: 'internal', label: 'Internal only', items: toItems(rows.filter(r => r.visibility === 'internal')) },
  ]

  const [DeleteDialog, confirmDelete] = useConfirm({ title: 'Delete file', message: 'This cannot be undone.' })

  return (
    <>
      <MediaManager
        groups={groups}
        accept="image/*,video/*,application/pdf"
        isUploading={isUploading}
        emptyLabel="No files yet"
        onUpload={async (groupKey, files) => {
          await Promise.allSettled(files.map(async (file) => {
            const created = await upload(file)
            if (groupKey === 'homeowner' && created?.id) {
              await media.setVisibility.mutateAsync({ id: created.id, visibility: 'homeowner' })
            }
          }))
          media.invalidate()
        }}
        onReorder={(_groupKey, updates) => media.reorder.mutate({ updates })}
        onDelete={async (id) => {
          if (await confirmDelete()) {
            media.remove.mutate({ id })
          }
        }}
        onRename={(id, name) => media.rename.mutate({ id, name })}
        renderThumbnail={(item) => {
          if (item.mimeType.startsWith('image/')) {
            return <img src={item.url} alt={item.name} className="h-full w-full object-cover" />
          }
          if (item.mimeType.startsWith('video/')) {
            return <video src={item.url} className="h-full w-full object-cover" muted playsInline />
          }
          return (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-muted p-2 text-center">
              <FileTextIcon className="h-8 w-8 text-muted-foreground" />
              <span className="line-clamp-2 text-[10px] text-muted-foreground">{item.name}</span>
            </div>
          )
        }}
        renderControls={item => (
          <div className="flex items-center gap-1.5 rounded bg-background/70 px-1.5 py-0.5">
            <span className="text-[10px]">Homeowner</span>
            <Switch
              checked={viewById.get(item.id)?.visibility === 'homeowner'}
              onCheckedChange={checked => media.setVisibility.mutate({ id: item.id, visibility: checked ? 'homeowner' : 'internal' })}
            />
          </div>
        )}
        renderDetails={(item) => {
          const row = viewById.get(item.id)
          return (
            <>
              <dt className="text-muted-foreground">MIME Type</dt>
              <dd className="text-foreground">{item.mimeType}</dd>

              <dt className="text-muted-foreground">Visibility</dt>
              <dd className="capitalize text-foreground">{row?.visibility ?? '—'}</dd>

              {row?.pageCount != null && (
                <>
                  <dt className="text-muted-foreground">Pages</dt>
                  <dd className="text-foreground">{row.pageCount}</dd>
                </>
              )}
            </>
          )
        }}
      />
      <DeleteDialog />
    </>
  )
}
