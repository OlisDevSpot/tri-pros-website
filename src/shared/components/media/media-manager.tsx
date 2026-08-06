'use client'

import type { ChangeEvent } from 'react'
import type { MediaManagerProps } from './types'
import { useRef, useState } from 'react'
import { MediaCard } from './media-card'
import { MediaReorderGrid } from './media-reorder-grid'
import { MediaUploadButton } from './media-upload-button'

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
  renderDetails,
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
                      renderDetails={renderDetails}
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
