import type { InsertTrade } from '@/shared/db/schema'

function generateAccessor(label: string) {
  return label
    .toLowerCase()
    .split(' ')
    .map(word => word.replace(/[^A-Z0-9]/gi, ''))
    .join('-')
}

export function generateObject(label: string, data: Partial<InsertTrade>) {
  return {
    label,
    accessor: data.accessor ?? generateAccessor(label),
    description: data.description,
    imageUrl: data.imageUrl ?? '',
    location: data.location,
  }
}

export const trades = [
  'Addition',
  'ADU',
  'Attic & Basement',
  'Bathroom',
  'Blueprints & Engineering',
  'Dryscaping & Hardscaping',
  'Electricals',
  'Exterior features',
  'Exterior paint & Siding',
  'Flooring',
  'Hazardous materials',
  'HVAC',
  'Interior paint',
  'Kitchen',
  'Plumbing',
  'Roof',
  'Solar',
  'Windows & Doors',
] as const

export const tradesData = [
  {
    accessor: 'addition',
    slug: 'addition',
    label: 'Addition',
    description: 'Addition keeps you added!',
    imageUrl: 'https://res.cloudinary.com/doyafbzya/image/upload/v1757819502/addition_ur6k1o.jpg',
    location: 'lot',
  },
  {
    accessor: 'adu',
    slug: 'adu',
    label: 'ADU',
    description: 'ADU keeps you rented!',
    imageUrl: 'https://res.cloudinary.com/doyafbzya/image/upload/v1757819503/adu_noeuiz.png',
    location: 'lot',
  },
  {
    accessor: 'atticBasement',
    slug: 'attic-basement',
    label: 'Attic & Basement',
    description: 'Insulation keeps you cool',
    imageUrl: 'https://res.cloudinary.com/doyafbzya/image/upload/v1755028714/attic-basement_uibgqr.webp',
    location: 'exterior',
  },
  {
    accessor: 'bathroom',
    slug: 'bathroom',
    label: 'Bathroom',
    description: 'Lets trade your bathroom, yo!',
    imageUrl: 'https://res.cloudinary.com/doyafbzya/image/upload/v1757819502/bathroom-remodel_js5yfu.jpg',
    location: 'interior',
  },
  {
    accessor: 'blueprintsEngineering',
    slug: 'blueprints-engineering',
    label: 'Blueprints & Engineering',
    description: 'Let\'s build cool stuff',
    imageUrl: 'https://res.cloudinary.com/doyafbzya/image/upload/v1764008156/blueprints_cmekto.jpg',
    location: 'lot',
  },
  {
    accessor: 'dryscapingHardscaping',
    slug: 'dryscaping-hardscaping',
    label: 'Dryscaping & Hardscaping',
    description: 'Dryscaping keeps you sexy',
    imageUrl: 'https://res.cloudinary.com/doyafbzya/image/upload/v1755028716/dryscaping-hardscaping_tujkml.webp',
    location: 'lot',
  },
  {
    accessor: 'electricals',
    slug: 'electricals',
    label: 'Electricals',
    description: 'Electricals keeps you powered',
    imageUrl: 'https://res.cloudinary.com/doyafbzya/image/upload/v1755029298/electricals_xjbtdn.jpg',
    location: 'interior',
  },
  {
    accessor: 'exteriorFeatures',
    slug: 'exterior-features',
    label: 'Exterior Features',
    description: 'Functional & modern exterior features to enhance your home\'s usablity',
    imageUrl: 'https://res.cloudinary.com/doyafbzya/image/upload/v1764008249/exterior-features_sjcjku.jpg',
    location: 'lot',
  },
  {
    accessor: 'exteriorPaintSiding',
    slug: 'exterior-paint-siding',
    label: 'Exterior Paint & Siding',
    description: 'Exterior Paint and siding keeps you slick',
    imageUrl: 'https://res.cloudinary.com/doyafbzya/image/upload/v1755028718/exterior-paint_bs9s9t.jpg',
    location: 'exterior',
  },
  {
    accessor: 'flooring',
    slug: 'flooring',
    label: 'Flooring',
    description: 'Flooring keeps you clean',
    imageUrl: 'https://res.cloudinary.com/doyafbzya/image/upload/v1757819502/flooring_wfymku.webp',
    location: 'interior',
  },
  {
    accessor: 'hazardousMaterials',
    slug: 'hazardous-materials',
    label: 'Hazardous Materials',
    description: 'Hazardous materials must be removed!',
    imageUrl: 'https://res.cloudinary.com/doyafbzya/image/upload/v1764008002/hazardous-materials_ltz5wj.jpg',
    location: 'interior',
  },
  {
    accessor: 'hvac',
    slug: 'hvac',
    label: 'HVAC',
    description: 'HVAC keeps you cool',
    imageUrl: 'https://res.cloudinary.com/doyafbzya/image/upload/v1755029136/hvac_k3dvn6.jpg',
    location: 'exterior',
  },
  {
    accessor: 'interiorPaint',
    slug: 'interior-paint',
    label: 'Interior Paint',
    description: 'Interior Paint keeps you sexy',
    imageUrl: 'https://res.cloudinary.com/doyafbzya/image/upload/v1755028718/interior-paint_iouz5x.jpg',
    location: 'interior',
  },
  {
    accessor: 'kitchen',
    slug: 'kitchen',
    label: 'Kitchen',
    description: 'Lets upgrade your kitchen, yo!',
    imageUrl: 'https://res.cloudinary.com/doyafbzya/image/upload/v1757819502/kitchen-remodel_ym35op.webp',
    location: 'interior',
  },
  {
    accessor: 'plumbing',
    slug: 'plumbing',
    label: 'Plumbing',
    description: 'Plumbing keeps you clean',
    imageUrl: 'https://res.cloudinary.com/doyafbzya/image/upload/v1757819502/plumbing_fathw4.jpg',
    location: 'interior',
  },
  {
    accessor: 'roof',
    slug: 'roof',
    label: 'Roof',
    description: 'Roof keeps you dry',
    imageUrl: 'https://res.cloudinary.com/doyafbzya/image/upload/v1755028717/roof_fln0s3.webp',
    location: 'exterior',
  },
  {
    accessor: 'solar',
    slug: 'solar',
    label: 'Solar',
    description: 'Install a new solar system',
    imageUrl: 'https://res.cloudinary.com/doyafbzya/image/upload/v1755028717/solar_oef06y.jpg',
    location: 'exterior',
  },
  {
    accessor: 'windows',
    slug: 'windows',
    label: 'Windows',
    description: 'Windows keeps you reflected',
    imageUrl: 'https://res.cloudinary.com/doyafbzya/image/upload/v1755028803/windows_upwmem.jpg',
    location: 'exterior',
  },
] as const satisfies InsertTrade[]
