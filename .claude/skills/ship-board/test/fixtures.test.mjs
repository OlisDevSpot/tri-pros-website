import test from "node:test"; import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadLanes, loadDecisions, loadConnectors, fixturesDay } from "./fixtures.mjs";

const LIVE = fileURLToPath(new URL("./fixtures/live", import.meta.url));

test("the harness clock is the newest day the board fixtures were written", () => {
  assert.equal(fixturesDay(loadLanes(), loadDecisions()), "2026-11-16");
  assert.equal(fixturesDay(loadLanes(LIVE), []), "2026-11-23");
  // The orient brief's decisions were asked two days later, so a run that loads them moves the clock.
  const orient = JSON.parse(readFileSync(new URL("./fixtures/brief-data-views.orient.json", import.meta.url)));
  assert.equal(fixturesDay(loadLanes(), [...loadDecisions(), ...orient.decisions]), "2026-11-18");
  // A session check-in counts by its day; a date inside free text does not.
  assert.equal(fixturesDay([{ id: "a", updated: "2026-11-01", session: { lastSeen: "2026-11-02T23:10:00Z" }, next: "2026-12-25 launch" }], []), "2026-11-02");
  assert.equal(fixturesDay([], []), null);
});

test("connector fixtures load one file per server, keyed by the flag name", () => {
  const c = loadConnectors();
  assert.deepEqual(c.map((s) => [s.key, s.server]).sort(), [["github", "GitHub"], ["vercel", "Vercel"]]);
  const vc = c.find((s) => s.key === "vercel");
  assert.deepEqual(vc.calls.map((x) => x.tool), ["list_deployments"]);
  assert.equal(vc.calls[0].payload.result.deployments.length, 3);
});
