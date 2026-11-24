import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const FIX = join(here, "fixtures");

function readDir(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const doc = JSON.parse(readFileSync(join(dir, f), "utf8"));
      if (doc.id === undefined) doc.id = basename(f, ".json");
      return doc;
    });
}

// Extra docs override pulled docs with the same id so a test can reshape one lane without touching the pull.
function load(collection, dir = FIX) {
  const byId = new Map();
  for (const d of readDir(join(dir, collection))) byId.set(d.id, d);
  for (const d of readDir(join(dir, "extra", collection))) byId.set(d.id, d);
  return [...byId.values()];
}

export const loadLanes = (dir) => load("lanes", dir);
export const loadDecisions = (dir) => load("decisions", dir);
// One file per connector, named for its --deny / --approval key; `server` is the display name the page calls.
export function loadConnectors(dir = FIX) {
  const at = join(dir, "mcp");
  if (!existsSync(at)) return [];
  return readdirSync(at).filter((f) => f.endsWith(".json")).sort().map((f) => ({ key: basename(f, ".json"), ...JSON.parse(readFileSync(join(at, f), "utf8")) }));
}

// The stamps a write leaves on a row or a decision. Dates inside free text are not when the data was written.
const LANE_STAMPS = ["updated", "briefAt"], DECISION_STAMPS = ["askedOn", "answeredOn", "replyOn", "appliedOn"];
const dayOf = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
export function fixturesDay(lanes, decisions) {
  const days = [
    ...lanes.flatMap((l) => [...LANE_STAMPS.map((k) => l[k]), l.session && l.session.lastSeen]),
    ...decisions.flatMap((d) => DECISION_STAMPS.map((k) => d[k])),
  ].map(dayOf).filter(Boolean).sort();
  return days.length ? days[days.length - 1] : null;
}
export function loadSnapshot(dir = FIX) {
  return JSON.parse(readFileSync(join(dir, "snapshots", "collisions.json"), "utf8"));
}
