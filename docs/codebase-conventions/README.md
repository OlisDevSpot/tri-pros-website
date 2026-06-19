# Codebase Conventions

Cross-cutting engineering rules — what goes where, signatures, naming, layering. **Business rules** (what the code means, derivations, gates) live next to the code that enforces them in `<dir>/DOCS.md` files. **Decisions** ("why we chose X") live in [`docs/adr/`](../adr/). **Recipes** ("how to add an X") live in [`docs/how-to/`](../how-to/).

If you can't find a rule here, check the most-recent ADR first — newer architectural decisions may not have been pulled into the topic files yet.

## Topics

| File | What it covers |
|---|---|
| [database-schema.md](./database-schema.md) | Schema files, pgEnum placement, UUID/timestamp conventions, barrel exports |
| [enum-standardization.md](./enum-standardization.md) | Const array → TS type → pgEnum pipeline |
| [trpc-procedures.md](./trpc-procedures.md) | Procedure types, router structure, app-router registration |
| [dal-conventions.md](./dal-conventions.md) | DalReturn pattern, ScopedContext, return types, CRUD vs business |
| [service-architecture.md](./service-architecture.md) | Four-tier service/provider split (operational rules; ADR-0003 has the why) |
| [query-toolkit.md](./query-toolkit.md) | Pagination + sort + search + filters + page-size toolkit |
| [frontend-stack.md](./frontend-stack.md) | Tailwind/shadcn/motion, `'use client'`, views vs components, lint, file rules |
| [app-shell.md](./app-shell.md) | PWA, safe-area, layout chain, scroll ownership, web-push manifest |
| [entity-frontend.md](./entity-frontend.md) | Compound overview cards, `<EntityActionMenu>`, `<EntityList>`, parent-enriched `meta` |
| [environment.md](./environment.md) | Env validation, public URLs, auth, integrations inventory |
| [webhook-routes.md](./webhook-routes.md) | Async-vs-sync split for inbound HTTP. One webhook route per provider; sync lookups under verb namespaces. |
| [phone-numbers.md](./phone-numbers.md) | Canonical 10-digit storage, `phone.ts` helpers, normalize-at-write-boundary, E.164 only at external calls |

---

## Where does a new rule go? — decision tree

This directory must be **standardized** (every rule has a predictable home) and **self-healing** (when a rule has no home, you either create one or push it to memory deliberately, never accidentally). Walk this tree top-down for any new rule:

1. **Is it about *why* we chose this approach** (with considered alternatives, trade-offs that warrant rationale)?
   → Write an [ADR](../adr/). Increment the next number. The topic file below references it with one sentence.
2. **Is it about *what business meaning* a field / entity / status carries** (invariants, derivations, gates, who-can-do-what)?
   → Write to the entity's `src/shared/entities/<entity>/DOCS.md` as a new slug-anchored H3.
3. **Is it about *how a subsystem operates internally*** (middleware contracts, factory rules, hook lifecycles)?
   → Write to that subsystem's `DOCS.md` (e.g., `src/trpc/DOCS.md`).
4. **Is it about *how to write code* that cuts across features / entities / subsystems** (signatures, conventions, file placement, anti-patterns)?
   → Pick the right topic file in this directory. If none fits, **create a new topic file** here and add it to the table above. New topic files are cheap; misplaced rules rot.
5. **Is it about *how to perform a specific task end-to-end*** ("add a new entity," "wire a new push type")?
   → Write to [`docs/how-to/`](../how-to/).
6. **Is it about *visual design language*** (tokens, layouts, color hierarchy, AI-slop avoidance)?
   → Write to [`docs/ui-design-playbook.md`](../ui-design-playbook.md).
7. **Is it about *feature-level UX flow*** (step ordering, role-gating, view-mode)?
   → Write to `src/features/<feature>/DOCS.md`. Only create one when the feature has ≥3 non-obvious rules not better placed at the entity level.
8. **Is it *personal / incidental / operational-gotcha-specific-to-this-developer's-machine***?
   → Write to `memory/` with a short reflection. Memory is for "I keep being tempted to X" or "my machine does Y" — not for shareable engineering rules.

**Default rule**: if you're tempted to write a rule into memory but it's a rule any future developer would also need to know, push it up the tree until you find the right canonical home. Memory drifts in isolation; canonical docs get reviewed in PRs.

## How to use this directory

- **Adding a rule**: pick the right topic file, add it as a new H3 with a slug-anchor name, fill in *Why* / *Reference impl* / *Enforced by*. Update the README's table if a new topic file is added.
- **Referencing from code**: `// see docs/codebase-conventions/dal-conventions.md#dal-returns-dalreturn` on the line above the relevant code. Keep refs to one line.
- **Promoting**: if a rule needs deep rationale or an alternatives-considered section, write an ADR in `docs/adr/` and link from the topic file (keep the topic file's *Why* one sentence with a link).

## Self-healing rituals

Docs go stale. These rituals catch drift:

- **Ping-on-staleness** (live, every session): when code diverges from a doc/memory rule, STOP and flag it inline. See `CLAUDE.md` "Working principles." This is the highest-leverage habit.
- **Memory audit**: at session boundaries or before major work, scan `memory/` for files whose body duplicates a canonical doc. Thin those to a reflection + link. Reference: the post-2026-05-19 audit in `memory/MEMORY.md` thinned 22 files using this pattern.
- **Anchor verification**: when memory or DOCS.md cross-references an anchor (`#some-slug`), grep that slug in the target file before committing. Renames silently break refs otherwise.
- **New-rule pause**: any time you're about to add a rule to `memory/`, run the decision tree above. If it would survive a `rm -rf memory/` (i.e., it's an engineering rule, not a personal reflex), it belongs in a canonical doc.

## Anti-patterns for this directory

- **Long prose explanations.** Conventions are short. Move rationale to an ADR if it doesn't fit one *Why* sentence.
- **Aspirational rules with no reference impl.** A rule without a code anchor is rot bait — delete it or write the impl.
- **Duplicating a rule across topic files.** Each rule has one home; cross-link with markdown anchors.
- **Project-specific business rules.** Those live in `src/.../<dir>/DOCS.md`, not here.
- **Treating memory as overflow for "rules without a home."** If a rule belongs to all developers, it belongs in a canonical doc — write the topic file if one doesn't exist yet.

## See also

- [`docs/adr/`](../adr/) — architectural decision records
- [`docs/how-to/`](../how-to/) — step-by-step recipes
- [`docs/README.md`](../README.md) — master index (quick-reference table by question)
