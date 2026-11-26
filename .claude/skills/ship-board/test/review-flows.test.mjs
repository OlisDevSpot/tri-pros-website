import test from "node:test"; import assert from "node:assert/strict";
import "../lane-core.js"; const C = globalThis.LaneCore;

const flow = (o = {}) => ({ id: "dv-flow-f1", lane: "dv", kind: "flow", no: 1, title: "Find a customer", who: "super-admin", paths: ["/dashboard/customers"], steps: [{ do: "Open Customers.", expect: "The table shows." }], ...o });

test("flows are not decisions: no pins, no open count, no lane decisions", () => {
  const ds = [flow(), flow({ id: "f2", no: 2, answer: "Works" }), { id: "q", lane: "dv", question: "Q?" }];
  assert.equal(C.openCount(ds, "dv"), 1);
  assert.equal(C.openCount(ds), 1);
  assert.deepEqual(Object.values(C.laneDecisions(ds, "dv")).map((a) => a.length), [1, 0, 0]);
  assert.deepEqual(C.pinsByStep({ phases: [] }, ds, "dv").release.map((p) => p.id), ["q"]);
});

test("laneFlows orders by number; flowsToWalk counts the unanswered", () => {
  const ds = [flow({ id: "b", no: 10 }), flow({ id: "a", no: 2, answer: "Skip" }), flow({ id: "o", lane: "other", no: 1 })];
  assert.deepEqual(C.laneFlows(ds, "dv").map((d) => d.no), [2, 10]);
  assert.equal(C.flowsToWalk(ds, "dv"), 1);
});

test("flowAnswerPatch: three answers, and Not right needs a note", () => {
  assert.deepEqual(C.flowAnswerPatch("Works", " ", "2026-11-26"), { answer: "Works", answeredOn: "2026-11-26", note: null, reply: null, replyOn: null, appliedOn: null });
  assert.equal(C.flowAnswerPatch("Not right", "F1.3: no chips", "2026-11-26").note, "F1.3: no chips");
  assert.throws(() => C.flowAnswerPatch("Not right", "  ", "2026-11-26"), /which step/);
  assert.throws(() => C.flowAnswerPatch("Maybe", "", "2026-11-26"));
});

test("validateDecision checks a flow by its own shape", () => {
  assert.deepEqual(C.validateDecision(flow()), []);
  const bad = C.validateDecision(flow({ no: 0, title: "", steps: [{ do: "x" }], paths: ["dashboard"], agent: { result: "ok" }, answer: "Yes" }));
  assert.deepEqual(bad, ["no must be a positive integer", "missing title", "paths must be a list of paths starting with /", "step 1 needs do and expect", "agent.result must be one of pass, fail, partial, not-run", "answer must be one of Works, Not right, Skip"]);
  assert.deepEqual(C.validateDecision(flow({ steps: [] })), ["steps must be a non-empty list"]);
});

test("previewHref stays on the preview", () => {
  const base = "https://tri-pros-website-git-feat-data-views-olisdevspots-projects.vercel.app";
  assert.equal(C.previewHref(base, "/dashboard/customers?tab=1"), base + "/dashboard/customers?tab=1");
  assert.equal(C.previewHref(base, "//evil.com/x"), null);
  assert.equal(C.previewHref(base, "https://evil.com"), null);
  assert.equal(C.previewHref("https://evil.com", "/x"), null);
});
