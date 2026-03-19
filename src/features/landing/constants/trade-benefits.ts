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
  'exterior-paint-stucco-and-siding': [
    { title: 'Weather Protection', description: 'A sealed exterior keeps moisture, rot, and UV damage out' },
    { title: 'Curb Appeal', description: 'The single fastest way to change how your home looks from the street' },
    { title: 'Home Value', description: 'Fresh exterior paint and stucco consistently lift appraisal value' },
    { title: 'Moisture Control', description: 'Properly applied coatings prevent wall penetration and structural damage' },
  ],
  'water-heating': [
    { title: 'Energy Savings', description: 'Tankless and heat-pump systems dramatically cut water heating costs', stat: '–30–50%' },
    { title: 'Instant Hot Water', description: 'No more waiting — hot water at the fixture in seconds' },
    { title: 'System Lifespan', description: 'Modern water heaters outlast old tank units by years', stat: '20 years' },
    { title: 'Rebate Eligible', description: 'Heat-pump water heaters qualify for federal and utility rebates', stat: 'Up to $2,000' },
  ],
  'dryscaping': [
    { title: 'Water Bill Reduction', description: 'Drought-tolerant landscaping cuts outdoor water use significantly', stat: '–50–70%' },
    { title: 'Zero Maintenance Lawn', description: 'No mowing, no irrigation cycles, no seasonal replanting' },
    { title: 'HOA Compliant', description: 'Native and drought-tolerant designs meet or exceed HOA standards' },
    { title: 'Drought Proof', description: 'A yard that looks great regardless of water restrictions' },
  ],
  'addition': [
    { title: 'Extra Space', description: 'A bedroom, office, or suite that\'s part of the existing structure' },
    { title: 'Stay in Your Home', description: 'The alternative to moving when your family outgrows the space' },
    { title: 'Permitted and Engineered', description: 'Every addition is fully permitted, structurally engineered, and warranted' },
    { title: 'Home Value', description: 'Added square footage is the most direct way to increase property value' },
  ],
  'exterior-upgrades-and-lot-layout': [
    { title: 'Usable Outdoor Space', description: 'Turn a dead yard into a space you actually want to be in' },
    { title: 'Privacy', description: 'Hardscape and plantings that create separation from neighbors and the street' },
    { title: 'Curb Appeal', description: 'A lot layout that makes your home stand out on the block' },
    { title: 'Property Value', description: 'Outdoor improvements consistently add measurable resale value' },
  ],
  'interior-upgrades-and-home-layout': [
    { title: 'Better Flow', description: 'Open layouts and improved circulation make every room more livable' },
    { title: 'Modern Functionality', description: 'Spaces designed for how you actually live today' },
    { title: 'Increased Value', description: 'Interior layout improvements add measurable value without adding square footage' },
    { title: 'Design-Led Results', description: 'Every change is intentional — not cosmetic for its own sake' },
  ],
  'patch-and-interior-paint': [
    { title: 'Instant Transformation', description: 'The fastest way to change how your home looks and feels' },
    { title: 'Done in Days', description: 'Full interior paint jobs completed efficiently with minimal disruption' },
    { title: 'Pre-Sale Value', description: 'Fresh paint is the highest-ROI prep step before listing a home' },
    { title: 'Smooth Walls', description: 'All patches, holes, and texture damage addressed before painting' },
  ],
  'tile': [
    { title: 'Long-Lasting Surface', description: 'Quality tile installed correctly lasts decades without replacement' },
    { title: 'Modern Aesthetic', description: 'Large-format tile, fresh grout lines, and clean design choices' },
    { title: 'Easy Maintenance', description: 'The right tile and grout combination stays clean without effort' },
    { title: 'Design Impact', description: 'The detail that finishes a kitchen, bathroom, or entryway properly' },
  ],
  'pool-remodel': [
    { title: 'Like-New Pool', description: 'Replastering, retiling, and coping replacement that restores the original look' },
    { title: 'Lower Operating Costs', description: 'Updated equipment runs more efficiently and costs less to maintain' },
    { title: 'Backyard Value', description: 'A pool that\'s an asset again — not an eyesore' },
    { title: 'Extended Lifespan', description: 'Properly remodeled pools last another 15-20 years before the next cycle' },
  ],
  'adu': [
    { title: 'Rental Income', description: 'A permitted ADU generates consistent monthly income from day one' },
    { title: 'Equity Conversion', description: 'Turn unused garage or backyard space into a long-term property asset' },
    { title: 'Flexible Use', description: 'Rent it, gift it to family, or use it yourself — the option is yours' },
    { title: 'Fully Permitted', description: 'Every ADU built to code, engineered, and permitted through the city' },
  ],
  'fencing-and-gates': [
    { title: 'Privacy', description: 'Solid fencing that creates real separation from the street and neighbors' },
    { title: 'Security', description: 'A defined perimeter with a gate that controls access' },
    { title: 'Curb Appeal', description: 'Fencing and gate design that matches and elevates the home\'s exterior' },
    { title: 'Property Definition', description: 'Clear boundaries that protect your investment and reduce disputes' },
  ],
  'garage': [
    { title: 'Functional Space', description: 'A garage organized and finished to actually work — not just store things' },
    { title: 'Vehicle Protection', description: 'A two-car garage that fits two cars, with room for storage' },
    { title: 'Added Value', description: 'Epoxy floors, door upgrades, and organization add measurable home value' },
    { title: 'Reliable Door', description: 'A quiet, fast, reliable door that works every time' },
  ],
  'electricals': [
    { title: 'Safety', description: 'A panel and wiring that meet current code and pass inspection' },
    { title: 'Modern Capacity', description: 'Circuits sized for how you actually use your home today' },
    { title: 'EV Ready', description: 'Dedicated EV charging circuit and outdoor outlet additions' },
    { title: 'Peace of Mind', description: 'No more breaker trips, flickering lights, or ungrounded outlets' },
  ],
  'plumbing': [
    { title: 'Consistent Pressure', description: 'Water pressure that\'s reliable at every fixture, every time' },
    { title: 'No Surprise Failures', description: 'Repiping and drain work that eliminates the aging infrastructure risk' },
    { title: 'Modern Fixtures', description: 'Upgraded fixtures that perform and look the way they should' },
    { title: 'Peace of Mind', description: 'A plumbing system you don\'t have to worry about' },
  ],
  'foundation-and-crawl-space': [
    { title: 'Structural Safety', description: 'Foundation repair that addresses the problem — not just the symptom' },
    { title: 'Dry Crawl Space', description: 'Encapsulation and drainage that keeps moisture out for good' },
    { title: 'Documented and Warranted', description: 'Structural repairs come with certification lenders and buyers accept' },
    { title: 'Peace of Mind', description: 'The worry in the back of your mind — resolved and documented' },
  ],
  'hazardous-materials': [
    { title: 'Safe Home', description: 'Asbestos, mold, lead, and termite damage removed properly and completely' },
    { title: 'Renovation Ready', description: 'Clearance that allows contractors to start without liability exposure' },
    { title: 'Lender Compliant', description: 'Documentation that satisfies lenders, inspectors, and title companies' },
    { title: 'Fully Permitted', description: 'Abatement performed and documented to city and state requirements' },
  ],
  'engineering-plans-and-blueprints': [
    { title: 'Permit Ready', description: 'Stamped drawings that meet city requirements and get approved' },
    { title: 'Professional Drawings', description: 'Structural, mechanical, or architectural plans that unlock the build' },
    { title: 'Code Compliant', description: 'Every set of plans engineered to current California building standards' },
    { title: 'Project Launcher', description: 'The first step that makes every other step possible' },
  ],
}
