import test from "node:test"; import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../scripts/check-brief.mjs", import.meta.url));
const fixture = fileURLToPath(new URL("./fixtures/brief-data-views.json", import.meta.url));
const run = (file) => spawnSync(process.execPath, [script, file], { encoding: "utf8" });
const tmp = (obj) => { const f = join(mkdtempSync(join(tmpdir(), "check-brief-")), "in.json"); writeFileSync(f, JSON.stringify(obj)); return f; };

test("a valid brief exits 0", () => {
  const r = run(fixture);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
test("a brief missing its fields exits 1", () => {
  const r = run(tmp({ goal: "x" }));
  assert.equal(r.status, 1);
  assert.match(r.stdout, /missing phases/);
});
test("decision problems are prefixed by the doc id", () => {
  const r = run(tmp({ brief: { goal: "g", phases: [], plan: "p.md" }, decisions: [{ id: "dv-x", kind: "other" }] }));
  assert.equal(r.status, 1);
  assert.match(r.stdout, /^dv-x: missing question$/m);
  assert.match(r.stdout, /^dv-x: kind must be decision or check$/m);
});
