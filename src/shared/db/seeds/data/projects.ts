import type { InsertProject } from '@/shared/db/schema'
import type { InsertProjectMediaFilesSchema } from '@/shared/db/schema/project-media-files'

export const projectsData = [
  {
    title: 'Altura',
    accessor: 'altura',
    description: 'Letting your frontyard do the talking',
    city: 'Lancaster',
    hoRequirements: ['Make parking space wider', 'open up space', 'increase curb appeal', 'reduce maintenance'],
    projectMediaFiles: [],
  },
  {
    title: 'Atlas',
    accessor: 'atlas',
    description: 'Bold and modern design for a long-lasting covered patio',
    city: 'Beverly Hills',
    projectMediaFiles: [],
  },
  {
    title: 'Bliss',
    accessor: 'bliss',
    description: '',
    city: 'Laguna Hills',
    projectMediaFiles: [],
  },
  {
    title: 'Oasis',
    accessor: 'oasis',
    description: '',
    city: 'Los Angeles',
    projectMediaFiles: [],
  },
  {
    title: 'Olympia',
    accessor: 'olympia',
    description: 'A stunning and functional finish inpsired by Inoko-Sato Architecture principles',
    city: 'Sherman Oaks',
    projectMediaFiles: [],
  },
  {
    title: 'Riviera',
    accessor: 'riviera',
    description: 'Mini-pebble, Baja, and spa for finish for the modern pool experience- Indio, CA',
    city: 'Indio',
    projectMediaFiles: [],
  },
  {
    title: 'Verona',
    accessor: 'verona',
    description: 'A luxurious finish for a modern kitchen',
    city: 'Arcadia',
    projectMediaFiles: [],
  },
] as const satisfies (InsertProject & {
  projectMediaFiles?: InsertProjectMediaFilesSchema[]
})[]
