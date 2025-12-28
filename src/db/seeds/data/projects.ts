import type { InsertProject } from '@/db/schema'
import type { InsertMediaFilesSchema } from '@/db/schema/media-files'

export const projectsData = [
  {
    title: 'Altura',
    accessor: 'altura',
    description: 'A luxurious finish for a modern kitchen',
    city: 'Arcadia',
    mediaFiles: [],
  },
  {
    title: 'Atlas',
    accessor: 'atlas',
    description: 'Bold and modern design for a long-lasting covered patio - Beverly Hills, CA',
    city: 'Beverly Hills',
    mediaFiles: [],
  },
  {
    title: 'Bliss',
    accessor: 'bliss',
    description: '',
    city: 'Laguna Hills',
    mediaFiles: [],
  },
  {
    title: 'Oasis',
    accessor: 'oasis',
    description: '',
    city: 'Los Angeles',
    mediaFiles: [],
  },
  {
    title: 'Olympia',
    accessor: 'olympia',
    description: 'A stunning and functional finish inpsired by Inoko-Sato Architecture principles',
    city: 'Sherman Oaks',
    mediaFiles: [],
  },
  {
    title: 'Riviera',
    accessor: 'riviera',
    description: 'Mini-pebble, Baja, and spa for finish for the modern pool experience- Indio, CA',
    city: 'Indio',
    mediaFiles: [],
  },
] as const satisfies (InsertProject & {
  mediaFiles?: InsertMediaFilesSchema[]
})[]
