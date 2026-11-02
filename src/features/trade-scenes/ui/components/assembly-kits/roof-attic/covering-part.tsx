'use client'

import type { PartRendererProps } from '@/features/trade-scenes/types'

import { KIT_COVERING_COLORS, KIT_FLAT_COVERINGS, KIT_SLOPE_FACES } from '@/features/trade-scenes/constants/roof-attic-kit'
import { FlatMembraneCovering } from '@/features/trade-scenes/ui/components/assembly-kits/roof-attic/flat-membrane-covering'
import { ShingleCovering } from '@/features/trade-scenes/ui/components/assembly-kits/roof-attic/shingle-covering'
import { SlopeFrame } from '@/features/trade-scenes/ui/components/assembly-kits/roof-attic/slope-frame'
import { TileCovering } from '@/features/trade-scenes/ui/components/assembly-kits/roof-attic/tile-covering'
import { WoodShakeCovering } from '@/features/trade-scenes/ui/components/assembly-kits/roof-attic/wood-shake-covering'

// The roof's surface, drawn per covering so each one is recognisable: the cool versions are the same pieces, lighter.
export function CoveringPart({ material, condition }: PartRendererProps) {
  const worn = condition === 'worn'
  const colours = KIT_COVERING_COLORS[material] ?? KIT_COVERING_COLORS.shingle
  const color = worn ? colours.worn : colours.new

  // The covering decides the form: the resolver only lays a material on the form it is built for.
  if (KIT_FLAT_COVERINGS.includes(material)) {
    return <FlatMembraneCovering worn={worn} cool={material === 'cool-membrane'} color={color} />
  }
  return (
    <>
      {KIT_SLOPE_FACES.map(face => (
        <SlopeFrame key={face} face={face}>
          {material === 'tile' && <TileCovering face={face} worn={worn} color={color} />}
          {material === 'wood-shake' && <WoodShakeCovering face={face} worn={worn} color={color} />}
          {material !== 'tile' && material !== 'wood-shake' && <ShingleCovering face={face} worn={worn} color={color} />}
        </SlopeFrame>
      ))}
    </>
  )
}
