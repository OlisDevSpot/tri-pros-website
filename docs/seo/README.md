# SEO Documentation

Strategic + tactical docs for the Tri Pros Remodeling SEO program.

## Read order (first time)

1. **[`playbook.md`](./playbook.md)** — the strategic rulebook. Captures all 24 grilling-session decisions, the architecture, the operating model, the KPI/kill criteria, and the industry-insider alpha pack. **Single source of truth.** Read this first.

2. **[`keyword-map.md`](./keyword-map.md)** — keyword targets per page tier (Tier 1 / Tier 2 / Tier 3 / blog / cost guides), with volume + difficulty estimates. Refined monthly via GSC + Ahrefs.

3. **[`30-day-sprint.md`](./30-day-sprint.md)** — concrete week-by-week ship list for sprint kickoff. Every deliverable has an acceptance criterion + owner + effort estimate.

4. **[`competitor-analysis.md`](./competitor-analysis.md)** — competitive landscape, research methodology, initial intel + backlink prospecting framework. Updated quarterly.

5. **[`llm-citation-strategy.md`](./llm-citation-strategy.md)** — AI/LLM SEO tactics: Q&A content, schema, `/llms.txt`, Reddit/Quora playbook, digital PR target list, monitoring + measurement.

## How decisions get amended

The playbook contains 24 locked business decisions made by the user during the strategic grilling session (2026-05-19). These do NOT change without:

1. Explicit amendment to [`playbook.md`](./playbook.md) §9.5 (change log)
2. Version bump (`v1` → `v2`)
3. Discussion thread on the ROOT SEO GitHub issue
4. Update of any downstream artifacts that referenced the old decision

Tactical execution decisions (within the playbook's locked architecture) can be made by the marketing operator + Claude without escalation.

## Conventions

- **Slug references:** Use `[link text](./file.md#slug)` to point readers to specific sections. Slug anchors survive doc reordering.
- **Trust but verify:** If you find a doc claim that contradicts what the code/data actually says, STOP and flag it. Business rules drift; favor reality, propose the doc update.
- **Living artifacts:** `keyword-map.md` and `competitor-analysis.md` are explicitly designed to evolve as we gather Ahrefs + GSC data. The playbook is more stable.

## Related (outside this directory)

- **GitHub project board:** https://github.com/users/OlisDevSpot/projects/3 — search for `area:seo` label
- **ROOT SEO issue:** [#222](https://github.com/OlisDevSpot/tri-pros-website/issues/222) — master tracker with sub-issues (12-month gameplan + 24 locked decisions)
- **`CLAUDE.md`** (project root) — engineering conventions
- **`docs/codebase-conventions/`** — cross-cutting engineering rules (DAL, tRPC, schema, query toolkit)
