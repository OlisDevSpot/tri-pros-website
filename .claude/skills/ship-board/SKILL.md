---
name: ship-board
description: Use when updating or republishing the Parallel Ship Flow board, reading or writing its lanes and decisions, or applying the owner's answers
---

# ship-board

The Parallel Ship Flow board: one claude.ai artifact whose source lives here. Lane sessions and `/orient` write lane and decision docs to its db; the page draws them.

- Board: https://claude.ai/artifact/7D8kgccA7iy6f8ATWzLdqS
- Source: `/home/olis-solutions/olis-v3/nextjs/tri-pros-website/.claude/skills/ship-board/` (`page.html`, `lane-core.js`, `lane-view.js`)

## Schema

The code is the schema. Brief fields are checked by `validateBrief` and decision docs by `validateDecision` in `lane-core.js`; run `scripts/check-brief.mjs <file>` before writing either to the board. Never copy the field list into prose.

Clearing a field: the page writes `null` (its db's `update` merges and has no delete marker); Claude-side `ArtifactData` writes clear with `{"__delete__": true}`. Readers treat a null field as absent.

## Vocabulary

- **Lane**: one feature on its own branch and worktree, doc id = lane id (`lanes/<id>`).
- **Brief**: the lane's `brief` object, written by `/orient`; the lane page reads it.
- **Decision**: a question only the owner can answer (`kind: "decision"`), with options or free text.
- **Owner check**: something only the owner can verify (`kind: "check"`); open until `done`.
- **Watch out**: a risk to the lane, shown on its page.
- **N waiting on you**: open decisions and owner checks for a lane.

## How to apply answers

This is the one home of these rules; `/orient`, the lane hook and `session-capture` point here.

1. **Which docs.** `decisions` docs whose `lane` matches the lane in hand, that have an `answer` or a `note`, and no `appliedOn` (absent or null). A doc with no `lane` is applied only when the owner asks, never by a lane run.
2. **Ruling target.** A row in the rulings table of the lane's tracker, the file its issue (the row's `issue`) links to (ADR-0007), in the owner's words, with the date. A ruling that changes an earlier one edits that row in place: the new text takes over under the same id, the old text stays, struck through and marked `Deprecated <date>`; no new id stacked on top (owner 2026-11-23). Rulings already posted as `Ruling <ID>:` issue comments stay until #336 moves them. No tracker: the doc alone. Never edit the spec.
3. **Which copy.** The file in the lane's worktree (`brief.worktree`); the main checkout when `brief.worktree` is missing or the folder is gone.
4. **Guard.** Write into another session's worktree only when `git -C <worktree> diff --quiet -- <file>` is clean, and only the rulings table and status block. Otherwise leave the file to the lane session and say so in `reply`.
5. **Close the loop.** Set `reply` (one or two plain sentences: what the agent will do, or the question it still has), `replyOn`, and `appliedOn`.

## Republish

`Artifact` publish with `file_path: page.html`, `url` the board URL, and `files: {"lane-core.js": "<abs path>", "lane-view.js": "<abs path>"}`. Omit `capabilities` so `{db, user, mcp}` carry forward; passing a partial set revokes the rest. Read the live artifact first when this session has not published it.

## Rollback

Delete the docs the change created, `set` each lane and decision back from the pinned JSON backup in `~/claude-archive/<run date>-board-backfill/`, then republish the archived v6 page, `~/claude-archive/2026-11-15-ship-board-source/parallel-ship-flow.published-v6.html`.

## Tests

Never write to the board from a test; the harness runs the page on a mock store built from `test/fixtures/`.

- Unit: `node --test '.claude/skills/ship-board/test/*.test.mjs'` (quoted glob; a folder argument fails on Node 24)
- Page: `node .claude/skills/ship-board/test/harness.mjs now decisions reference lane-data-views`; flags `--viewport=WxH`, `--scheme=light|dark`, `--brief=<laneId>=<file>`, `--order=lanes,decisions,collisions`, `--delay=<collection>=<ms>`, `--reject-next[=code]`, `--read-only`, `--script=<file.mjs>`. Each state prints one JSON line; screenshots go to `test/shots/`.
