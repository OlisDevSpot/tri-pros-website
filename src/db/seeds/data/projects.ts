import type { InsertProject } from '@/db/schema'
import type { InsertMediaFilesSchema } from '@/db/schema/media-files'

export const projects = [
  {
    title: 'Bliss',
    accessor: 'bliss',
    description: '',
    heroImage: '',
    mediaFiles: {
      before: [],
      during: [],
      after: [],
    },
  },
] as const satisfies (InsertProject & {
  mediaFiles?: {
    before: InsertMediaFilesSchema[]
    during: InsertMediaFilesSchema[]
    after: InsertMediaFilesSchema[]
  }
})[]
