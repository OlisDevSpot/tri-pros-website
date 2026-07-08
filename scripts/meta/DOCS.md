# scripts/meta — Campaign Engine

CLI tooling for Tri Pros Meta ad account. Manages campaigns, ad sets, and ads as
versioned code. Entry point: `pnpm meta sync` (dry-run) / `pnpm meta sync --apply`.

Design spec: `docs/superpowers/specs/2026-07-03-meta-campaign-engine-design.md`.
Measurement invariants: `src/shared/services/providers/meta/DOCS.md`.

## showcase-offer

Every campaign spec sells the **Showcase offer** — canonical definition,
approved vocabulary, and ad rules (incl. CTA rules: `APPLY_NOW`/`LEARN_MORE`,
never `GET_QUOTE`) live in `docs/marketing/showcase-offer.md`. Read it BEFORE
writing or editing ad copy in `campaign-specs/*.campaign.ts`.

## campaign-as-code

Specs in `scripts/meta/campaign-specs/` are the single source of truth for all
**managed** objects. A managed object is one whose key appears in `meta.lock.json`.
Anything else in the account is an **orphan** — reported by sync, never touched.

Editing a spec field and running `--apply` overwrites the corresponding Meta object
on the next sync. The one exception is **`status`**: sync never reads or writes it.
Activation (campaign/ad set/ad → ACTIVE) is human-only in Ads Manager.

Ad copy (headline, primary text, description) lives typed in the campaign spec, not
in `public/` (everything there is publicly served and guessable). Image files live in
`public/funnels/<funnelSlug>/ads/` (committed, high-res source — NOT the compressed
funnel WebPs). Missing image → that ad is skipped with a warning; the rest of the
plan still runs.

Campaign specs are validated on load via `defineCampaign` (Zod). The registry
(`campaign-specs/registry.ts`) exports `CAMPAIGN_SPECS`; all other tooling imports
from there.

## hard-guardrails

These are hard-coded invariants, not operator policy. They cannot be bypassed by any
flag or config.

- **Creates always PAUSED.** Every campaign, ad set, and ad is created with
  `status: PAUSED`. The engine never activates anything.
- **Updates never send `status`.** Updates re-send the full spec-derived body except
  `campaign_id` (immutable) and `status` (never sent).
- **No deletes, ever.** Objects removed from a spec become orphans — reported in the
  plan output, never deleted or paused by the engine.
- **Budget ceiling.** `assertBudgetCeiling` (run before any API call) sums
  `dailyBudgetCents` across all specs and throws if the total exceeds `16_600`
  ($166/day ≈ $5K/mo). To raise the ceiling, edit the constant in
  `campaign-specs/lib/guardrails.ts` and get a second pair of eyes on the diff.
- **Audit trail.** Every `--apply` appends a JSON line to
  `scripts/meta/logs/sync-history.jsonl` (gitignored). The lock file is committed;
  the log is not.

## lock-file

`scripts/meta/meta.lock.json` maps each spec key to its Meta ID and the fingerprint
it was last synced with — analogous to Terraform state.

**The lock is committed to git.** It is the canonical record of what the engine
manages and the source sync uses to match spec objects to live account objects.

**Self-healing.** If a managed object is manually deleted in Ads Manager, the lock
entry becomes stale. On the next `--apply` sync detects the ID is missing from the
account and re-creates the object from the spec. The lock is then updated
immediately after each successful API call, so a mid-run failure leaves the lock
consistent with whatever did complete — re-running sync resumes safely.

**Conflict resolution.** If the lock and the live account drift in a way sync cannot
auto-resolve (e.g., duplicate named objects from a pre-engine wizard run), re-run
sync. The diff + orphan report surfaces the conflict; decide which objects to keep in
Ads Manager, then update the lock if needed and re-run.

## optimization-ladder

Ad sets launch with `optimizationEvent: 'LEAD'`. This tells Meta to find people
likely to submit the funnel form.

Once the CAPI `Schedule` event flows (appointment-set via CRM entity hook) and a
given ad set accumulates **~50 Schedule conversions/week**, flip that ad set's
`optimizationEvent` to `'SCHEDULE'` in the spec and run `pnpm meta sync --apply`.
Meta then optimizes for people likely to set an appointment — a higher-quality signal
than form completion.

Do not graduate below ~50 conversions/week per ad set; Meta's learning phase stalls
with insufficient volume and performance degrades.

The graduation path is per ad set, not per campaign. Kitchens and bathrooms can
graduate independently based on their own conversion volumes.
