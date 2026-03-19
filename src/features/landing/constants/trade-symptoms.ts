// src/features/landing/constants/trade-symptoms.ts
// Energy pillar trades only (8). Sparse lookup — return [] at call site if not found.
export const tradeSymptoms: Partial<Record<string, string[]>> = {
  'hvac': [
    'Rooms that won\'t stay at the right temperature',
    'Energy bill over $250/mo',
    'AC running constantly in summer',
    'System is 10+ years old',
    'Uneven cooling room to room',
  ],
  'attic-and-basement': [
    'Rooms that won\'t stay warm in winter',
    'Heating bill keeps climbing',
    'Drafts near windows or doors',
    'Attic feels like an oven in summer',
    'AC runs all day and still can\'t keep up',
  ],
  'windows-and-doors': [
    'Drafts near windows even when closed',
    'Outside noise bleeds in constantly',
    'Condensation on the inside of glass',
    'Single-pane windows from the 80s or 90s',
  ],
  'roof-and-gutters': [
    'Worried about the next storm season',
    'Visible wear, missing shingles, or age 20+ years',
    'Gutters overflowing or pulling away',
    'Attic heat or moisture problems',
  ],
  'solar': [
    'Electricity bill over $200 every month',
    'Utility rates went up — again',
    'Watched your neighbor\'s bill drop to zero',
    'You own your home but still rent your energy',
    'AC season doubles your bill every year',
  ],
  'exterior-paint-stucco-and-siding': [
    'Paint peeling, cracking, or fading',
    'Stucco showing hairline cracks',
    'Wood rot or moisture damage along the trim',
    'Worried about moisture getting behind the walls',
    'A dated exterior that doesn\'t match the neighborhood',
  ],
  'water-heating': [
    'Waiting 3+ minutes for hot water to reach the shower',
    'Hot water runs out mid-shower',
    'Tank is 10+ years old',
    'High gas bill from constantly reheating a tank',
    'Low water pressure at fixtures',
  ],
  'dryscaping': [
    'Water bill spiking every summer',
    'A lawn that needs constant maintenance to look decent',
    'Water restrictions limiting what you can plant',
    'Patchy grass that never fully recovers',
    'HOA warnings about yard appearance',
  ],
}
