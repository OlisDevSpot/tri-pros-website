# ADR-0007: Plans and specs stay files; their GitHub issues point at them

## Status

Accepted, 2026-11-24 (owner, shaping #336). It reverses the 2026-11-23 rulings that put specs in issue bodies and rulings in issue comments.

## Decision

An epic or a plan is a GitHub issue: an epic carries the `epic` label and its plans are its sub-issues. Its working detail stays in a committed **tracker** file: the order or tasks, the status block and the rulings table. The issue is short. An epic's body says what it solves, when it is done, and links to its tracker, spec and references. A plan's body gives its steps at a high level, each with what it solves, and links to its tracker. A plan has no task sub-issues. A spec stays a file under `docs/superpowers/specs/`. While a lane is open, its issue links to the tracker on the lane's branch; before that, to `main`.

## Why

Matt Pocock's skills (`/to-spec`, `/to-tickets`) put the spec in the issue body and each task in a sub-issue. We tried that on 2026-11-23 and reversed it the same day:

- A GitHub issue body holds at most 65,536 characters. 48 of the 307 files under `docs/plans/` and `docs/superpowers/` were larger.
- #316 became a 41 KB body plus 12 task sub-issues, which the owner judged not scalable. #311, a short body linking its tracker, read much cleaner.
- One comment per ruling was too verbose, compared with a table that can be read at a glance.
- SDD agents build from a file in the worktree, which they can read and edit.

## Consequences

- A skill that "publishes the spec to the issue tracker" writes the spec file and the short issue body described here. The issue body never holds the spec.
- Shipped trackers and specs are deleted once their leftovers have a home and nothing points at them. Git history keeps them.
- Each lane branch carries its own copy of its tracker. The issue links to that branch's copy so the link stays current.
