# Session Log — Issue #40: Meetings Complete Overhaul

**Date**: 2026-03-25
**Branch**: `feat/40-feat-meetings-complete-overhaul-schema-l`
**Issue**: #40 — feat(meetings): complete overhaul — schema & logic improvements

---

## Phase: Brainstorming

### Context Explored

**Domain docs read**:
- `docs/sales/due-diligence-story.md` — 6-point framework + 6 psychological levers
- `docs/sales/in-home-meeting-playbook.md` — 5 phases (Rapport/Discovery → Trusted Contractor → Scope → Pricing → Close)
- `docs/customer/decision-psychology.md` — Emotional drivers, spouse dynamics, price anchoring
- `docs/customer/journey-map.md` — 7 stages, Stage 3 (Evaluation) is where the meeting lives
- `docs/domain/ubiquitous-language.md` — Canonical terms

**Schema/code read**:
- `src/shared/db/schema/meetings.ts` — table with 3 JSONB columns (situation, programData, meetingScopes)
- `src/shared/entities/meetings/schemas.ts` — Thin schemas (2 fields situation, 4 fields programData, scopes array)
- `src/shared/entities/customers/schemas.ts` — CustomerProfile (15+ fields), PropertyProfile, FinancialProfile
- `src/shared/constants/enums/meetings.ts` — All meeting enums (statuses, types, pain types, etc.)
- `src/features/meetings/constants/intake-steps.ts` — 5 intake steps with field configs
- `src/features/meetings/constants/programs.ts` — 3 programs (TPR Monthly, Energy-Saver, Existing Customer)
- `src/features/meetings/constants/step-content.ts` — Display constants for program steps
- `src/features/meetings/types/index.ts` — MeetingProgram, MeetingStep, IntakeStep, etc.
- `src/features/meetings/ui/views/meeting-flow.tsx` — Main flow view (intake + program modes)
- `src/features/meetings/ui/views/meeting-intake-view.tsx` — Intake form steps
- `src/trpc/routers/meetings.router.ts` — CRUD + linkProposal + duplicate + assignOwner

### Key Observations

1. **Intake steps don't map to playbook phases** — The 5 intake steps (Pain, Household, Home, Decision, Financial) are profiling buckets, not aligned with the meeting's narrative arc
2. **Due diligence story isn't explicitly in the flow** — The 6-point framework is the core sales narrative but has no structural presence
3. **Program mode is disconnected from intake** — Binary mode toggle (intake vs. program) when the actual meeting is a continuous journey
4. **situationProfileJSON is too thin** — Only 2 fields (decisionMakersPresent, meetingType). Should capture discovery outcomes
5. **programDataJSON is too thin** — Only 4 fields. Needs to hold per-program collected data
6. **No meeting outcome tracking** — No way to record: what happened, what was the result, what are next steps
7. **No follow-up scheduling** — No integration with follow-up cadence after meeting ends
8. **No agent coaching/guidance** — The playbook has great scripts but they aren't surfaced in the UI
9. **Case studies are hardcoded** — All 3 programs share similar hardcoded stories, no dynamic portfolio integration

### Gaps Identified

- **Missing from schema**: meeting outcome, agent notes, follow-up date, objections raised, close attempt result
- **Missing from flow**: discovery phase (playbook Phase 1), trusted contractor presentation (Phase 2), due diligence story integration
- **Missing from UX**: agent coaching prompts, discovery question suggestions, objection handler references
- **Data model confusion**: Some profiling data is on customer (permanent) vs. meeting (per-visit) — this is mostly correct but the boundary needs review

---

## Decisions Made

1. **Approach A — Full Rebuild**: New JSONB columns, new pgEnums, delete old schema. Customer FK is sacred.
2. **Single 7-step journey**: Who We Are → Specialties → Portfolio → Program → Deal Structure → Closing → Create Proposal
3. **Context panel replaces intake**: Persistent drawer, 6 sections, writes to both meeting and customer entities
4. **Programs become lean incentive packages**: Qualification function + condensed presentation (story, history, timeline, FAQ accordion)
5. **Portfolio from showroom DB**: Dynamic query filtered by selected trades/scopes, fallback to other public projects
6. **Customer-facing majority**: Steps 1-4, 6 are customer-facing. Step 5 is agent-private. Step 7 is agent transition.
7. **Meeting outcome is agent-controlled label**: Not auto-assigned. Accessible from closing step AND context panel.
8. **Trade/scope selection is layered**: Select trade → expand to pain points + scopes + notes per trade
9. **Energy Saver+ qualification**: At least 1 energy-efficient trade selected (insulation, hvac, windows, solar)
10. **Tax credits/rebates**: Only visible in Deal Structure when Energy Saver+ is the selected program

---

## Implementation Plan

Written to: `docs/superpowers/plans/2026-03-25-meetings-overhaul.md`

18 tasks covering:
- Tasks 1-2: Schema foundation (enums, entity schemas, Drizzle, pgEnums)
- Tasks 3-5: Fix downstream references + delete old files
- Tasks 6-8: New types, constants, program logic, portfolio query
- Task 9: Flow shell rewrite
- Tasks 10-17: Context panel + 7 step components
- Task 18: Final verification