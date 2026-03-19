// src/features/landing/constants/trade-before-after.ts
// Luxury pillar trades only (17 — Framing excluded, it has no scopes).
// Sparse lookup — returns undefined at call site if slug not present.
export const tradeBeforeAfter: Partial<Record<string, { before: string[], after: string[] }>> = {
  'kitchen-remodel': {
    before: [
      'Cabinets that don\'t close right',
      'Counter space that was never enough',
      'Layout that makes cooking a chore',
      'A kitchen that feels decades behind the rest of the house',
    ],
    after: [
      'Soft-close cabinetry, quartz counters, optimized layout',
      'A kitchen you actually want to cook in',
      'The highest-ROI improvement you can make before selling',
      'A space that finally matches how you live',
    ],
  },
  'bathroom-remodel': {
    before: [
      'A bathroom you avoid guests seeing',
      'Fixtures from another decade',
      'Poor lighting, no storage, outdated tile',
      'A daily routine in a space you don\'t enjoy',
    ],
    after: [
      'Frameless glass, modern tile, LED lighting',
      'A bathroom you love using every morning',
      'The #1 priority for buyers — resale value increase',
      'Like moving into a new house, without moving',
    ],
  },
  'flooring': {
    before: [
      'Scratched or stained carpet from years of use',
      'Squeaky, uneven, or cold hardwood',
      'A floor that dates the whole room',
      'Different flooring in every room that doesn\'t flow',
    ],
    after: [
      'New hardwood, LVP, or tile — consistent throughout',
      'Floors that make every room feel intentional',
      'A refresh that works for buyers and for living',
      'Quiet, level, durable surface underfoot',
    ],
  },
  'addition': {
    before: [
      'Kids sharing rooms they\'ve outgrown',
      'No dedicated home office or workspace',
      'A house that works for a smaller family than yours',
      'Moving feels like the only option',
    ],
    after: [
      'A new bedroom, office, or suite that\'s part of the house',
      'Square footage that fits your actual life',
      'Permitted, engineered, and done right',
      'A home worth staying in — and investing in',
    ],
  },
  'exterior-upgrades-and-lot-layout': {
    before: [
      'A backyard you don\'t use because it\'s not set up for anything',
      'Concrete or dead grass where there could be something better',
      'No privacy from neighbors',
      'A front yard that looks like everyone else\'s on the block',
    ],
    after: [
      'An outdoor space you actually live in',
      'A lot layout that works: parking, entertaining, privacy',
      'Hardscape, landscaping, and drainage that holds up',
      'Curb appeal that makes your home stand out',
    ],
  },
  'interior-upgrades-and-home-layout': {
    before: [
      'A floor plan that made sense in 1985',
      'Rooms that feel disconnected or poorly used',
      'An entryway, hallway, or staircase that\'s just wasted space',
      'A home that works against how you live',
    ],
    after: [
      'An open layout, improved flow, and functional rooms',
      'Spaces that feel intentional instead of leftover',
      'A home that works for your family the way it is today',
      'Value added through design, not just cosmetics',
    ],
  },
  'patch-and-interior-paint': {
    before: [
      'Scuffs, holes, and wall damage that\'s been there too long',
      'Paint colors from a previous decade',
      'A home that looks tired even when it\'s clean',
      'The one project you\'ve been putting off for years',
    ],
    after: [
      'Fresh, smooth walls throughout',
      'A color palette that makes rooms feel bigger or warmer',
      'The fastest way to transform how a home feels',
      'Done in days — not weeks',
    ],
  },
  'tile': {
    before: [
      'Grout lines that never clean up',
      'Cracked, chipped, or outdated ceramic',
      'A shower or kitchen backsplash that doesn\'t match anything else',
      'Tile that looked fine 10 years ago',
    ],
    after: [
      'Large-format tile, fresh grout, clean lines',
      'A surface that\'s easy to maintain and looks intentional',
      'Pattern, texture, and material choices that last',
      'The detail that finishes a room properly',
    ],
  },
  'pool-remodel': {
    before: [
      'A pool that\'s cracking, staining, or showing its age',
      'Outdated coping, tile, or equipment',
      'A feature that\'s costing more than it should to maintain',
      'A backyard centrepiece that doesn\'t look like one anymore',
    ],
    after: [
      'Replastered, retiled, and mechanically sound',
      'A pool you want to show off again',
      'Lower operating costs with updated equipment',
      'A backyard that\'s actually worth using',
    ],
  },
  'adu': {
    before: [
      'A garage or backyard space that\'s just storage',
      'Untapped equity sitting on your property',
      'In-laws or adult kids with no good housing option',
      'Rental income you\'re not collecting',
    ],
    after: [
      'A permitted ADU: its own entrance, utilities, and value',
      'Equity converted into livable space',
      'A long-term asset that pays for itself',
      'Options: rent it, gift it, or use it yourself',
    ],
  },
  'fencing-and-gates': {
    before: [
      'An old fence that\'s leaning, rotting, or falling apart',
      'No privacy from the street or neighbors',
      'A driveway or yard with no clear boundary',
      'An entry that doesn\'t say anything about the home',
    ],
    after: [
      'Solid fencing — wood, vinyl, wrought iron, or masonry',
      'Privacy and security that actually work',
      'A clean perimeter with a gate that matches',
      'Curb appeal that starts at the property line',
    ],
  },
  'garage': {
    before: [
      'A garage that fits one car with nowhere to park the other',
      'Cracked or stained concrete',
      'A door that\'s noisy, slow, or unreliable',
      'Storage with no system — just stuff piled up',
    ],
    after: [
      'Epoxy floor, organized walls, working door',
      'A functional space instead of a wasted one',
      'A two-car garage that actually fits two cars',
      'Added value with minimal footprint',
    ],
  },
  'electricals': {
    before: [
      'Breakers that trip on a normal evening',
      'Outlets that aren\'t grounded or aren\'t where you need them',
      'An older panel that\'s never been evaluated',
      'No outdoor lighting, EV charging, or home office circuit',
    ],
    after: [
      'A panel that\'s sized for your home',
      'Outlets, switches, and circuits where you need them',
      'EV charger, dedicated circuits, or outdoor lighting added',
      'A system you can trust — and that passes inspection',
    ],
  },
  'plumbing': {
    before: [
      'Drains that are slow or stop up regularly',
      'A water heater that\'s aging out',
      'Low pressure at fixtures or inconsistent water temperature',
      'Fixtures that look fine but perform poorly',
    ],
    after: [
      'Repiping, drain clearing, or fixture upgrades — done right',
      'Water pressure that\'s consistent throughout',
      'A water heater that meets the home\'s demand',
      'No more guessing if something will fail',
    ],
  },
  'foundation-and-crawl-space': {
    before: [
      'Cracks in walls or floors that are getting wider',
      'Doors and windows that stick or won\'t close right',
      'Moisture or standing water in the crawl space',
      'A concern in the back of your mind that keeps growing',
    ],
    after: [
      'Foundation assessment, repair, and certification',
      'A crawl space that\'s sealed, dry, and inspected',
      'Structural confidence — documented and warranted',
      'Peace of mind that starts from the ground up',
    ],
  },
  'hazardous-materials': {
    before: [
      'An older home with unknown materials in walls or ceilings',
      'A renovation stalled because of what might be there',
      'Mold growing behind walls or under flooring',
      'Asbestos, lead, or termite damage that\'s been suspected',
    ],
    after: [
      'Testing, abatement, and clearance — all permitted',
      'A home that\'s safe to remodel',
      'Documentation that satisfies lenders and inspectors',
      'The removal that makes everything else possible',
    ],
  },
  'engineering-plans-and-blueprints': {
    before: [
      'An ADU, addition, or renovation with no plans to submit',
      'A permit application that was rejected',
      'A contractor who needs engineered drawings before they can start',
      'A project stuck in planning because the paperwork isn\'t right',
    ],
    after: [
      'Stamped engineering drawings that meet city requirements',
      'A permit package ready to submit',
      'Structural, mechanical, or architectural plans that unlock the build',
      'The foundation for every project that needs to be done right',
    ],
  },
}
