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
| [environment.md](./environment.md) | Env validation, public URLs, auth, integrations inventory |

## How to use this directory

- **Adding a rule**: pick the right topic file, add it as a new H3 with a slug-anchor name, fill in *Why* / *Reference impl* / *Enforced by*. Update the README's table if a new topic file is added.
- **Referencing from code**: `// see docs/codebase-conventions/dal-conventions.md#dal-returns-dalreturn` on the line above the relevant code. Keep refs to one line.
- **Promoting**: if a rule needs deep rationale or an alternatives-considered section, write an ADR in `docs/adr/` and link from the topic file (keep the topic file's *Why* one sentence with a link).

## Anti-patterns for this directory

- **Long prose explanations.** Conventions are short. Move rationale to an ADR if it doesn't fit one *Why* sentence.
- **Aspirational rules with no reference impl.** A rule without a code anchor is rot bait — delete it or write the impl.
- **Duplicating a rule across topic files.** Each rule has one home; cross-link with markdown anchors.
- **Project-specific business rules.** Those live in `src/.../<dir>/DOCS.md`, not here.

## See also

- [`docs/adr/`](../adr/) — architectural decision records
- [`docs/how-to/`](../how-to/) — step-by-step recipes
- [`docs/README.md`](../README.md) — master index
