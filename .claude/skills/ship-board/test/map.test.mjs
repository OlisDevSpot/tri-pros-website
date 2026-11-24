import test from "node:test"; import assert from "node:assert/strict";
import "../lane-core.js"; const C = globalThis.LaneCore;
import { loadLanes, loadConnectors } from "./fixtures.mjs";

const LANES = loadLanes();
const GH = loadConnectors().find((c) => c.key === "github");
const call = (tool, pick) => GH.calls.find((c) => c.tool === tool && pick(c.input)).payload;
const openList = call("list_issues", (i) => !i.labels);
const epicList = call("list_issues", (i) => i.labels?.[0] === "epic");
const bugList = call("list_issues", (i) => i.labels?.[0] === "bug");
const subsOf = (n) => call("issue_read", (i) => i.method === "get_sub_issues" && i.issue_number === n).sub_issues;
const fullGh = () => ({ open: openList, epics: epicList.issues, bugs: bugList.issues, subs: { 315: subsOf(315), 302: subsOf(302), 305: subsOf(305), 313: subsOf(313) } });
const ids = (rows) => rows.map((r) => r.id);
const row = (issue, extra = {}) => ({ id: issue ? "issue-" + issue : "x", issue, order: 1, stage: "build", ...extra });

test("kindOf: a row with no issue yet is a standalone plan, whatever GitHub knows", () => {
  assert.equal(C.kindOf(row(undefined), undefined, () => undefined), "standalone");
  assert.equal(C.kindOf(row(null), undefined, () => undefined), "standalone");
});

test("kindOf: an issue GitHub has not answered for cannot be placed", () => {
  assert.equal(C.kindOf(row(308), undefined, () => null), null);
});

test("kindOf: the epic label makes the row an epic, before any parent is known", () => {
  assert.equal(C.kindOf(row(305), { number: 305, labels: ["area:sales-flow", "enhancement", "epic"] }, () => undefined), "epic");
});

test("kindOf: a plan's epic is its GitHub parent; the parent wins over the bug label", () => {
  const parentOf = (n) => ({ 311: 315, 224: 315 })[n] ?? null;
  assert.equal(C.kindOf(row(311), { number: 311, labels: ["chore"] }, parentOf), "epic");
  assert.equal(C.kindOf(row(224), { number: 224, labels: ["bug"] }, parentOf), "epic");
});

test("kindOf: with no parent, the bug label makes a bug and anything else a standalone plan", () => {
  assert.equal(C.kindOf(row(223), { number: 223, labels: ["area:backend", "P0", "bug"] }, () => null), "bug");
  assert.equal(C.kindOf(row(308), { number: 308, labels: ["enhancement"] }, () => null), "standalone");
  assert.equal(C.kindOf(row(223), { number: 223, labels: [{ name: "bug" }] }, () => null), "bug");
});

test("kindOf: while an epic's sub-issues are unknown, a labelled bug still waits for its parent", () => {
  assert.equal(C.kindOf(row(223), { number: 223, labels: ["bug"] }, () => undefined), null);
});

test("mapBlocks: lanes sit in their GitHub parent's epic block, epics in row order, the epic's own lane first", () => {
  const m = C.mapBlocks(LANES, fullGh());
  assert.deepEqual(m.epics.map((e) => [e.row.id, ids(e.lanes)]), [
    ["issue-315", ["issue-315", "dev-flow", "issue-316"]],
    ["proposal-page", ["proposal-page", "pe4"]],
    ["trade-scenes", ["trade-scenes"]],
    ["hv", ["hv"]],
  ]);
  assert.equal(m.epics[0].issue.title, "Epic: Dev cycle — Parallel Ship");
});

test("mapBlocks: progress counts closed sub-issues of all sub-issues; an epic with none has no progress", () => {
  const m = C.mapBlocks(LANES, fullGh());
  assert.deepEqual(m.epics.map((e) => e.plans), [{ closed: 1, total: 6 }, { closed: 0, total: 2 }, { closed: 0, total: 2 }, { closed: 0, total: 0 }]);
});

test("mapBlocks: standalone plans are lanes with no parent and no bug label, rows with no issue included; bugs on their own", () => {
  const m = C.mapBlocks(LANES, fullGh());
  assert.deepEqual(ids(m.standalone), ["drain", "r19", "data-views", "filter-rules", "office-tv", "scene-lab", "foundation", "casl-285", "long-names"]);
  assert.deepEqual(ids(m.bugs), ["issue-223"]);
  assert.deepEqual(m.unplaced, []);
});

test("mapBlocks: a shipped row is on prod, not on the map", () => {
  const m = C.mapBlocks(LANES, fullGh());
  const all = [...m.epics.flatMap((e) => ids(e.lanes)), ...ids(m.standalone), ...ids(m.bugs)];
  assert.ok(!all.includes("superseded"));
  assert.equal(new Set(all).size, all.length, "each lane sits in one block");
});

test("mapBlocks: the backlog is every open issue with no row, epics first, and counts the pages not fetched", () => {
  const b = C.mapBlocks(LANES, fullGh()).backlog;
  assert.deepEqual(b.issues.slice(0, 8).map((i) => i.number), [336, 265, 222, 256, 248, 240, 233, 3]);
  assert.equal(b.issues.length, 29);
  assert.ok(!b.issues.some((i) => [305, 308, 315, 316, 223].includes(i.number)), "issues with a row are not backlog");
  // 145 open on GitHub, 12 of them have rows.
  assert.equal(b.issues.length + b.more, 133);
});

test("mapBlocks: before GitHub answers, rows with an issue wait unplaced and only rows with no issue are known", () => {
  const m = C.mapBlocks(LANES, { open: null, epics: null, bugs: null, subs: {} });
  assert.deepEqual(m.epics, []);
  assert.deepEqual(ids(m.standalone), ["drain", "r19", "scene-lab", "foundation", "long-names"]);
  assert.deepEqual(m.bugs, []);
  assert.equal(m.unplaced.length, 12);
  assert.equal(m.backlog, null);
});

test("mapBlocks: an epic whose sub-issues have not answered holds back every lane it might own", () => {
  const gh = fullGh();
  delete gh.subs[302];
  const m = C.mapBlocks(LANES, gh);
  assert.deepEqual(m.epics.map((e) => e.row.id), ["issue-315", "proposal-page", "trade-scenes", "hv"]);
  assert.equal(m.epics[2].plans, null);
  assert.deepEqual(ids(m.epics[0].lanes), ["issue-315", "dev-flow", "issue-316"], "lanes already found under another epic stay there");
  assert.deepEqual(ids(m.unplaced), ["issue-223", "data-views", "filter-rules", "office-tv", "casl-285"]);
});

test("mapBlocks: an issue on a page not fetched is neither epic nor bug once both label lists answered", () => {
  const gh = fullGh();
  gh.open = { ...gh.open, issues: gh.open.issues.filter((i) => i.number !== 308) };
  assert.ok(C.mapBlocks(LANES, gh).standalone.some((r) => r.id === "data-views"));
  gh.bugs = null;
  assert.ok(C.mapBlocks(LANES, gh).unplaced.some((r) => r.id === "data-views"));
});

test("startCommand: the branch follows {type}/{issue}-{slug} so the lane hook finds the issue", () => {
  const by = (n) => [...openList.issues, ...epicList.issues, ...bugList.issues].find((i) => i.number === n);
  assert.equal(C.startCommand(by(336)).branch, "chore/336-move-live-work-onto-github-issues");
  assert.equal(C.startCommand(by(223)).branch, "fix/223-schedule-cron-observability-stop-silent");
  assert.equal(C.startCommand(by(279)).branch, "chore/279-facade-final-review-follow-ups-untracked");
  assert.equal(C.startCommand(by(306)).branch, "feat/306-the-homeowner-s-proposal-page-as-a-story");
  assert.equal(C.startCommand(by(13)).branch, "fix/13-showroom-hero-image-not-rendering-for");
  assert.equal(C.startCommand({ number: 7, title: "Something", labels: ["refactor"] }).branch, "refactor/7-something");
  assert.equal(C.startCommand({ number: 8, title: "!!!", labels: [] }).branch, "feat/8-issue");
});

test("startCommand: one line that branches from origin/main into its own worktree and starts a session there", () => {
  assert.equal(C.startCommand({ number: 336, title: "Epic: Move live work onto GitHub issues", labels: ["chore", "epic"] }).command,
    "git fetch -q origin && git worktree add -b chore/336-move-live-work-onto-github-issues .claude/worktrees/336 origin/main && cd .claude/worktrees/336 && claude");
});

test("safeLink: only https links on github.com or vercel.app pass", () => {
  assert.equal(C.safeLink("https://github.com/OlisDevSpot/tri-pros-website/issues/316"), "https://github.com/OlisDevSpot/tri-pros-website/issues/316");
  assert.equal(C.safeLink("https://tri-pros-website-git-feat-x.vercel.app"), "https://tri-pros-website-git-feat-x.vercel.app/");
  for (const bad of ["http://github.com/x", "javascript:alert(1)", "https://github.com.evil.io/x", "https://evil.io/github.com", "https://gist.github.com/x", "", null, undefined, 42]) assert.equal(C.safeLink(bad), null, String(bad));
});
