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
export const loadVercel = (dir = FIX) => JSON.parse(readFileSync(join(dir, "vercel.json"), "utf8"));
export function loadSnapshot(dir = FIX) {
  return JSON.parse(readFileSync(join(dir, "snapshots", "collisions.json"), "utf8"));
}
