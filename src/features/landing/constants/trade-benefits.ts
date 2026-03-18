interface TradeBenefit {
  title: string
  description: string
}

export const tradeBenefits: Record<string, TradeBenefit[]> = {
  'hvac': [
    { title: 'Lower Utility Bills', description: 'High-SEER systems that cut heating and cooling costs dramatically' },
    { title: 'Consistent Comfort', description: 'Even temperatures throughout your home, every room, every season' },
    { title: 'Reduced Carbon Footprint', description: 'Energy-efficient units that are better for your home and the environment' },
    { title: 'Rebate Eligible', description: 'Qualifies for federal tax credits and utility company rebates' },
  ],
  'roof-and-gutters': [
    { title: 'Weather Protection', description: 'Complete protection from rain, wind, and sun for decades' },
    { title: 'Energy Efficiency', description: 'Cool roof systems that reflect heat and reduce cooling costs' },
    { title: 'Curb Appeal', description: 'A new roof dramatically improves how your home looks from the street' },
    { title: 'Home Value', description: 'One of the highest-ROI improvements for resale' },
  ],
  'windows-and-doors': [
    { title: 'Lower Utility Bills', description: 'Reduced heat gain and loss through dual or triple-pane glass' },
    { title: 'Quieter Living Spaces', description: 'Significant noise reduction from outside' },
    { title: 'Enhanced Security', description: 'Modern frames and locking mechanisms' },
    { title: 'Consistent Comfort', description: 'No more drafts or hot spots near windows' },
  ],
  'attic-and-basement': [
    { title: 'Immediate Comfort', description: 'Notice the temperature difference the same day' },
    { title: '20-40% Bill Reduction', description: 'Significant heating and cooling cost savings' },
    { title: 'Eliminated Drafts', description: 'No more cold spots or inconsistent temperatures' },
    { title: 'Rebate Eligible', description: 'Qualifies for federal and utility rebate programs' },
  ],
  'solar': [
    { title: 'Eliminate Your Bill', description: 'Monthly electricity bill reduction or complete elimination' },
    { title: 'Fixed Energy Costs', description: 'Lock in your rate for 25+ years while utility rates rise' },
    { title: 'Federal Tax Credit', description: 'Significant ITC eligibility reduces total project cost' },
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
