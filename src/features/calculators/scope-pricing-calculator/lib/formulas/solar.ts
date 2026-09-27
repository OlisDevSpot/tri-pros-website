import { defineFormula } from '@/features/calculators/scope-pricing-calculator/lib/define-formula'

export const installPanels = defineFormula({
  key: 'installPanels',
  trade: 'solar',
  label: 'Install Panels',
  outcome: 'Generate your own power and cut dependence on the grid',
  variables: ['numPanels', 'wattsPerPanel'],
  compute({ numPanels, wattsPerPanel }, _context, costs) {
    return numPanels * wattsPerPanel * costs.dollarPerWatt
  },
})

export const rnrPanels = defineFormula({
  key: 'rnrPanels',
  trade: 'solar',
  label: 'Remove & Reinstall Panels',
  outcome: 'Safely remove and reinstall your solar system so roof work can proceed without damaging equipment',
  variables: ['numPanels'],
  defaults: { numPanels: 0 },
  compute({ numPanels }, _context, costs) {
    return numPanels * costs.dollarPerPanelRnr
  },
})

export const installBattery = defineFormula({
  key: 'installBattery',
  trade: 'solar',
  label: 'Install Battery',
  outcome: 'Store excess solar energy and keep your home powered during outages',
  variables: ['numBatteries', 'kWhPerBattery'],
  compute({ numBatteries, kWhPerBattery }, _context, costs) {
    const perBattery = kWhPerBattery === 5 ? costs.battery5kWh : costs.battery10kWh
    return numBatteries * perBattery
  },
})
