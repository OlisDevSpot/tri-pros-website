import { defineFormula } from '@/features/calculators/scope-pricing-calculator/lib/define-formula'

export const installArtificial = defineFormula({
  key: 'installArtificial',
  trade: 'dryscapingHardscaping',
  label: 'Install Artificial',
  outcome: 'Eliminate lawn maintenance and save water with year-round, lush-looking artificial turf',
  variables: ['installSqFt'],
  compute({ installSqFt }, _context, costs) {
    return installSqFt * costs.dollarPerSqFtArtificial
  },
})

export const installGravel = defineFormula({
  key: 'installGravel',
  trade: 'dryscapingHardscaping',
  label: 'Install Gravel',
  outcome: 'Create a clean, low-maintenance landscape that improves drainage and curb appeal',
  variables: ['installSqFt'],
  compute({ installSqFt }, _context, costs) {
    return installSqFt * costs.dollarPerSqFtGravel
  },
})

export const installMulch = defineFormula({
  key: 'installMulch',
  trade: 'dryscapingHardscaping',
  label: 'Install Mulch',
  outcome: 'Refresh your yard with a clean, moisture-retaining mulch layer that boosts plant health and appearance',
  variables: ['installSqFt'],
  compute({ installSqFt }, _context, costs) {
    return installSqFt * costs.dollarPerSqFtMulch
  },
})

export const installConcrete = defineFormula({
  key: 'installConcrete',
  trade: 'dryscapingHardscaping',
  label: 'Install Concrete',
  outcome: 'Add a solid, long-lasting concrete surface that improves function, durability, and property value',
  variables: ['installSqFt'],
  compute({ installSqFt }, _context, costs) {
    return installSqFt * costs.dollarPerSqFtConcrete
  },
})

export const installPavers = defineFormula({
  key: 'installPavers',
  trade: 'dryscapingHardscaping',
  label: 'Install Pavers',
  outcome: 'Upgrade outdoor areas with elegant, long-lasting pavers that enhance aesthetics and usability',
  variables: ['installSqFt'],
  compute({ installSqFt }, _context, costs) {
    return installSqFt * costs.dollarPerSqFtPavers
  },
})

export const installDg = defineFormula({
  key: 'installDg',
  trade: 'dryscapingHardscaping',
  label: 'Install DG',
  outcome: 'Give your yard a durable, desert-modern look while reducing maintenance and water use',
  variables: ['installSqFt'],
  compute({ installSqFt }, _context, costs) {
    return installSqFt * costs.dollarPerSqFtDg
  },
})
