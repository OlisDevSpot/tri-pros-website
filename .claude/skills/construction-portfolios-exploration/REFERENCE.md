# Construction Portfolios Exploration — reference

## Mistakes

What went wrong in the first run (2026-09-24 → 2026-10-02) before the owner said "exactly what we were looking for":

1. **Locked onto the topic word instead of the visual criterion.** The first ask said "focus is energy efficiency", and I built the whole search around energy scope (insulation, HVAC, cool roofs, deep retrofits). What the owner actually wanted was *real projects with clear construction work being done*. The trade or topic was secondary. Ask "is the topic a filter or just a preference?" before searching.
2. **Grilled on the wrong things.** I asked about purpose (presentation vs content vs sales proof), per-entry fields, an artifact, a repo markdown file and screenshots. The owner wanted just the URLs. Keep questions to what changes the search results.
3. **The energy filter starved the search.** Insulation, HVAC and home-performance contractors almost never post more than 6 photos per job. The energy-strong pages came from high-performance builders, and most of their portfolios are finished photos only. Round 1 ended with half the list having a weak energy angle, plus suggestions of Canadian and architect sites that broke the bar.
4. **Scouts spawned their own sub-scouts.** That burned the 200-WebSearch session cap, and the last scouts ran with no searches left. Every scout prompt now says "don't spawn subagents, budget ~60 searches".
5. **Trusted WebFetch for photo counts.** It undercounts lazy-loaded galleries. Raw HTML filenames and alt text, plus contact sheets, were what actually confirmed the during shots.
6. **Didn't pass the exclude-list to new scouts at first.** That cost duplicate verification of already-known domains.
7. **Started from the energy trades instead of the full trade list.** Round 2 used every trade grouped as interior, exterior and structural. That produced 27 verified pages across 9 contractors in one pass.

## Last verified list (2026-10-02, round 2)

Use these domains as the EXCLUDE list when asked for *new* finds, or as the starting list for "more like this".

| Trade | URL | Photos / during |
|---|---|---|
| Bath | https://austin-tile-pro.com/2019/07/03/budget-bathrom-renovation/ | ~50 / ~35 |
| Kitchen | https://austin-tile-pro.com/2017/08/01/inexpensive-full-kitchen-renovation/ | ~41 / ~28 |
| Bath | https://austin-tile-pro.com/2021/07/05/bright-bathroom-renovation/ | ~42 / ~28 |
| Flooring | https://ceramictec.com/porcelain-plank-tile-installation-tampa/ | 24 / ~14 |
| Bath | https://ceramictec.com/new-tampa-bathroom-tile-remodel/ | 21 / ~12 |
| ADU | https://snapadu.com/projects/reuniting-family-custom-adu-in-poway-2/ | 42 / ~20 |
| ADU | https://snapadu.com/projects/dorothy-way-san-diego-ca-adu-rental-4br-3ba-1200sqft/ | 28 / ~15 |
| Addition | https://richardlouisconstruction.com/remodel-room-addition-projects/fullerton-2 | 25 / ~13 |
| Kitchen + patio | https://richardlouisconstruction.com/remodel-room-addition-projects/panorama-heights-1 | 24 / ~8 |
| Gut reno | https://www.phillygreenbuilding.com/portfolio/woodstock-street | ~60 / many |
| Rebuild | https://www.kolbertbuilding.com/projects/cumberland-renovation | ~55 / many |
| Roof | https://teamarmored.com/locations/palm-harbor/projects/palm-harbor-shingle-roof-replacement-grand-bay-drive-apr-2026-8365/ | ~55 / ~20 |
| Deck | https://www.jweremodeling.com/exterior-remodel-deck-manchester-md-21088/ | ~28 / ~15 |
| Roof + siding | https://lattakennedyexteriors.com/portfolio/bryn-mawr-exterior-outfitting.html | 22 / yes |
| Metal roof | https://www.equityroofs.com/case-studies/historic-standing-seam-roof-replacement-northumberland-pa | ~16 / 6 |
| Siding | https://www.equityroofs.com/case-studies/siding-replacement-for-drafty-elysburg-home | ~19 / 6 |
| Roof + siding | https://www.equityroofs.com/case-studies/standing-seam-metal-roof-james-hardie-siding-michigan | ~14 / 6 |
| Windows | https://kingshadeandwindow.com/randolph-ma-storm-window-replacement-case-study/ | 16 / 4 |
| Ext. paint | https://certapro.com/salisbury/lakeside-exterior-transformation-residential-case-study/ | ~60 / ~12 |
| Siding | https://www.jweremodeling.com/log-cabin-remodel-vinyl-siding-install-york-springs-pa/ | ~16 / 5 |

**Deep catalogs, the same format on many more pages:**
- snapadu.com/projects has about 196 pages. Many lack a before shot.
- ceramictec.com has about 10 more bathroom pages.
- equityroofs.com/case-studies has 18 pages.
- roofreplacementca.com has about 70 reroof pages.
- lattakennedyexteriors.com/portfolio has more pages, but many have only 4–8 photos.

**Gaps (nothing passed):** HVAC, plumbing, electrical, concrete, garage conversions.

**Foundation near-miss:** dalinghausconstruction.com/projects has 13 strong photos of the crew working, but no after shot.

**Sites that failed the bar:**
- Hammer & Hand, Byggmeister, Siding & Window Vault, Meadowlark: finished photos only.
- Block Renovation: a platform, not a contractor.
- Most ADU marketplaces: same problem as Block Renovation.
