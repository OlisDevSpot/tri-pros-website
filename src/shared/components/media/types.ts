import type { ReactNode } from 'react'

/** Owner-agnostic media item. Owner-specific fields (phase/hero/visibility) live behind DI slots, not here. */
export interface MediaItem {
  id: number
  name: string
  mimeType: string
  /** Best display URL (project: public variant/original; proposal: presigned). Used by the DEFAULT thumbnail; a consumer may ignore it in a custom renderThumbnail. */
  url: string
  blurDataUrl?: string | null
  optimizationStatus?: string
  sortOrder?: number
}

/** A named group of items (project: a phase; proposal: a visibility bucket). */
export interface MediaGroup {
  key: string
  label: string
  items: MediaItem[]
}

export interface MediaManagerProps {
  groups: MediaGroup[]
  /** file-input accept string, e.g. 'image/*' or 'image/*,video/*,application/pdf'. */
  accept: string
  isUploading: boolean
  onUpload: (groupKey: string, files: File[]) => void
  onReorder: (groupKey: string, updates: { id: number, sortOrder: number }[]) => void
  onDelete: (id: number) => void
  onRename: (id: number, name: string) => void
  /** Render an item's thumbnail/preview (project: derives public-bucket image variants + retry UI; proposal: presigned img/video/pdf). */
  renderThumbnail: (item: MediaItem) => ReactNode
  /** Owner-specific per-item controls overlaid on the card (proposal: a visibility Switch). */
  renderControls?: (item: MediaItem) => ReactNode
  /** Owner-specific large preview for the detail dialog (project: public-bucket image variant with retry UI; proposal: presigned img/video/pdf). Defaults to a plain <img>. */
  renderPreview?: (item: MediaItem) => ReactNode
  /** Owner-specific extra rows in the detail dialog. */
  renderDetails?: (item: MediaItem) => ReactNode
  emptyLabel?: string
}
