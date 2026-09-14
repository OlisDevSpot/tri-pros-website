'use client'

import type { ChangeEvent, ReactNode } from 'react'
import type { MediaGroup, MediaItem } from './types'
import { useRef, useState } from 'react'
import { MediaCard } from './media-card'
import { MediaReorderGrid } from './media-reorder-grid'
import { MediaUploadButton } from './media-upload-button'

export interface MediaManagerProps {
  groups: MediaGroup[]
  /** file-input accept string, e.g. 'image/*' or 'image/*,video/*,application/pdf'. */
  accept: string
  isUploading: boolean
  onUpload: (groupKey: string, files: File[]) => void
  onReorder: (groupKey: string, updates: { id: number, sortOrder: number }[]) => void
  onDelete: (id: number) => void
  onRename: (id: number, name: string) => void
  /** Render an item's thumbnail/preview (project: derives public-bucket image variants + retry UI; proposal: OptimizedImage / public video+pdf). */
  renderThumbnail: (item: MediaItem) => ReactNode
  /** Owner-specific per-item controls overlaid on the card (proposal: a visibility Switch). Receives the card's internal `menuOpen` so a control can stay visible while the more-menu is open. */
  renderControls?: (item: MediaItem, state: { menuOpen: boolean }) => ReactNode
  /** Owner-specific large preview for the detail dialog (project: public-bucket image variant with retry UI; proposal: OptimizedImage / public video+pdf). Defaults to a plain <img>. */
  renderPreview?: (item: MediaItem) => ReactNode
  /** Owner-specific extra rows in the detail dialog. */
  renderDetails?: (item: MediaItem) => ReactNode
  /** Owner-specific menu items injected into each card's more-menu between "View Details" and "Delete" (project: Move-to-phase submenu). */
  renderMenuItems?: (item: MediaItem) => ReactNode
  emptyLabel?: string
}

/**
 * Simple stacked DI orchestrator — one header + upload button + reorder grid per group.
 * NO tabs, NO bulk toolbar, NO multi-select: the richer project photo manager composes
 * MediaCard/MediaReorderGrid/MediaUploadButton directly for those needs. This manager
 * serves the proposal Files tab (and any similarly simple consumer).
 */
export function MediaManager({
  groups,
  accept,
  isUploading,
  onUpload,
  onReorder,
  onDelete,
  onRename,
  renderThumbnail,
  renderControls,
  renderPreview,
  renderDetails,
  renderMenuItems,
  emptyLabel = 'No files yet',
}: MediaManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null)

  function handleUploadClick(groupKey: string) {
    setActiveGroupKey(groupKey)
    fileInputRef.current?.click()
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0 || !activeGroupKey) {
      return
    }

    const fileList = Array.from(files)
    e.target.value = ''
    onUpload(activeGroupKey, fileList)
  }

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {groups.map(group => (
        <div key={group.key} className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">
              {group.label}
              {' ('}
              {group.items.length}
              )
            </h3>
            <MediaUploadButton
              onLocalUpload={() => handleUploadClick(group.key)}
              isUploading={isUploading}
            />
          </div>

          {group.items.length === 0
            ? (
                <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                  {emptyLabel}
                </div>
              )
            : (
                <MediaReorderGrid
                  items={group.items}
                  onReorder={updates => onReorder(group.key, updates)}
                  renderItem={(item, dnd) => (
                    <MediaCard
                      item={item}
                      renderThumbnail={renderThumbnail}
                      renderControls={renderControls}
                      renderPreview={renderPreview}
                      renderDetails={renderDetails}
                      renderMenuItems={renderMenuItems}
                      onRename={onRename}
                      onDelete={onDelete}
                      dragHandleProps={dnd.dragHandleProps}
                      isDragging={dnd.isDragging}
                      isGroupDragged={dnd.isGroupDragged}
                    />
                  )}
                />
              )}
        </div>
      ))}
    </div>
  )
}
