import test from "node:test"; import assert from "node:assert/strict";
import "../lane-core.js"; const C = globalThis.LaneCore;
import { loadLanes, loadSnapshot } from "./fixtures.mjs";
const L = loadLanes(), S = loadSnapshot();
const lane = (id, o = {}) => ({id, name: id, stage: "build", move: "agent", ...o});
const col = (m, c) => m.nodes.filter(n => n.col === c).map(n => n.id).sort();
test("data views columns", () => {
  const m = C.layoutBlockerMap("data-views", L, S);
  assert.deepEqual(col(m, 0), ["none:0"]); assert.deepEqual(col(m, 1), ["data-views"]);
  assert.deepEqual(col(m, 2), ["filter-rules", "long-names", "proposal-page"]); assert.deepEqual(col(m, 3), ["pe4"]);
  assert.deepEqual(col(m, "overlap"), ["hv", "office-tv"]);
  const e = (a, b) => m.edges.find(x => x.from === a && x.to === b)?.kind;
  assert.equal(e("data-views", "filter-rules"), "stack"); assert.equal(e("data-views", "proposal-page"), "wait");
  assert.equal(e("data-views", "hv"), "conflict"); assert.equal(e("data-views", "office-tv"), "clean");
  assert.equal(m.nodes.find(n => n.id === "hv").parked, true);
});
test("unknown and shipped deps are left out, a parked one is drawn parked", () => {
  const lanes = [...L.map(l => l.id === "drain" ? {...l, stage: "shipped"} : l), lane("z", {blockedBy: ["ghost", "drain"], stackedOn: "hv"})];
  const m = C.layoutBlockerMap("z", lanes, S);
  assert.deepEqual(col(m, 0), ["hv"]); assert.equal(m.nodes.find(n => n.id === "hv").parked, true);
});
test("more than four in a column collapses", () => {
  const lanes = [lane("hub"), ...[1, 2, 3, 4, 5, 6].map(i => lane("w" + i, {blockedBy: ["hub"]}))];
  const m = C.layoutBlockerMap("hub", lanes, {pairs: []});
  const c2 = m.nodes.filter(n => n.col === 2);
  assert.equal(c2.length, 4); assert.equal(c2[3].id, "more:2"); assert.deepEqual(c2[3].more, ["w4", "w5", "w6"]);
});
test("a loop is reported once, without the lane that only waits on it", () => {
  const m = C.layoutBlockerMap("a", [lane("a", {blockedBy: ["b"]}), lane("b", {blockedBy: ["a"]}), lane("c", {blockedBy: ["a"]})], {pairs: []});
  assert.deepEqual([...m.cycle].sort(), ["a", "b"]);
  assert.equal(m.nodes.filter(n => n.id === "b").length, 1);
});
test("nodes never overlap and stay inside width/height", () => {
  const m = C.layoutBlockerMap("data-views", L, S);
  for (const n of m.nodes) assert.ok(n.x >= 0 && n.y >= 0 && n.x + n.w <= m.width && n.y + n.h <= m.height, n.id);
  for (const a of m.nodes) for (const b of m.nodes) if (a !== b)
    assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, a.id + "/" + b.id);
});
test("only the loop through this lane is reported", () => {
  const lanes = [lane("a", {blockedBy: ["b"]}), lane("b", {blockedBy: ["a"]}), lane("x", {blockedBy: ["y"]}), lane("y", {blockedBy: ["x"]})];
  assert.deepEqual([...C.layoutBlockerMap("a", lanes, {pairs: []}).cycle].sort(), ["a", "b"]);
});
test("width follows the columns actually used", () => {
  const m = C.layoutBlockerMap("solo", [lane("solo")], {pairs: []});
  assert.ok(m.width < 770);
  for (const n of m.nodes) assert.ok(n.x + n.w <= m.width, n.id);
});
