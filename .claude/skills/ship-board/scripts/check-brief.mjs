import { readFileSync } from "node:fs";
import "../lane-core.js";

const { validateBrief, validateDecision } = globalThis.LaneCore;
const file = process.argv[2];
if (!file) { console.error("usage: check-brief.mjs <file.json>"); process.exit(2); }

const input = JSON.parse(readFileSync(file, "utf8"));
const wrapped = input && typeof input === "object" && "brief" in input;
const brief = wrapped ? input.brief : input;
const decisions = wrapped ? input.decisions || [] : [];
const entries = Array.isArray(decisions) ? decisions.map((d, i) => [(d && d.id) || "decision " + i, d]) : Object.entries(decisions);

const problems = [
  ...validateBrief(brief).map((p) => "brief: " + p),
  ...entries.flatMap(([id, d]) => validateDecision(d).map((p) => id + ": " + p)),
];
for (const p of problems) console.log(p);
process.exit(problems.length ? 1 : 0);
