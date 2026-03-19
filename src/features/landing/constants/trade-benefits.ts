// src/features/landing/constants/trade-benefits.ts
export interface TradeBenefit {
  title: string
  description: string
  stat?: string
}

export const tradeBenefits: Partial<Record<string, TradeBenefit[]>> = {
  'hvac': [
    { title: 'Lower Utility Bills', description: 'High-SEER systems that cut heating and cooling costs dramatically', stat: '–40–60%' },
    { title: 'Consistent Comfort', description: 'Even temperatures throughout your home, every room, every season' },
    { title: 'Reduced Carbon Footprint', description: 'Energy-efficient units that are better for your home and the environment' },
    { title: 'Rebate Eligible', description: 'Qualifies for federal tax credits and utility company rebates', stat: 'Up to $3,200' },
  ],
  'roof-and-gutters': [
    { title: 'Lifespan', description: 'Complete protection from rain, wind, and sun for decades', stat: '30 years' },
    { title: 'Energy Efficiency', description: 'Cool roof systems that reflect heat and reduce cooling costs' },
    { title: 'Curb Appeal', description: 'A new roof dramatically improves how your home looks from the street' },
    { title: 'Home Value', description: 'One of the highest-ROI improvements for resale' },
  ],
  'windows-and-doors': [
    { title: 'Lower Utility Bills', description: 'Reduced heat gain and loss through dual or triple-pane glass', stat: '–15–25%' },
    { title: 'Quieter Living Spaces', description: 'Significant noise reduction from outside' },
    { title: 'Enhanced Security', description: 'Modern frames and locking mechanisms' },
    { title: 'Consistent Comfort', description: 'No more drafts or hot spots near windows' },
  ],
  'attic-and-basement': [
    { title: 'Immediate Comfort', description: 'Notice the temperature difference the same day', stat: 'Same day' },
    { title: 'Energy Bill Reduction', description: 'Significant heating and cooling cost savings', stat: '–20–40%' },
    { title: 'Annual Savings', description: 'Real dollar savings that compound year over year', stat: '$1,400+ avg' },
    { title: 'Federal Tax Credit', description: 'Qualifies for federal and utility rebate programs', stat: '30%' },
  ],
  'solar': [
    { title: 'Bill Elimination', description: 'Monthly electricity bill reduction or complete elimination', stat: '~100%' },
    { title: 'Rate Lock', description: 'Lock in your rate for 25+ years while utility rates rise', stat: '25 years' },
    { title: 'Federal Tax Credit', description: 'Significant ITC eligibility reduces total project cost', stat: '30%' },
    { title: 'Increased Home Value', description: 'Solar adds measurable resale value' },
  ],
  'kitchen-remodel': [
    { title: 'Highest ROI', description: 'Kitchen remodels return 60-80% at resale — the best of any room' },
    { title: 'Daily Lifestyle Upgrade', description: 'A functional, beautiful kitchen transforms how you live' },
    { title: 'Modern Functionality', description: 'Soft-close cabinetry, quartz countertops, optimized layouts' },
  ],
  'bathroom-remodel': [
    { title: 'Daily Comfort', description: 'A space you enjoy using every single day' },
    { title: 'Resale Value', description: 'Updated bathrooms are the #1 thing buyers look for' },
    { title: 'Modern Aesthetic', description: 'Frameless glass, modern tile, premium fixtures' },
  ],
  'flooring': [
    { title: 'Whole-Home Transformation', description: 'New floors change how every room looks and feels' },
    { title: 'Durability', description: 'Materials that stand up to daily life for years' },
    { title: 'Easy Maintenance', description: 'Modern flooring options that are simple to clean and maintain' },
  ],
}
