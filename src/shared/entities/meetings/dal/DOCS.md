# Meetings DAL — Server Notes

Operational notes for `dal/server/`. Business rules live in `../DOCS.md`.

## crud.ts orchestrates services (by design)

`dal/server/crud.ts` invokes services/QStash jobs from within its config-factory hooks — this is the sanctioned hook home (CRUD DAL mutation-interface epic), not a Rule-19 breach. Pure business logic still belongs in `lib/`.
