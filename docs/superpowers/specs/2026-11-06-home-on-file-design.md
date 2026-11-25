# Trade scene, TS4 design 1: the home on file

Tracker: `docs/plans/2026-10-16-trade-scenes-epic.md`, row TS4; rulings R153, R210, R237–R246, R253–R265, R269–R282.
Handoff: `docs/superpowers/handoff/2026-11-03-ts4-meeting-integration-handoff.md`. Research: `docs/plans/2026-11-05-property-data-sources-research.md`.
Status: approved by the owner 2026-11-06 (R280). Nothing built.
Glossary (agreed 2026-11-06, in `CONTEXT.md`): **Build**, **Property facts**, **Property lookup** (free, paid).

TS4 is two designs (R242). This is the first: what Tri Pros keeps about a customer's home, how the address fills it in, and how the scene opens for a customer and saves. The second, **the scene in the meeting** (where it sits in the flow, the Build side against the selected proposal), is designed afterward with the multi-proposal meeting flow epic. §8 lists what is left to it.

## 1. Goal

Today the trade scene opens the same for everyone: `TradeSceneView` seeds its store from `HOME_SCENE_DEFAULTS` and nothing is saved. A rep sets up the home on a phone during the walkthrough and has to do it again on the iPad at the table.

After this design:

- A rep opens the scene **from a meeting**. It shows that customer's home.
- The address has already answered what it can for free (the map point, the utilities, the climate zone, coastal or inland). A paid lookup (year built, roof, lot and the like) runs on a tap.
- The rep's work is saved with an explicit **Save** as a **Build**: one version of both sides of the scene. It shows on any device after a reload.
- A later meeting shows the earlier Builds and starts a new one from any of them.

Why now: the scene is on prod (PR #287) and is the meeting's product presentation (R118), but it has no memory. Every other part of TS4 hangs on whose data is which (handoff §4 call 3), so that is settled first.

## 2. Decisions already made

| # | Decision | Source |
|---|---|---|
| D1 | Save is explicit. Not every tap is written. No live sync between devices; a second device shows what was saved when it loads or reloads. | R243 |
| D2 | Save keeps both sides: the home as it stands and the build lined up so far. The Save button shows when something is unsaved; leaving with unsaved changes asks first. A reload on the same device restores the working copy from session storage. Save is the only write. | R253 |
| D3 | Two Property lookups, fetched apart. The **free lookup** runs by itself when a street address lands on a customer. The **paid lookup** runs only on a tap in the scene. | R244, R254, R256 |
| D4 | Most leads arrive with a city, ZIP and state only; the dispatcher enters the street address when an appointment is set. So the free lookup runs then. No run across the customers already on file; a manual run on a customer covers them, free lookup only. | R255, R256 |
| D5 | The lookup provider is swappable. The stored fields are ours and do not change with the provider. RentCast is the first paid provider. | R245 |
| D6 | A lookup run on purpose may replace what a person set, after a confirmation that lists the facts that will change. It overrides only facts it returned and that have a home here; an empty answer wipes nothing. | R257, R258 |
| D7 | Property facts are never filtered, sorted or counted. They are read whole for one customer, by the scene and later by personalized copy. | R259 |
| D8 | A customer has one set of Property facts and many Builds. A new Build starts from the original or from an earlier Build. A correction made in a Build stays in that Build. | R261, R262 |
| D9 | The customer holds the facts that never change. Everything else is in the Builds. A layout drafted from the address is never put into a Build by itself. | R263 |
| D10 | The split between the customer and a Build (§3.1). The rep's layout is part of the Build. Household and age group stay on the profile. | R264 |
| D11 | Three tables: Property facts as typed columns, one row per customer; lookup runs as rows that are never edited; Builds as rows with JSONB fields. Not stored: which facts a lookup set, and the confirmation's list. Both are worked out. | R265 |
| D12 | Names: Build, Property facts, Property lookup. "Enrichment" stays the funnel answers (`customer_enrichment`). | R269 |
| D13 | Today's bill amounts are one record per customer, `customer_utility_bills` (the energy-impact plan's table), read and written by the scene and the proposals. The rep's cut overrides are saved in the Build. The electric utility lives in Property facts only. | R270 |
| D14 | A Build belongs to its meeting and is stable for it: editable there, view-only from any other meeting, with the prompt "To edit, start a new build for this meeting", which copies the row. A Build links to its meeting, not to its customer; the customer is read through the meeting. Several Builds in one meeting are allowed. Numbered automatically, with an optional short name. The scene opens on the latest. The homeowner sees Builds on the rep's screen only. | R271 |
| D15 | The one electric utility list in code (`electricProviders`) grows to every utility the state's service-area map returns in the service area. The gas utility is stored too. | R238, R272 |
| D16 | The paid lookup: any rep who can open the meeting; once per address; a changed address brings the button back; a repeat on the same address only by the owner or an admin, and never past $1 per address, every source added together. | R241, R273 |
| D17 | Any rep who sits in a meeting with the customer sees all of that customer's Builds, locked outside their own meeting. | R274 |
| D18 | HVAC type and components, windows type and insulation level leave the customer profile and the meeting's context panel. They are set in the scene only and live in the Build. | R275 |
| D19 | The area's climate numbers are shown to the homeowner even though the scene does not draw from them, tied to the home's ZIP code: "how much research we are doing into their home". | R276 |
| D20 | Standing instruction for all schema work here: one source of truth per fact, the same primitives, the common interfaces, the house conventions. | owner, 2026-11-05 |

## 3. The design

### 3.1 Every fact has one home

| Fact | Home | Written by | Read by |
|---|---|---|---|
| Street address, city, ZIP | `customers` (exists) | dispatcher, intake | everything |
| The map point | `customers.latitude`, `longitude`, `geocodedAt` (exist; nothing writes them today) | the free lookup | the scene later (sun, rung 4–5), maps |
| Year built, stories, foundation type, roof type, lot size, garage, pool, HOA | **Property facts** (new, §3.2) | the paid lookup; a rep, from the scene or the customer profile | the scene, the customer profile, copy |
| Electric utility, gas utility, climate zone, coastal or inland | **Property facts** | the free lookup; a rep | the scene, bills, programs, copy |
| What each lookup returned | **Lookup runs** (new, §3.3) | the lookups | the confirmation, the cost cap, a later provider swap |
| Household type, age group | `customer_profiles` (stay) | a rep, from the profile or from the scene with Save | the scene |
| Today's electric, gas and water bills | `customer_utility_bills` (the energy-impact plan's table, §3.6) | a rep; the homeowner by share link | the scene, proposals |
| Today side: wear per material, paint wear, HVAC type and components, windows type and insulation level as they are (nowhere else, D18), gutters, exterior paint, ducts, crawl space insulation, AC size, typed repair figures | **Build** (new, §3.4) | a rep, with Save | the scene |
| Build side: scopes, efficiency upgrades, install styles, shingle colour, bill cut overrides | **Build** | a rep, with Save | the scene; the proposal tie is design 2 |
| The lot's layout | **Build**, a third field, when the layout work merges | a rep, with Save | the scene |
| The area's climate numbers | one generated file, by ZIP code (§3.8) | a generator script | the scene's readout and Area tab |
| A rep's override of a climate number for this home | **Property facts** | a rep, in the Area tab | the same readout and tab, in place of the ZIP's number |
| Weather, Today ⇄ Build, camera, thermal camera, Look inside, what is in focus | not saved | | |

Three points where this table sharpens R264 and R265, each to keep one home per fact. The first is the owner's ruling (R275); the other two are my calls:

- **All eight property columns leave `customer_profiles`; four move and four go.** `yearBuilt`, `roofType`, `foundationType` and `hoa` become Property facts. `hvacType`, `hvacComponents`, `windowsType` and `insulationLevel` are dropped (D18): R264 put them in the Build, and a second editable copy on the profile would never reach the scene. No existing value of any of the eight is kept or copied: "no property data is important for us to keep from old customers as of now. This build is the first time we start caring for these facts" (R281).
- **Roof form is not stored.** R264 lists it on the customer. In code it follows from the roof type (`roofTypeForForm`, `homeRoofForm`), and gable or hip is part of the layout. A stored copy would be a second truth.
- **The map point stays where it is.** `customers` already has the three columns and a hook that clears them when the address changes (`customerCrud`, `update.before`). The free lookup becomes their writer.

### 3.2 Property facts

One row per customer, typed columns, its own table keyed by the customer (the `customer_profiles` shape: primary key is the customer id, created on first write with `upsertOneToOne`, read with a flattened left join). It is a table of its own, not more profile columns, because the free lookup's job writes it when the address lands while a rep writes the profile in discovery (the Sub-Entity Standard's lifecycle and writer test).

Columns, every one nullable; null means not known:

| Column | Type | Vocabulary |
|---|---|---|
| year built, exact | whole number | set by a lookup or typed |
| year built, range | closed list | `yearBuiltRanges` (exists); only when the exact year is not known |
| stories | whole number | the existing key `numStories` |
| foundation type | closed list | `foundationTypes` (exists) |
| roof type | closed list | `roofTypes` (exists) |
| lot size, square feet | whole number | |
| garage | closed list | none, attached, detached (new const array in construction core; the layout work reuses it) |
| pool | yes / no | |
| HOA | yes / no | |
| electric utility | closed list | `electricProviders` (exists; grows, D15; PG&E and "other" stay, "other" for an answer outside the list) |
| gas utility | closed list | new const array beside it |
| climate zone | whole number | the state's 16 building climate zones |
| coastal or inland | closed list | `CLIMATES` (exists); a person's pick only |
| summer high, winter low, yearly average, yearly rain | number each | a person's override only; empty means the home follows its ZIP (§3.8) |

Rules:

- **Year built, one truth.** The row holds the exact year or a range, never both; the database refuses both. One helper, beside `ERA_BUILD_YEAR`, returns the range the scene reads: worked out from the exact year when there is one, else the stored range. It also settles the two years the ranges share (1978 and 1998). A lookup sets the exact year and clears the range; a rep who picks a range clears the exact year. Both count as a change under D6.
- **Coastal or inland, one truth.** The column holds only what a person picked (R184). Empty means it follows the climate zone through one mapping (zone 6 at least is coastal, per the research). The lookup writes the zone and never this column. A home with a zone is no longer "missing" coastal or inland.
- **A person can correct every Property fact.** The customer profile's property section lists them all, read from and written to Property facts. The scene keeps the controls it has (year built, roof type, foundation, coastal or inland); the rest get scene controls with the Property facts tab (R236). That tab, and the home and lot grouping of areas and systems, are brainstormed in the layout lab (`feat/scene-layout-lab`: options shown to the owner, nothing built). The scene's dock and Controls will change when the layout changes come in, so this design adds no new scene controls ahead of them (R281). The meeting flow's context panel keeps year built, HOA, roof type and foundation type, now on Property facts, and loses the four dropped fields along with everything that counted them (`PROPERTY_PROFILE_FIELDS`, the fill count, the persona profile types). The multi-proposal flow epic is reworking that panel; the two changes must not collide. Which table a field saves to comes from the tables' own columns, never a second hand-written list.
- **Who may edit stays the same.** Agents and dispatchers can edit the profile's property section today; both grants must name the new record, or the four moved fields lose their editors.
- **The scene's `property` input keeps its shape** (`PropertyProfile`, seven fields). One mapper builds it from Property facts (three fields) and the open Build's Today side (four fields), and splits it back on Save. `TradeSceneView` and its store are the only scene surface this design touches.
- **No old values are carried (R281), and the eight old columns are not dropped yet (R282).** They stay in the database as frozen `*Deprecated` columns with no reader and no writer. The dev database is shared by every worktree, and a branch that still selects a dropped column fails; how schema changes should flow across worktrees is being worked out separately. Dropping them is tracked as T23 in the epic tracker. On prod the new table must exist before the new code goes live; that is the owner's step.
- **Adding the table to dev is open too.** The shared dev database is ahead of `origin/main`: on 2026-11-06 it held two tables and some columns that only unshipped work on local `main` defines. A push from a branch off `origin/main` offers to drop them, and drizzle-kit applies all of its statements or none. How plan 1's table reaches dev is the owner's ruling (§7); plan 1 is not built before it.

### 3.3 Property lookups

**The runs.** One row per run, many per customer, never edited:

- the customer, free or paid, the provider, who asked (empty for the job), the date;
- the address it looked up, as one normalized key worked out by one helper from the customer's address fields;
- the cost in cents, and whether it succeeded (a failed run is a row with no cost and the reason);
- the provider's raw answer, whole, as an unedited snapshot (the `customer_lead_attribution.capture_json` precedent);
- our own fixed fields worked out from that answer: a small, flat, versioned document, checked on write.

Worked out, never stored: whether a Property fact still equals what the latest run returned (so the scene can say "from the lookup"), whether the address changed since a run (compare keys), and what was spent on an address (sum the paid runs for its key).

**One service, three ways in.** A property-lookup service does the work: fetch, write the run, apply to Property facts. It is called by:

1. **The job**, for the automatic free lookup. The customer's crud hooks dispatch it, best effort: after a create with a street address (a new hook; there is none today), and after an update only when an address field changed. The update gate matters: the job's own write of the map point is a customer update, and without the gate it would dispatch itself again. That write sets the coordinates in the same patch, or the existing hook clears them. The handler takes the customer id only and checks again that no successful free run covers the address key, so a repeat does nothing. A city and ZIP alone never trigger it.
2. **A customer action**, "Look up property" (free only), one customer at a time, shown when a street address exists and no successful free run covers it. It calls the service directly.
3. **The scene**, which offers the free and the paid lookup apart. It calls the service directly, so it also works in dev without the job tunnel.

**The free lookup** returns the map point, the electric utility, the gas utility and the climate zone. Coastal or inland follows from the zone (§3.2).

- The map point comes from Geocodio (free to 2,500 a day; its terms allow keeping the result, which Google's do not).
- The utilities and the climate zone come from the state's published service-area and climate-zone maps, downloaded once, trimmed to the company's service area (the one definition in `src/shared/constants/company/`) and kept with the code, tested point-in-area. No network call, so this is plain library code, not a provider. The research's fixes apply: drop the Metropolitan Water District area, handle Vernon's two entries, key on the utility's name or id, and use an even-odd test across all rings so enclaves resolve (Beverly Hills, Riverside, Anaheim and the others in research §B.2). Those tested points are the helper's test cases.

**The paid lookup** returns year built (exact), stories, foundation type, roof type, lot size, garage and pool where the provider has them. Los Angeles, Orange and San Bernardino counties publish no roof field, so empty answers are expected and wipe nothing. Each provider (Geocodio, RentCast) returns its own shapes and knows nothing of ours. One source contract on our side takes an address and returns our fixed fields plus the raw answer; a translator per provider implements it (the construction module's `sources` shape). Swapping RentCast later adds a translator and changes no stored field (D5).

**Applying a run.**

- The automatic free lookup only fills empty facts.
- A lookup run on purpose compares what it returned with what is on file. If no filled value would change, it applies. If any would, the rep sees the list and confirms first (D6). Declining leaves the run on file; the same answer can be applied later without fetching again.
- A lookup writes Property facts only. A Build's Today side holds what a lookup cannot know and is never touched by one. This is how R257's "override the changes made to the Today build" reads now that Builds exist: the facts a lookup can change all live on the customer.
- **When the address changes**, the map point is cleared (existing hook) and the free lookup runs for the new address. It replaces the values the last free lookup set that nobody changed since, and leaves a person's values alone. The scene shows that the address changed since the paid lookup, and the paid button comes back (D16).

**The guard (D16).** The paid button is live when no successful paid run covers the current address key. After a run it reads "Looked up" with the date. A repeat on the same address is offered to super-admins only (there is no owner or admin role; this is a permission rule, not a role check in the button), and the service refuses any paid call that would take the address past 100 cents. The check is in the service, not the button.

**Dev and prod.** A paid call is made only where the provider's key is set. Whether dev gets a key is the owner's choice; with no key the paid button says so and does nothing. Each needs an owner step: a Geocodio account and key, a RentCast key.

### 3.4 Builds

One row per Build, hanging off the meeting like participants and conversations do (deleted with its meeting):

- its meeting; who made it; the Build it was started from (empty when started from the original); an optional short name;
- the **Today side** as one JSONB document and the **Build side** as another, each saved whole, versioned, and checked on write against schemas built from the scene's own types and const arrays (never a parallel shape);
- the **layout** as a third document when the layout work merges, using that work's own codec.

A Build's number is its place in the customer's timeline, oldest first across all their meetings, counted over every Build of the customer whoever is looking. It is worked out, not stored.

**The original** is not a row. It is what a Build starts from when there is none to copy: the Today side unset, so the scene's era guesses apply as they do now, and the Build side from the scene's defaults.

**Opening the scene from a meeting:**

| The customer has | The scene opens on |
|---|---|
| no Build | the original, editable; the first Save creates Build 1 for this meeting |
| a Build from this meeting | this meeting's latest Build, editable |
| Builds from earlier meetings only | the latest of them, view-only, with "To edit, start a new build for this meeting"; the tap copies the row into this meeting and opens the copy |

A Builds list in the scene shows the customer's Builds (number, name, date, meeting type, rep) and "New build", from the original or from any Build. The open Build is in the address, so a reload reopens it.

**View-only** means every input is locked, Property facts and bills included; weather, the Today ⇄ Build toggle, the camera and the other view controls still work.

**Save.**

- One request, one transaction. It writes the open Build's two documents and whatever else the rep changed: Property facts, bill amounts, and household type and age group on the profile. All of it lands or none of it.
- The working copy lives in session storage, keyed by the Build, so a reload on the same device keeps unsaved work (D2). It extends the storage hooks that exist (`use-session-once`, `use-persisted-state`); the layout lab's "session storage replaces URL state" project reuses the same mechanism.
- If the Build was saved from another device since it was loaded, Save says so and offers to reload it or overwrite it.
- A Build can be deleted inside its own meeting only.

Property facts and bills are read live in every Build. Correct one in a later meeting and an earlier Build shows the corrected value when reopened (accepted, R270).

- **A changed fact can change what is offered.** The scene already trims the picks and some wear on every property change (`propertyPatch`): a different roof type offers different scopes. Opening a Build runs that same rule against the facts as they are now. A locked Build is shown trimmed and its row is never rewritten; an editable one shows as unsaved if the trim changed it. A lookup applied while a Build is open goes through the same rule.
- **A reschedule carries the Builds.** The replacement meeting already takes over the visit (flow state, participants, the link). The Builds move to it in the same hand-off, so the rep does not find their own set-up locked.
- **Duplicating a meeting** copies no Builds. The copy at the view-only prompt is its own action.

### 3.5 Getting in, and who may

- **Entry:** a meeting action, "Open trade scene", beside Start Meeting, shown when the meeting has a customer. It opens the scene page for that meeting. Its proper place inside the meeting flow is design 2.
- **The demo scene** (`/dashboard/trade-scene` with no meeting) stays as it is and saves nothing.
- **Who saves:** the reps who sit in the meeting, and super-admins. They save, start and delete Builds and run lookups. Dispatchers can open a scene and look; they cannot save a Build or run the paid lookup. The free lookup's customer action is theirs too, since they enter the address.
- **Who sees earlier Builds (D17):** any rep who sits in a meeting with the customer sees all of that customer's Builds, locked outside their own meeting. This is wider than proposals, which a rep reads only through a meeting they sit in. So a Build is read through the customer's reach and written through its meeting's; it is declared with its own read rule (the `CustomerNote` shape), not as a plain child of the meeting.

### 3.6 Bills

The scene's two bill fields each hold an amount today and the rep's cut override (`BillEntry`). They split:

- **The amount today** reads from and saves to `customer_utility_bills`, the 1:1 table the energy-impact foundation plan defines (EI-D19, its Tasks 7 and 8). Whichever of the two plans is built first creates the table from that one definition, **without the electric utility column** (D13). The energy-impact plan still creates that column and spells it two ways (`electricProvider`, `electricUtility`); it must be edited before either table task runs. `electricProvider` is the one name, matching the list and the glossary.
- **The cut override** is in the Build's Build side.
- The climate's default bills (R148) stay display defaults for an empty amount; they are not written.

### 3.7 When something is missing or fails

- No lookup has run, or one failed: the scene is exactly as it is today, defaults and the rep picks. A failed run is on file with its reason, and the button offers it again.
- A meeting with no customer has no scene entry.
- Save fails: the working copy stays in session storage and the button still shows unsaved.

### 3.8 The area's climate numbers, by ZIP code

The owner wants the homeowner to see them (D19). They change by ZIP code, and most leads arrive with a ZIP and no street address, so they are keyed by ZIP and need no lookup:

- **One generated file**: a row per service-area ZIP (the 750 in `service-area-zips.ts`), produced by a generator script from 30-year climate normals, the way the ZIP list itself is generated. The customer's ZIP is the key. The file stays on the server: the scene asks for one ZIP and receives its few numbers, so the list is never sent to a browser (R279).
- **The numbers**: the average summer high, the average winter low, the yearly average temperature and the yearly rain. Sun strength is added if the source's units check out. UV and wind are not in the source and wait.
- **Where they are changed**: the scene's Area tab, beside the utilities and the climate zone, where a rep can override any of them (R277). An override is for this customer's home only, never the whole ZIP: only the override is saved, on Property facts, and clearing it returns the home to its ZIP's number (R279).
- **Where the homeowner sees them**: a readout on the scene itself, in the manner of the thermal camera's readings (`ReadingPin`): the ZIP, the climate numbers and the utility, neat and always in view. Its place and look are settled in the UI pass. A ZIP with no numbers shows no readout.
- **They change nothing in the scene.** The weather keeps its two presets until the typical-day work (T19) decides to read these.
- The source is PRISM's 30-year normals (research §B.4). Its terms are not checked for now (R278).

## 4. Non-goals

- Where the scene sits in the meeting flow, the Build side against the selected proposal, prefetch on meeting open, the back gesture: design 2.
- Parcel imagery, vision and the layout draft (ladder rungs 4–5). They write into these same records and count against the same $1.
- A run across the customers already on file (D4).
- A homeowner-facing link to a Build (D14).
- A rep's view of a lead built from lookup facts (the ATTOM handoff). The customer profile only gains the plain list of Property facts (§3.2).
- AI in Modify, the second-screen mirror.

## 5. What would make this a failure

- The same fact stored in two places, or a second shape beside an existing type or const array.
- A lookup that silently changes what a person set.
- A paid call that runs without a tap, or past the cap.
- A looked-up layout or a bad lookup making a Build unusable by default.
- The scene feeling slower because of saving.
- A Build from an earlier meeting that no longer shows what the homeowner saw, because someone edited it.

## 6. Calls of mine (not the owner's words)

1. Roof form is not stored, and the map point stays on `customers` (§3.1).
2. Year built is the exact year or a range, never both, read through one helper (§3.2).
3. Coastal or inland stores a person's pick only and otherwise follows the climate zone.
4. Every Property fact can be corrected on the customer profile; scene controls for the new ones wait for the Property facts tab (R236).
5. A failed lookup is a row; the address key is stored on the run; "once per address" and the cap are worked out from the runs.
6. The automatic free lookup fills empty facts only; after an address change it also replaces its own earlier values.
7. Declining the confirmation keeps the run and allows applying it later without a new fetch.
8. A lookup never writes into a Build.
9. The first Save creates Build 1; a copy is created at the tap.
10. View-only locks Property facts and bills too.
11. Save also writes household type and age group to the profile.
12. Save checks for a newer save from another device.
13. Opening a Build re-applies the scene's own trim rule against today's facts; a locked Build's row is never rewritten.
14. A reschedule moves the Builds to the replacement meeting; duplicating a meeting copies none.
15. A Build's number is worked out, so deleting one renumbers the later ones.
16. Reps in the meeting and super-admins save; dispatchers look only; a repeat paid lookup is for super-admins.
17. The paid lookup keeps heating and cooling answers in the run only; mapping them to our HVAC list is a later step that needs no schema change.
18. The climate numbers are those four, and the on-scene readout also shows the ZIP and the utility (§3.8).

## 7. Owner steps and checks

- A Geocodio account and key; a RentCast key; whether dev gets the RentCast key.
- Prod schema steps for each plan (the new tables), in the order each plan's PR gives. The drop of the eight frozen profile columns is T23, later.
- **Open:** how a new table from a branch off `origin/main` reaches the shared dev database, which is ahead of `origin/main` (§3.2). Every plan here that adds a table needs the answer.
- A hand check on dev after plan 1 is built: save a year built two ways on one customer and read it back on the profile and in the meeting's panel (agents write no rows).
- The energy-impact plan edited to drop its electric utility column (§3.6).
- The wording beside the climate numbers approved (§3.8).
- The look of every new control, in a UI pass (§10).

## 8. Left to design 2, and what this replaces

- Foundation spec §5.1 and §5.5 stay stale (handoff §2); design 2 redesigns them and records the lines it replaces.
- This design replaces: foundation spec D4 ("a bill the agent types in the cutaway (not saved)") and §5.3's "Nothing is persisted"; tracker T14 ("saving bills and overrides to the meeting"); R153's "saved to the meeting" (now: saved as a Build of the meeting, with the never-changing facts on the customer); R210's "one layout per customer" (now: the layout is in the Build).
- Design 2 inherits: the Build side read against the selected proposal's scopes; whether picking in the scene changes a proposal; the entry inside the flow; participants-only access.

## 9. Order of the build

One design, five plans, each shippable by itself:

1. **Property facts.** The table, the garage list, the eight property columns retired from the profile (frozen in the database, no values kept), the customer profile and the context panel on the new record, the year-built helper. (As planned: the utility and climate zone columns, the gas utility list and the grown electric utility list come with plan 2, the `PropertyProfile` mapper with plan 3.)
2. **The free lookup.** The runs table, the Geocodio provider, the area maps and the point-in-area helper, the service, the job and its trigger, the customer action.
3. **Builds and Save.** The table, the scene opening from a meeting, the original, the Builds list, view-only and copy, Save with the working copy, bills on their one record.
4. **The paid lookup.** RentCast behind the provider interface, the scene's two buttons, the confirmation, the guard and the cap.

5. **The area's climate numbers.** The generator, the file, the Area tab block.

Plan 3 needs plan 1 (the mapper). Plans 2 and 4 need plan 1. Plan 5 needs plan 3 only to know the customer's ZIP in the scene.

## 10. Left to the builder

- Table, column and file names, within `database-schema.md` and the Sub-Entity Standard.
- Where the area maps are kept and how they are trimmed to the service area.
- The route shape for a meeting's scene and how the open Build sits in the address.
- The exact fields of each Build document, taken from `TradeSceneInputs` and `HomeMaterialFacts` as they stand when plan 3 starts (the Up close and layout work are still moving them).
- The look of Save, the Builds list, the view-only prompt, the lookup buttons and the confirmation: a UI pass with the owner (flow first, real tokens), not decided here.
- Tests: the point-in-area helper against the research's tested points; the year-built rule; the apply rules (fill empty, override on purpose, empty wipes nothing); the cap; the Build documents' schemas against the scene's defaults.

## 11. Conventions the plan must follow

From a conventions audit of this design on 2026-11-06, each point checked against the code. Paths are exemplars to copy.

**Schema**
- One table per file, exported from the barrel with select and insert schemas and types; closed lists as `text({ enum })` from the const array, never a pg enum (`src/shared/db/schema/customer-profiles.ts`).
- Property facts: primary key is the customer id, cascade. Runs and Builds: the `id` helper. Runs carry `createdAt` only (`src/shared/db/schema/meeting-conversations.ts`).
- New const arrays sit with their siblings: garage in `src/shared/modules/construction/core/constants/enums.ts` (check the layout branch for a garage vocabulary first), gas utilities beside `electricProviders`; lookup kind and provider are const arrays too.
- Cost is whole cents with a check (`src/shared/db/schema/lead-source-monthly-spend.ts`). The run's kind, provider, success, cost and address key are columns; index on customer and address key. Builds: index on the meeting; the started-from link is set null with an index. `meetings.customer_id` has no index today.
- No copy script (R281) and no drop (R282): retired columns are frozen as `*Deprecated` properties. Schema changes go to dev only with `pnpm db:push:dev`; a destructive change is never pushed to the shared dev database from a feature branch.

**JSONB**
- Each Build document and the run's fixed fields carry `_v` and are parsed at the write boundary (`src/shared/entities/applications/schemas/index.ts`, the only `_v` document today).
- The Build schemas use `z.enum(<the core const array>)` and pick from the existing types, with a compile-time equality check. No Zod exists yet for `PropertyProfile`, `HomeMaterialFacts` or `TradeSceneInputs`. Three types are cut across homes: `PropertyProfile` (three fields from Property facts, four from the Today side), `HomeMaterialFacts` (`shingleColor` to the Build side), `BillEntry` (`now` to the bills record in cents, `cut` to the Build side).
- The raw answer is a snapshot, written once, pinned on the insert schema, never selected in a list read (`src/shared/db/schema/customer-lead-attribution.ts`).

**Specs, permissions, DAL**
- Property facts and the runs are declared with `defineSubEntitySpec`; Builds are declared with a parent and their own read rule through the customer (`src/shared/entities/customer-notes/lib/server-spec.ts`). Every new spec is added to `ENTITY_NAMES`, the `ServerSpec` union and `SERVER_SPECS` (`src/shared/entities/customers/lib/server-spec.ts`). A 1:1 child is a field of its parent's subject in code, so the agent and dispatcher `update` grants on `Customer` must name the new field.
- The facts write is `upsertOneToOne(ctx, spec, customerId, patch)` behind a one-line mutation; the read is a column picker like `profileCols()` at all three join sites.
- Every writer of Property facts (the profile, the meeting panel, the lookups, Save) goes through the one mutation, which applies the year-built rule; a direct `upsertOneToOne` call skips it. The patch schemas are strict where they are defined, so an unknown key is refused for every writer, not only at a router.
- A number's limits are written once, as named constants (the `CUSTOMER_AGE_MIN` / `CUSTOMER_AGE_MAX` precedent), read by the Zod schema and the field's config. Zod is the write boundary; a database check is kept for the one rule that spans two columns (year built, exact or range).
- The facts' keys come from the table: the key type is the patch schema's keys, the one hand-written list is the field configs (labels are needed anyway) with ids of that type and a compile-time check that none is missing, and the key list is worked out from it.
- The boundary years of the build ranges are written once, beside `ERA_BUILD_YEAR`.
- New files for the customer go under `src/shared/modules/customers/core/`; existing files under `src/shared/entities/customers/` are edited where they are (owner, 2026-10-05).
- The job's context is `systemContext(<reason>)`, with the reason added to the closed list first.
- A customer's Builds are read the `getMeetingsWithProposals` way: one query on the child joined to `meetings`, filtered by the meeting's customer and the Build's own read rule (D17).
- Save is a service verb wrapping `withTx` (its first user). It must not go through `customerCrud.update`, whose hook dispatches before commit.
- New units go under `src/shared/modules/customers/<unit>/` and `src/shared/modules/meetings/<unit>/`.

**Service, providers, job**
- Geocodio and RentCast are provider directories with a lazy env config (`src/shared/services/providers/notion/lib/config.ts`); the source contract and translators sit on our side (`src/shared/modules/construction/sources/`).
- The trimmed maps follow the generator pattern (`scripts/generate-service-area-zips.ts`).
- The job is declared with `createJob`, registered, payload `{ customerId }`, dispatched with `void job.dispatch(...)` from the `customerCrud` config (`src/shared/modules/projects/media/dal/server/crud.ts`).
- The address key helper and the hook's address fields share one list, beside the address formatter (`src/shared/lib/formatters.ts`).
- The customer action follows `use-customer-action-configs.ts`; its hide rule reads only the row, so "no free run covers this address" must be a field on the row.
- A new page prefix for a meeting's scene goes in the nav-path lint and `ROOTS`.
