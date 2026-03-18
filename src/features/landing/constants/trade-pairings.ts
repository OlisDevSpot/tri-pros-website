import type { PillarSlug } from '@/features/landing/lib/notion-trade-helpers'

interface TradePairing {
  pairedTradeSlug: string
  pairedTradeName: string
  pillarSlug: PillarSlug
  story: string
}

export const tradePairings: Record<string, TradePairing[]> = {
  'hvac': [
    { pairedTradeSlug: 'attic-and-basement', pairedTradeName: 'Insulation', pillarSlug: 'energy-efficient-construction', story: 'Sealing the envelope and upgrading the system — your energy bills drop dramatically both ways.' },
    { pairedTradeSlug: 'windows-and-doors', pairedTradeName: 'Windows & Doors', pillarSlug: 'energy-efficient-construction', story: 'Your new system won\'t have to fight through drafty windows — both upgrades work together.' },
  ],
  'roof-and-gutters': [
    { pairedTradeSlug: 'attic-and-basement', pairedTradeName: 'Insulation', pillarSlug: 'energy-efficient-construction', story: 'While the attic is open, we can upgrade insulation — one crew visit, compounding energy savings.' },
    { pairedTradeSlug: 'solar', pairedTradeName: 'Solar', pillarSlug: 'energy-efficient-construction', story: 'A new roof is the ideal foundation for solar — one installation sequence, better ROI.' },
  ],
  'attic-and-basement': [
    { pairedTradeSlug: 'hvac', pairedTradeName: 'HVAC', pillarSlug: 'energy-efficient-construction', story: 'Seal the envelope, upgrade the system. Your bills drop from both sides.' },
    { pairedTradeSlug: 'windows-and-doors', pairedTradeName: 'Windows & Doors', pillarSlug: 'energy-efficient-construction', story: 'Complete envelope sealing — the most cost-effective energy upgrade you can do.' },
  ],
  'windows-and-doors': [
    { pairedTradeSlug: 'attic-and-basement', pairedTradeName: 'Insulation', pillarSlug: 'energy-efficient-construction', story: 'Complete envelope sealing — the most cost-effective energy upgrade you can do.' },
    { pairedTradeSlug: 'hvac', pairedTradeName: 'HVAC', pillarSlug: 'energy-efficient-construction', story: 'Your new system won\'t have to fight through drafty windows — both upgrades work together.' },
  ],
  'solar': [
    { pairedTradeSlug: 'roof-and-gutters', pairedTradeName: 'Roof & Gutters', pillarSlug: 'energy-efficient-construction', story: 'A new roof is the ideal foundation for solar — one install, better ROI.' },
  ],
  'bathroom-remodel': [
    { pairedTradeSlug: 'flooring', pairedTradeName: 'Flooring', pillarSlug: 'luxury-renovations', story: 'Updating the bathroom? The transition to new flooring in the hallway is natural and seamless.' },
  ],
  'kitchen-remodel': [
    { pairedTradeSlug: 'patch-and-interior-paint', pairedTradeName: 'Interior Paint', pillarSlug: 'luxury-renovations', story: 'A remodeled kitchen paired with fresh paint transforms how the whole home feels.' },
    { pairedTradeSlug: 'flooring', pairedTradeName: 'Flooring', pillarSlug: 'luxury-renovations', story: 'New kitchen floors flow naturally into the rest of your home.' },
  ],
  'adu': [
    { pairedTradeSlug: 'engineering-plans-and-blueprints', pairedTradeName: 'Engineering & Plans', pillarSlug: 'luxury-renovations', story: 'From blueprints to finished unit — one team, one process.' },
  ],
  'flooring': [
    { pairedTradeSlug: 'bathroom-remodel', pairedTradeName: 'Bathroom Remodel', pillarSlug: 'luxury-renovations', story: 'As long as we\'re updating the bathroom, the transition to new flooring is natural and seamless.' },
  ],
}
