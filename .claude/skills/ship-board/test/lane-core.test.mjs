import test from "node:test"; import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "../lane-core.js"; const C = globalThis.LaneCore;
import { loadLanes } from "./fixtures.mjs";
const VALID_DV_BRIEF = JSON.parse(readFileSync(new URL("./fixtures/brief-data-views.json", import.meta.url)));
test("isEpic", () => { assert.equal(C.isEpic({phases: Array(5).fill({})}), true); assert.equal(C.isEpic({phases: Array(4).fill({})}), false); assert.equal(C.isEpic(undefined), false); });
test("normalizeOptions keeps legacy strings and empty lists", () => {
  assert.deepEqual(C.normalizeOptions(["Yes", {label: "No", consequence: "c"}]), [{label: "Yes", consequence: ""}, {label: "No", consequence: "c"}]);
  assert.deepEqual(C.normalizeOptions([]), []); assert.deepEqual(C.normalizeOptions(undefined), []);
});
// The page's db has no delete marker, so a page-side clear is null.
test("answerPatch clears the agent's reply and any stale own or note", () => {
  const d = {options: ["A", {label: "B", consequence: "x"}]};
  assert.deepEqual(C.answerPatch(d, 1, "", "2026-11-16"), {answer: "B", answeredOn: "2026-11-16", own: null, note: null, reply: null, replyOn: null, appliedOn: null});
  assert.deepEqual(C.answerPatch(d, "  my own  ", "only if cheap", "2026-11-16"), {answer: "my own", answeredOn: "2026-11-16", own: true, note: "only if cheap", reply: null, replyOn: null, appliedOn: null});
  assert.throws(() => C.answerPatch(d, "   ", "", "2026-11-16"));
});
test("localDay is the local calendar day", () => assert.equal(C.localDay(new Date(2026, 10, 16, 23, 30)), "2026-11-16"));
test("waitGap", () => {
  assert.deepEqual(C.waitGap({stage: "review", brief: {builtOn: "2026-10-23"}}, "2026-11-14"), {days: 22, from: "2026-10-23"});
  assert.equal(C.waitGap({stage: "build", brief: {builtOn: "2026-10-23"}}, "2026-11-14"), null);
  assert.equal(C.waitGap({stage: "review", brief: {}}, "2026-11-14"), null);
});
test("collision staleness reads the leading date of asOf", () => {
  const s = {asOf: "2026-11-13, branches as held after the drain"};
  assert.equal(C.collisionAsOf(s), "2026-11-13");
  assert.equal(C.collisionStale(s, "2026-11-16"), false);
  assert.equal(C.collisionStale(s, "2026-11-17"), true);
});
test("pins, lane decisions and the open count", () => {
  const ds = [{id: "a", lane: "dv", phase: "DV4", order: 1}, {id: "b", lane: "dv", phase: "DV10", order: 2}, {id: "z", lane: "dv", phase: "DV11", order: 3}, {id: "c", lane: "dv", kind: "check"}, {id: "d", lane: "dv", kind: "check", done: true}, {id: "x", lane: "other", phase: "DV4"}, {id: "y", lane: "dv", phase: "DV4", answer: "A"}];
  const brief = {phases: [{id: "DV4", step: "release"}, {id: "DV10", step: "later"}, {id: "DV11"}], watch: ["w"]};
  const p = C.pinsByStep(brief, ds, "dv");
  assert.deepEqual(p.release.map(x => x.kind + x.n), ["decision1", "decision3", "check1", "watch1"]);
  assert.deepEqual(p.later.map(x => x.id), ["b"]);
  assert.deepEqual(Object.values(C.laneDecisions(ds, "dv")).map(a => a.length), [3, 1, 2]);
  assert.equal(C.openCount(ds, "dv"), 4);
  assert.equal(C.openCount(ds), 5);
});
test("deps, activeDeps, groupOf and findCycle", () => {
  assert.deepEqual(C.deps({stackedOn: "a", blockedBy: ["a", "b", null]}), ["a", "b"]);
  const m = {a: {id: "a", stage: "build"}, b: {id: "b", stage: "shipped"}, p: {id: "p", stage: "build", move: "parked"}};
  assert.deepEqual(C.activeDeps({stackedOn: "p", blockedBy: ["a", "b", "ghost"]}, m), ["p", "a"]);
  assert.equal(C.groupOf({id: "c", move: "you", blockedBy: ["a"]}, m), "blocked");
  assert.equal(C.groupOf({id: "c", move: "you", blockedBy: ["p"]}, m), "blocked");
  assert.equal(C.groupOf({id: "c", move: "you", blockedBy: ["b"]}, m), "you");
  const L = [{id: "a", stage: "build", blockedBy: ["b"]}, {id: "b", stage: "build", blockedBy: ["a"]}, {id: "c", stage: "build", blockedBy: ["a"]}, {id: "d", stage: "build"}];
  assert.deepEqual(C.findCycle(L).sort(), ["a", "b"]);
});
test("migrateBrief converts the old open list", () => {
  const lane = {id: "casl-285", risk: "lint wall may slip", notes: "lane note", brief: {goal: "g", tracker: "t", phases: [], notes: "brief note", orientPage: "u", statusBlock: "s", pr: {checks: "ok"},
    decided: [1, 2, 3, 4, 5, 6, 7, 8].map(i => ({date: "2026-11-0" + i, text: "t" + i})).reverse(),
    open: [{id: "DB1", owner: "you", text: "Rules in the database?"}, {id: null, owner: "you", text: "Merge PR #289 first"}, {id: "c0 task 9", owner: "you", text: "iPad check of the chip"}, {id: null, owner: "you", text: "Rules in the database?"}, {id: "J6", owner: "agent", text: "Shape of the lint wall"}]}};
  const r = C.migrateBrief(lane, "2026-11-16", {"casl-285-merge-pr-289-first": "drop", "casl-285-c0-task-9": "check"});
  assert.deepEqual(r.decisions.map(d => [d.id, d.kind, d.ref]), [["casl-285-db1", "decision", "DB1"], ["casl-285-c0-task-9", "check", "c0 task 9"], ["casl-285-rules-in-the-database", "decision", null]]);
  assert.deepEqual(r.decisions[0], {id: "casl-285-db1", lane: "casl-285", phase: null, kind: "decision", question: "Rules in the database?", ref: "DB1", options: [], askedBy: "migrated", askedOn: "2026-11-16"});
  assert.deepEqual(r.brief.agent, ["Shape of the lint wall"]); assert.deepEqual(r.brief.watch, ["lint wall may slip"]);
  assert.equal(r.notes, "lane note · brief note");
  assert.deepEqual(r.brief.decided.map(d => d.date), ["2026-11-08", "2026-11-07", "2026-11-06", "2026-11-05", "2026-11-04", "2026-11-03"]);
  for (const k of ["open", "notes", "orientPage", "statusBlock", "pr"]) assert.ok(!(k in r.brief), k);
});
test("docId slugs, trims and suffixes", () => {
  const taken = new Set();
  assert.equal(C.docId("hv", "Lot on the prod page?", taken), "hv-lot-on-the-prod-page");
  assert.equal(C.docId("hv", "Lot on the prod page!", taken), "hv-lot-on-the-prod-page-2");
});
test("migrated ids on the real lanes are unique and legal", () => {
  const ids = loadLanes().filter(l => l.brief).flatMap(l => C.migrateBrief(l, "2026-11-16").decisions.map(d => d.id));
  assert.equal(ids.length, 47);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[a-z0-9-]+$/);
});
test("validateBrief and validateDecision", () => {
  assert.deepEqual(C.validateBrief(VALID_DV_BRIEF), []);
  assert.ok(C.validateBrief({goal: "x"}).length > 0);
  assert.ok(C.validateBrief(loadLanes().find(l => l.id === "data-views").brief).some(p => p.includes("open")));
  assert.deepEqual(C.validateDecision({question: "q", kind: "decision", options: ["A", {label: "B"}], lane: null}), []);
  assert.ok(C.validateDecision({kind: "x"}).length > 0);
});
test("every live fixture lane migrates to a valid brief and valid docs", () => {
  for (const l of loadLanes().filter(l => l.brief)) {
    const r = C.migrateBrief(l, "2026-11-16");
    assert.deepEqual(C.validateBrief(r.brief), [], l.id);
    for (const d of r.decisions) assert.deepEqual(C.validateDecision(d), [], d.id);
  }
});
test("a decision on a parked phase pins to later", () => {
  const brief = {phases: [{id: "p1", name: "P", status: "parked", step: "parked"}, {id: "p2", name: "Q", status: "plan"}]};
  const ds = [{id: "a", lane: "x", phase: "p1", question: "q"}, {id: "b", lane: "x", phase: "p2", question: "q"}, {id: "c", lane: "x", phase: "ghost", question: "q"}, {id: "d", lane: "x", phase: null, question: "q"}];
  const p = C.pinsByStep(brief, ds, "x");
  assert.deepEqual(p.later.map(x => x.id), ["a"]);
  assert.deepEqual(p.release.map(x => x.id), ["b", "c", "d"]);
});
test("migrateBrief takes the ids already on the board as taken", () => {
  const lane = {id: "casl-285", brief: {goal: "g", tracker: "t", phases: [], open: [{id: "DB1", owner: "you", text: "Rules in the database?"}]}};
  const taken = new Set(["casl-285-db1"]);
  assert.deepEqual(C.migrateBrief(lane, "2026-11-16", {}, taken).decisions.map(d => d.id), ["casl-285-db1-2"]);
  assert.deepEqual(C.migrateBrief(lane, "2026-11-16").decisions.map(d => d.id), ["casl-285-db1"]);
});
test("validateBrief checks types, not only presence", () => {
  const ok = {goal: "g", plan: "p.md", phases: []};
  assert.deepEqual(C.validateBrief({...ok, stand: null, watch: null, steps: {release: "Ship it"}, builtOn: "2026-11-03"}), []);
  const bad = (patch, re) => assert.ok(C.validateBrief({...ok, ...patch}).some(p => re.test(p)), JSON.stringify(patch));
  bad({goal: 3}, /goal must be a string/);
  bad({stand: ["x"]}, /stand must be a string/);
  bad({phases: "DV1"}, /phases must be a list/);
  bad({watch: "one risk"}, /watch must be a list/);
  bad({agent: [{text: "x"}]}, /agent row 0 must be a string/);
  bad({evidence: [1]}, /evidence row 0 must be a string/);
  bad({timeline: [{date: "Nov 3", label: "x"}]}, /timeline row 0 date must be YYYY-MM-DD/);
  bad({decided: [{date: "2026-11-3", text: "x"}]}, /decided row 0 needs a YYYY-MM-DD date/);
  bad({builtOn: "2026-11-03T10:00"}, /builtOn must be YYYY-MM-DD/);
  bad({steps: ["Ship it"]}, /steps must be an object/);
  bad({steps: {release: 1}}, /steps.release must be a string/);
  bad({areas: [{area: "src", files: "12"}]}, /area row 0 needs area and files/);
});
test("validateDecision reads null as an absent field", () => {
  assert.deepEqual(C.validateDecision({question: "q", kind: "decision", options: ["A"], answer: null, own: null, note: null, reply: null, replyOn: null, appliedOn: null}), []);
  assert.deepEqual(C.validateDecision({question: "q", kind: "check", done: null}), []);
});
