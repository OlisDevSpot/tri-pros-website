import type { InsertMaterial } from '@/shared/db/schema'

export const materialsData = [
  {
    label: 'Fiberglass Batts',
    accessor: 'fiberglassBatts',
    description: 'Insulation material made from fine glass fibers, providing thermal and sound insulation. Batts',
    imageUrl: 'https://ritewayinsulationcompany.com/wp-content/uploads/2021/08/batted-insulation.jpg',
  },
  {
    label: 'Fiberglass Blown',
    accessor: 'fiberglassBlown',
    description: 'Insulation material made from fine glass fibers, providing thermal and sound insulation. Blown',
    imageUrl: 'https://homecomfortinsulation.com/image/37/1000/iStock-183779679.jpg',
  },
  {
    label: 'Cellulose',
    accessor: 'cellulose',
    description: 'An eco-friendly insulation material made from recycled paper, treated for fire and pest resistance.',
    imageUrl: 'https://images.thdstatic.com/productImages/a30b442a-37a5-4332-b7b0-d3201f161fbe/svn/greenfiber-blown-in-insulation-inssanc-fa_600.jpg',
  },
  {
    label: 'Artificial Turf',
    accessor: 'artificialTurf',
    description: 'Synthetic grass designed to mimic natural grass, commonly used in landscaping and sports fields.',
    imageUrl: 'https://www.synlawn.com/wp-content/uploads/2024/01/synlawn-los-angeles-earth-design-landscape-turf-la.jpg',
  },
  {
    label: 'Red Mulch',
    accessor: 'redMulch',
    description: 'A layer of organic or inorganic material applied to soil to retain moisture and suppress weeds.',
    imageUrl: 'https://bayaggregates.com/wp-content/uploads/2023/01/red-mulch.jpg',
  },
  {
    label: 'Black Mulch',
    accessor: 'blackMulch',
    description: 'A layer of organic or inorganic material applied to soil to retain moisture and suppress weeds.',
    imageUrl: 'https://i.pinimg.com/474x/d1/00/a1/d100a1dd8be9408d3f20be69b11ce2eb.jpg',
  },
  {
    label: 'Gravel',
    accessor: 'gravel',
    description: 'Small, loose rock fragments used for driveways, landscaping, and drainage applications.',
    imageUrl: 'https://media.angi.com/s3fs-public/Walkway-white-gravel-491096017-.jpeg',
  },
  {
    label: 'Decomposed Granite',
    accessor: 'decomposedGranite',
    description: 'A compactable material made of weathered granite, ideal for pathways and landscaping.',
    imageUrl: 'https://www.floresartscape.com/upload/decomposed-granite-garden.jpeg',
  },
  {
    label: 'River Rocks',
    accessor: 'riverRocks',
    description: 'Smooth, naturally rounded stones commonly used for decorative landscaping and drainage.',
    imageUrl: 'https://worldofstonesusa.com/cdn/shop/articles/river-rock-landscaping-ideas-scaled_2048x2048.webp?v=1720607359',
  },
  {
    label: 'Concrete',
    accessor: 'concrete',
    description: 'A durable building material composed of cement, sand, and gravel, used for foundations and structures.',
    imageUrl: 'https://images.landscapingnetwork.com/pictures/images/900x705Max/site_8/colored-concrete-quality-living-landscape_4504.jpg',
  },
  {
    label: 'Pavers',
    accessor: 'pavers',
    description: 'Interlocking stone or concrete blocks used for patios, walkways, and driveways.',
    imageUrl: 'https://i.pinimg.com/originals/95/74/0c/95740cb8e935fca367742d45c4fc539f.png',
  },
  {
    label: 'Cool Shingles',
    accessor: 'coolShingles',
    description: 'A reflective roofing material designed to reduce heat absorption and improve energy efficiency.',
    imageUrl: 'https://www.rapidrestoreny.com/wp-content/uploads/2022/05/Cool-Roof-Shingles-3.jpeg',
  },
  {
    label: 'Torch Down',
    accessor: 'torchDown',
    description: 'A reflective roofing material designed to reduce heat absorption and improve energy efficiency.',
    imageUrl: 'https://cdn.prod.website-files.com/64d655ee953196171381bee7/658c909161cdc354342facab_torch-down-roofing-guide-materials-installation-benefits-and-disadvantages.webp',
  },
  {
    label: 'Clay Tiles',
    accessor: 'clayTile',
    description: 'A roofing system made from clay or concrete tiles, known for durability and aesthetic appeal.',
    imageUrl: 'https://sunvena.com/wp-content/uploads/2023/03/can-you-install-solar-spanish-tile-roof.jpeg',
  },
  {
    label: 'Concrete Tiles',
    accessor: 'concreteTiles',
    description: 'A solid and durable roofing system made of reinforced concrete, ideal for structural strength.',
    imageUrl: 'https://cimg0.ibsrv.net/cimg/www.doityourself.com/660x300_85-1/260/Concrete-roof-tile-140260.jpg',
  },
  {
    label: 'Metal Roof',
    accessor: 'metalRoof',
    description: 'A long-lasting and energy-efficient roofing material made from metal sheets or panels.',
    imageUrl: 'https://www.roofingcontractor.com/ext/resources/Issues/2020/October/CostOfMetal_Img01.jpg?height=635&t=1602532060&width=1200',
  },
  {
    label: 'Cool Life Paint',
    accessor: 'coolLifePaint',
    description: 'Paint your home',
    imageUrl: 'https://contentgrid.homedepot-static.com/hdus/en_US/DTCCOMNEW/Articles/painting-the-exterior-of-our-house-with-the-projectcolor-app-hero.jpg',
  },
  {
    label: 'Water Paint',
    accessor: 'waterPaint',
    description: 'Paint your home with basic water paint',
    imageUrl: 'https://s7d2.scene7.com/is/image/sherwinwilliams/modern-house-sw-6148-wool-skein-sw-7540-artisan-tan-sw-7034-status-bronze?qlt=82&wid=1024&ts=1704770447288&dpr=off',
  },
] as const satisfies InsertMaterial[]
