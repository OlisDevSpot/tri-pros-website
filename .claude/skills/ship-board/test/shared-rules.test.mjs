import test from "node:test"; import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import "../lane-core.js"; const C = globalThis.LaneCore;
import { loadLanes } from "./fixtures.mjs";

// Copies of the board's rows as they stood on 2026-11-23: blockers are row ids, several rows are keyed issue-<n>.
const LIVE = loadLanes(fileURLToPath(new URL("./fixtures/live", import.meta.url)));
const live = (id) => structuredClone(LIVE.find((l) => l.id === id));

test("stepFor: a phase's own step wins, parked work reads as later", () => {
  assert.equal(C.stepFor({ id: "a", status: "built", step: "next" }), "next");
  assert.equal(C.stepFor({ id: "a", status: "shipped", step: "later" }), "later");
  assert.equal(C.stepFor({ id: "a", status: "built", step: "parked" }), "later");
});

test("stepFor: with no step, the phase's status places it", () => {
  const want = { shipped: "prod", built: "release", building: "release", decided: "next", plan: "next", spec: "next", idea: "later", parked: "later" };
  for (const [status, step] of Object.entries(want)) assert.equal(C.stepFor({ id: "x", status }), step, status);
});

test("stepFor: no phase, or one with neither step nor known status, stays in this release", () => {
  assert.equal(C.stepFor(undefined), "release");
  assert.equal(C.stepFor(null), "release");
  assert.equal(C.stepFor({ id: "DV11" }), "release");
  assert.equal(C.stepFor({ id: "x", status: "done", step: "soon" }), "release");
});

test("stepFor spreads a live lane's phases across the four steps", () => {
  const by = { prod: [], release: [], next: [], later: [] };
  for (const p of live("data-views").brief.phases) by[C.stepFor(p)].push(p.id);
  assert.deepEqual(by, {
    prod: ["DV0", "DV1"],
    release: ["DV3", "DV3a", "DV4"],
    next: ["DV2", "DV5", "DV6"],
    later: ["DV7", "DV8", "DV9", "DV10", "DV11"],
  });
  // This row has steps written by hand: "verify" is still building but was placed under Next.
  assert.deepEqual(live("google-preview-signin").brief.phases.map(C.stepFor), ["prod", "prod", "prod", "next"]);
});

test("pinsByStep places a decision by its phase's fallback step", () => {
  const brief = live("data-views").brief;
  const ds = [
    { id: "q-prod", lane: "data-views", phase: "DV0", question: "q", order: 1 },
    { id: "q-next", lane: "data-views", phase: "DV5", question: "q", order: 2 },
    { id: "q-later", lane: "data-views", phase: "DV9", question: "q", order: 3 },
    { id: "q-none", lane: "data-views", phase: null, question: "q", order: 4 },
  ];
  const p = C.pinsByStep(brief, ds, "data-views");
  assert.deepEqual(p.prod.map((x) => x.id), ["q-prod"]);
  assert.deepEqual(p.next.map((x) => x.id), ["q-next"]);
  assert.deepEqual(p.later.map((x) => x.id), ["q-later"]);
  assert.deepEqual(p.release.filter((x) => x.kind === "decision").map((x) => x.id), ["q-none"]);
});

const byId = (lanes) => Object.fromEntries(lanes.map((l) => [l.id, l]));

test("stateOf reads each live row the way the board groups it", () => {
  const m = byId(LIVE);
  const want = {
    "data-views": "agent", "trade-scenes": "agent", "confidence-scorer": "agent",
    "dev-flow": "you", "issue-321": "you", "office-tv": "you", "foundation": "you",
    "proposal-page": "blocked", "filter-rules": "blocked", "pe4": "blocked", "issue-316": "blocked",
    "casl-285": "parked", "hv": "parked",
    "drain": "shipped", "superseded": "shipped", "r19": "shipped",
  };
  for (const [id, state] of Object.entries(want)) assert.equal(C.stateOf(m[id], m), state, id);
});

test("stateOf: shipped beats parked, parked beats blocked, blocked beats your move", () => {
  const m = byId(LIVE);
  assert.equal(C.stateOf({ ...live("proposal-page"), move: "parked" }, m), "parked");
  assert.equal(C.stateOf({ ...live("proposal-page"), stage: "shipped", move: "parked" }, m), "shipped");
  assert.equal(C.stateOf({ ...live("proposal-page"), blockedBy: [] }, m), "you");
});

test("stateOf splits the agent's lanes into working and gone quiet once activity is known", () => {
  const m = byId(LIVE);
  assert.equal(C.stateOf(m["data-views"], m, { quietDays: 1 }), "working");
  assert.equal(C.stateOf(m["data-views"], m, { quietDays: 3 }), "working");
  assert.equal(C.stateOf(m["data-views"], m, { quietDays: 4 }), "quiet");
  assert.equal(C.stateOf(m["data-views"], m, {}), "agent");
  // Only a lane on the agent's move goes quiet.
  assert.equal(C.stateOf(m["dev-flow"], m, { quietDays: 9 }), "you");
  assert.equal(C.stateOf(m["proposal-page"], m, { quietDays: 9 }), "blocked");
  assert.equal(C.stateOf(m["hv"], m, { quietDays: 9 }), "parked");
});

// The board on 2026-11-23 without the #321 row: #316 still waits on an issue nobody has opened a lane for.
const withoutRow = (id) => LIVE.filter((l) => l.id !== id).map((l) => structuredClone(l));

test("resolveDeps keeps an issue blocker with no lane row, and drops shipped lanes and unknown ids", () => {
  const r = C.resolveDeps(withoutRow("issue-321"));
  assert.deepEqual(r["issue-316"], [{ id: "issue-321", issue: 321, noLane: true }]);
  assert.deepEqual(r["proposal-page"], [{ id: "data-views", issue: 308, noLane: false }]);
  assert.deepEqual(r["filter-rules"], [{ id: "data-views", issue: 308, noLane: false }]);
  assert.deepEqual(r["pe4"], [{ id: "proposal-page", issue: 305, noLane: false }]);
  assert.deepEqual(r["foundation"], [], "drain is on prod, so foundation is not held up by it");
  assert.deepEqual(r["data-views"], []);
  const odd = C.resolveDeps([{ id: "x", stage: "build", blockedBy: ["ghost", "issue-", "issue-12a", "issue-7"] }]);
  assert.deepEqual(odd.x, [{ id: "issue-7", issue: 7, noLane: true }]);
});

test("resolveDeps reads a blocker issue that has a row as that lane", () => {
  assert.deepEqual(C.resolveDeps(LIVE)["issue-316"], [{ id: "issue-321", issue: 321, noLane: false }]);
});

test("a no-lane blocker still blocks: the row and the map agree", () => {
  const lanes = withoutRow("issue-321"), m = byId(lanes);
  assert.equal(C.stateOf(m["issue-316"], m), "blocked");
  assert.deepEqual(C.activeDeps(m["issue-316"], m), ["issue-321"]);
  const map = C.layoutBlockerMap("issue-316", lanes, { pairs: [] });
  const waitsOn = map.nodes.filter((n) => n.col === 0);
  assert.deepEqual(waitsOn.map((n) => [n.id, n.noLane]), [["issue-321", 321]]);
  assert.deepEqual(map.edges.map((e) => [e.from, e.to, e.kind]), [["issue-321", "issue-316", "wait"]]);
  // With the row back, the same blocker is an ordinary lane node.
  const withRow = C.layoutBlockerMap("issue-316", LIVE, { pairs: [] }).nodes.find((n) => n.id === "issue-321");
  assert.equal(withRow.col, 0);
  assert.equal(withRow.noLane, undefined);
});

test("hasStepMap: five or more phases get the step map, whatever the lane is labelled", () => {
  assert.equal(C.hasStepMap(live("data-views").brief), true);
  assert.equal(C.hasStepMap(live("proposal-page").brief), true);
  assert.equal(C.hasStepMap(live("pe4").brief), false);
  assert.equal(C.hasStepMap(live("google-preview-signin").brief), false);
  assert.equal(C.hasStepMap(live("issue-316").brief), false);
  assert.equal(C.isEpic, undefined, "epic means the GitHub label only");
});

test("validateBrief takes an issue as the brief's anchor", () => {
  const b = { goal: "Board UI", phases: [{ id: "S1", name: "Shared rules", status: "building" }] };
  assert.deepEqual(C.validateBrief({ ...b, issue: 316 }), []);
  assert.deepEqual(C.validateBrief(b, live("issue-316")), [], "the row's issue anchors a brief written for it");
  assert.ok(C.validateBrief(b).some((p) => /needs one of issue, tracker, plan or spec/.test(p)));
  assert.ok(C.validateBrief(b, live("drain")).some((p) => /needs one of issue/.test(p)), "drain's row has no issue");
  for (const issue of ["316", 0, -3, 3.5]) assert.ok(C.validateBrief({ ...b, issue }).some((p) => /issue must be a positive integer/.test(p)), JSON.stringify(issue));
});

test("validateBrief no longer checks decided, which the issue's Ruling comments replace", () => {
  const b = { goal: "g", phases: [], issue: 308 };
  const eight = Array.from({ length: 8 }, (_, i) => ({ date: "2026-11-0" + (i + 1), text: "t" }));
  assert.deepEqual(C.validateBrief({ ...b, decided: eight }), []);
  assert.deepEqual(C.validateBrief({ ...b, decided: [{ date: "Nov 3", text: 1 }] }), []);
  assert.deepEqual(C.validateBrief({ ...b, decided: "see the issue" }), []);
});

test("every live brief still validates against its row", () => {
  for (const l of LIVE.filter((x) => x.brief)) assert.deepEqual(C.validateBrief(l.brief, l), [], l.id);
});

test("validateLane passes every live row, old rows with no issue included", () => {
  for (const l of LIVE) assert.deepEqual(C.validateLane(l), [], l.id);
  assert.deepEqual(C.validateLane({ ...live("issue-316"), blockedBySyncedAt: "2026-11-23" }), []);
  assert.deepEqual(C.validateLane({ ...live("issue-316"), blockedBySyncedAt: "2026-11-23T18:04:00Z" }), []);
  assert.deepEqual(C.validateLane({ ...live("issue-316"), blockedBySyncedAt: "2026-11-23T18:04:00.512-08:00" }), []);
  assert.deepEqual(C.validateLane({ ...live("issue-316"), blockedBySyncedAt: null, blockedBy: null }), []);
});

test("validateLane names each bad row field", () => {
  const row = live("issue-316");
  const bad = (patch, re) => assert.ok(C.validateLane({ ...row, ...patch }).some((p) => re.test(p)), JSON.stringify(patch) + " → " + JSON.stringify(C.validateLane({ ...row, ...patch })));
  bad({ issue: "316" }, /issue must be a positive integer/);
  bad({ issue: 0 }, /issue must be a positive integer/);
  bad({ issue: 31.6 }, /issue must be a positive integer/);
  bad({ order: "10.9" }, /order must be a number/);
  bad({ order: undefined }, /order must be a number/);
  bad({ order: NaN }, /order must be a number/);
  bad({ blockedBy: "issue-321" }, /blockedBy must be a list of row ids/);
  bad({ blockedBy: [321] }, /blockedBy must be a list of row ids/);
  bad({ blockedBy: [""] }, /blockedBy must be a list of row ids/);
  bad({ blockedBySyncedAt: "23 Nov" }, /blockedBySyncedAt must be YYYY-MM-DD or an ISO time/);
  bad({ blockedBySyncedAt: "2026-11-23T25:99:00Z" }, /blockedBySyncedAt must be YYYY-MM-DD or an ISO time/);
  bad({ blockedBySyncedAt: 1795000000000 }, /blockedBySyncedAt must be YYYY-MM-DD or an ISO time/);
  assert.deepEqual(C.validateLane(null), ["lane is missing"]);
});
