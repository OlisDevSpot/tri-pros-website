export const NOT_DRAWN: Partial<Record<string, true>> = {
  '31b0ca1b-548b-8045-8302-d14e7f922de1': true, // Roof tune up service — a service visit, no part is replaced
  '31a0ca1b-548b-80ff-8692-e1db91818a7a': true, // Roof torch down (repair) — a patch repair, the covering is not replaced
  '31a0ca1b-548b-802c-917c-d7252224c617': true, // Roof tear-off shingles (repair) — a partial repair, the covering is not replaced
  '3190ca1b-548b-80e7-9863-f892fbfb6108': true, // Tile roof reset (repair) — a partial repair, the covering is not replaced
  '8860ca1b-548b-83c5-adb1-01edfc5be0fc': true, // Fascia board replacement — the assembly has no fascia part
  '32f0ca1b-548b-805e-bf76-e8a65bc3cbc7': true, // Foundation repair — structural work, the crawl space draws no foundation part yet
  '3760ca1b-548b-8063-97e0-ef74848b3e7b': true, // Epoxy flooring application — an interior floor finish, no wall part
  '36f0ca1b-548b-8083-93c8-ef5c32a68032': true, // Repaint exterior trim — trim is not a wall part
  '3490ca1b-548b-804e-bebd-d0cbb945f1c5': true, // Wood / siding repair — a patch repair, the finish is not replaced
  'ee10ca1b-548b-82ba-a6c7-01ab7dc39c3a': true, // Re-stucco — the wall's stucco coats are not a pick yet
  'f290ca1b-548b-8357-8036-017304b34487': true, // Wood stain application (exterior) — a stain is not paint, and moves no part
  '4020ca1b-548b-82d2-96c2-81068068e903': true, // Repaint w/ water-based (exterior) — ordinary paint over ordinary paint, the part stays as it is
  '32f0ca1b-548b-805a-b1ec-e8026c403bb1': true, // French door replacement — doors are not a window part
  '2550ca1b-548b-8257-acfd-816f0f96a64a': true, // Sliding door installation (new) — doors are not a window part
  '25b0ca1b-548b-8281-af32-01c2e1b2f080': true, // Sliding door replacement — doors are not a window part
  '7ab0ca1b-548b-8375-b3b4-017bffbdc1e8': true, // Window installation (new) — adds openings, replaces no existing window
  '3190ca1b-548b-805f-8d87-f51275832424': true, // Kit: mini-split — a ductless system, no air handler or ducts to draw
  'dcb0ca1b-548b-8303-9f65-01730423e685': true, // Mini-split installation — a ductless system, no air handler or ducts to draw
  '88d0ca1b-548b-82b2-bb26-017081659f61': true, // Furnace replacement — half a system, standard equipment on standard equipment
  'e450ca1b-548b-8269-adc7-019776a6acf7': true, // A/C replacement — half a system, standard equipment on standard equipment
  '8aa0ca1b-548b-82dd-9148-81d0b51076bf': true, // Split system new-cut installation — a first-time install with no existing system to replace
}
