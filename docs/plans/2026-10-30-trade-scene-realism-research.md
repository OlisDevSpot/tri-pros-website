# Trade scene realism: the reference render, the gap, and how to close it

**Written:** 2026-10-30, for TS3b.6 (tracker `docs/plans/2026-10-16-trade-scenes-epic.md`, §2 row TS3b.6 and §2b).
**Reference:** `assets/trade-scene-realism/reference-render.jpg` (an AI render the owner picked as the target look: a SoCal single-story flat-roof stucco home with an attached garage). **Today:** `assets/trade-scene-realism/today-2026-10-30.jpg` (the lab page, gable shingle home, Today).

Three read-only research passes, kept as written. Sizes read off the render are estimates scaled from the doors. File:line citations in Part 2 are from branch head 2026-10-30 and drift as other sessions edit; check the code before quoting any of it. Part 3's dimension sources are tagged by strength inside it.

- Part 1: what the reference render shows (inventory)
- Part 2: the gap between the render and our code, with the files each fix touches and the overlap with in-flight work
- Part 3: real SoCal lot dimensions, and the cheapest ways to the look on an iPad in three.js / R3F

---

# Part 1: Reference inventory


Source: `assets/trade-scene-realism/reference-render.jpg` (1194 × 1600 px, portrait 3:4, AI-rendered). Colours were sampled as 9×9 px averages from the JPEG. They are the colours as rendered, already lit and graded, not albedo. To get albedo, take about 10–15 % less warmth off sunlit samples and lighten shaded ones.

Conventions: "left/right" = as seen in the image. The house front faces the camera and the street (lower right of frame). The living volume is on the left, the garage on the right. "(inf)" marks an inference, not something directly visible.

Scale anchors used: entry door ≈ 160 px tall and 52 px wide in the image, so the front facade carries about 55 px per metre horizontally and about 79 px per metre vertically (vertical lines are foreshortened by the downward pitch). The garage door is ≈ 145 px wide, which suggests a single door of about 2.7 m. That is consistent with the entry door.

---

## 1. House massing

| Item | Observation |
|---|---|
| Footprint | A simple rectangle about **12 m wide × 7–8 m deep** (inf. ±1.5 m on depth; the depth axis is strongly foreshortened). Living volume ≈ 8.5 m of the front, garage bay ≈ 3.6 m on the right. Roughly 90 m² in all, a compact or ADU-scale house. |
| Storeys | One. |
| Wall height | Ground to the underside of the cornice band ≈ **2.4–2.5 m**. The band sits only ~0.3 m above the door head. |
| Parapet | The parapet face runs from the cornice band to the cap, ≈ 0.5–0.6 m. Total ground-to-cap height ≈ **3.3 m**. On the roof side the parapet stands ≈ **0.4–0.5 m** above the roof deck, and its inside face is visible all round. Wall and cap thickness ≈ 0.25–0.3 m. |
| Garage vs living | The garage bay reads as its **own parapet block**. A vertical stucco pilaster / reveal (~0.25 m wide) runs from the ground to the cap at the junction. The cap and cornice **step up** there: the garage cap sits ≈ 0.1–0.2 m higher, and the cornice band turns a small corner (inf.: the garage face is flush with or ≤ 0.2 m proud of the living face). One continuous roof deck runs behind both, with no interior parapet between them. |
| Corners | The front-left corner has a slight pilaster/quoin strip that the cornice bands wrap around. The left side face is plain. |
| Roof | Flat (low-slope). A **light warm-grey membrane** (#bbb5a9 lit, about #c4bfb4 in the cleaner areas). Visible **roll laps** run parallel to the front at roughly 0.9–1 m spacing. There are faint darker blotches. Along the base of the back parapet runs a **darker grey band** (ponding or cricket flashing stain, ~0.3 m wide). |
| Roof penetrations | **Two plumbing vent stacks**: off-white PVC, Ø ≈ 0.1 m, ≈ 0.3 m tall, each with a small cap/collar. One sits about 1.5 m in from the front-left corner, the other about mid-depth, centre-right. There are no skylights, no HVAC unit and no solar. |
| Drainage | **One downspout** on the front face, ~0.3 m right of the front-left corner. Round, Ø ≈ 75 mm, painted the stucco colour (#896f53 in shade). It has a **funnel conductor head** directly under the cornice band, which implies a scupper through the parapet (inf.). It runs straight down into the front bed, with a white splash stone at its foot. No gutters anywhere. |

## 2. Architectural detail / trim

- **Stucco**: a fine sand / light-dash finish with soft, low-frequency mottling (cloudy tonal variation of about ±5 % luminance over 0.5–1 m patches). It is not a heavy lace texture.
  - Front face, sunlit: **#d3ab7d**. Upper wall near the cornice: #d9b385.
  - Left side face, in shade: **#8c7760**.
  - Trim is the same colour family, a hair lighter.
- **Parapet cap**: a flat stucco/precast cap, slightly lighter and cooler (**#beb9ae**). It projects ~4–6 cm past the parapet face on the outside and also on the inside (roof side). The edge is softly rounded or eased. A thin shadow line sits under the outer edge.
- **Cornice band**: below the plain parapet face is a **two-step stacked band**, an upper fascia ~12–15 cm tall over a lower step ~8–10 cm tall. Each step projects ~3–5 cm, so the total projection from the wall is ~8–10 cm. Each step has a crisp soft shadow line under it. The band wraps the front-left corner and runs along the left side. It steps up at the garage junction.
- **Overall cornice reading** (top to bottom): cap (1 step, overhanging) → plain parapet face (~0.5 m) → 2-step band → wall. That is about **3 steps of shadow** in total.
- **Window surrounds**: flat stucco casing ~10–12 cm wide, ~2–3 cm proud of the wall. The **sill** is deeper: it projects ~4–5 cm and its ends run past the casing sides by ~5 cm (eared sill). There is no head pediment.
- **Door surround**: the same flat casing on the sides and head. There is no sill; the door sits on the stoop.
- **Garage door surround**: the same flat casing. The door is recessed ~10–15 cm into the opening, so there is a dark reveal on the left and top.
- **Pilaster** at the living/garage junction (see §1).
- **Utility items**:
  - Left side wall, ~0.6 m above grade near the front: a small grey box (~15 × 20 cm) with a conduit running down to grade. It could be an outlet cover, an irrigation controller or a GFCI box (inf.).
  - On the same wall, just above the gate top near the front corner: a small white box (~15 cm), possibly a light or sensor (inf.).
  - No electric meter, hose bib, house numbers, porch light or garage lights are visible. These absences are notable: the front is bare of fixtures.
- **Vents**: none are visible on the walls; the only vents are the roof stacks.
- **Weep screed**: not clearly visible. Mulch and lawn meet the wall base, with a faint dark contact line (AO). Inferred to exist at grade.

## 3. Openings

| Opening | Where | Size (≈) | Detail |
|---|---|---|---|
| Window W1 | Front, left of the door | 1.5 W × 1.2 H, sill ≈ 0.9 m | Horizontal slider, 2 panes, vertical meeting rail. Frame **dark charcoal/bronze vinyl or aluminium (#4a4a46)**. |
| Window W2 | Front, between the door and the garage | 1.2 W × 1.1 H, sill ≈ 1.0 m | Same type. Its glass shows a bright reflection (the render invents a figure-like shape). |
| Window W3 | Left side face, about 2 m back from the front corner | 0.75 W × 1.3 H | Tall single-hung or slider. Same frame and surround. |
| Glass, all windows | | | Dark, reflective, greenish-grey (#5b5549). Reflects lawn and sky. No interior visible. |
| Entry door | Front, right of centre of the living face (x ≈ 5.4 m from the front-left corner) | 0.91 × 2.03 | **Charcoal grey (#5b564c)**. Two panels: a tall upper raised panel and a shorter lower one. Satin-nickel lever plus deadbolt. No glass, no sidelights, no awning. |
| Stoop | In front of the door | ≈ 1.4 W × 1.0 D, one riser of ~15 cm | Plain concrete. It connects to a path leading toward the street and to a slab running right to the driveway. |
| Garage door | Garage bay | ≈ 2.7 W × 2.1 H, single | Sectional steel, **4 sections × 2 long raised panels = 8 panels**, no windows. **Grey (#68635a)**, a touch lighter and warmer than the entry door. |

Total visible: 3 windows, 1 door and 1 garage door. The back and right faces are not visible.

## 4. Lot layout / property lines

- **Front setback**: from the house face to the back of the public sidewalk ≈ **7–8 m** (inf., using a camera-geometry estimate together with typical CA 20–25 ft setbacks).
- **Left side yard**: ≈ **3 m**. It is closed at the front plane of the house by a **double cedar gate**: two leaves, each ~1.4 m wide, ~1.85 m tall. Vertical boards ~14 cm wide sit in a frame with a top cap rail, with black hinges and latch. The colour is **orange-brown cedar #a8602b**; it is new and unweathered. The gate runs from the house's front-left corner to the left property wall. Behind it is a lawn strip leading to the backyard.
- **Left property line**: a **smooth grey concrete wall**, poured or plastered block with no joints visible.
  - Size: ~1.8 m tall, ~0.15–0.2 m thick, flat top with no cap.
  - Colour: **#a49787** on its lit/top surfaces, **#726556** on the shaded face.
  - It runs the full depth from the back wall to the front yard, and **ends ~1–1.5 m short of the sidewalk** (inf.) with a squared end face.
  - At the house front line, a **neighbour's perpendicular wall** of the same type returns to the left. Behind that is a strip of bare soil about 1.5 m wide (the neighbour's side yard), then a second parallel wall.
- **Right side**:
  - The **driveway** sits in front of the garage. It is ≈ **5.5 m wide** (the garage door width plus an ~2.5 m parking strip to the right, where a grey crossover SUV is parked). Its length runs from the garage to the sidewalk.
  - A **cedar board fence** (~1.8 m, the same style as the gate) runs back from the garage's front-right corner. In front of it is a small concrete pad about 1 m deep, with a mulch strip at the fence base.
  - The right neighbour's two-storey wall is ≈ 2–3 m beyond the fence. The right property line is inferred at the fence / driveway's right edge.
- **Front walkway**: concrete, ~1.2 m wide. It runs straight from the stoop toward the street, parallel to the driveway. A **lawn strip ~1.3 m wide** separates it from the driveway. A short connector slab runs from the stoop right toward the driveway along the facade. Scored joints are about every 1.2–1.5 m.
- **Driveway joints**: control joints divide it into panels of roughly 2.5–3 m. There is one transverse joint near the garage apron, and the apron is slightly lighter.
  - Colour: drive **#9b9b92**, walk **#afaba0**. Both are cool light-grey broom-finish concrete with faint tyre and water marks.
- **Public sidewalk**: a light concrete band (≈ 1.2 m) crosses the bottom-right corner of the frame, parallel to the house front, with a scored joint visible. The curb and street are out of frame.
- **Backyard** (visible past the house's left-rear corner):
  - A **paver patio** ≈ 4 × 3.5 m: grey concrete pavers with light joints, lit ≈ #a8a49c.
  - **4 lounge chairs** in teak / light wood with cream cushions, arranged in a U around a **low wood coffee table** with a small bowl on it.
  - **3 large rectangular stepping stones** (~0.9 × 0.45 m, light grey) set in the lawn, leading from the patio toward the side yard and gate.
  - The lawn is lush.
  - The **back wall** is beige stucco-finished block, ~1.8 m tall. The backyard depth to it is ≈ 8–10 m behind the house (inf.).
- Inferred lot: about **17 m wide × 26–30 m deep** (a typical 50–60 ft × 90–100 ft lot).

### ASCII lot plan (metres, approximate; top = back, bottom = street)

```
x: 0    2    4    6    8    10   12   14   16  17
   :    :    :    :    :    :    :    :    :   :
26 W=========== back wall (beige stucco block, 1.8 m) ===========+
   W palms  [patio 4x3.5]   trees/shrubs at wall                 |
22 W  pyg.  chairs x4+table                                      |
   W  palm  [ ][ ][ ] stepping stones          (unseen)          F
18 W   lawn                                                       F  nbr
   W        +----------------------------------+----------+       F  2-storey
16 W        |                                  |          |       F  ~2-3 m
   W  side  |     LIVING  ~8.5 x 7.5           |  GARAGE  |       F  beyond
12 W  yard  |     flat roof, 0.45 m parapet    |  ~3.6 m  |       F
   W  lawn  |  o vent                 o vent   |  bay     |       F
 8 W==GATE==+--W3(side)--W1----DOOR---W2-------+==[GDOOR]=+--F----+
   W  (1.85)   bed: agave,shrub,sago |stoop|bed |                   |
 6 W bed  .    curved lawn edge      |walk |lawn|  DRIVEWAY ~5.5 m  |
   W agave,    FRONT LAWN            |1.2m |1.3 |  (car parked on   |
 4 W pygmy                           |     |    |   right half)     |
   W palms                           |     |    |                   |
 1 W  (wall ends ~1 m short)         |     |    |                   |
 0 ====================== public sidewalk ~1.2 m =====================
                        curb / street (out of frame)
 <- left nbr: lawn w/ dead patches, perpendicular wall at y=8,
    bare-soil strip + 2nd wall behind it
 W = concrete property wall (1.8 m)   F = cedar fence (1.8 m)
 Camera: above the left neighbour's front yard, ~2-4 m left of W,
 near y ~ 0-2, ~8 m up, looking back-right at ~28 deg down.
```

## 5. Landscaping

| Group | Where | Size | Colour / notes |
|---|---|---|---|
| **Agave** (Agave americana type, blue-grey) | Front bed, just right of the downspout | ~1.0 m spread, 0.7 m tall | Glaucous blue-grey #51574b to #7f8a80, with pale leaf edges. |
| Rounded shrub (pittosporum/boxwood, inf.) | Front bed, between the agave and the sago | ~0.6 m mound | Deep green. |
| **Sago palm** (Cycas revoluta) | Front bed, just left of the stoop | ~1.2 m spread | Dark glossy green fronds. |
| Strap-leaf clump (bird of paradise or a cordyline-like plant, inf.) plus low shrubs | Bed between the stoop and the garage | ~1.0–1.3 m tall | Mid green, some yellowing. |
| Front bed | Along the front face from the downspout to the stoop | ~1.2 m deep, **curved (convex) front edge** | **Dark brown bark mulch #2f1f15**, a few white decorative stones, **thin dark steel edging** at the lawn line. |
| Wall-side bed | Right of the left wall, running from the gate to the front | ~1.2 m wide, ~8 m long | The same mulch and steel edging. **Sequence from the gate toward the street**: round green shrub (0.6 m), variegated yellow-green spiky plant (Dianella / variegated yucca, inf., 0.7 m), small pygmy date palm (0.9 m), blue agave (0.8 m), larger blue agave (1.1 m), pygmy date palm / fan-like palm (1.2 m). Spacing ≈ 1–1.5 m, all in a single row. |
| **Front lawn** | The whole area between the beds, the walk and the sidewalk | — | Coarse warm-season turf (St. Augustine / kikuyu look). Lit **#4e5b13**, with lighter yellow-green flecks. **Not striped**: a shaggy surface with very faint mowing direction, scattered small yellow/brown spots (one near the bed edge, one by the right edge), visible individual blades in the foreground. |
| Lawn strip | Between the walk and the driveway | 1.3 m | Same turf. |
| Backyard plants | Along the left wall, by the patio | ~2–2.5 m | **2–3 pygmy date palms** (Phoenix roebelenii) with yellow-green crowns, plus ferns or low shrubs at their bases. |
| Backyard trees | Along the back wall | 3–4 m | A small broadleaf tree (citrus/ficus look, standard form) centre-back; a fan / Mediterranean palm; dense shrubs and ferns at the wall base. |
| Backyard lawn | Between the patio and the gate | — | Brighter and more uniform than the front lawn, a vivid green. |
| Left neighbour's lawn | Foreground left, outside our wall | — | **Patchier**, with brown dead patches and bare soil near the perpendicular wall. Darker, because it sits in the wall's shadow. |

## 6. Neighbours & surroundings

- **Houses visible**: about 4–5, all **two-storey stucco** with **hipped roofs** of **brown/terracotta concrete S-tile** (#966d54 lit, #806658 shade).
  1. **Left**, behind the left wall, ~12–18 m away. A two-storey main block with a one-storey hip wing in front. Stucco warm beige (#ae7c4b lit, appearing warmer in sun). White-framed sliders, one with a glass-block / gridded window.
  2. **Centre-back**, ~25–35 m away. Two-storey with a one-storey tile projection in front of it.
  3. A further house peeking between the left and centre houses, ~40 m away.
  4. **Right**, very close: ≈ 2–3 m beyond our right fence, a large two-storey block. Greige stucco in shade (#a69c92). White sliders, a white gutter, a small white wall box, and a tile roof with a lower wing reaching into the frame at the right edge.
- **Chimneys**: **3** boxy stucco chimneys with caps, on the left, centre and right houses. Plus a small roof vent on the left house.
- **Eave/fascia**: narrow boxed eaves (~0.3–0.5 m) with a fascia in the stucco colour.
- **Trees beyond**:
  - **Mexican fan palms** (Washingtonia robusta). The tallest, behind the centre-left, is ~20 m. Others ~12–18 m sit left and right on the skyline.
  - **Queen palms** (Syagrus, feathery), centre-left, ~10–12 m.
  - One **Italian cypress** column, centre, ~10 m.
  - Large **eucalyptus**, right-centre, ~20–25 m, with grey-green open canopy and white trunks.
  - Dense **broadleaf canopy trees** (ficus/magnolia look), 6–10 m, between the houses.
  - A large-leaf banana / giant bird of paradise, centre-left behind the patio wall.
- **Depth layering**:
  - foreground: our lot and walls (3–15 m)
  - midground: neighbour houses and canopy (12–40 m)
  - background: a continuous tree band with **palms and eucalyptus breaking the skyline** (50–200 m)
  - beyond that, nothing: there is no visible horizon, hills or other houses. Clutter and density increase toward the back. Roofs overlap roofs, and trees fill every gap so no sky shows between houses below about 260 px.

## 7. Lighting & atmosphere

- **Time**: golden hour, inferred late afternoon. Low sun, warm light, no clouds.
- **Sun direction**:
  - from the **front-right** of the house: the front face is lit, the left side face is in shade, and the right neighbour's left-facing wall is in shade
  - azimuth ≈ **40–60° right of the front-facade normal**
  - elevation ≈ **20–25°**, from the wall shadow: the 1.8 m left wall casts a ~4 m shadow leftward onto the neighbour's lawn
  - the AI render is not fully shadow-consistent; the house's own shadow does not clearly darken the side yard
- **Shadows**: **very soft**, with low contrast and wide penumbras. They are **slightly cool, green-olive** on grass (lawn in shadow #182907–#2a3a10) and greyish on concrete. Shade-to-light ratio on stucco ≈ 1 : 1.6 (#8c7760 vs #d3ab7d), so the fill from the sky is strong.
- **Ambient occlusion**:
  - clear darkening at the wall–ground contact, along bed edges and where the gate meets the grass
  - under each cornice step and the cap, a thin, crisp, soft line
  - in the garage-door reveal
  - under the car, a strong soft blob
  - in the inner corners of the parapet on the roof
- **Sky**: cloudless. A vertical gradient from pale neutral cream at the top (**#edeee8**) through #f2eee2 to warm peach at the treeline (**#f8e8d4**). Overall very bright, close to white, with low saturation.
- **Haze / aerial perspective**: there is moderate haze.
  - Distant trees are lifted and desaturated toward a warm grey-beige (about +15–25 % luminance, −40 % saturation at ~100 m).
  - Neighbour houses at 30–40 m are noticeably flatter than our house.
  - The haze colour matches the horizon peach.
- **Colour grade**:
  - warm, with whites pushed to cream
  - moderate saturation: greens lean yellow and olive, the cedar is pushed orange
  - lifted blacks: nothing is pure black except under the car
  - soft highlight roll-off: no clipped whites, even on the sunlit cap and concrete
  - medium-low global contrast and a slightly filmic look

## 8. Camera

- **Height**: ≈ **8 m** above grade, just above the neighbours' ridge lines. Their ridges sit at or slightly below the horizon.
- **Position**: above the left neighbour's front yard, ~2–4 m left of our left wall, roughly level with the sidewalk. We see the left face of the property wall, so the camera is on the neighbour's side of it.
- **Distance**: ≈ 13–14 m to the house's front-left corner, ≈ 18 m to the garage.
- **Pitch**: ≈ **28° down**. The horizon falls at ~y 245 of 1600 (15 % from the top). The house sits just below frame centre.
- **Yaw**: looking back-right, ≈ 30–35° off the facade normal, so the front face and the left side are both visible (the front dominates).
- **FOV**: portrait 3:4, vertical FOV ≈ **70–75°** and horizontal ≈ **55–58°**, about a 24–26 mm full-frame equivalent. This is a typical drone wide lens held in portrait.
- **Framing**:
  - the house fills the middle band (y 460–920), with the roof deck fully readable
  - the left wall runs as a strong diagonal leading line from the bottom centre to the mid-left
  - the front lawn fills the lower half
  - the car is cropped at the right edge, the sidewalk clipped at the bottom right, the left neighbour's lawn bleeds off the bottom left
  - the sky takes the top ~15 %, trees and palms break the top edge
  - no roll

## 9. What makes it read as real (ranked)

1. **Soft, low golden-hour light with strong sky fill.** The front is warm-lit and the side is shaded with no harsh black. This one lighting model unifies everything.
2. **Aerial perspective / haze layering.** Distant houses and trees fade toward peach-grey and give the scene physical depth.
3. **Dense, layered background clutter.** Overlapping tile roofs, chimneys, canopy and skyline-breaking palms and eucalyptus mean the world never ends and no sky shows between objects.
4. **Ambient occlusion and contact shadows.** Dark contact at the wall base, the cornice-step shadow lines, the garage reveal and the car blob ground every object.
5. **Lawn micro-variation.** The turf is coarse and shaggy, with colour flecks, yellow spots and dead patches next door. It is not a flat green plane.
6. **Material imperfection on hard surfaces.** The stained and chipped concrete wall, the mottled stucco, the roof membrane laps and blotches, and the faint tyre marks on the drive.
7. **Correct architectural trim depth.** The stepped cornice, eared sills, recessed garage door and parapet cap catch light as real profiles, with 3–4 shadow lines per edge.
8. **Plausible suburban layout and scale cues.** Property walls, the gate, the walk/lawn/driveway split, the parked car and patio furniture, all at believable sizes and setbacks.
9. **Organic planting with species variety.** Agave, sago and pygmy palms in mulch beds with steel edging. Each plant has its own silhouette and is not repeated identically.
10. **Gentle filmic grade.** Lifted blacks, cream whites and warm-shifted greens hide CG-perfect colour and tie the scene to a camera.

## 10. Clean vs worn

The house itself is **pristine and newly finished**: crisp stucco, no cracks, clean trim, new cedar gate and fence, fresh mulch, new-looking roof membrane. The visible wear is:

- **Left concrete property wall**: grey mottling, dark dirt streaks running down from the top, lichen/efflorescence speckle, **chipped and rounded top edge**, a few small spalls on the end face.
- **Neighbour's perpendicular wall**: **heavy staining**, a large whitewashed/patched rectangle low down, a dark damp band at the base. This is the dirtiest surface in the frame.
- **Neighbour's lawn**: brown dead patches and bare soil. The neighbour's side strip is all bare dirt.
- **Our roof**: faint dark spots, a darker ponding/flashing band at the back parapet, slightly dusty membrane.
- **Our lawn**: a few small yellow/brown spots near the bed edge and the right edge. Otherwise healthy.
- **Driveway and walk**: light water and tyre staining, slightly darker patches by the garage apron.
- **Plants**: some yellowing leaves on the strap-leaf clump by the garage and on the pygmy palms.
- **Downspout**: clean.

Rebuild note: wear concentrates on the **neighbours' and boundary surfaces**, while the subject home stays crisp. The contrast makes the house read as freshly finished.

---

# Part 2: Gap analysis against the code


Read-only research, 2026-10-30, worktree `.worktrees/trade-scenes` (branch `feat/trade-scenes-foundation`, head `9a699167e`).
Paths below are relative to the worktree. `F/` = `src/features/trade-scenes/`, `S/` = `src/shared/components/scene/`.

**Live-tree caveat.** Other sessions are editing the tree right now. `home-geometry.ts`, `house-shell.tsx`, `low-slope-roof.tsx` and `wall-boxes.ts` carry uncommitted hunks. `wall-skin.tsx`, `wall-skin-geometry.ts` and `wall-skin-outline.ts` are untracked: they are the TS3b.4a fixes' Fix B fallback, and `9a699167e` landed during this research. Line numbers are as of the working tree on 2026-10-30 and will drift.

**Images compared.**
- Reference (`assets/trade-scene-realism/reference-render.jpg`): a portrait drone shot from about 10–12 m up, looking roughly 35–45° down from the front-left corner of the lot. It shows a one-story flat-roof stucco house with an attached garage, golden-hour light, and a full lot: property-line block walls, a wood gate, front lawn and planting beds, a walk, a driveway, a car, a sidewalk, and the backyard patio through the side yard. Two-story tile-roof neighbours and palms and eucalyptus fill the background.
- Ours (`assets/trade-scene-realism/today-2026-10-30.jpg`): the lab page, gable shingle roof, Today, worn. It shows a box house on a flat green disc, two lollipop trees, blob shrubs, a back block wall, flat walk and driveway slabs, and the condenser at the left. There are no neighbours, no street and no lot edges.

---

## Ranked gaps by visual impact (my read)

1. **No lot and no surroundings.** There are no property-line walls, side yards, gate, street, sidewalk or neighbours, so the house floats on a 60 m green disc against a bare horizon. This is the biggest "toy vs real home" difference.
2. **Lighting and atmosphere.** The sun is high (~50°), lit from the front, flat and clean. There is no golden hour, no ambient occlusion, a two-panel 64 px code-built environment, and a gradient dome with no haze or sun glow.
3. **Materials are flat colour.** No surface in the home uses a texture, so stucco, grass, concrete, wood and block all read as plastic. Wear is a colour shift plus geometry boxes.
4. **Facade detail.** The reference has a foam cornice band, a tall parapet with a cap, window surrounds and sills, dark window frames, a door surround and stoop, and vent stacks on the roof. Ours has white slim frames and a 0.45 m parapet with a 5 cm coping only.
5. **No garage.** There is no input for one and no geometry. The driveway runs to nothing beside the right wall.
6. **Landscaping.** We have 2 trees and 11 shrubs as icosahedron blobs. The reference has a lawn texture, mulch beds with edging, agaves, sagos, palms, citrus, stepping stones and a backyard patio with furniture.
7. **Camera.** Our default is a low, telephoto, near-eye-level view (12–17° down, fov 30, ~24 m away). The reference is a high, steep, wider drone view that shows the lot plan.

---

## 1. Lighting & atmosphere

| Reference has | Our code today | Gap | Files that would change | Must stay compatible with | Size |
|---|---|---|---|---|---|
| Golden-hour sun: low (~10–20°), warm amber key, long soft shadows | Four weather presets, none at golden hour. `F/constants/weather-skies.ts:9-52`. Normal sun at `[-8,15,10]` (~50° up), `#fff6e6`, intensity **1.8**. Summer `[-9,16,11]`, **2.5**. Winter evening `[-12,7,6]`, **0.75**, cold blue. Rain **0.95**. | No warm low-sun look. The sun sits in front of and above the camera's side, so the house is front-lit and flat. A golden-hour look would be a retune of `normal`, or a separate look axis. Weather is a domain enum (`Weather`) that drives the heat model, so a new weather value is not free. | `weather-skies.ts` (values); possibly `F/types.ts` `WeatherSky` if a look axis is added | Heat model keyed by `Weather` (`home-temperatures`, `seasonOf`); the stills in `home-scene-stills.ts` / `public/scenes/stills/*.webp` (the fallback images) would need re-capturing | S (retune) / M (new look axis) |
| Strong sky fill, warm bounce, ambient occlusion in every corner and under eaves, plants and walls | Hemisphere fill (normal **0.9**), one bounce directional at `BOUNCE_POSITION [-3,-6,14]` (normal **0.55**), `weather-sky.tsx:52-53`. No AO of any kind: no SSAO/N8AO, no baked AO, no contact shadows (drei `ContactShadows` is used only in look-dev, `look-dev-scene.tsx:34`). | Corners, the wall–ground line and eaves read flat. AO is the single largest "realism" cue missing. | Options: (a) baked AO: gradient decals on the ground along the walls and under the plants and walls, and a darkening at the wall base (cheap; `F/ui/components/home-kit/yard.tsx`, a new AO decal component); (b) N8AO: `@react-three/postprocessing` 3.2 already depends on `n8ao`, wired through `S/ui/scene-shell.tsx` (today it mounts an `EffectComposer` only for `bloom`, `:77`) | **Thermal**: post AO must be off under Thermal, or it darkens the ironbow; baked AO decals must be `OWN_PAINT` or removed under Thermal. **R23 / iPad**: N8AO is a full-screen pass every drawn frame at dpr up to 2, and `EffectComposer` drops the canvas MSAA unless `multisampling` is set. `S/**` is off-limits to the TS3b.4a fixes plan only, not to this work. | M (baked) / M (N8AO plus a perf gate) |
| Soft, accurate shadows across the whole lot (walls, fence, trees) | Sun casts with a **2048²** map, ortho reach **±15 m** (30×30 m, about 1.5 cm per texel), bias −0.0004, normalBias 0.03, near 1, far 60 (`weather-sky.tsx:54-68`, `SKY_RIG` `weather-skies.ts:56`). The Canvas uses `shadows` = R3F's default **PCFSoftShadowMap** (`home-scene-canvas.tsx:107`; R3F `events-*.cjs.dev.js` ~1744). The shadow map re-renders every drawn frame outside Thermal (`autoUpdate = !thermal`, `weather-sky.tsx:30-39`). | ±15 m does not cover a 17×33 m lot, let alone the neighbours. Widening the reach blurs the house shadows. Golden-hour long shadows also stretch past the frustum. | `weather-skies.ts` `SKY_RIG`; `weather-sky.tsx` (could freeze `shadowMap.autoUpdate` while only static parts move); neighbours and far plants set `castShadow={false}` plus a baked shadow decal | Ghost turns off a mesh's `castShadow` below 50% opacity (`F/ui/lib/apply-ghost.ts:277-278`); a frozen shadow map has to refresh on fades, the floor lift, the camera slide and the condenser shake. Draw budget: every caster is drawn twice. | S–M |
| Hazy warm sky, sun glow, atmospheric perspective on distant trees and houses | The sky dome is a 2-stop gradient texture (`createSkyTexture(top, horizon)`) on a radius-**95** sphere, `meshBasicMaterial`, `toneMapped=false` (`weather-sky.tsx:45-48`). Linear fog normal `near 40 / far 95`, horizon colour (`weather-skies.ts:15`, `weather-sky.tsx:50`). | No sun disc or glow, no warm-to-cool gradient toward the sun, no cloud or haze texture. Fog starts at 40 m, so neighbours at 15–35 m get no aerial perspective. The flat ground disc edge shows as the horizon line. | `F/ui/lib/create-sky-texture.ts` (3–4 stops plus a sun glow), `weather-skies.ts` (fog near and far per look), `weather-sky.tsx` | Sky is tagged `thermalTag('sky')` and painted by the lens; `HOME_CAMERA_FAR = domeRadius + maxDistance + 20` (`home-geometry.ts:289`) | S |
| Image-based reflections (window glass reflecting sky and trees, a sheen on the car) | drei `<Environment resolution={64} frames={1}>` built from **2 Lightformers** (a top rect at intensity 2, a horizon rect at 1), `environmentIntensity` normal **0.45** (`weather-sky.tsx:70-73`). The rule "never downloads an HDR" is stated in the comment at `:69` and `S/ui/scene-lights.tsx:11`. | The environment is too coarse and too uniform for glass and metal to read. A 64 px cube gives blobby reflections. | `weather-sky.tsx` (res 128–256, add a warm sun-side panel and a green ground panel); or a small 1k HDR/`.hdr`/KTX2 file under `public/scenes/` if the owner lifts the no-HDR rule | `frames={1}` bakes once per weather (keyed), with no per-frame cost. HDR = download size on homeowner Wi-Fi (owner rule in code comment). | S |
| Filmic but neutral photographic grading | Tone mapping = R3F default **ACESFilmic**, output **sRGB** (not overridden; `S/ui/scene-shell.tsx:54` passes only `{ antialias: true }`). Bloom off for the home (`bloom` prop not passed). **dpr `[1, 2]`**, **`frameloop="demand"`** (`scene-shell.tsx:50-51`). | ACES shifts hues and pushes saturation; the reference reads closer to AgX/Neutral (three r180 has both). There is no exposure control per look. | `S/ui/scene-shell.tsx` (`gl.toneMapping`, `toneMappingExposure`, ideally a prop so look-dev and the home can differ) | Thermal shaders are `toneMapped={false}`, so they are unaffected. Every palette hex in `home-palette.ts`/`weather-skies.ts` was tuned under ACES and would need a re-tune pass by eye. | S code / M re-tune |

## 2. Materials & textures

| Reference has | Our code today | Gap | Files that would change | Must stay compatible with | Size |
|---|---|---|---|---|---|
| Sand-finish stucco with fine bump and low-frequency colour mottling | Walls are an extruded skin with `meshStandardMaterial color={stucco} roughness 0.9`, no maps (`F/ui/components/home-kit/wall-skin.tsx:20`). Colour comes from `paintLook` → `wornColor(stucco '#e6d2b0' | paintCool '#f0e2c6', chalk '#d2c9b6', wear)` (`F/ui/lib/paint-look.ts:9-11`, `home-palette.ts:3-5`). | No texture anywhere on the house. Stucco reads as plastic. | `wall-skin.tsx` (map, normalMap, roughnessMap); `F/ui/lib/wall-skin-geometry.ts` (UVs); a small texture loader (none exists: no `TextureLoader`/`useTexture` in the home, only canvas textures) | **wornColor** stays a tint only if the albedo map is neutral (grey, mean ≈ white) so `color × map` keeps the palette hue (see Q3). **Thermal**: an opaque material's maps are dropped under the lens (fine). **Exterior paint wear kinds plan** (in flight) adds cracks, stains and peeling as boxes and a stain atlas on these same walls. | M |
| Lawn with blade texture, mowing stripes and dry patches | Ground = `circleGeometry(60, 64)`, `meshStandardMaterial color=sky.ground.color` (normal `#8fa35c`, roughness 0.95) (`yard.tsx:27-30`, `weather-skies.ts:16`) | Flat colour disc. | `yard.tsx` (tiled grass map plus a large-scale variation map, or vertex-colour patches); rain wets it via `ground.roughness 0.55` | Yard is tagged `thermalTag('exterior')` (`home-kit.tsx:207-209`) and painted solid under Thermal (fine) | S–M |
| Concrete with control joints and stains (walk, driveway, sidewalk, block wall cap) | Walk and driveway are `MergedBoxes` `#d8cfbf` roughness 0.85 radius 0.008 (`yard.tsx:31`); back wall `#cbbea6` radius 0.04 (`:32`) | No joints, no texture, no edges. | `yard.tsx`, `F/ui/lib/merge-boxes.ts` (UVs) | Merged-box draw-call rule: one material = one draw (`merge-boxes.ts:14`) | S |
| Wood grain on the gate and fence; dark bronze vinyl window frames; grey steel garage door | Frames `#f3ece0` worn toward `#a39a8c` (`house-shell.tsx:97`, `wear-looks.ts:9`); door `#5d6b73` (`home-palette.ts:8`) | No wood or metal materials exist on the house. | `home-palette.ts`, `house-shell.tsx` (window frame colour, which the TS3b.4a wear owns) | Wear API: frame wear → `wornColor(trim, WEAR_LOOKS.window.frame, frameWear)` | S |
| PBR on loaded models (metal condenser grille, car paint) | `LoadedFurniturePiece` overwrites every `MeshStandardMaterial`: `color.set(placement.colors[name])`, **`roughness = FURNITURE_MATTE_ROUGHNESS`, `metalness = 0`** (`loaded-furniture-piece.tsx:32-45`) | Any textured or PBR GLB would be flattened. The colour tint multiplies onto the base-colour texture, the forced roughness scales the roughnessMap, and metalness 0 kills metal. | `loaded-furniture-piece.tsx` (a per-placement opt-out such as `keepMaterial`, or tint only named materials); `F/constants/home-furnishings.ts` | The condenser's dust wear recolours by material name (`condenser-unit.tsx:202-211`); `useGltfAsset` clones materials per use (`S/hooks/use-gltf-asset.ts:88-102`) | S |
| — (engineering) | `mergeBoxes` uses `BoxGeometry`/`RoundedBoxGeometry` UVs, 0..1 per face per box (`merge-boxes.ts:24`). `ExtrudeGeometry` caps (the wall skin's big faces) get shape-space UVs in metres, but the side faces don't. | Tiling textures stretch per box: a 12 m parapet and a 5 cm crack get the same UV square. | `merge-boxes.ts` (world-space or box-projected UVs, metres), or a triplanar `onBeforeCompile` chunk on textured materials | Keep one geometry per colour/material (the draw-call budget) | M |

## 3. House trim & detail

| Reference has | Our code today | Gap | Files | Compatible with | Size |
|---|---|---|---|---|---|
| A tall parapet (~0.6–0.8 m above the roof plane) on every side, with a projecting **two-step foam cornice band** at the wall top and a cap | `LOW_SLOPE.parapet` **0.45**, `coping` **0.05**, `copingOverhang` **0.05**, `joistSpace` 0.3 (`home-geometry.ts:70-79`); `PARAPET_TOP = WALL_TOP_Y + 0.3 + 0.45 = 3.70 m` (`:81-82`). `PARAPETS`/`COPING`/`COMPLETE_PARAPETS`/`PARAPET_CORNERS` boxes (`low-slope-roof.tsx:52-83`). `FRONT_FASCIA` (`:67-70`) is a 0.035 m board closing the joist space behind the front parapet, not a trim band. | No cornice band, no stepped profile, a short parapet. | `low-slope-roof.tsx` (a band ring under the coping, kept and Complete halves), `home-geometry.ts` `LOW_SLOPE` | Fade tag `complete` on the front-wall pieces (the Complete parapet lifts off in Partly open); `thermalTag('exterior')`; parapet cracks pass `paint` (TS3b.4a fixes Fix A, built `8dbe06e86`). **Low-slope-roof.tsx is being edited now** (Fix B uncommitted; exterior-paint plan peeling). | S–M |
| Window surrounds (flat foam trim ~10 cm), projecting sills, dark frames, divided sliders | `windowBoxes(wall, opening, frame, floorY, wallThickness)` makes the frame bars and glass. Frames: single `bar 0.045 / depth 0.07`, double `0.075 / 0.12` (`home-geometry.ts:197-200`). Sill ledge in `F/lib/window-boxes.ts:27` (the exterior-paint plan exports it as `sillLedgeBox`). | No surrounds, thin sills, white frames. | `F/lib/window-boxes.ts`, `house-shell.tsx`, `home-palette.ts` | Glazing single/double (TS3b.4a), glass wear (`glassColor/roughness/opacity`, `house-shell.tsx:98-100`), `thermalTag('window')` on glass, **TS3b.4b R123** (the window system expands frame, panes, argon and flashing up close on the home's own model) | M |
| Door with a surround, a small concrete stoop and step | Door leaf `#5d6b73`, jamb 0.06 (`FRONT_DOOR_FRAME`, `home-geometry.ts:126`; boxes `house-shell.tsx:72-83`). A slab home has no stoop; a raised one has 4 risers (`FRONT_STEPS`, `home-details.ts:30`; `foundation.tsx:106-112`). | No stoop on a slab, no surround. | `foundation.tsx` (slab stoop under the `slab` fade tag), `house-shell.tsx`; door frame boxes move to `home-geometry.ts` as `DOOR_FRAME_BOXES` in the exterior-paint plan | Fade tags `slab`/`raised`/`complete`; the foundation's lift group | S |
| Roof: light-grey cool membrane / elastomeric coat, vent stacks with caps, no visible drains at front | Membrane boxes, colours `membrane #6d6a66 / cool-membrane #eeede8` (`home-palette.ts:53-54`), seams every 0.9 m, worn patches (`low-slope-roof.tsx:85-91`), two back scuppers (`DOWNSPOUTS.lowSlope`, `home-geometry.ts:234-240`) | Vent stacks are missing on the flat roof (the attic plan adds `vent-pipe-stubs.tsx`, pitched only). No surface texture. | `low-slope-roof.tsx`, attic plan's `vent-pipe-stubs.tsx` (extend to low-slope) | Covering wear (`wornColor`, `wornValue(0.75, 0.95)`); `thermalTag(null,'covering')`; anchors for the roof pin | S |
| Downspout down the front corner, hose bib, electrical boxes, conduit | The pitched roof has 3 downspouts and a gutter (`DOWNSPOUTS.pitched`); the meter on the left wall `[-6.02, floorY+1.15, 2.7]` (`home-geometry.ts:204`) | Little exterior clutter (bibs, J-boxes, conduit, light fixtures by the door, house numbers). | `house-shell.tsx` or a new `facade-details.tsx`; `home-details.ts` | `thermalTag`; draw-call budget (merge them all into one or two `MergedBoxes`) | S |
| Gable roof (not in the reference, but our default): real shingle courses already instanced; fascia 0.2 × 0.035, rake 0.16, gutter 0.13 (`home-details.ts:3-10`) | — | Fine as is. The rake and fascia read thin; a frieze board and soffit vents are missing. | `gable-roof.tsx`, `roof-slope.tsx` | **Attic plan** adds gable vents to `gable-roof.tsx`; **exterior-paint plan** passes `paint` to `roof-slope.tsx` | S |

## 4. Openings, including the garage

| Reference has | Our code today | Gap | Files | Compatible with | Size |
|---|---|---|---|---|---|
| **Attached garage**: its own volume on the right (~6 m wide), a 16 ft (≈4.9 × 2.1 m) grey sectional door with panels, a reveal where it meets the house, its own parapet run | Nothing. No `garage` in the scene. `PropertyProfile` (`src/shared/modules/construction/core/types.ts:32-40`) has `yearBuilt, roofType, foundationType, hvacType, insulationLevel, windowsType, hvacComponents`: **no stories, size or garage**. `garage` appears only as a roof location and trade slug (`enums.ts:19,31`, `trade-slugs.ts:18`). R80 is "open (modeling phase not set)". | A new structure input, shared with the construction module, then new geometry. | `PropertyProfile` + `F/constants/home-profile-choices.ts` (input); `home-geometry.ts` (garage footprint); new `garage.tsx` in `home-kit/`; `low-slope-roof.tsx` + `gable-roof.tsx` (the roof over it); `home-anchors.ts`, `home-heat-lanes`/thermal zones (unconditioned space); `HOME_FRAMINGS`/`HOME_PAN` (the footprint grows from 12 m to ~18 m) | **Attached on the right gable end, it covers the right-wall window** (`HOUSE_WALLS.right.openings[0]`, `home-geometry.ts:158`), the pitched **right-front downspout** (`:232`), the right-wall heat lanes, and **one of the attic plan's two gable vents** (spec §R105: "a louvred vent high in each gable end"). Needs fade tags (its front in `complete`?), a thermal zone, the R18 code-built rule, and the TS3b.4b system views. Owner rulings needed: none / attached / detached, which side, and whether it is drawn on every home or only when picked. | **L** |
| Front door with sidelight-free slab, two front windows, one side window | `FRONT_WALL.openings`: windows at along −4 (1.4 m) and 1.3 (1.2 m) plus the door at −0.6 (0.95 m) (`home-geometry.ts:174-177, 122`); back wall 3 windows, left 1, right 1 | Layout is fine. Missing: the garage door, and a side-yard door into the garage. | `home-geometry.ts` | Heat lanes per window (TS3b.4a fixes Fix E rebuilds the wall and window lanes); `WallSkin` holes per opening | S |

## 5. Lot layout (property lines, side yards, setbacks, walls, fences, gate, driveway, walkway, curb/street, backyard)

| Reference has | Our code today | Gap | Files | Compatible with | Size |
|---|---|---|---|---|---|
| A rectangular lot (~15–18 m wide × 30–35 m deep, typical SoCal tract), house set back ~6 m from the sidewalk, 1.5 m side yards | **No lot concept.** The house is centred on the origin, 12 × 8 m (`HOUSE.halfLength 6, halfDepth 4`, `home-geometry.ts:12-14`). The ground is a **60 m radius disc** (`YARD.radius`, `:294`). Nothing names a property line, setback, side yard or street (grep: "street" occurs only in comments, `home-furnishings.ts:74`, `electric-meter.tsx:29`). | Everything. | New `LOT` constants in `home-geometry.ts` (or a new `F/constants/home-lot.ts`, which is less conflict-prone); `yard.tsx` → a lot component | `HOME_PAN.frontReach` reads `YARD.walk` (`home-geometry.ts:323`); `SKY_RIG.shadowReach`; the condenser at x −7.25 (`EQUIPMENT.condenser`, `:203`, pad 1.0 × 1.3 → spans x −7.75…−6.75) and the meter at x −6.02 set the minimum left side yard (~2 m, so a property wall at x ≤ −8.0) | M |
| **Property-line block walls** (slump block / CMU, ~1.8 m, stucco-capped), down the left side and returning across the front of the side yard; weathering stains | One **back wall** only: `size [26, 1.7, 0.2]` at z **−9** (`YARD.backWall`, `home-geometry.ts:297`), colour `#cbbea6`, radius 0.04 (`yard.tsx:32`) | No side walls, no returns, no caps or pilasters, no texture. | `home-geometry.ts`/new lot constants, `yard.tsx` | Draw calls: all walls are one `MergedBoxes`. The opening view looks from the front-left over the side yard **"where the meter and the condenser sit"** (`home-geometry.ts:271-272`): a left wall at x ≈ −8 runs right under the camera (`HOME_FRAMINGS.wide` x −8.1), so the condenser stays clear from that view, but check the zoom framings. | S |
| **Wood double gate** between the house and the side wall, plus a fence and gate on the garage side | None | — | New fence/gate boxes (merged; wood texture) | **Occlusion**: the sight line from the wide framing `[-8.1, 6.5, 21.9]` to the condenser `[-7.25, ~0.6, -2.1]` passes ~1.6 m above the ground at z ≈ 2. A 1.8 m gate at the front of the left side yard would hide the condenser's lower half and, if in front of z 2.7, the meter. Owner call: gate open, set behind the condenser, lowered, or faded with the house's ghost. | S (+ ruling) |
| **Driveway** to the garage with expansion joints, a car, an apron and curb cut | Driveway `size [3.6, 0.02, 9]` at `[8.6, 0.01, 5.5]` → x 6.8…10.4, z 1…10 (`home-geometry.ts:296`): it ends beside the right wall at nothing | Needs to meet a garage (or stop at a carport/side gate if there is no garage); no joints, apron or curb cut | lot constants, `yard.tsx` | Garage ruling (§4) | S |
| **Walkway** from the stoop curving to the driveway or sidewalk; stepping stones in the back lawn | Walk `size [1.3, 0.02, 6]` at `[-0.6, 0.01, 7.2]` → z 4.2…10.2, straight from the door (`:295`) | Straight slab, ends in the lawn; no connection to the street | lot constants, `yard.tsx` | `HOME_PAN.frontReach = 7.2 + 3 + 0.5 = 10.7` (`:323`), so the pan box grows if the lot extends to the street | S |
| **Sidewalk, parkway strip, curb and gutter, street edge** | None | Missing | new lot pieces | Pan box, orbit `maxDistance 36` (`HOME_ORBIT`, `:284`), fog | S |
| **Backyard**: patio slab or pavers, outdoor furniture, back lawn, stepping stones | Back lawn = the disc; the back wall at z −9 leaves a 5 m backyard; nothing in it | Missing; partly seen only through the side yard and from high orbits | lot pieces + a few props (CC0 patio furniture) | Partly open and the camera mostly look from the front; low priority | S–M |

## 6. Landscaping

| Reference has | Our code today | Gap | Files | Compatible with | Size |
|---|---|---|---|---|---|
| Mulch planting beds with edging along the front wall and the side wall | None | Missing | `yard.tsx` (bed shapes as flat merged boxes with a bark texture, or a ground splat) | Thermal paints the yard as exterior (fine) | S |
| Agaves, sago palms, small fan palms, clipped shrubs, flowering shrubs | **11 shrubs** as instanced icosahedrons (detail 2, 320 tris each), `[x, y, z, r]` (`YARD.shrubs`, `home-geometry.ts:303-315`; `yard-blobs.tsx:21,49`), one draw call, colour `#7b9554` with per-instance tint | Spheres read as toys. Agave/sago rosettes are easy procedural geometry (instanced leaf blades), or CC0 models. | `yard-blobs.tsx` → `yard-plants.tsx` (instanced per species); `YARD` constants | **Thermal shader handles instancing** (`S/constants/thermal-shader.ts:8-15`) but **not alpha-tested cards**: leaf cards with `alphaTest` and `transparent=false` would paint as solid rectangles (see Q3) | M |
| Tall Mexican fan palms and queen palms, eucalyptus, citrus, Italian cypress (mostly on the neighbours' lots) | **2 trees**: tapered cylinder trunk (r 0.16, 10 sides) plus 3 blob crowns each, at `[-9.6,0,-6.2]` h 4.6 and `[9.8,0,-5.4]` h 3.8 (`YARD.trees`, `home-geometry.ts:300-302`; `yard.tsx:18-22,33-39`) | Lollipop trees. Palms need trunks plus frond cards or frond meshes. | `yard.tsx`, new tree/palm components; CC0 packs (Quaternius "Ultimate Nature", Kenney Nature Kit) are low-poly and stylized; realistic palms need alpha cards | Draw budget (instance per species), shadow casters, the thermal alpha path | M |
| Lawn read (see §2) | — | — | — | — | — |

## 7. Neighbours & surroundings

| Reference has | Our code today | Gap | Files | Compatible with | Size |
|---|---|---|---|---|---|
| Two-story stucco neighbours with clay-tile **hip** roofs, chimneys, white windows, ~3 m apart side to side; more houses behind | **None.** Beyond the back wall is the bare disc to 60 m, fog 40–95, dome 95. | The single biggest "is this a real neighbourhood" cue | New `neighbourhood.tsx` (outside the house group, so it is never ghosted, faded or cut); simple massing: merged boxes plus a hip-roof geometry, one merged geometry per material for **all** neighbours (≈3–5 draws), tile via texture/normalMap (not the instanced half-pipe tiles from `roof-covering.tsx:35-60`, which would cost tens of thousands of triangles), `castShadow=false` | Not under `HOME_GHOST_TAG`, no fade tags; Thermal paints them as exterior if tagged (or `OWN_PAINT`); R18 (neighbours built in code is consistent); fog values | M |
| Street trees, a skyline of palms against the sky | None | — | billboards/cards at 30–80 m, inside the dome | Alpha cards + Thermal (Q3) | S–M |
| Car in the driveway | None | — | CC0 car GLB through `useGltfAsset` with a code stand-in | `loadGltfAsset` resolves null on failure → stand-in; `LoadedFurniturePiece` material override (§2); `public/scenes/LICENSES.md` | S |

## 8. Camera & framing

| Reference has | Our code today | Gap | Files | Compatible with | Size |
|---|---|---|---|---|---|
| High drone view from the front-left lot corner, ~35–45° down, ~12–15 m from the house, wide lens; the whole lot reads as a plan; portrait | `HOME_FRAMINGS.wide` position `[-8.1, 6.5, 21.9]`, target `[0.6, 1.4, 0.2]`, **fov 30** (≈23.9 m away, **~12° down**); `tall` `[-9, 8.6, 21.4]` → `[0.5, 1.3, 0.2]`, fov 30 (**~17° down**) (`home-geometry.ts:277-280`). The rig keeps ~92% of a 4:3 visible width (`:271-276`). `HOME_ORBIT` min 3, max 36, `maxPolarAngle 1.53` (`:284`); far = 95 + 36 + 20 = 151. Default canvas camera `[-9, 5.2, 10]`, fov 30 (`S/constants/scene-camera.ts:1`). | Our view is a low telephoto "street" view chosen so the rep sees under the ceiling into the rooms on wide stages. The reference's steep, wider view sells the lot. These pull opposite ways: a steep view hides the open rooms behind the parapet or roof in Partly open. Options: keep the framing and let the lot fill the frame, add a "lot" framing, or raise only the tall framing. | `home-geometry.ts` `HOME_FRAMINGS`/`HOME_PAN`/`HOME_ORBIT`; `F/lib/home-framing-for.ts` | **Camera slide work (R103) is closed "done for now"** (`821097568`, `0200949ef`); the **TS3b.4a fixes Task 7** edits `home-camera-rig.tsx` (canvas overhang); the anchors' zoom framings (`home-anchors.ts`); the 92% fit rule; reading callouts | S (constants) / M (a new framing mode) |

## 9. People and props (not in the reference, for completeness)
- Residents: Quaternius man and woman GLBs (~210–220 KB each), rigged. The child is a code stand-in. Thermal paints figures flat through `RESIDENT_THERMAL_PAINT` (`F/ui/lib/resident-thermal-paint.ts:7`), because **the thermal ShaderMaterial has no skinning** (`thermal-shader.ts` has no `#include <skinning_*>`). Any new skinned model must take the same route.
- Condenser: Quaternius "Air Conditioner", dusted by material name. R34 says it should look like a real condenser.

---

## Answers to the specific questions

### Q1. How is the house sized and placed, and does the code have a lot, property line, setback, neighbour, garage or driveway?

Sizing (`F/constants/home-geometry.ts:10-42`):

```ts
// Metres. A one-story SoCal ranch, 12 × 8 m, centred on the origin: the ridge runs along x and the open front faces +z,
export const HOUSE = { halfLength: 6, halfDepth: 4, floorY: 0.45, wallHeight: 2.5, wallThickness: 0.16, …
  pitch: Math.atan(4 / 12), heel: 0.1, eaveOverhang: 0.5, rakeOverhang: 0.3, … cutX: 2.4, atticFrontZ: 0 }
export const WALL_TOP_Y = HOUSE.floorY + HOUSE.wallHeight            // 2.95 (drawn height)
export const HOME_FLOOR_Y = { slab: 0.15, raised: 0.75 } as const    // real floor; the lift group carries the difference
```

- The ridge is at `RIDGE_Y = 2.95 + 0.1 + 4·(4/12) ≈ 4.38` (drawn).
- The flat deck is at `WALL_TOP_Y + 0.3 = 3.25`, and the parapet top at 3.70.
- The size is fixed: nothing in `PropertyProfile` scales the house, and there are no stories, square footage or garage fields.

Placement of everything outside the house (`home-geometry.ts:293-316`):

```ts
export const YARD = {
  radius: 60,
  walk: { size: [1.3, 0.02, 6], position: [-0.6, 0.01, 7.2] },
  driveway: { size: [3.6, 0.02, 9], position: [8.6, 0.01, 5.5] },
  backWall: { size: [26, 1.7, 0.2], position: [0, 0.85, -9] },
  trunkRadius: 0.16, trees: [ … 2 … ], shrubs: [ … 11 … ],
}
```

- **Driveway:** yes, a 3.6 × 9 m slab beside the right wall. It leads to nothing, because there is no garage.
- **Lot, property line, setback, side yard, neighbour, street, curb, sidewalk:** none. "Street" appears only in comments: the meter "on the side wall facing the street", and the condenser "fan faces the street".
- **Garage:** none in the scene. `garage` exists only as a roof location and trade slug in the construction module, and R80 (stories and garage as structure inputs) is open with no phase.
- **Nearest thing to a lot:** the 60 m ground disc, the back block wall at z −9, and the pan box (`HOME_PAN`: margin 3, front reach 10.7 m).

### Q2. Is there a flat roof with a parapet today?

Yes. The low-slope form exists (`F/ui/components/home-kit/low-slope-roof.tsx`, chosen when the roof's `form === 'low-slope'`):

- **Parapets on three sides**, with a front parapet and left front half that lift off in Partly open (`HOME_FADE_TAGS.complete`).
- **`LOW_SLOPE`:** `parapet: 0.45`, `coping: 0.05`, `copingOverhang: 0.05`, `joistSpace: 0.3`, `membraneThickness: 0.02`, `seamSpacing: 0.9` (`home-geometry.ts:70-79`).
- **Coping boxes** in trim colour.
- **Membrane** with seams and worn patches.
- **Two back scuppers.**
- **Parapet cracks** that follow the wall paint.

`FRONT_FASCIA` (`low-slope-roof.tsx:67-70`) is a 0.035 m board that closes the kept front edge of the joist space behind the Complete front parapet. It is not a visible trim band.

What the reference adds:

- a taller parapet;
- a projecting stepped cornice or belly band at the wall top;
- a heavier cap;
- vent stacks on the roof;
- the garage's own parapet block.

These are additions to `low-slope-roof.tsx` and `LOW_SLOPE`, which are files under active edit (see Q5).

### Q3. How would map, normalMap or roughnessMap interact with the thermal repaint and with `wornColor`?

**Thermal repaint** (`F/ui/lib/thermal-paint-set.ts`):

- Every tagged mesh's material is swapped for a shared `ShaderMaterial` (ironbow plus a little form shading). The shader reads only `position` and `normal` (instancing is supported).
- So `map`, `normalMap` and `roughnessMap` on an **opaque** material are simply not drawn under Thermal. That is correct for the lens and does not break anything.
- On lens-off the originals are restored untouched (`restoreThermalPaint`).

Three traps would bite once textures arrive:

1. **The decal rule keys on `transparent && map`** (`thermal-paint-set.ts:132-135`): `return original.transparent && map ? decalFor(...) : surfaceFor(...)`.
   - The home's ghost (zoomed up close) sets `material.transparent = true` on the originals (`apply-ghost.ts:287-292`).
   - So a textured opaque wall, ghosted first and then painted with Thermal on, would be treated as a decal: the stucco map tinted one flat thermal colour, with no ironbow shading.
   - It could also flip between decal and surface as the ghost eases.
   - Fix: decide decals by an explicit tag (`userData.thermalDecal`) or by the base transparency `apply-ghost` records in `material.userData.ghostBase`, never by the live `transparent` flag.
2. **Alpha-cutout foliage and fence cards** (`alphaTest`, `transparent=false`) take the surface path and paint as solid rectangles. The thermal shader has no `map`, `alphaMap` or `discard`.
   - Fix: give the thermal shader an optional map plus an alphaTest uniform (in `S/constants/thermal-shader.ts` and `createThermalShader`), or tag plants `OWN_PAINT` and accept a non-ironbow look.
3. **Skinned models** are not handled by the thermal shader (no skinning chunks). Residents bypass it with a flat colour; any new skinned model must too.

**`wornColor`** (`F/ui/lib/worn-color.ts`):

- It returns a hex string that every part writes to `material.color`. Wear today is a colour lerp (with a lightness-only run past Worn), plus `wornValue` for roughness, plus geometry such as cracks and patches.
- With a `map`, three multiplies `color × map`. So `wornColor` keeps working only if albedo maps are **neutral**: greyscale, or white-balanced with mean ≈ 1, carrying detail but not hue, while the palette hex keeps carrying hue and wear.
- If a texture carries its own beige, the palette tint doubles it, so every `HOME_PALETTE`/`COVERING_COLORS` value would need renormalising.
- Roughness maps combine the same way: the material's `roughness` scalar multiplies the map, so `wornValue` still scales it.
- Wear that should look like real stains or grime (beyond tint) needs either a second "worn" texture blended by a uniform (`onBeforeCompile`) or per-wear map swaps. The **exterior-paint-wear-kinds plan** already chose geometry plus a canvas stain atlas (`create-stain-atlas.ts`, transparent decals) for paint wear, so new wall textures should sit under that, not replace it.

**Loaded models:** `LoadedFurniturePiece` forces `color`, `roughness = FURNITURE_MATTE_ROUGHNESS` and `metalness = 0` on every standard material. A PBR GLB would be flattened, and the condenser's dust tint would double over a coloured base texture. It needs an opt-out per placement.

**UVs:** merged boxes have per-box 0..1 UVs, so tiling stretches. This needs world-space box UVs in `merge-boxes.ts`, or triplanar texturing.

**Draw calls:** textures add none (one material per merged geometry stays one draw). The cost is GPU memory and bandwidth. KTX2/Basis would need `KTX2Loader` plus serving `three/examples/jsm/libs/basis/basis_transcoder.{js,wasm}` from `public/`.

### Q4. Draw calls and triangle counts on record

None are recorded on an iPad. Every number below is a headless-Chromium/SwiftShader probe, counted at the WebGL draw functions, shadow pass included.

| When | Scene | Draw calls | Triangles | Source |
|---|---|---|---|---|
| TS3b.3, before the fix (2eb52636a) | Complete + Thermal | 143–147 | 79.3k–80.2k | `.superpowers/sdd/2026-10-23-home-views-and-thermal-lens/perf-final.md` |
| TS3b.3, after the fix (7ee8d143a/6a73da21f) | Complete + Thermal | **63** | **39.3k** | same |
| TS3b.3, after the fix | Partly open + Thermal | 111 | 56.8k | same |
| TS3b.4a diagnosis | default (Complete, lens off) | 153 | ~66k | `.superpowers/sdd/2026-10-24-upgrades-that-follow-the-home/shots/diag/findings.md:34` |
| Attic plan Task 1 dry run (2026-10-30) | default: Complete, lens off | **146** | **66.65k** | `.superpowers/sdd/2026-10-30-attic-ventilated-and-sealed/task-1-report.md:20-21` |
| same | worst: Partly open + Summer + Thermal | **114** | **57.8k** | same |

Frame times:

- The TS3b.3 baseline was 100 ms mean in SwiftShader. After the fix, the median was 180 ms under heavy machine load, so the numbers are not comparable.
- The owner ruled on 2026-10-30 that SwiftShader milliseconds are not evidence of iPad speed. The gate is draw calls and triangles before and after (`attic…/review-constraints.md:22`).

Probe scripts already exist: `.superpowers/sdd/2026-10-30-attic-ventilated-and-sealed/perf.mjs` (`node perf.mjs <default|worst> <label>`) and `…/2026-10-23-home-views-and-thermal-lens/shots/final/perf.mjs`. Lens-off frames draw everything twice where it casts shadows, because the shadow map re-renders per frame outside Thermal.

**No budget for TS3b.6 has been agreed** (handoff §3.4). A strawman for the owner:

- ≤ +40 draws;
- ≤ +100k triangles;
- ≤ ~24 MB of GPU texture (KTX2);
- no new shadow casters beyond the lot walls;
- AO baked, not a post pass.

### Q5. Overlap with in-flight work

Recorded from the TS3b.4a fixes plan, `docs/superpowers/plans/2026-10-30-ts3b4a-fixes.md` (spec `…/specs/2026-10-30-ts3b4a-fixes-design.md`):

- Built so far: A (`8dbe06e86`), B (`9a699167e`) and C (`af7d50057`), all landed. E and D are still pending.
- The plan says it lands before the attic plan.
- The exterior-paint-wear-kinds plan is a further in-flight build on the same files.

| File | TS3b.4a fixes | Attic plan | Exterior paint wear kinds (R121) | TS3b.4b (up close, R119–R125) | TS3b.6 would touch for |
|---|---|---|---|---|---|
| `F/constants/home-geometry.ts` | ✔ (A, B; uncommitted hunks now) | ✔ (Tasks 4, 5) | ✔ (`FRONT_OPENINGS`, `DOOR_FRAME_BOXES`) | likely (anchors/framings) | YARD/lot, framings, LOW_SLOPE, garage |
| `F/ui/components/home-kit/house-shell.tsx` | ✔ (A, B; uncommitted) | — | ✔ (cracks, stains, peeling) | ✔ (windows system, R123) | textures, trim, window surrounds |
| `F/ui/components/home-kit/low-slope-roof.tsx` | ✔ (A, B; uncommitted) | — | ✔ (front fascia peeling) | ✔ (roof system view) | parapet height, cornice, vent stacks |
| `F/ui/components/home-kit/gable-roof.tsx` | ✔ (A) | ✔ (gable vents, fan) | ✔ (passes paint to slopes) | ✔ (roof/attic system view) | trim, frieze |
| `F/ui/components/home-kit/roof-slope.tsx` | — | — | ✔ (`paint`, fascia) | ✔ | fascia/soffit |
| `F/ui/components/home-kit/house-roof.tsx` | ✔ (A) | ✔ | — | ✔ | garage roof |
| `F/ui/components/home-kit/home-kit.tsx` | ✔ (A) | ✔ (most tasks) | ✔ (`paintLook` args, foundation props) | ✔ | lot/neighbourhood mount, garage |
| `F/ui/components/home-kit/foundation.tsx` | — | — | ✔ (paint, skirt cracks, stains) | — (crawl waits) | slab stoop |
| `F/ui/components/home-kit/merged-boxes.tsx` | (B mentions) | ✔ | — | — | textured variant/UVs |
| `F/ui/lib/merge-boxes.ts` | — | — | (new sibling `merge-tinted-boxes.ts`) | — | world UVs |
| `F/ui/components/home-kit/wall-skin.tsx`, `F/ui/lib/wall-skin-geometry.ts`, `F/lib/wall-skin-outline.ts`, `F/lib/wall-boxes.ts` | ✔ (B; untracked/uncommitted) | — | — | — | stucco textures and UVs |
| `F/constants/home-palette.ts` | (A) | ✔ | ✔ (deletes `crawlSkirt`) | — | palette re-tune |
| `F/constants/wear-looks.ts` | — | — | ✔ (stain, peel looks) | ✔ (wear up close) | texture wear |
| `F/ui/lib/paint-look.ts` | ✔ (A, created) | — | ✔ (`paintWear` arg) | — | stucco texture choice |
| `F/constants/home-details.ts` | — | ✔ | — | — | cornice, stoop, facade clutter |
| `F/ui/components/home-kit/attic-ducts.tsx`, `home-equipment.tsx` | — | ✔ | — | ✔ (ducts, R124/R125) | — |
| `F/ui/components/home-kit/home-camera-rig.tsx` | ✔ (Task 7, D) | — | — | ✔ | framing |
| `F/constants/home-anchors.ts` | — | — | — | ✔ | garage/lot anchors |
| `F/types.ts` | ✔ | ✔ | ✔ | ✔ | `WeatherSky`, lot types |
| `scripts/verify-trade-scene.ts` | ✔ | ✔ | ✔ | ✔ | every task's checks (claim file `.superpowers/claims/verify-trade-scene.ts` exists) |
| `F/ui/components/home-kit/yard.tsx`, `yard-blobs.tsx` | — | — | — | — | **free** |
| `F/ui/components/home-kit/weather-sky.tsx`, `F/constants/weather-skies.ts`, `F/ui/lib/create-sky-texture.ts` | — | — | — | — | **free** |
| `S/ui/scene-shell.tsx`, `S/constants/thermal-shader.ts`, `F/ui/lib/thermal-paint-set.ts` | off-limits to the TS3b.4a fixes plan | — | — | `part-thermal-paint` (kit) | tone mapping, AO, thermal alpha |
| `F/ui/components/home-kit/loaded-furniture-piece.tsx`, `S/hooks/use-gltf-asset.ts`, `public/scenes/**` | — | — | — | — | **free** (models) |
| `F/ui/components/home-kit/condenser-unit.tsx`, `package-unit.tsx` | — | — | — | ✔ (R125 moves the package unit) | condenser model |

**Suggested split to avoid conflicts.**

- **6-A (start now, no overlap):**
  - lighting, sky, tone mapping and AO (`weather-sky*`, `create-sky-texture`, `scene-shell`);
  - the lot, yard, landscaping and neighbours as **new files** (`home-lot.ts`, `neighbourhood.tsx`, `yard-plants.tsx`), touching only `yard.tsx` and a new `LOT` constant file rather than `home-geometry.ts`;
  - loaded-model plumbing (`loaded-furniture-piece.tsx`);
  - the thermal alpha and decal-rule fix in `thermal-paint-set.ts`/`thermal-shader.ts`;
  - texture UV support in `merge-boxes.ts`.
- **6-B (after TS3b.4a fixes, exterior-paint, attic and TS3b.4b land):**
  - house textures, facade trim, parapet and cornice, window surrounds, stoop;
  - garage (R80, which also needs a `PropertyProfile` ruling);
  - the camera framing change.

**Two owner rulings come first:** R9's style bar (stylized vs stylized-real vs near-real), and the gate/side-wall occlusion of the condenser and meter in the opening view.

---

# Part 3: Lot dimensions and real-time realism research


Researched 2026-10-30. Read-only; no repo files edited.
Stack checked against the worktree's installed packages: three 0.180.0, @react-three/fiber 9.8.2, @react-three/drei 10.7.9,
@react-three/postprocessing 3.2.0 (pulls postprocessing 6.39.5 and n8ao 2.0.1), @monogrid/gainmap-js 3.4.0 (a drei dependency).

Confidence tags used below:
- **[code]**: a municipal or state code, or an official city or county document.
- **[mfr]**: a manufacturer or official library doc/source.
- **[norm]**: a builder or industry norm. Secondary sources, or my own estimate where noted. Treat as a sensible default, not a rule.

---

## Part A — real-world layout numbers

### A1. Lot sizes

| Era / type | Typical lot | Evidence |
|---|---|---|
| Minimum R-1 lot, LA City / unincorporated LA County | 50 ft × 100 ft = 5,000 sf | LAMC §12.08 R1: min width 50 ft, min area 5,000 sf [code] ([gocodebook LAMC 12.08](https://gocodebook.com/library/us/ca/los-angeles-planning/chapter-i-general-provisions-and-zoning/article-2-specific-planning-zoning-comprehensive-zoning-plan/sec.-12.08.-r1-one-family-zone)); LA County R-1 5,000 sf/lot unless otherwise specified [code] ([LA County DRP zone summary](https://case.planning.lacounty.gov/luz/summary/category/residential_zones)) |
| Riverside County R-1 | 7,200 sf, 60 ft wide, 100 ft deep (minimums) | Riverside County Planning zoning summary (Ord. 348, Art. VI) [code] ([RCTLMA Ord. 348 summary PDF](https://planning.rctlma.org/sites/g/files/aldnop416/files/migrated/Portals-14-GeneralInformation-Old-20348-07-20Ord.-20No.-20348-20with-20amendments-20to-203-20-75.pdf)); current text in Title 17 §17.24.020 ([gocodebook](https://gocodebook.com/library/us/ca/riverside-county-zoning/title-17-zoning/17.24)) |
| Orange County unincorporated R-1 (current) | 7,200 sf min | [code], secondary summary ([gocodebook OC](https://gocodebook.com/us/california/orange-county/development-standards)) |
| San Diego RS-1-7 | 5,000 sf/DU; side yards are a formula of lot width | [code], secondary ([scoutred RS-1-7](https://scoutred.com/zoning/57)) |
| 1950s–1970s single-storey tracts (LA basin, OC, SGV) | **60 × 100–120 ft** (5,500–7,200 sf) is the most common; 50 ft frontage in older LA City tracts | [norm]. Example: a 1960s Santa Ana tract lot of 6,300+ sf ([listing](https://theboutiquere.com/properties/retsPdf/OC25151060/2001-W-Jan-Way)). Lots shrank nationally from 10,545 sf in the 1970s to 9,148 sf in the 2010s ([GBA](https://www.greenbuildingadvisor.com/article/bigger-houses-mean-smaller-yards)). |
| 1990s–2010s two-storey tracts (IE, south OC, north SD County) | **45–55 × 90–110 ft** (4,000–6,000 sf); small-lot planned developments go down to about 40 × 80 ft | [norm], my estimate. No primary source found. |

### A2. Setbacks (yards)

| Yard | Default | Range | Evidence |
|---|---|---|---|
| Front | **20 ft (6.10 m)** | 15–25 ft | LA County R-1 20 ft [code] ([LA County residential guidelines](https://case.planning.lacounty.gov/guidelines/residential)); LA City: 20% of lot depth, capped at 20 ft [code] (LAMC 12.08 via [gocodebook](https://gocodebook.com/library/us/ca/los-angeles-planning/chapter-i-general-provisions-and-zoning/article-2-specific-planning-zoning-comprehensive-zoning-plan/sec.-12.08.-r1-one-family-zone)); Riverside 20 ft; OC 20 ft; San Diego RS 15 ft. The 20 ft front setback also gives a ~20 ft driveway, enough to park a car without blocking the sidewalk (Pismo Beach requires 20 ft from the back of the sidewalk to the garage: [cityrulelookup](https://cityrulelookup.com/parking/driveway-rules/pismo-beach-ca)). |
| Side (each) | **5 ft (1.52 m)** | 3–5 ft (10% of width on narrow lots, 3 ft min) | LA County and LA City R-1: 5 ft, or 10% of width with a 3 ft minimum on lots under 50 ft [code]; Riverside 5 ft (10 ft street side on corners) [code]; San Diego interior side = 0.08 × lot width (4 ft on a 50 ft lot) [code, secondary] |
| Street side (corner lot) | 10 ft (3.05 m) | 5–10 ft | Riverside summary; LA secondary sources |
| Rear | **15 ft (4.57 m)** | 10–25 ft | LA City/County 15 ft [code]; OC 25 ft [code, secondary]; Riverside summary reads as 10 ft (the table layout is ambiguous) |

Building code layer: CRC R302.1 / Table R302.1(1) governs walls and projections near the line. Eaves are **not allowed within 2 ft** of the property line and must be fire-rated between 2 and 5 ft ([gocodebook CRC summary](https://gocodebook.com/blog/california-fire-separation-distance-rules), [CRC R302](https://gocodebook.com/library/us/ca/ca-residential-code/chapter-3-building-planning/section-r302-fire-resistant-construction)). With 5 ft side yards, eaves over side yards are typically 12–18 in.

### A3. Side-yard reality: walls, fences, gates

| Element | Default | Range | Evidence |
|---|---|---|---|
| CMU block wall at side and rear lines | **6 ft (1.83 m)** above grade | 5–6 ft; subdivision perimeter walls 6–8 ft | Baldwin Park and Redlands allow 6 ft on side and rear lines ([Baldwin Park](https://www.baldwinpark.com/DocumentCenter/View/1582), [Redlands](https://cityofredlands.org/sites/main/files/file-attachments/7.29.2024_minutes.pdf)); Cerritos perimeter walls 6–8 ft, slump block matching abutting walls ([Cerritos](https://cerritos.gov/media/yaphfsz1/block-wall-fence-application.pdf)); Covina handout ([Covina](https://covinaca.gov/wp-content/uploads/2026/01/18-Handout-Blockwalls_Fences.pdf)) [code] |
| Block unit | 8×8×16 in nominal = **7⅝ × 7⅝ × 15⅝ in (194 × 194 × 397 mm)** + ⅜ in joints; 6 in-wide units are common for garden walls; slump stone ≥ 8 in thick in El Monte | — | [mfr] ([Ernest Maier 8x8x16](https://ernestmaier.com/product/8x8x16-smooth-faced-buff-block/), [Angelus 8 in](https://www.angelusblock.com/wall_widths/8-inch-wide/)); [El Monte](https://ca-elmonte.civicplus.com/DocumentCenter/View/7233) [code] |
| Wall cap | **2 in or 4 in tall × 8 in wide** cap block on a 6 in wall gives ~1 in overhang each side | 51–102 mm tall, 203 mm wide | [mfr] ([Home Depot 2x8x16 cap](https://www.homedepot.com/p/-/206125462), [4x8x16 cap](https://www.homedepot.com/p/reviews/4-in-x-8-in-x-16-in-Concrete-Solid-Cap-Block-745553/202534032/1)); Brea requires a slumpstone cap treatment on its design-overlay walls ([Brea](https://gocodebook.com/library/us/ca/brea-zoning/title-20/division-ii-specific-zone-regulations/chapter-20.262-wd-wall-design-overlay-zone)) |
| Courses | 6 ft wall ≈ 9 courses of 8 in (8 in pitch = 203 mm) | — | arithmetic |
| Front-yard fence/wall | **42 in (1.07 m)** max in the required front yard | 36–42 in | Artesia, American Canyon, Aliso Viejo, Santa Monica 42 in; Garden Grove 36 in ([Artesia](https://www.zoneomics.com/code/artesia-CA/chapter_19), [American Canyon](https://law.cityofamericancanyon.org/us/ca/cities/american-canyon/code/19.10.080), [Garden Grove](https://ggcity.org/records_request/requests/8031/correspondences/33882/download/9.08.040.110_Walls__Fences_and_Hedges.pdf)) [code] |
| Side-yard return fence + gate (front of side yard) | Wood or block return 5–6 ft tall, set flush with the front wall of the house or a few feet behind it; **pedestrian gate 3–4 ft (0.9–1.2 m)**; RV gate 10–12 ft | — | [norm], my estimate; no code source found for gate width |

### A4. Garage, driveway, street

| Element | Default | Range | Evidence |
|---|---|---|---|
| Two-car garage door | **16 × 7 ft (4.88 × 2.13 m)** | 16 × 8 ft on newer and custom homes | Clopay ([Clopay sizes](https://www.clopaydoor.com/residential/buyingguide/what-is-the-average-garage-door-size)), Amarr ([Amarr](https://blog.amarr.com/whats-the-standard-garage-door-height-a-garage-door-sizing-guide)) [mfr] |
| One-car garage door | **9 × 7 ft (2.74 × 2.13 m)** | 8×7, 9×8 ft; three-car homes often use 16 + 9 | same [mfr] |
| Garage interior, two-car | **20 × 20 ft (6.10 × 6.10 m)** clear | 19.5–22 wide × 20–22 deep | Escondido 19.5 × 20; Carson 20 × 20 (18 × 20 on lots under 50 ft); Palo Alto 20 × 20 [code] ([Escondido](https://gocodebook.com/library/us/ca/escondido-zoning/division-1-generally/chapter-33/article-39-off-street-parking/33-769.-off-street-parking-space-size-and-access), [Carson](https://gocodebook.com/library/us/ca/carson-zoning/division-2-vehicular-parking-loading-and-maneuvering-areas/9162.41.-off-street-parking-automobile-parking-stall-size)) |
| Garage interior, one-car | 10 × 20 ft (3.05 × 6.10 m) | 10–12 × 20 | same [code] |
| Driveway width (two-car) | **18 ft (5.49 m)**, matching the door plus returns | 16–20 ft | West Hollywood 10 ft single / 18 ft (20 on request) double ([WeHo](https://weho.org/home/showpublisheddocument/50204/637604674761230000)); West Covina: garage width + up to 6 ft each side ([West Covina](https://www.westcovina.gov/DocumentCenter/View/589/Driveway-Standards-PDF)) [code] |
| Driveway length | = front setback, **20 ft (6.10 m)** from property line to garage, plus the parkway/sidewalk crossing | 18–25 ft | see Front setback |
| Driveway approach (apron in parkway) | Driveway width plus ~3 ft flares each side; 4 in thick residential | — | LA City Standard Plan S-440-4 referenced on the LADOT driveway form ([LA BOE form](https://permitmanual.engineering.lacity.gov/sites/default/files/documents/DOT%20Driveway%20approval%20form_7-2021.pdf)) [code]; flare width is my estimate [norm] |
| Local street | **60 ft (18.3 m) right-of-way, 36 ft (11.0 m) curb to curb**, leaving 12 ft (3.66 m) of border per side | Local Limited 50/30 ft | LA Complete Streets Manual / Mobility Plan 2035 "Local Standard 60'/36'" [code] ([LA CSDM E-211](https://completestreetdesignmanual.engineering.lacity.gov/e-200-general-design-street-improvement-projects/e-210-street-classifications/e-211-213-street), [LA HEU EIR 4.14](https://planning.lacity.gov/eir/HEU_2021-2029_SEU/deir/files/4.14_Transportation.pdf)) |
| Border split | **5 ft sidewalk + 7 ft parkway** (sidewalk at the property line, grass parkway at the curb) | 4–5 ft sidewalk; some 1960s–80s tracts have curb-adjacent ("monolithic") sidewalks with no parkway | [norm] estimate; Santee details show ~4.5–5 ft sidewalks ([Santee](https://cityofsanteeca.gov/documents/planning-building/ab2234/submittal-guidelines/driveway-standards-engineering.pdf)) |
| Curb | **6 in (152 mm) vertical curb + 1.5–2 ft (0.45–0.6 m) gutter** | Rolled (mountable) curb in some tracts and HOA streets | Vertical "square" curb is the current CA city standard (e.g. [Morgan Hill](https://www.morganhill.ca.gov/DocumentCenter/View/805/3-Street-Design-Standards)); rolled curbs are a suburban option ([Wikipedia: Curb](https://en.wikipedia.org/wiki/Curb)). Gutter width is [norm]. |

### A5. Neighbours, storeys, roofs, walls, trim

- **Spacing between houses**: two 5 ft side yards give **10 ft (3.05 m) wall to wall**, about 6–8 ft eave to eave. Range: ~6 ft on small-lot PDs up to 15–20 ft on older 60–70 ft lots. [code, derived]
- **Storeys**: 1950s–70s tracts are overwhelmingly single-storey ranches, some with later second-storey additions. 1990s–2010s IE/south-OC tracts are mostly two-storey, often with a one-storey plan on corner lots. [norm]
- **Roof materials by era** [norm, secondary]:
  - 1950s–60s: composition shingle, rock/gravel low-slope ("built-up") roofs and wood shake on low 3:12–4:12 hips.
  - 1970s–80s: shake, then concrete tile. Skip-sheathed concrete tile was common in CA in the 70s–80s ([NACHI forum](https://forum.nachi.org/t/tile-roof/58243)).
  - Late 1980s–2010s: **concrete S-tile ("Spanish S"/mission) and flat concrete tile** dominate new tracts, e.g. "35 year old tract home, standard red concrete S tiles" ([Western Roofing](https://www.westernroofing.net/?p=5101)). Concrete tile weighs 900–1,100 lb per square ([GBA PDF](https://images.greenbuildingadvisor.com/app/uploads/2019/05/10050116/Roofing-with-Concrete-Tile.pdf)).
  - Many re-roofed older homes are now composition shingle ([Baker Home Energy](https://bakerhomeenergy.com/roofing/roofing-products)).
  - Minimum slopes: asphalt shingle 2:12 (CRC R905.2.2); clay and concrete tile 2.5:12 (CRC R905.3.2). Tracts typically use 4:12–5:12. [code, recalled; verify]
- **Flat or low-slope roof with parapet** (Spanish-revival pockets, 1950s mid-century, desert-modern infill): the parapet stands **18–30 in (0.45–0.75 m)** above the roof deck. No residential code requires a height, so this is my visual-norm estimate [norm]. A 30 in parapet is the IBC fire-parapet minimum; residential use seldom requires it.
- **Wall heights (plate)**: **8 ft (2.44 m)** for 1950s–80s, driven by the 4×8 drywall sheet ([Inman](https://inman.com/2008/02/06/high-ceilings-got-homeowner-itching-remodel)). **9 ft (2.74 m) on the first floor** became standard from the mid-1990s, with 8 ft upstairs ([dgfloors](https://dgfloors.com/standard-ceiling-height/), low authority). A slab sits 6–8 in above grade.
  - Single-storey: stucco from grade to eave ≈ 8.5–9.5 ft (2.6–2.9 m).
  - Two-storey: ≈ 19–20 ft (5.8–6.1 m) to the upper eave, i.e. 9 ft + ~1 ft floor framing + 8 ft + slab. My arithmetic [norm].
- **Foam trim**: SoCal tract elevations specify "stucco over rigid foam" window surrounds, sills, belly bands and pop-outs, with profiles set per elevation style ([Palm Springs sheet](https://palmspringsca.gov/home/showpublisheddocument/39747/635847658310200000), [Goleta sheet](https://cityofgoleta.org/home/showpublisheddocument/4582/635689476246700000), [Queen Creek sheet](https://queencreekaz.gov/home/showpublisheddocument/16241/635296972128600000)). Typical sizes [norm, my estimate]:
  - Window surround: 4–6 in face, projecting 1–2 in.
  - Sill: 2–3 in tall, projecting 2–3 in.
  - Two-storey belly band: 6–10 in tall, projecting 1.5–3 in.
  - Eave or parapet cornice: 8–14 in tall, projecting 3–6 in, usually a cove or ogee profile under a flat cap.

### A6. Recommended defaults for a "typical SoCal tract lot" (metres)

These defaults are encodable as constants. "Era A" = 1950s–70s single-storey; "Era B" = 1990s–2010s two-storey.

| Constant | Default (m) | Range (m) | Basis |
|---|---|---|---|
| `LOT_WIDTH` A / B | **18.3** / **15.2** | 15.2–21.3 / 12.2–16.8 | 60 ft / 50 ft |
| `LOT_DEPTH` A / B | **33.5** / **30.5** | 30.5–36.6 / 24.4–33.5 | 110 ft / 100 ft |
| `FRONT_SETBACK` | **6.10** | 4.6–7.6 | 20 ft |
| `SIDE_SETBACK` (each) | **1.52** | 0.9–1.52 | 5 ft |
| `REAR_SETBACK` | **4.57** | 3.0–7.6 | 15 ft |
| `HOUSE_GAP` (wall to wall) | **3.05** | 1.8–6.1 | 2 × side setback |
| `BLOCK_WALL_HEIGHT` (side and rear) | **1.83** | 1.52–1.83 (2.44 perimeter) | 6 ft = 9 courses |
| `BLOCK_COURSE` / `BLOCK_LENGTH` (pitch) | **0.203** / **0.406** | — | 8 in / 16 in incl. joint |
| `BLOCK_WALL_THICKNESS` | **0.152** | 0.152–0.203 | 6 in garden wall |
| `WALL_CAP` h × w | **0.051 × 0.203** | 0.051–0.102 tall | 2 in × 8 in cap |
| `FRONT_FENCE_MAX` | **1.07** | 0.91–1.07 | 42 in |
| `SIDE_RETURN_FENCE_HEIGHT` | **1.83** | 1.52–1.83 | 6 ft wood |
| `SIDE_GATE_WIDTH` | **1.07** | 0.91–1.22 | 3.5 ft |
| `GARAGE_DOOR_2CAR` w × h | **4.88 × 2.13** | h 2.13–2.44 | 16 × 7 ft |
| `GARAGE_DOOR_1CAR` w × h | **2.74 × 2.13** | w 2.44–2.74 | 9 × 7 ft |
| `GARAGE_INTERIOR` w × d | **6.10 × 6.10** | 5.9–6.7 × 6.1–6.7 | 20 × 20 ft |
| `DRIVEWAY_WIDTH` | **5.49** | 4.88–6.10 | 18 ft |
| `DRIVEWAY_LENGTH` (lot) | **6.10** | 5.5–7.6 | = front setback |
| `APRON_FLARE` (each side) | **0.91** | 0.6–1.2 | 3 ft |
| `SIDEWALK_WIDTH` | **1.52** | 1.22–1.52 | 5 ft |
| `PARKWAY_WIDTH` | **2.13** | 0–2.4 | 7 ft (0 = curb-adjacent walk) |
| `CURB_HEIGHT` | **0.152** | 0.10–0.152 (rolled ≈0.10) | 6 in |
| `GUTTER_WIDTH` | **0.46** | 0.30–0.61 | 18 in |
| `ROAD_HALF_WIDTH` (curb to centreline) | **5.49** | 4.6–5.5 | 36 ft / 2 |
| `PLATE_HEIGHT` A / B ground floor | **2.44** / **2.74** | — | 8 ft / 9 ft |
| `SLAB_ABOVE_GRADE` | **0.18** | 0.15–0.20 | 7 in |
| `UPPER_PLATE` (B) | **2.44** | — | 8 ft |
| `FLOOR_FRAMING` (B) | **0.30** | 0.28–0.36 | ~12 in |
| `EAVE_OVERHANG` | **0.45** | 0.30–0.61 (ranch to 0.9) | 18 in |
| `ROOF_PITCH` tile / comp | **4:12 (18.4°)** / **4:12** | 3:12–6:12 | — |
| `PARAPET_HEIGHT` | **0.60** | 0.45–0.76 | 24 in |
| `CORNICE` h × projection | **0.25 × 0.10** | 0.20–0.36 × 0.08–0.15 | foam |
| `BELLY_BAND` h × projection | **0.20 × 0.05** | 0.15–0.25 × 0.04–0.08 | foam |
| `WINDOW_SURROUND` face × projection | **0.12 × 0.04** | 0.10–0.15 × 0.025–0.05 | foam |

---

## Part B — a stylized-real look at low cost (WebGL only, iPad, `frameloop="demand"`)

### B0. What the scene already does (from the worktree)

- `home-kit/weather-sky.tsx` builds the environment from two drei `<Lightformer>`s at `resolution={64}`, `frames={1}`. Nothing is fetched and the PMREM bakes once, which is already the cheapest possible environment.
- `home-scene-canvas.tsx` passes `shadows`, so R3F defaults to `PCFSoftShadowMap`. One directional light casts shadows with a configurable `shadow-mapSize` (`weather-sky.tsx:58`).
- Geometry is built by `MergedBoxes` (one merged geometry per part), which makes world-scaled UVs cheap to add at merge time (see B3).
- No `EffectComposer` is in use today. `ContactShadows frames={1}` exists only in the look-dev scene.

### B1. Version compatibility (verified against the npm registry and installed `node_modules`)

| Package | Latest / installed | Peer range | OK with three 0.180 / R3F 9.8 / drei 10? |
|---|---|---|---|
| @react-three/drei | 10.7.9 / 10.7.9 | three ≥0.159, fiber ^9 | yes |
| @react-three/postprocessing | 3.2.2 / 3.2.0 | three ≥0.156, **fiber ≥9.7.0**, postprocessing ^6.36 | yes (fiber 9.8.2 installed) |
| postprocessing | 6.39.5 | three ≥0.168 <0.187 | yes |
| n8ao | 2.0.1 | three ≥0.137, postprocessing ≥6.30 | yes (exported as `N8AO` from @react-three/postprocessing) |
| @monogrid/gainmap-js | 3.7.2 / 3.4.0 | three ≥0.159 | yes (drei dependency) |
| @three.ez/instanced-mesh | 0.3.16 | three ≥0.159 | yes (not R3F-specific; use with `<primitive>`) |
| three-custom-shader-material | 6.4.0 | three ≥0.159, fiber ≥8 | yes |
| @gltf-transform/cli | 4.5.1 | needs KTX-Software ≥4.4 (`ktx create`) on PATH for KTX2 ([source](https://raw.githubusercontent.com/donmccurdy/glTF-Transform/main/packages/cli/src/transforms/toktx.ts)) | build-time only |

### B2. Lighting

**HDRI environment (drei `<Environment files=…>`)**
- drei 10's `useEnvironment` picks a loader from the file extension:
  - `.hdr` uses RGBELoader.
  - `.exr` uses EXRLoader.
  - `.jpg` (Ultra HDR) uses `HDRJPGLoader` from `@monogrid/gainmap-js`.
  - A three-file `[sdr.webp, gainmap.webp, meta.json]` set uses `GainMapLoader`.

  Verified in `node_modules/@react-three/drei/core/useEnvironment.js:134-146`. Gainmaps cannot be preloaded (`useEnvironment.preload` throws).
- **Do not use `preset=`.** The presets load 1k Poly Haven `.hdr`s from `raw.githack.com` at runtime (`helpers/environment-assets.js`, `CUBEMAP_ROOT`). Self-host under `/public` instead, so a flaky in-home connection cannot leave the scene unlit.
- **Golden-hour / soft-sun candidates** (all Poly Haven, CC0; sizes from `api.polyhaven.com/files`):

  | HDRI | 1k .hdr | 1k .exr | 2k .hdr | Notes |
  |---|---|---|---|---|
  | `citrus_orchard_road_puresky` | 1.32 MB | 5.14 MB | 4.98 MB | warm low sun, partly cloudy, low contrast. **Best SoCal fit** (citrus country) |
  | `qwantani_dusk_2_puresky` | 1.17 MB | 4.98 MB | 4.61 MB | clear dusk, low contrast |
  | `kloppenheim_06_puresky` | 1.17 MB | 5.37 MB | 4.43 MB | soft golden, low contrast, very popular |
  | `belfast_sunset_puresky` | 1.19 MB | 5.31 MB | 4.56 MB | low contrast sunset |
  | `spruit_sunrise` | 1.50 MB | 1.38 MB | 5.93 MB | clear, high contrast (strong sun disc) |
  | `venice_sunset` (drei `sunset` preset) | 1.44 MB | 1.23 MB | 5.72 MB | clear, medium contrast |
  | `suburban_parking_area` | 1.34 MB | 0.46 MB | 5.72 MB | clear, low contrast, urban ground |
  | `kloofendal_48d_partly_cloudy_puresky` | 1.44 MB | 5.50 MB | 5.45 MB | mid-day alternative |

  Prefer the `_puresky` variants: they have no ground plate to clash with the code-built yard. Use them for lighting only (`background={false}`) and keep the existing gradient sky, or show them blurred (`backgroundBlurriness`).
- **Resolution**: 1k is plenty for diffuse and rough-specular lighting on stucco, concrete and tile. PMREM output is the same either way, so 2k only costs download and decode time.
- **Format**: `.hdr` 1k ≈ 1.2–1.5 MB. Convert to Ultra HDR `.jpg` with MONOGRID's [free online encoder](https://gainmap-creator.monogrid.com) ([repo](https://github.com/monogrid/gainmap-js)). Community reports put it 10–30× smaller than `.hdr` with faster decode ([three.js forum](https://discourse.threejs.org/t/ultrahdr-three/60548)), i.e. roughly 100–200 KB at 1k. EXR has no advantage for this use.
- The env map renders once into PMREM, so per-frame cost is effectively zero after load.

**Sun**
- Keep a single shadow-casting `DirectionalLight` aligned with the HDRI's sun azimuth.
  - Late-afternoon SoCal: sun in the west to south-west at **20–30° elevation**. That gives long, readable shadows that still light the façade; true golden hour (<10°) makes the yard too dark.
  - Colour ≈ `#ffd6a8`. Check sun angles for 34°N with the [NOAA solar calculator](https://gml.noaa.gov/grad/solcalc/).
- Fit the shadow camera tightly to the lot plus a margin, ~24 × 40 m. A 2048² map then gives ~1.5–2 cm texels, enough for a crisp eave line.

**Shadow technique, ranked for frameloop demand**
1. **`PCFSoftShadowMap` (current) + drei `<BakeShadows/>`.** BakeShadows sets `gl.shadowMap.autoUpdate = false`, so the shadow map renders once instead of on every camera move. Set `gl.shadowMap.needsUpdate = true` whenever geometry changes (scope toggles, opening the house, weather). This is the biggest free win: camera orbits stop paying a shadow pass. **Recommended.**
2. **`<AccumulativeShadows>` + `<RandomizedLight>`.**
   - With `temporal` off and finite `frames`, it runs all frames synchronously in a layout effect, then costs **zero per frame** (`drei/core/AccumulativeShadows.js:98-112`).
   - Great soft ground shadows: area-sun plus sky occlusion around the house footprint.
   - Limits: it is a ground-plane catcher only, so walls do not receive it. Call `api.update()` after house changes. The bake costs `frames × amount` shadow renders (e.g. 40 × 8 = 320) at mount, a ~0.2–1 s hitch on an iPad (estimate).
   - Use it for the yard, alongside (1) for the house.
3. **drei `<SoftShadows>` (PCSS).** It patches `ShaderChunk.shadowmap_pars_fragment` at runtime. drei 10.7.9 checks for `sampler2DShadow` and `shadowIntensity`, so it adapts to three 0.180's chunk. But it forces a recompile of every material and adds ~10–25 shadow taps per lit fragment on every frame. Low payoff over (1)+(2); skip.
4. **`VSMShadowMap`.** "All shadow receivers will also cast shadows" (three `constants.js`), and it adds blur passes and light bleeding. Skip.

**Tone mapping (three 0.180)**
- three 0.180 has `ACESFilmicToneMapping` (4), `AgXToneMapping` (6) and `NeutralToneMapping` (7, the Khronos PBR Neutral).
- R3F 9 defaults to ACESFilmic (`fiber/dist/events-*.esm.js:1752`).
- **AgX** handles bright sun and saturated stucco or roof colours without ACES's hue shifts and over-saturation, and three.js maintainers call it a better base for new scenes ([three.js PR #27366](https://github.com/mrdoob/three.js/pull/27366), [tone-mapping overview](https://discourse.threejs.org/t/tone-mapping-overview/75204)).
- **Neutral** keeps material colours closest to their swatches. That matters if paint colours in the proposal must read true.
- **Recommendation**: Neutral if colour fidelity of paint swatches matters, otherwise AgX. Both cost the same.
- **Trap**: `@react-three/postprocessing`'s `EffectComposer` forces `gl.toneMapping = NoToneMapping` (`postprocessing/dist/index.js:481`). If you add a composer, add `<ToneMapping mode={ToneMappingMode.AGX | NEUTRAL}>` (postprocessing 6.39 has `AGX: 7`, `NEUTRAL: 8`) as the last effect.

**Fog / aerial perspective**
- Linear `THREE.Fog` coloured to the sky horizon, with `near` just beyond the lot and `far` ~80–150 m. It hides the world edge, desaturates neighbours, sells depth, and is free.
- The scene already has fog plumbing (14 `fog` references).

### B3. Ambient occlusion

**N8AO** (`n8ao` 2.0.1, wrapped as `<N8AO>` in @react-three/postprocessing):
- Quality presets from the n8ao README (installed copy):
  - "Performance": 8 AO / 4 denoise samples, for "Mobile, low-end iGPUs".
  - "Low": 16 / 4, for "High-End Mobile".
- `halfRes`: "generally 2x–4x" faster. The depth-aware upsampling it needs costs "a fixed ~1 ms".
- `accumulate: true` accumulates samples while the camera is still. It is not exposed as a React prop; set it via `ref.current.configuration.accumulate`. With frameloop demand you must `invalidate()` a few dozen frames after the camera rests for it to converge.
- `transparencyAware` (auto-on when transparent objects exist) renders **transparent objects twice**. That hits our ghosted and thermal modes.
- **Cost reality at dpr 2 on an iPad.** An iPad Pro 12.9" canvas is 2732 × 2048 ≈ 5.6 MP.
  - The composer's default `multisampling = 4` with `HalfFloatType` buffers (`postprocessing/dist/index.js`) means one RGBA16F colour buffer ≈ **45 MB**.
  - 4× MSAA adds ~180 MB of renderbuffer plus depth. That is a real jetsam risk on iOS Safari (see B6).
  - If you add a composer: set `multisampling={0}`, add `<SMAA>` (or nothing), and/or `resolutionScale`; or clamp the composer's dpr to 1.5.
- **Verdict**: worthwhile only as a **"rest" pass**. Enable `halfRes` + "Low" when the camera settles, keep it off during motion (R3F `performance.regress()` / drei `PerformanceMonitor`), and disable it in ghost/thermal modes.

**Baked or cheap alternatives (better payoff ÷ cost here)**
- **AccumulativeShadows** on the ground gives the soft contact darkening around the slab, walls and plants that sells "grounded" (see B2).
- **ContactShadows `frames={1}`**: one depth render plus blur at mount, then free. Only for small objects (AC unit, bins), not the whole house.
- **Hand-placed AO** costs no pass:
  - Vertex-colour or gradient darkening at wall bases.
  - A dark 1-texel gradient strip under eaves and at the wall–ground junction.
  - A soft radial-gradient decal under the house footprint.

  For box-built geometry this delivers ~70% of SSAO's look.
- `three/examples/jsm/misc/ProgressiveLightMap.js` (present in r180) can bake GI/AO into a lightmap for static ground. It needs a second UV set; overkill here.

### B4. Textures

**CC0 sources picked for this scene** (Poly Haven 1k JPG map sizes from `api.polyhaven.com/files`; physical size from `/info`)

| Surface | Asset | Covers | 1k maps (diff / nor_gl / rough / arm) |
|---|---|---|---|
| Stucco | [`white_stucco`](https://polyhaven.com/a/white_stucco) | 2.0 m | 558 / 932 / 348 / 324 KB |
| Stucco alt. | [`white_stucco_02`](https://polyhaven.com/a/white_stucco_02) | 1.8 m | 704 / 1224 / 453 / 945 KB |
| Block wall | [`concrete_block_wall`](https://polyhaven.com/a/concrete_block_wall) | 2.0 m | 849 / 1100 / 193 / 579 KB |
| Driveway | [`grooved_concrete_driveway`](https://polyhaven.com/a/grooved_concrete_driveway) | 1.8 m | 1147 / 1115 / 469 / 780 KB |
| Sidewalk | [`concrete_pavement`](https://polyhaven.com/a/concrete_pavement) | — | 926 / 1184 / 476 / 802 KB |
| Clay/S-tile roof | [`clay_roof_tiles_02`](https://polyhaven.com/a/clay_roof_tiles_02) | 2.5 m | 904 / 990 / 342 / 565 KB |
| Grey flat tile | [`grey_roof_tiles`](https://polyhaven.com/a/grey_roof_tiles) | — | 596 / 522 / 261 / 138 KB |
| Lawn | [`leafy_grass`](https://polyhaven.com/a/leafy_grass), [`sparse_grass`](https://polyhaven.com/a/sparse_grass) | 2.0 m | ~1.0–1.5 MB each map |
| Fence wood | [`brown_planks_05`](https://polyhaven.com/a/brown_planks_05) | — | 299 / 468 / 93 / 136 KB |

ambientCG equivalents (CC0, [ambientcg.com](https://ambientcg.com)): `Plaster001–004`, `PaintedPlaster017`, `Concrete034`, `Grass001–008`, `RoofingTiles012–014`, `Asphalt031/033`, `Road007`. Their 1K-JPG zips are 4–11 MB because they bundle displacement and both normal conventions; ship only colour + normalGL + roughness.

**Texturing strategy for a stylized-real look**
- Keep the **flat palette colours** the scene already uses (paint, weather, thermal tinting all key off them).
- Add **detail maps only**: a greyscale tileable roughness map plus a normal map per material family. They modulate light without fighting the colour system.
- Albedo maps are needed only where the pattern is the point: roof tiles, block coursing, driveway grooves, lawn.

**GPU memory math**
- Uncompressed 1k RGBA8 with mips ≈ 5.6 MB; 2k ≈ 22 MB.
- KTX2 (Basis) transcodes on Apple GPUs to ASTC 4×4 (8 bpp) ≈ 1.4 MB per 1k map with mips, or ETC2 RGB (4 bpp) ≈ 0.7 MB.
- So **8 materials × 3 maps at 1k**: ~135 MB uncompressed vs ~20–35 MB as KTX2.

**KTX2 pipeline**
- For glTF: `gltf-transform etc1s|uastc` (KTX-Software ≥4.4).
- For loose textures: `ktx create --encode basis-lz` (ETC1S, smallest; fine for roughness/AO and grass albedo) or `--encode uastc` (better for normal maps), then load with drei `useKTX2`.
- **Trap**: `useKTX2` defaults its transcoder path to `cdn.jsdelivr.net/gh/pmndrs/drei-assets@master/basis/` (`drei/core/Ktx2.js:7-8`). Self-host `three/examples/jsm/libs/basis/basis_transcoder.{js,wasm}` and pass `basisPath`.

**UVs without hand-UVing code-built boxes**
- **Recommended: world-scaled box UVs generated at merge time.** `MergedBoxes` already builds geometry. For each face, set `uv = (face-plane position) / textureMetres` (e.g. stucco tile = 2.0 m). Textures then keep real-world scale across boxes of any size. Cost: zero per frame, one texture sample.
- **Triplanar** is for irregular shapes only. It costs 3× texture fetches per map. On `WebGLRenderer` (no TSL node materials), use `onBeforeCompile` or `three-custom-shader-material` 6.4.0 ([forum notes](https://discourse.threejs.org/t/wrap-texture-around-object-without-stretching-with-meshstandardmaterial/56948)).

### B5. Vegetation and neighbours

**Draw-call primitives**
- drei `<Instances>`/`<Instance>` = 1 draw call per geometry + material.
- drei `<Merged>` = 1 call per source mesh.
- `@three.ez/instanced-mesh` (`InstancedMesh2`, 0.3.16) adds per-instance frustum culling with a BVH, distance LOD and shadow LOD ([forum](https://discourse.threejs.org/t/three-ez-instancedmesh2-enhanced-instancedmesh-with-frustum-culling-fast-raycasting-bvh-sorting-visibility-management-lod-skinning-and-more/69344)). It is overkill for <500 instances on one lot; plain `<Instances>` suffices.

**CC0 plant sources, and the gap**
- [Quaternius Ultimate Nature Pack](https://quaternius.itch.io/150-lowpoly-nature-models): 150 models, CC0, tagged palm and cactus; ships .blend/.fbx/.obj (convert with Blender or gltf-transform).
- [Quaternius Stylized Nature MegaKit](https://quaternius.com/packs/stylizednaturemegakit.html): 116 models, CC0, glTF; 40 trees, 35 plants/flowers, grass, bushes; ~60–70% free.
- [Kenney Nature Kit](https://kenney.nl/assets/nature-kit): CC0, v1.0 (2020), 330 files; generic trees, foliage, rocks.
- Poly Haven plants are photogrammetry at 17k–17M tris. Most are unusable. Exceptions: `potted_plant_04` (succulent, 6k), `shrub_03` (17k), and `jacaranda_tree` (312k tris; iconic SoCal street tree but heavy, decimate first).
- **No CC0 low-poly agave, sago/cycad, Mexican fan palm or eucalyptus turned up.** The sago models found are paid ([Superhive](https://superhivemarket.com/products/cycas-revoluta-3d-model)).

**Recommended plant approach: build the four SoCal signatures in code** (they are geometric and read well when stylized)
- **Agave**: one rosette of 12–20 tapered, slightly curved leaf blades (an extruded `Shape`, or a `ConeGeometry` scaled flat). Instance per plant; ~200 tris.
- **Sago/cycad**: short trunk plus 12–16 arched frond cards. Each card is a plane with an alpha-tested leaflet texture (one 256² atlas).
- **Mexican fan palm / queen palm**: tall thin tapered cylinder (16–25 m for fan palms) plus a crown of 10–14 fan or feather cards; fan palms often carry a brown "skirt" cone. Reads well against the sky at distance.
- **Eucalyptus**: from an orbiting camera, use 3–5 overlapping alpha-cutout cards around a pale trunk, or a Quaternius tree tinted blue-grey.
- All of these instance into ~5–8 draw calls total.

**Neighbour houses**
- Code-built low-poly shells: box plus hip or gable roof; every neighbour **merged into one geometry with vertex colours**, so 1–2 draw calls.
- Sit them 3.05 m (Era A) from our side walls and let fog take them. Real geometry beats billboards because the camera orbits.
- Drop shadows from neighbours, or mark them `castShadow` only once with BakeShadows.

**Impostors**
- drei `<Billboard>` is per object, so each one is its own draw call. Use it only for a handful of far trees.
- Octahedral impostors ([agargaro/octahedral-impostor](https://discourse.threejs.org/t/a-forest-of-octahedral-impostors/85735)) are WIP by the author's own account; skip.
- For distant street trees, **cross-quads (two crossed alpha-tested planes) in one InstancedMesh** are the cheapest solid option.

**Grass on iPad**
- **Textured plane**: `leafy_grass` normal + roughness at world scale, plus a low-frequency macro tint (a large noise texture or vertex colours) to kill tiling, plus a darker band along walls and edging. 1 draw call, negligible cost.
- Instanced blades (10k–100k) are a fill-rate, overdraw and alpha-test cost on tile-based Apple GPUs, and need per-frame wind or they look dead. Not worth it.
- **Middle ground**: a few hundred instanced grass-clump cards only along the lawn edges and the parkway, where silhouette matters.
- Also consider that many current SoCal front yards are drought-tolerant decomposed granite, gravel and succulents. A DG texture plus agave rosettes is cheaper than lawn and on-brand.

### B6. iPad Safari WebGL realities

- **MAX_TEXTURE_SIZE**: Apple GPUs report 16384 (macOS Safari 17.3 WebGL report: [PDF](https://github.com/gkjohnson/three-gpu-pathtracer/files/14887242/WebGL.Report.pdf)). An iOS 26 report shows 16384 advertised while textures above 4096 crash ([cosmosgl/graph#203](https://github.com/cosmosgl/graph/issues/203)). **Stay ≤2048 per texture.**
- **Memory**:
  - iOS Safari kills tabs on a per-process limit (jetsam or WebKit's own threshold, whichever is lower). This is not physical RAM. Texture-heavy WebGL pages hit reload loops ending in "A problem repeatedly occurred" ([WebKit 300782](https://bugs.webkit.org/show_bug.cgi?id=300782), [Apple forum](https://developer.apple.com/forums/thread/741624), [WebKit 290623](https://bugs.webkit.org/show_bug.cgi?id=290623)).
  - A 2012-era Khronos report saw termination at ~1.25 GB on an iPad; resizing a WebGL canvas leaks backing stores ([Khronos list](https://www.khronos.org/webgl/public-mailing-list/public_webgl/1511/msg00022.php)).
  - No authoritative per-device number exists. **Practical budget: keep total GPU allocations under ~250–300 MB.** Count textures plus every full-screen render target at dpr 2; see the composer math in B3.
  - Dispose the renderer explicitly on unmount, and handle `webglcontextlost`.
- **Post-processing at dpr 2**: every full-screen pass touches 5.6 MP on a 12.9" iPad. Apple's tile-based GPUs pay mostly in bandwidth for each extra full-screen target. Composer + N8AO + SMAA is ~4–6 extra full-screen read/writes per frame.
- **Does frameloop demand make heavy effects acceptable?** Partly.
  - Cost scales with frames drawn, and most of a 1–2 h meeting is the camera at rest. So:
    - (a) a one-off bake (env PMREM, AccumulativeShadows, BakeShadows) is essentially free;
    - (b) an effect that runs *only on settle* (N8AO accumulate, then stop invalidating) costs a burst of ~30 frames per rest.
  - But every camera glide and tap animation renders at full rate with all passes enabled. Thermal headroom is therefore set by interaction-time cost, not idle cost.
  - Use R3F's `performance` / `regress()` (or drei `AdaptiveDpr`) to drop dpr and disable AO during motion, and restore them on rest.

---

## Ranked: realism techniques by visual payoff ÷ iPad cost

| # | Technique | Payoff | Per-frame cost | Notes |
|---|---|---|---|---|
| 1 | Self-hosted 1k golden-hour HDRI (Ultra HDR jpg) for lighting + matched warm sun at 20–30° + **AgX or Neutral** tone mapping | very high | ~0 (PMREM once) | biggest "real" jump; replaces the Lightformers or adds to them |
| 2 | **BakeShadows** (`shadowMap.autoUpdate=false`, `needsUpdate` on change) + tight 2048 shadow frustum | high | negative (removes the per-frame shadow pass) | pure win under orbiting |
| 3 | Horizon-matched linear fog (aerial perspective) + merged low-poly neighbour houses | high | ~0, +1–2 draw calls | sells "suburb" and depth |
| 4 | Real-scale layout (Part A constants: setbacks, block walls with cap, driveway/apron, curb/gutter, sidewalk/parkway) | high | +few draw calls (merged) | believability comes from proportion more than shading |
| 5 | World-scaled box UVs + 1k **KTX2** detail normal/roughness (stucco, block, concrete, tile, grass) | high | 1–2 extra samples per fragment; ~25 MB GPU | textures give scale cues; keep palette colours |
| 6 | **AccumulativeShadows** ground catcher (bake once) + hand-placed gradient AO at wall bases and eaves | medium-high | 0 after a one-time bake | grounding without SSAO |
| 7 | Code-built instanced agave / sago / palms / eucalyptus cards + lawn macro-tint (or DG + succulents) | medium-high | +5–8 draw calls | the SoCal read |
| 8 | N8AO half-res "Low", **only on settle**, composer with `multisampling={0}` | medium | high during use; memory-heavy at dpr 2 | add last, behind a perf gate; off in ghost/thermal |
| 9 | PCSS `SoftShadows`, VSM, instanced grass blades, octahedral impostors | low | medium-high | skip |

**Recommendation**: ship tiers 1–7 with no `EffectComposer`. That stays within ~70–80 draw calls, adds no full-screen passes, and adds ~25–35 MB of GPU textures. All new costs are either one-time bakes or folded into existing passes, so the iPad's per-frame load during camera moves stays about where it is today (it actually drops, thanks to BakeShadows).

Treat N8AO as an optional tier 8 behind `PerformanceMonitor`, and only if a side-by-side on the iPad shows the eave and corner AO is worth the heat. Tone-map choice: Neutral if proposal paint colours must read true, AgX otherwise.
