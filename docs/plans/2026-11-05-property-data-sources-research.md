# Property data from an address: sources, terms and cost (research, 2026-11-05)

**For:** the property enrichment brainstorm (tracker R237–R241). It extends `docs/plans/2026-11-02-trade-scene-layout-research.md` §4 and does not repeat it.
**How it was made:** web research passes against the providers' own docs, terms and pricing pages on 2026-11-05. Nothing was built and no database was touched. Every claim marked UNVERIFIED could not be confirmed from a primary source; the rest carry a URL. Check a clause again before relying on it, terms change.
**Budget it is measured against:** $1 per address, every source added together (R241).

Sections: **A. Imagery and what can be read from it** · **B. Area facts from a point** · **C. Parcel and building facts**.

**Cost across all three, per address:** area facts $0; parcel facts $0 from the counties, about $0.13–0.20 when a paid lookup is needed; imagery and the vision pass $0.03–0.08. Well under the $1 cap.

---

## A. Imagery and what can be read from it

**Bottom line.** A legally clean pipeline costs about $0.03–0.08 per address, but what it can read depends on the county. Orange, Riverside and San Bernardino publish 7.5–30 cm county imagery. LA County, the largest part of the service area, has only 60 cm NAIP 2024 plus a public 2023 land-cover raster, so roof covering, solar and rooftop units are weak there without Google. **Fence material is not readable from overhead imagery at any resolution available here**; it needs street-level photos.

### A.0 Corrections to the layout research

- §4.1's Google quotes still match the live terms (ToS last modified 2026-08-26; Service Specific Terms 2026-10-28).
- §8 "NAIP 2024/2025 vintage" is resolved: California was flown in 2024 at 60 cm, 4-band (the Encino tile is dated 2024-05-06). California has no 30 cm NAIP.
- ⚠️ Stale ref, §9: the USGS NAIP ImageServer link serves California 2022, not 2024, and Planetary Computer's latest California item is also 2022. The 2024 mosaic is on the USDA service below.
- §4.3 "~1,400 visual tokens": the exact figure is 1,369 for 1024×1024.
- §8 "OC Landbase licence and 3-inch aerial terms" is still unresolved; the OC services publish no licence text.

### A.1 Overhead imagery, public sources (all $0 per address)

| Source | Resolution, vintage | Fetch | Terms (store / send to AI / derive and store / show) | Caveats | URL |
|---|---|---|---|---|---|
| NAIP via USDA FPAC | 60 cm, RGB + near infrared, CA 2024 | ArcGIS ImageServer `exportImage?bbox=…&size=…` (tested: a 768² JPEG for Encino) | All four allowed. "Use Constraints: These services are for illustrative purposes only… [USDA] asks to be credited for derived products." AWS registry: "Public Domain with Attribution" | A house is about 25 × 20 px. Next CA flight UNVERIFIED | https://apps.geo.fpac.usda.gov/geo-imagery/rest/services/naip/conus_naip/ImageServer |
| NAIP via USGS, Planetary Computer, AWS | 60 cm; CA latest is 2022 on USGS and Planetary Computer | ImageServer; STAC + COG; S3 (Requester Pays) | Same public-domain status | One cycle behind USDA | https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer |
| LA County LARIAC orthos | LARIAC7: 2023, 4 in urban | Not public; members under NDA | Not allowed: "proprietary dataset provided courtesy of [LAR-IAC] and Pictometry International Corp." | A private-company purchase route is UNVERIFIED | https://lariac-lacounty.hub.arcgis.com |
| LA County public aerial caches | 2014 at 4 in; 2011–2013 on a second host | MapServer `export` (tested) | 2014: no licence text. 2011–2013: "free of known copyright restrictions" | Ten years old: misses re-roofs, solar, new pools. A detail hint only | https://cache.gis.lacounty.gov/cache/rest/services/LACounty_Cache/LACounty_Aerial_2014/MapServer |
| LA County Land Cover 3.0 | 2023, 4 in urban; classes: tree canopy, grass/shrubs, bare soil, water, buildings, roads, other paved, tall shrubs | MapServer `export` (tested: clean per-yard classes) | "This view only image service…"; the full raster is for county departments and LARIAC7 members | Whether stored per-parcel crops fit "view only" is UNVERIFIED (ask mapping@dpw.lacounty.gov). Which class artificial turf lands in is unknown | https://image.gis.lacounty.gov/image/rest/services/LARIAC7/LANDCOVER_2023/MapServer |
| Orange County | 3 in (7.6 cm) 2022; 1 ft 2025 | ImageServer `exportImage` (tested: tile courses, hips, skylights, a lattice cover are legible) | No licence text; credit "Eagle Aerial Imaging", a commercial vendor. UNVERIFIED | Ask OC Survey before storing or showing | https://www.ocgis.com/arcpub/rest/services/Aerial_Imagery_Countywide |
| Riverside County | 2020, 3 in and 6 in | ImageServer on the `arcgis_mapping` host (the `arcgis_public` host errored) | licenseInfo "None". UNVERIFIED | Six years old | https://gis.countyofriverside.us/arcgis_mapping/rest/services/Aerials_WGS/Riverside_County_2020_WM/ImageServer |
| San Bernardino County | 2024, 2025 (4-band), 2026; reported pixel 1 ft | ImageServer `exportImage` (tested: cars resolve clearly) | A warranty disclaimer only; no use restriction stated | "Primary Urban Area" only; high-desert coverage and true resolution UNVERIFIED | https://maps.sbcounty.gov/img/rest/services |

### A.2 Google (all inside the free monthly caps at our volume)

| Product | Price | Clause | Usable for reading facts? |
|---|---|---|---|
| Maps Static, satellite | $2 per 1,000; 10,000 free a month | §3.2.3(a): will not "pre-fetch, index, store, reshare, or rehost Google Maps Content outside the services". §3.2.3(c): will not "(i) trace or digitize roadways, building outlines… (vii) use Google Maps Content to improve machine learning and artificial intelligence models" | No |
| Map Tiles (2D satellite, Photorealistic 3D) | $0.60 per 1,000; 3D $6 per 1,000 | "You may not use Map Tiles API for any non-visualization use cases, such as: Image analysis, Machine interpretation, Object detection or identification, Geodata extraction" | No; the most explicit ban |
| Solar API | buildingInsights $10 per 1,000 (10,000 free); dataLayers $75 per 1,000 (1,000 free) | §20.1: only "to determine the feasibility of installing energy systems… to design or install an energy system". §20.2: cache up to 30 days | No for a general home model. The text says "energy systems", not "solar"; whether HVAC or insulation proposals qualify is a legal call |
| Aerial View | $16 per 1,000 | Only the video ID may be cached | No; display only |
| Street View Static | $7 per 1,000; 10,000 free | Storing barred; only the panorama ID may be kept; cannot show Street View beside a non-Google map | No |
| Street View Insights | Contact sales | Only for "public or commercial infrastructure", only Google's own models or models hosted entirely on Google Cloud, source deleted after 35 days, detections for internal use only | No: wrong use, excludes the Claude API, facts could not be shown to the homeowner |
| Aerial and Satellite Insights, Earth AI imagery models | Announced April 2026 | No terms published | UNVERIFIED |

Terms: https://cloud.google.com/maps-platform/terms · https://cloud.google.com/maps-platform/terms/maps-service-terms · https://developers.google.com/maps/documentation/tile/policies

Google's Geocoding terms allow keeping latitude and longitude past 30 days only under narrow conditions (B.1).

### A.3 Other commercial imagery

| Source | Terms or price | Verdict |
|---|---|---|
| Mapbox Satellite | Product Terms §1.5 bars use "to train, operate or improve machine-learning or artificial intelligence (AI) technologies"; §1.6 bars tracing for commercial use; §1.9 bars storing | No |
| Esri World Imagery | Derived information "strictly for non-commercial use" (wording from a search snippet; the page returned 403) | No |
| Bing, Azure Maps | Bing Maps for Enterprise is retired; Azure Maps terms UNVERIFIED | Treat as no |
| Nearmap (with AI packs) | 5–7 cm; charged per transaction, no public rate; third-party estimates of $3–10 per property UNVERIFIED | Over budget or needs a quote |
| Vexcel, EagleView, Hover, Maxar/Vantor, Planet, Cape Analytics, Zesty, Betterview | No published per-address price; per-report or enterprise contracts | Over budget; UNVERIFIED |

**Only the county services allow reading facts at 30 cm or better for well under $1**, and their licences are silent rather than permissive. LA County has no legally clean option at that resolution newer than 2014.

### A.4 Street-level imagery

| Source | Price | Terms | Coverage | Usable? |
|---|---|---|---|---|
| Google Street View Static | $7 per 1,000 | See A.2 | Near-complete | No under its terms |
| Mapillary | Free API with a token | Other users' images are CC BY-SA; §12 permits commercial "improvement, training, and development of products"; extracted data must show the Mapillary logo and link | Crowdsourced; density on SoCal residential streets UNVERIFIED | Yes, with attribution, where images exist |
| KartaView | Free | CC BY-SA 4.0 (UNVERIFIED) | Sparse (UNVERIFIED) | Marginal |
| Bing Streetside, Apple Look Around | — | Retired; no server API found | — | No |
| **The rep's own photos at the visit** | $0 | Tri Pros owns them | Every customer | Yes: the only clean, reliable source for fence material and the front of the home |

Mapillary terms: https://www.mapillary.com/terms

### A.5 What a vision model can read

No published benchmark of Claude, GPT or Gemini on roof material was found. Run a 30–50 address check before trusting this table; outside the cited figures the cells are a judgement from pixel sizes and the test crops.

| Fact | 60 cm (NAIP) | 30 cm | 7.5 cm (Orange, Riverside) |
|---|---|---|---|
| Pool | Mostly yes by colour; covered or green pools missed | Reliable | Reliable |
| Roof shape | Flat or pitched only | Gable or hip plausible on simple roofs | Good |
| Roof covering | Colour only: red or orange suggests clay tile; grey tile, shingle and flat membrane not separable | Tile or shingle sometimes | Tile, shingle or flat yes; wood shake or shingle unreliable |
| Solar panels | Unreliable (an array is about 5 × 8 px) | Reliable | Reliable |
| Lawn or artificial turf | Not from colour; near infrared separates living grass from plastic | Same | Same (the county imagery has no near infrared) |
| Lawn, dirt, paved | Yes, coarse | Yes | Yes |
| Driveway material | Where it is, yes; concrete or asphalt by tone; pavers no | Same | Pavers sometimes |
| Where the garage sits, which way the home faces | From the parcel, footprint and street: geometry, not a model call | Same | Same |
| **Fence or wall kind** | **Not readable** | Not readable | A line and a shadow sometimes; block wall or thin fence is a guess; material no |
| AC condenser | No (about 1 px) | No | Sometimes |
| Rooftop package unit | No | Plausible | Yes |

Evidence: pool F1 above 0.95 at about 30 cm (https://docs.mapflow.ai/userguides/swimming_pools_model.html); zero-shot roof shape 49.2% against 99.4% supervised (https://arxiv.org/abs/2312.12479); roof material 83–84% supervised on drone imagery (https://arxiv.org/pdf/2004.11482), 91% when aerial and street view are fused (https://isprs-archives.copernicus.org/articles/XLIX-M-1-2026/65/2026/); solar about 93% precision at 30 cm or better (https://arxiv.org/pdf/2201.02107.pdf); turf by near infrared (https://site.caes.uga.edu/scriturf/data-visualization).

Off the shelf: SAM 3 on fal.ai at $0.005 per request, commercial use permitted (https://fal.ai/models/fal-ai/sam-3/image). Roboflow and Hugging Face roof and pool models were not checked.

### A.6 Cost of the vision pass with Claude (pricing page fetched 2026-11-05)

An image costs ⌈width/28⌉ × ⌈height/28⌉ visual tokens; 1024 × 1024 is 1,369.

| Model | Input / output per million tokens | Typical call (1 image, 800 prompt tokens, 1,000 output tokens) |
|---|---|---|
| Claude Haiku 5.5 | $0.10 / $0.50 | about $0.0007 |
| Claude Sonnet 5.5 | $2 / $10 | about $0.014 |
| Claude Opus 5.5 | $4 / $20 | about $0.029 |

Three images per call, two Haiku passes and one Sonnet pass, is about $0.025 per address. The Batch API halves both prices. Sources: https://platform.claude.com/docs/en/about-claude/pricing · https://platform.claude.com/docs/en/build-with-claude/vision

### A.7 A pipeline that stays clean (about $0.03–0.08 per address)

1. **Skeleton, no AI:** parcel, footprint, street side and assessor facts (layout research §4.2–4.3).
2. **Fetch and store the crops, by county:**
   - Orange: 3 in 2022, plus the 1 ft 2025 as a recency check;
   - Riverside: 2020 at 3–6 in, plus NAIP 2024 as a recency check;
   - San Bernardino: the newest of the 2024–2026 services;
   - LA: NAIP 2024 with near infrared, the Land Cover 2023 crop, and the 2014 4 in cache as a dated detail hint.
3. **Yard layer, no AI:** living grass from NAIP's near infrared; in LA, the land-cover classes snapped to the grid.
4. **One Claude call set:** a tight parcel crop, a wider street crop and the land-cover overlay, with the parcel and footprint drawn and the labelled grid. Two Haiku passes and one Sonnet pass, majority vote, `?` where they disagree.
5. **Optional:** SAM 3 for pool or patio edges.
6. **Fences and the front of the home:** parcel edges as default fence lines with the kind unset; the rep's visit photos through one model call; Mapillary where it exists.
7. **Before launch:** write to OC Survey, Riverside RCIT and LA County Public Works to confirm storing crops and showing them to the rep. NAIP needs no permission.

| | Orange, Riverside, San Bernardino | LA County |
|---|---|---|
| Reliable | Pool, roof shape, tile or shingle or flat, roof colour, solar, lawn/dirt/paved, driveway location, garage position, facing | Pool, lawn/dirt/paved, driveway location, garage position, facing, roof colour, flat or pitched |
| Unreliable | Pavers or concrete, turf or lawn, package unit, condenser, wall or fence line | Gable or hip, tile or shingle, solar, turf or lawn |
| Not at all | Fence material, wood shake or shingle | Fence material, condenser, package unit, pavers, wood shake |

**If the owner accepts Google's terms risk**, three calls at $0 inside the free caps close most of the LA County gap: Solar `buildingInsights` (pitch and azimuth per roof plane, so gable, hip or flat everywhere), Static satellite at zoom 20–21 (roof covering, solar, package units), and Street View Static (fence and wall kind on the street side, the front of the home). It breaches Maps §3.2.3(a) and (c) and Solar §20.1–20.2; the stored facts would be "content based on Google Maps Content"; the exposure is account suspension or termination.

### A.8 Not verified

- NAIP's next California flight year and resolution.
- The licence behind Orange's and Riverside's public imagery services (silent, not permissive).
- San Bernardino's true source resolution and high-desert coverage.
- LA County: whether stored crops fit the "view only" land-cover service; which class artificial turf falls in; any private route to LARIAC.
- Esri's exact wording; Azure Maps' terms; Google's Aerial and Satellite Insights; every commercial vendor's per-address price.
- Mapillary's density on SoCal residential streets; KartaView's licence and coverage.
- Any benchmark of a current general vision model on roof material, solar, condensers or package units from overhead imagery.

---

## B. Area facts from a point

**Bottom line.** Every area fact can be had at $0 per address at our volume. Marks: **[live]** the endpoint was called on 2026-11-05; **[doc]** read on the provider's own page.

Three findings shape the design:

- **Google's latitude and longitude cannot be kept as a permanent business record.** Use a geocoder whose terms allow storage.
- **NASA POWER is too coarse to use.** It returned identical temperature, rain, wind, UV and solar values for Santa Monica, Encino and Woodland Hills.
- **The state's utility map needs three fixes before it is used locally** (B.2).

### B.1 Geocoding with the right to store

| Option | Cost | Storage terms | Accuracy | URL |
|---|---|---|---|---|
| Google Geocoding | $5 per 1,000; 10,000 free a month [doc] | §6.3.1: latitude and longitude cached 30 days at most. §6.3.2: indefinitely only "solely to support the direct, End User facing functionality", isolated per end user, "not used as a replacement for making an additional call". §6.2: not with a non-Google map. The `place_id` may be kept indefinitely | Rooftop | https://cloud.google.com/maps-platform/terms/maps-service-terms |
| **Geocodio** | 2,500 lookups a day free; then about $1 per 1,000 (figure UNVERIFIED) | Results "can be stored permanently without restrictions" [doc] | Rooftop where county address points exist | https://www.geocod.io/terms-of-use/ |
| US Census Geocoder | Free, no key [live] | No terms published | Interpolated along the street, not rooftop. Test: "200 N Spring St" matched 200 **S** Spring St, about 300 m off | https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html |
| Mapbox permanent geocoding | $5 per 1,000, no free tier [doc] | "Permanent results are allowed to be cached and stored indefinitely"; the free temporary tier may not be stored at all | Rooftop in most metros | https://docs.mapbox.com/api/search/geocoding/ |
| LA County CAMS locator | Free, no key [live] | County terms page did not render | Best in LA County only; one endpoint also returns the parcel number (AIN) | https://geocode.gis.lacounty.gov/geocode/rest/services/CAMS_Locator/GeocodeServer |

### B.2 Electric utility

| Option | Returns | Cost and terms | Caveats | URL |
|---|---|---|---|---|
| **California Energy Commission, "Electric Load Serving Entities (IOU & POU)"** | `Utility`, `Acronym`, `Type` | Free, no key. data.ca.gov lists CC-BY; the CEC's own Conditions of Use carry an ambiguous sentence on commercial use (UNVERIFIED; GIS@energy.ca.gov) | 54 areas, last edited 2026-09-04, "boundaries are approximate". 24 SoCal test points all returned the right utility | https://services3.arcgis.com/bWPjFyq029ChCGur/arcgis/rest/services/ElectricLoadServingEntities_IOU_POU/FeatureServer/0 |
| HIFLD Electric Retail Service Territories | national | — | Deactivated 2025-08-26; archives only. The CEC layer is built from it and is still maintained | — |
| NLR (formerly NREL) Utility Rates v3 | `utility_name`, rates | Free key, 1,000 an hour | Right for LA City Hall and Burbank [live], but the data is from 2012 and the rates are stale. `developer.nrel.gov` no longer resolves; use `developer.nlr.gov` | https://developer.nlr.gov/docs/electricity/utility-rates-v3/ |
| Arcadia (Genability) | utility and tariff | Paid | Not needed at this budget | — |

Test results on the CEC layer:

- **LADWP:** LA City Hall, Encino, San Pedro.
- **SCE:** Santa Monica, Beverly Hills, West Hollywood, Culver City, San Fernando, Long Beach, Irvine, Lancaster, Moreno Valley, Rancho Cucamonga.
- **Their own city utility:** Burbank, Glendale, Pasadena, Vernon, Azusa, Colton, Banning, Riverside, Anaheim, Cerritos. Coachella returned the Imperial Irrigation District.

So the owner's three (LADWP, SCE, PG&E) are not the whole list in the service area: Burbank, Glendale, Pasadena, Riverside, Anaheim and others run their own. The code's `electricProviders` enum already names three of them.

Fixes the layer needs:

1. **The Metropolitan Water District is in it** as an area covering most of the basin, so almost every point gets two hits. Drop it.
2. **Vernon appears twice.**
3. **`Acronym` is blank for most city utilities.** Key on `Utility` or `HIFLD_ID`.
4. **The GeoJSON export loses holes.** Enclaves come back as extra polygon parts, so a plain point-in-polygon test returns SCE plus the city utility for Riverside, Anaheim, Azusa, Colton, Banning and Cerritos, and SCE plus LADWP for Beverly Hills, West Hollywood and San Fernando. "Smallest polygon wins" gives the wrong answer for those three. An even-odd test across all rings matched the hosted answers exactly; or rebuild from the shapefile.
5. **Cerritos, Industry, Corona, Victorville, Moreno Valley Utility and Rancho Cucamonga Municipal** are believed to serve only selected developments (UNVERIFIED). Treat a hit there as "SCE unless the rep confirms".
6. **For the LADWP and SCE line**, cross-check with the Census place: "Los Angeles city" should mean LADWP.

Download the layer and keep it rather than query the hosted service: it is small, the hosted service has no uptime promise, and its name carries a version. Record the snapshot date.

### B.3 Gas utility and the building climate zone

| Fact | Source | Notes | URL |
|---|---|---|---|
| Gas utility | CEC "Natural Gas Service Area" | 13 areas, last edited 2020. SoCalGas everywhere tested except Long Beach and Vernon [live]. Southwest Gas in the high desert was not point-tested | https://services3.arcgis.com/bWPjFyq029ChCGur/arcgis/rest/services/Natural_Gas_Service_Area/FeatureServer/0 |
| Building climate zone (Title 24, 1–16) | CEC Building Climate Zones layer | 16 areas, public [live]. Use the point lookup; a ZIP can span zones | https://services3.arcgis.com/bWPjFyq029ChCGur/arcgis/rest/services/BuildingClimateZones_CEC_2015/FeatureServer/0 |

Zones in the service area, point-tested: **6** Santa Monica, Long Beach, San Pedro · **8** Anaheim, Irvine, Cerritos, Culver City · **9** downtown LA, Encino, Burbank, Glendale, Pasadena, Beverly Hills, San Fernando · **10** Riverside, Colton, Moreno Valley, Rancho Cucamonga · **14** Lancaster · **15** Banning, Coachella. Zone 16 (mountains) is expected but untested. Zone 6 is a ready stand-in for "coastal".

### B.4 Climate averages

| Option | Returns | Resolution | Cost and terms | Caveats | URL |
|---|---|---|---|---|---|
| **PRISM 1991–2020 normals** | monthly and annual mean, high, low and precipitation; also solar | **800 m** | Free download; "may be freely reproduced and distributed" with credit; commercial use not addressed (UNVERIFIED) | No wind, no extremes. Files, not an API: clip once to SoCal and sample | https://data.prism.oregonstate.edu/normals/us/800m/ |
| NOAA station normals | monthly normals, average days at 90°F or above, wind at about 467 stations | Station | Free, no key [live] | The nearest station can sit in another microclimate; filter by climate zone and elevation | https://www.ncei.noaa.gov/access/services/data/v1?dataset=normals-monthly-1991-2020 |
| NOAA gridded normals | monthly high, low, mean, precipitation | About 4 km | Free; four files of about 281 MB | No point API | https://www.ncei.noaa.gov/products/land-based-station/us-climate-normals |
| NASA POWER | temperature, precipitation, wind, UV, solar | Coarse | Free | **Do not use:** identical values across the basin | — |
| Open-Meteo | reanalysis, climate models | 10–25 km | Free tier is non-commercial only [doc] | Still blurs coast and valley | https://open-meteo.com/en/pricing |
| Visual Crossing | station history | Station | Free plan allows commercial use | Climate statistics are on the top plans only | https://www.visualcrossing.com/weather-data-editions/ |

### B.5 Sun and UV

| Option | Returns | Resolution | Cost | Caveats | URL |
|---|---|---|---|---|---|
| **NLR PVWatts v8** (`tilt=0`) | annual and monthly sun energy on a flat surface | 4 km | Free key, 1,000 an hour | Tells the areas apart [live]: Santa Monica 1,916, Woodland Hills 1,995, Lancaster 2,153 kWh/m² a year | https://developer.nlr.gov/docs/solar/pvwatts/v8/ |
| PRISM solar normals | monthly solar | 800 m | Free | Units not checked | as B.4 |
| EPA UV index | daily UV by ZIP | ZIP | Free [live] | A forecast, not an average | https://data.epa.gov/efservice/getEnvirofactsUVDAILY/ZIP/91316/JSON |

**There is no fine-grained average UV index per address.** Use the annual sun energy at the address as the headline number, and one regional table for monthly UV. Do not put a UV-dose figure in copy without a source.

### B.6 Other area facts

| Fact | Source | Notes | URL |
|---|---|---|---|
| Fire hazard zone | CAL FIRE, two layers: local areas (2025-03-24) and state areas (2024-04-01) | Free. Tested: Encino hills and Pacific Palisades Very High [live]. Query both; a city's adopted map can differ. The older `services.gis.ca.gov` service is 2007–2011 data | https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/FHSALRA25_v1_All/FeatureServer/0 |
| Flood zone | FEMA NFHL layer 28 | Free, no key [live]; the server can be slow | https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28 |
| Elevation | USGS EPQS | Free, no key [live] | https://epqs.nationalmap.gov/v1/json |
| Liquefaction and landslide zones | California Geological Survey | Free with a credit line; "no hit" can also mean "not evaluated" | https://services2.arcgis.com/zr3KAIbsRSUyARHG/ArcGIS/rest/services/CGS_Liquefaction_Zones/FeatureServer/0 |
| City or unincorporated county (who issues the permit) | Census `geographies/coordinates` | Free [live] | https://geocoding.geo.census.gov/geocoder/geographies/coordinates |
| LA historic overlay (HPOZ) | LA City Planning | Free; City of LA only | https://services1.arcgis.com/tzwalEyxl2rpamKs/arcgis/rest/services/Historic_Preservation_Overlay_Zones_e214e/FeatureServer/0 |
| Distance to the coast | Natural Earth coastline | Public domain; coarse, good for bands | https://www.naturalearthdata.com/about/terms-of-use/ |
| HOA | — | No public source found | — |
| Average electric rate and its growth | EIA-861 annual files | Free; about ten months behind | https://www.eia.gov/electricity/data/eia861/ |

Residential revenue per kWh from the EIA-861 files, bundled service. These are revenue divided by sales, not tariff rates, and were parsed by hand: **re-derive them before any customer-facing use.**

| Utility | 2015 | 2024 | Growth a year |
|---|---|---|---|
| LADWP | 15.38¢ | 23.84¢ | about 5.0% |
| SCE | 16.51¢ | 32.43¢ | about 7.8% |
| PG&E | 18.03¢ | 39.62¢ | — |
| Burbank | 15.81¢ | 19.25¢ | — |

### B.7 Infra

| Dataset | Areas | Size as GeoJSON | Bundle in the app? | In Postgres with PostGIS? |
|---|---|---|---|---|
| Electric utilities, SoCal | 25 | 5.4 MB (1.2 MB gzipped) | Yes, once trimmed, simplified and the holes fixed | Yes |
| Gas utilities, statewide | 13 | 1.1 MB | Yes | Yes |
| Climate zones, statewide | 16 | 2.3 MB | Yes, once clipped | Yes |
| Fire zones, SoCal, both layers | about 7,500 | 44 MB | No | Yes, or query the hosted service |

- The services are stored in Web Mercator; pass `inSR=4326` and `outSR=4326`.
- Always handle more than one hit.
- A hosted query suits a background job (one call per layer per address, with retry), but service names carry versions and change with the next map release.
- Whether PostGIS is enabled on our Neon plan was not checked.

### B.8 A stack at $0

1. **Geocode:** Geocodio. Keep Google's `place_id` only if the form already uses Google autocomplete.
2. **Jurisdiction:** the Census call on the stored point.
3. **Electric, gas, climate zone:** the three CEC layers, downloaded once, with the fixes in B.2.
4. **Climate averages:** PRISM, clipped once to SoCal; twelve months of mean, high, low and precipitation per address. NOAA station normals for "days above 90°F" and wind.
5. **Sun:** PVWatts v8 at `tilt=0`.
6. **Hazards:** hosted point queries to CAL FIRE, FEMA, the Geological Survey and USGS, stored with each layer's date.
7. **Rates:** a small table per utility from EIA-861, refreshed yearly.

### B.9 Not verified

- The CEC's and PRISM's terms for commercial use.
- Geocodio's price above the free tier, and whether its response says rooftop or interpolated.
- The terms of the Census geocoder, NOAA, the LA County locators, the NLR developer APIs, FEMA and USGS.
- Where the small city utilities (B.2 item 5) really serve, and whether LADWP matches the LA city limit exactly.
- Southwest Gas in the high desert; climate zone 16.
- Any city-level average UV index table.
- Local adoption of the 2025 fire maps, city by city.

---

## C. Parcel and building facts

**Bottom line.** County records give the parcel outline, lot size, year built and a building footprint with height for all four core counties at $0. Only Riverside records roof material, garage and stories. LA adds pool and heating/cooling through its use and design codes. RentCast is the only paid API whose public terms clearly allow storing the data and showing it to third parties; whether it fills roof, garage and stories for LA, Orange and San Bernardino homes is untested.

Every county row was queried live on 2026-11-05. Each parcel layer answers a point query (`geometry=lng,lat&inSR=4326&spatialRel=esriSpatialRelIntersects`) and returns the outline.

### C.1 County records ($0)

| Source | Lookup | Fields that come back | Terms | Caveats | URL |
|---|---|---|---|---|---|
| **LA parcels** | Point; situs address; `AIN` | `UseCode`, `DesignType1..5`, `YearBuilt1..5`, `EffectiveYear1..5`, `SQFTmain1..5`, `Bedrooms1..5`, `Bathrooms1..5`, `Units1..5`, `Shape.STArea()` | LA eGIS terms grant a "license to copy, publish, distribute… and to exploit the Data for commercial and/or personal use" | No stories, garage or roof fields. Pool is digit 4 of `UseCode`; heating/cooling is digit 3 of `DesignType1` | https://cache.gis.lacounty.gov/cache/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0 |
| LA Assessor portal JSON | `ain` | Adds `SqftLot`, `LandWidth`, `LandDepth`, and the decoded digits ("Pool", "Central Refrigeration and Heat") | No terms found | The public portal's internal API, undocumented; it can change without notice. Use it to confirm the digit meanings, not as a dependency | https://portal.assessor.lacounty.gov/api/parceldetail?ain=2184038019 |
| **LA building outlines** | Intersect with the parcel | `HEIGHT` (ft), `AREA`, `CODE`, `DATE_` | LA eGIS terms | 3.29M outlines; 94% have a height; only 11% are dated 2020 or later, the rest go back to 2006–2008 | https://services.arcgis.com/RmCCgQtiZLDCtblq/arcgis/rest/services/Countywide_Building_Outlines_(2020)/FeatureServer/0 |
| **Riverside parcels** (layer 50) | Point; situs; `APN` | `ACREAGE`, `CLASS_CODE`, situs, values | No licence text (UNVERIFIED) | Cloudflare blocked some `where` clauses; untested from Vercel | https://gis.countyofriverside.us/arcgis_mapping/rest/services/OpenData/Assessor/MapServer/50 |
| **Riverside characteristics** (table 80) | `PIN` | `YEAR_BUILT`, `NUMBER_OF_STORIES`, `ROOF_TYPE`, `GARAGE_TYPE`, `GARAGE_SIZE`, `LIVING_AREA`, `BEDROOM_COUNT`, `BATH_COUNT`, `CENTRAL_HEATING`, `CENTRAL_COOLING`, `HAS_POOL`, `SHAPE_CODE` | Same | One row per building | …/OpenData/Assessor/MapServer/80 |
| **Orange parcels** | Point; `SITE_ADDRESS` | `YEAR_BUILT`, `NBR_BEDROOMS`, outline | The county calls it "publically available" but cites a licence template and "copyrighted matter" (UNVERIFIED) | Nothing else: no living area, stories, pool, garage, roof. Lot size from the outline's area | https://www.ocgis.com/arcpub/rest/services/Map_Layers/Parcels/FeatureServer/0 |
| Orange building footprints | Point; `Address` | `Height`, `Shape__Area` | None stated | 754,811 outlines; vintage not stated | https://www.ocgis.com/arcpub/rest/services/Map_Layers/Building_Footprints/FeatureServer/0 |
| **San Bernardino parcels** | Point; `ParcelNumber` | `Acreage`, `AssessDescription`, `BaseYear`; a second dataset adds `CONST_YEAR`, `Latitude`, `Longitude` | A warranty disclaimer only | No situs address on the official layer. The second dataset is published under an individual's account. Footprints are 2021, urban area only, with `Height` | https://services.arcgis.com/aA3snZwJfFkVyDuP/arcgis/rest/services/Parcels_for_San_Bernardino_County/FeatureServer/0 |
| Ventura | Point; `apn`; `address` | Footprints carry `yr_blt`, `flr_1a`, `flr_2a`, `height` | None stated | Floor areas give living area and stories; sample imagery 2015 | https://maps.ventura.org/arcgis/rest/services/DataDownloads/CommonData/MapServer |
| Kern | Point; `APN` | `SHAPE_SQFT`, outline | As-is disclaimer | No address or building facts | https://services5.arcgis.com/Y8jwjGUWbRjuqpG5/arcgis/rest/services/Assessor_Parcels_Land_2026_gdb/FeatureServer/0 |
| Microsoft footprints | Bulk files | Outline, `height` | CDLA Permissive 2.0 | Not an API | https://github.com/microsoft/GlobalMLBuildingFootprints |

Sample results:

| County | Home | What came back |
|---|---|---|
| LA, Encino | 18041 Green Meadow Dr | Pool, 2018, 4,935 sq ft, 5 bed / 6 bath, lot 17,546 sq ft (80 × 210), two outlines at 25.9 ft and 13.3 ft |
| LA, Lancaster | 36915 95th St E | 1990, 1,134 sq ft, 3 / 2, one outline at 14 ft (2008 geometry) |
| Orange, Anaheim | 905 N Holly St | 1954, 3 bed; footprint 9.4 ft, 2,512 sq ft |
| Riverside, Corona | 11544 Merry Hill Dr | 0.17 ac, 1984, 2 stories, Tile/Slate, attached garage 432 sq ft, living 1,904, central heat and cooling |
| San Bernardino, Alta Loma | 10324 Holly St | 0.2 ac, built 1977; footprint 21.1 ft, 2,316 sq ft |

Riverside fill rates over 692,546 single-family building rows: roof type about 99% (Tile/Slate 463,120; Rock/Composite 165,434; Shake/Wood Shingles 54,039; Membrane 3,167), stories 99.2%, living area and year built over 99.9%, attached garage 83.5% ("Detached" appears on one row), pool 22.9%. Central cooling reads "Yes" on 99.6%, which looks like a default, not a measurement.

### C.2 Paid APIs with one schema

| Source | Returns | Cost | Terms (store / show) | Caveats | URL |
|---|---|---|---|---|---|
| **RentCast** | Lot size, year built, living area, beds, baths, `floorCount`, `garage`, `garageSpaces`, `garageType`, `pool`, `roofType` (material), `heatingType`, `coolingType`, latitude, longitude | 50 free a month; $0.20 each after; $74 a month for 1,000 | Right to "use and/or store the API Data" and "to sublicense, disclose, display, resell and distribute the API Data to third parties"; may keep it after termination | No parcel outline, no roof shape. "Data availability… may vary by county" | https://www.rentcast.io/terms-api |
| **Realie** | Parcel outline, acres, `lotFrontage`, `lotDepth`, stories, year built, living area, `garageCount`, attached/detached code, pool, `roofMaterial`, `roofStyle` (gable, hip, flat), `building.shape`, heating, cooling | 25 free a month; $0.15 each after; $50 a month for 1,250; a no-match is free | "Personal, non-commercial use or internal business purpose"; nothing "publicly displayed… for any commercial purpose" without written permission | States it is "not a consumer reporting agency". Permits "not currently populated". No fill rates published | https://www.realie.ai/terms |
| ATTOM | Roof cover, heating, pool, size, year built | "Starting at $500/month" | Agreement not public | Over budget at our volume | https://www.attomdata.com/solutions/delivery/property-data-api/pricing/ |
| Regrid | Parcel outline and assessor attributes | $0.10–0.15 per record past 2,000 a month; base fee not published | Not read | Footprints with heights are Enterprise only | https://support.regrid.com/reference/plan-options |
| BatchData, PropertyRadar, HouseCanary, Melissa | — | $1,000 a month; $119 a month; $79 a month plus $0.40 a call; $1,760 a year | Not read | Over budget or unconfirmed fields | — |
| Zillow/Bridge, Cotality Trestle, Datafiniti, DataTree | — | Not published | — | Invite-only or not a public-records API | — |

RentCast and Realie both draw on county assessor records. LA, Orange and San Bernardino publish no roof field, so nulls are likely there (UNVERIFIED until tested with a key).

### C.3 Permits: when the roof, HVAC or water heater was last replaced

| Source | Lookup | Returns | Cost | Caveats | URL |
|---|---|---|---|---|---|
| **LADBS** (City of LA; nine datasets back before 2010) | `apn` (the county AIN), address | Permit type, issue date, status, valuation, `work_desc`, `solar` | $0; no licence set (UNVERIFIED) | Most re-roof text is boilerplate: it gives the date, the roof squares and the weight class, not always the material. The mechanical set carries HVAC and water-heater rows | https://data.lacity.org/resource/pi9x-tg5x.json |
| **EPIC-LA** (unincorporated LA County) | `MAIN_AIN`, address | Case name, `DESCRIPTION`, issue date, valuation | $0; LA eGIS terms (commercial use granted) | 2018 onward. Descriptions often name the material ("Reroof for 2300 sqft with asphalt shingle") | https://services.arcgis.com/RmCCgQtiZLDCtblq/arcgis/rest/services/EPIC-LA_Case_History_view/FeatureServer/0 |
| Shovels | Address | Permits with description, tags, dates, job value | Free tier has one year of history only; $599 a month above it | "Licensed for internal business use". The free tier cannot answer "when was the roof last replaced" | https://www.shovels.ai/pricing |
| Other cities' permit portals | — | — | — | Not surveyed | — |

### C.4 A stack

1. **Find the parcel (free):** geocode, then point-query the county parcel layer; fall back to a situs-address match where the layer has one.
2. **County facts (free):**
   - LA: year, living area, beds and baths; pool and heating/cooling from the code digits; outlines for footprint and height;
   - Riverside: everything except roof shape;
   - Orange: year built, outline, footprint height;
   - San Bernardino: acreage, construction year, footprint height.
3. **Stories where the county has none:** from footprint height, and living area divided by footprint area. The Encino sample (4,935 sq ft over a 3,674 sq ft footprint at 25.9 ft) reads as two stories.
4. **Permits (free, LA only):** LADBS inside the City of LA, EPIC-LA in unincorporated areas.
5. **Paid fallback, RentCast,** only when the county lacks stories, garage, roof material or living area. At 150 paid lookups a month the bill is about $20, roughly $0.13 an address on that subset.
6. **Before building on step 5:** run about 20 real LA, Orange and San Bernardino addresses through RentCast's and Realie's free tiers and count the nulls for roof, garage and stories. It costs nothing and settles the main open question.

Realie has the richer schema (outline, roof shape, attached or detached) but its terms bar public display without written permission. Write to hello@realie.ai before any Realie fact reaches a homeowner's screen.

**Still for the rep to enter or confirm:** roof shape everywhere; roof material outside Riverside unless a permit or RentCast supplies it; garage count and attachment outside Riverside; pool in Orange and San Bernardino; heating and cooling outside LA and Riverside.

### C.5 Corrections to earlier docs

- Layout research §4.2: "Realie (ex-Estated)" is wrong. ATTOM acquired Estated in 2022; Realie is a separate company.
- Layout research §4.2: Riverside's building fields sit in table 80, not on the parcel layer, and `HAS_POOL` is '1' or blank.
- Layout research §4.2: Orange and San Bernardino also publish footprints with heights.
- ⚠️ Stale ref — `docs/plans/2026-10-16-attom-property-data-handoff.md` §2 says ATTOM's pricing "is not published"; ATTOM's pricing page now shows "Starting at $500/month".

### C.6 Not verified

- Licence terms for Riverside, Orange, Ventura and data.lacity.org.
- Whether Riverside's Cloudflare lets Vercel's servers through.
- RentCast's and Realie's fill rates for roof, garage and stories in any California county; whether a RentCast no-match is billed.
- Whether Realie's API has licence terms separate from its website terms.
- How Riverside records detached garages.
- Regrid's base fee; ATTOM's call volumes; Shovels' California coverage.
- Permit portals for cities other than Los Angeles.
