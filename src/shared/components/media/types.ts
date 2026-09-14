/** Owner-agnostic media item. Owner-specific fields (phase/hero/visibility) live behind DI slots, not here. */
export interface MediaItem {
  id: number
  name: string
  mimeType: string
  /** Best display URL (project: public variant/original; proposal: public variant/original, derived). Used by the DEFAULT thumbnail; a consumer may ignore it in a custom renderThumbnail. */
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
