import type { MaterialAccessor } from '@/shared/db/types/materials'
import type { ScopeAccessor } from '@/shared/db/types/scopes'

export interface XScopeMaterial {
  scopeAccessor: ScopeAccessor
  materialAccessor: MaterialAccessor
  isMostPopular?: boolean
}

export const xScopeMaterialsData: XScopeMaterial[] = [
  {
    scopeAccessor: 'rnrAttic',
    materialAccessor: 'fiberglassBatts',
  },
  {
    scopeAccessor: 'rnrAttic',
    materialAccessor: 'fiberglassBlown',
    isMostPopular: true,
  },
  {
    scopeAccessor: 'rnrAttic',
    materialAccessor: 'cellulose',
  },
  {
    scopeAccessor: 'topOffAttic',
    materialAccessor: 'cellulose',
  },
  {
    scopeAccessor: 'topOffAttic',
    materialAccessor: 'fiberglassBlown',
    isMostPopular: true,
  },
  {
    scopeAccessor: 'installCrawlSpaceInsulation',
    materialAccessor: 'fiberglassBatts',
    isMostPopular: true,
  },
  {
    scopeAccessor: 'tearOff',
    materialAccessor: 'coolShingles',
    isMostPopular: true,
  },
  {
    scopeAccessor: 'tearOff',
    materialAccessor: 'metalRoof',
  },
  {
    scopeAccessor: 'tearOff',
    materialAccessor: 'clayTile',
  },
  {
    scopeAccessor: 'tearOff',
    materialAccessor: 'torchDown',
  },
  {
    scopeAccessor: 'redeck',
    materialAccessor: 'coolShingles',
    isMostPopular: true,
  },
  {
    scopeAccessor: 'redeck',
    materialAccessor: 'metalRoof',
  },
  {
    scopeAccessor: 'redeck',
    materialAccessor: 'clayTile',
  },
  {
    scopeAccessor: 'redeck',
    materialAccessor: 'torchDown',
  },
  {
    scopeAccessor: 'installArtificial',
    materialAccessor: 'artificialTurf',
    isMostPopular: true,
  },
  {
    scopeAccessor: 'installMulch',
    materialAccessor: 'redMulch',
    isMostPopular: true,
  },
  {
    scopeAccessor: 'installMulch',
    materialAccessor: 'blackMulch',
  },
  {
    scopeAccessor: 'installPavers',
    materialAccessor: 'pavers',
    isMostPopular: true,
  },
  {
    scopeAccessor: 'installConcrete',
    materialAccessor: 'concrete',
    isMostPopular: true,
  },
  {
    scopeAccessor: 'installGravel',
    materialAccessor: 'gravel',
    isMostPopular: true,
  },
  {
    scopeAccessor: 'installExteriorPaint',
    materialAccessor: 'coolLifePaint',
    isMostPopular: true,
  },
  {
    scopeAccessor: 'installExteriorPaint',
    materialAccessor: 'waterPaint',
  },
]
