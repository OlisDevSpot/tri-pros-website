# Triage Labels

The skills speak in five canonical triage roles and two category roles. This maps them to the label strings on this repo.

## State roles (readiness before work)

| Role | Label | Meaning |
|---|---|---|
| `needs-triage` | `needs-triage` | Owner needs to evaluate it |
| `needs-info` | `needs-info` | Waiting on answers; a `## Triage Notes` comment lists them (a slice rated under 8/10: `## Open questions` in its body) |
| `ready-for-agent` | `ready-for-agent` | Fully specified; an agent can take it unattended |
| `ready-for-human` | `ready-for-human` | Specified, but needs the owner (judgement, external access, manual testing) |
| `wontfix` | `wontfix` | Will not be actioned; the issue is closed as not planned |

Every open issue that isn't an epic or a wayfinder issue carries exactly one state label. Once claimed, the state label stays as it is and Project 3 Status takes over (see `docs/agents/issue-tracker.md`).

## Category roles

| Role | Label | Meaning |
|---|---|---|
| `bug` | `bug` | Something is broken |
| `enhancement` | `enhancement` | New capability |
| `enhancement` | `refactor` | Restructure without behaviour change; counts as an enhancement for triage |
| `enhancement` | `chore` | Maintenance, deps, config; counts as an enhancement for triage |

Every triaged issue carries exactly one category label.

## Other labels (outside triage)

- `epic`: parent issue whose slices are sub-issues. Carries a category, no state label.
- `wayfinder:map`, `wayfinder:research|prototype|grilling|task`: `/wayfinder` only; no other labels.
- `area:*` and `P0`–`P3`: area and priority, set at triage.
