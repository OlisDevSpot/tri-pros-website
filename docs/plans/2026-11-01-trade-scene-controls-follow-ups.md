# Trade scene Controls: follow-ups

The Controls build (`d8f49477b..4de8411ad`, branch `feat/trade-scenes-foundation`) made these calls for the owner while it ran. Each one is cheap to change. Rule on it, or leave it as built.

## Copy calls
- **The toggle's accessible name changes with its state**, alongside `aria-pressed`, using the mock's copy. A screen reader hears the new name on every flip.
- **An unset foundation** reads "Slab, no crawl space" on the Today row, and "Nothing to add on a slab" under the build. The mock does the same for any system without upgrades.
- **Frame and package-unit build chips** keep their part labels; the mock has no wording for them.
- **The keys sheet's Escape line** now describes the whole order: a menu, then the system, then the window, then the close-up.

## Behaviour calls
- **Opening Systems from a close-up leaves the close-up**, so nothing sits behind the rail. This mirrors "a zoom closes Systems". Keeping the close-up under the rail is a one-line revert.
- **`m` only opens Modify.** With Modify already open, it puts the cursor back in the search and keeps the query.
- **Age group has no Not sure** (as in the mock), so a set age group can't be cleared from Home facts.
- **Heating & cooling's camera aims at the condenser pad for every HVAC type**, including package and wall units, which draw no pad. TS3b.4b's system views replace this.
- **Leaving a close-up** (Escape or Whole home) hands focus to the pin that opened it, or else to the Systems button.

## Look calls (the mock lost to a standing rule)
- **Type follows the design system's lint caps:**
  - no arbitrary px sizes;
  - weights up to bold;
  - Syne up to semibold;
  - a 12 px floor.

  So the mock's 13/13.5 px is `text-sm` and its 10–12.5 px is `text-xs`.
- **Colours are theme tokens**, never the mock's hex. The applied flash uses the success token.
- **On the phone the group stays centred.** The toggle shifts by half of the open name, as on the iPad, not 0 px.
- **Home facts tabs** sit in the window's body on stages 600–799 wide (an iPad with the nav open), as on portrait. On a phone they step 12 px apart, not the mock's 16, which overflowed a 390 phone.
- **Modify's button turns primary while open** (R162). The mock draws it raised like the others.
- **The bill fields' `$`** sits inside the figure; the shared `MoneyField` adds it.
- **Age group's scale** reads smaller than the mock's. It is the shared `ScaleField`, and its targets pass the 40 px floor.

## Code left for later
- **`era-code-line.ts` casts the era tables.** The fix lives in `src/shared/modules/construction/core/`, which was off limits: declare `HOME_MATERIALS` with `satisfies` so `windows.eraGuess` keeps `WindowsType`. That needs clearance to touch the construction module.
- **`CONTEXT.md` "Scopes and addons (the Upgrades tab's list)"** names components the build deleted (`ScopesAndAddons`, `ScopeOrAddonRow`). The term still describes Systems' build rows. Re-word it with the owner.
- **TS3b.4b's plan** cites the scene card, panel, build switch and `'under-floor'` focus. It must be re-planned on this head: it now replaces `close-up-card.tsx` and builds on `SYSTEM_CAMERA_VIEWS`.

## The device check
On the real iPad and phone, through `pnpm dev:mobile`, check:
1. each section opens and closes;
2. a system glides into view beside its card;
3. a part pin opens the close-up card with the whole dock visible;
4. Modify applies a change on Enter;
5. Benefits on Today flips to the build first.
