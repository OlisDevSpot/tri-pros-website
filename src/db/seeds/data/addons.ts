import type { InsertAddon } from '@/db/schema'
import type { TradeAccessor } from '@/db/types'

export const addonsData = [
  {
    label: 'Attic air sealing',
    accessor: 'atticAirSealing',
    description: 'Prevent draft, dust, and heat from entering your home from the attic',
    imageUrl: 'https://res.cloudinary.com/doyafbzya/image/upload/v1764005941/air-sealing_bctbmk.jpg',
    tradeAccessor: 'atticBasement',
  },
  {
    label: 'Install attic fan',
    accessor: 'atticFan',
    description: 'Improve your home\'s ventilation and energy efficiency by installing an attic fan to keep your space cooler and more comfortable',
    imageUrl: 'https://res.cloudinary.com/doyafbzya/image/upload/v1756346660/attic-fan_ajlrdt.webp',
    tradeAccessor: 'atticBasement',
  },
  {
    label: 'Install radiant barrier',
    accessor: 'radiantBarrier',
    description: 'Boost your home\'s energy efficiency and reduce cooling costs by installing a radiant barrier in your attic',
    imageUrl: 'https://res.cloudinary.com/doyafbzya/image/upload/v1756346660/radiant-barrier_fq7118.webp',
    tradeAccessor: 'atticBasement',
  },
  {
    label: 'Install drip system',
    accessor: 'installDripSystem',
    description: 'Low maintenence, low cost watering system',
    imageUrl: 'https://res.cloudinary.com/doyafbzya/image/upload/v1764006767/drip-system_nhtveo.jpg',
    tradeAccessor: 'dryscapingHardscaping',
  },
  {
    label: 'Install small plants',
    accessor: 'installSmallPlants',
    description: 'Low maintenence, small plants',
    imageUrl: 'https://res.cloudinary.com/doyafbzya/image/upload/v1764021057/small-plants_owhwfm.jpg',
    tradeAccessor: 'dryscapingHardscaping',
  },
  {
    label: 'Facia Boards Replacement',
    accessor: 'replaceFasciaBoards',
    description: 'Boost your home\'s curb appeal with modern facia boards',
    imageUrl: 'https://res.cloudinary.com/doyafbzya/image/upload/v1756346660/fascia-board-replacement_gw8owg.webp',
    tradeAccessor: 'roof',
  },
  {
    label: 'Facia Boards Repaint',
    accessor: 'repaintFasciaBoards',
    description: 'Boost your home\'s curb appeal with modern facia boards6389p',
    imageUrl: 'https://res.cloudinary.com/doyafbzya/image/upload/v1756346660/fascia-board-repaint_zsnxhp.jpg',
    tradeAccessor: 'exteriorPaintSiding',
  },
  {
    label: 'Gutters trade',
    accessor: 'tradeGutters',
    description: 'Boost yard appeal with new retaining wall',
    imageUrl: 'https://res.cloudinary.com/doyafbzya/image/upload/v1756346660/gutter-replacement-2_xbly5l.webp',
    tradeAccessor: 'roof',
  },
  {
    label: 'Ducting replacement',
    accessor: 'replaceDucts',
    description: 'Trade the energy efficiency of your ducts',
    imageUrl: 'https://res.cloudinary.com/doyafbzya/image/upload/v1757092099/duct-replacement_xkoil9.webp',
    tradeAccessor: 'hvac',
  },
] as const satisfies (Omit<InsertAddon, 'tradeId'> & { tradeAccessor: TradeAccessor })[]
