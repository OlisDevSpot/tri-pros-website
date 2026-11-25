import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname, resolve, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { loadLanes, loadDecisions, loadSnapshot, loadConnectors, fixturesDay } from "./fixtures.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const skillDir = resolve(here, "..");
const ORIGIN = "https://board.test";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json" };

const hashes = [];
const opt = { viewports: [], schemes: [], briefs: [], delay: {}, order: ["lanes", "decisions", "collisions"], rejectNext: null, readOnly: false, script: null, deny: {}, approval: [] };
const connectors = loadConnectors();
const connectorKey = (k, flag) => {
  if (connectors.some((c) => c.key === k)) return k;
  console.error("--" + flag + ": no fixture file test/fixtures/mcp/" + k + ".json");
  process.exit(2);
};
for (const a of process.argv.slice(2)) {
  if (!a.startsWith("--")) { hashes.push(a.replace(/^#/, "")); continue; }
  const [k, ...rest] = a.slice(2).split("=");
  const v = rest.join("=");
  if (k === "viewport") opt.viewports.push(...v.split(","));
  else if (k === "scheme") opt.schemes.push(...v.split(","));
  else if (k === "brief") opt.briefs.push(v);
  else if (k === "order") opt.order = v.split(",");
  else if (k === "delay") { const [c, ms] = v.split("="); opt.delay[c] = Number(ms); }
  else if (k === "reject-next") opt.rejectNext = v || "unavailable";
  else if (k === "read-only") opt.readOnly = true;
  else if (k === "script") opt.script = resolve(skillDir, v);
  // A viewer who declined the connector for this page: not_in_manifest, unless another denial code is named.
  else if (k === "deny") { const [key, code] = v.split("="); opt.deny[connectorKey(key, k)] = code || "not_in_manifest"; }
  else if (k === "approval") opt.approval.push(connectorKey(v, k));
  else { console.error("unknown flag --" + k); process.exit(2); }
}
if (!hashes.length) hashes.push("map");
if (!opt.viewports.length) opt.viewports.push("1280x900");
if (!opt.schemes.length) opt.schemes.push("light");

const lanes = loadLanes();
const decisions = loadDecisions();
for (const spec of opt.briefs) {
  const i = spec.indexOf("=");
  const laneId = spec.slice(0, i);
  const file = JSON.parse(readFileSync(resolve(skillDir, spec.slice(i + 1)), "utf8"));
  const lane = lanes.find((l) => l.id === laneId);
  if (!lane) throw new Error("--brief: no lane " + laneId);
  const wrapped = file && typeof file === "object" && "brief" in file;
  lane.brief = wrapped ? file.brief : file;
  for (const [n, d] of (wrapped ? file.decisions || [] : []).entries()) {
    const doc = { id: `${laneId}-extra-${n + 1}`, ...d };
    const at = decisions.findIndex((x) => x.id === doc.id);
    if (at >= 0) decisions[at] = doc; else decisions.push(doc);
  }
}

const strip = ({ id, ...rest }) => rest;
const config = {
  data: {
    lanes: Object.fromEntries(lanes.map((d) => [d.id, strip(d)])),
    decisions: Object.fromEntries(decisions.map((d) => [d.id, strip(d)])),
    setup: {}, skills: {}, flow_nodes: {}, flow_changes: {},
  },
  snapshot: loadSnapshot(),
  mcp: { servers: connectors, deny: opt.deny, approval: opt.approval },
  order: opt.order,
  delay: opt.delay,
  rejectNext: opt.rejectNext,
  readOnly: opt.readOnly,
};
// Collections not named in --order arrive at once; named ones 100 ms apart, so a test can pin which of lanes, decisions or collisions lands last.
const arrival = (name) => {
  const i = config.order.indexOf(name);
  return (i < 0 ? 0 : i * 100) + (config.delay[name] || 0);
};
const clockDay = fixturesDay(lanes, decisions);
if (!clockDay) throw new Error("no write stamp in the fixtures to set the clock from");
const settleMs = Math.max(...["lanes", "decisions", "collisions"].map(arrival)) + 600;

// Runs inside the page before any script: the whole mock of window.claude.
function installMock(cfg) {
  const data = cfg.data;
  const listeners = [];
  const ready = {};
  window.__updates = [];
  let rejectCode = cfg.rejectNext;

  // The page's db contract: update merges nested objects recursively, arrays and scalars replace, and there is
  // no delete marker; {"__delete__": true} is an ArtifactData feature on Claude's side only. A page write that
  // carries one would be stored as a truthy object, so the mock stores it verbatim and fails the run.
  const isObj = (x) => !!x && typeof x === "object" && !Array.isArray(x);
  const hasMarker = (v) => isObj(v) ? ("__delete__" in v || Object.values(v).some(hasMarker)) : Array.isArray(v) && v.some(hasMarker);
  const merge = (into, patch) => {
    for (const [k, v] of Object.entries(patch)) {
      if (isObj(v) && isObj(into[k])) merge(into[k], v);
      else into[k] = clone(v);
    }
  };
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const collSnap = (col) => ({
    metadata: { fromCache: false },
    docs: Object.entries(data[col] || {}).map(([id, d]) => ({ id, exists: true, data: () => clone(d) })),
  });
  const docSnap = (path) => {
    const [col, id] = path.split("/");
    const d = (data[col] || {})[id];
    return { exists: !!d, id, metadata: { fromCache: false }, data: () => (d ? clone(d) : undefined) };
  };
  const fire = (l) => { if (ready[l.key]) l.cb(l.kind === "col" ? collSnap(l.col) : docSnap(l.path)); };
  const arrive = (name, key, ms) => {
    if (ready[key] !== undefined) return;
    ready[key] = false;
    setTimeout(() => { ready[key] = true; listeners.filter((l) => l.key === key).forEach(fire); }, ms);
  };
  const arrivalOf = (name) => {
    const i = cfg.order.indexOf(name);
    return (i < 0 ? 0 : i * 100) + (cfg.delay[name] || 0);
  };
  const keyFor = { lanes: "lanes", decisions: "decisions" };

  const db = {
    collection(col) {
      return {
        onSnapshot(cb) {
          const key = "col:" + col;
          const l = { kind: "col", col, key, cb };
          listeners.push(l);
          arrive(col, key, arrivalOf(keyFor[col] || col));
          if (ready[key]) setTimeout(() => fire(l), 0);
          return () => { const i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1); };
        },
      };
    },
    doc(path) {
      return {
        onSnapshot(cb) {
          const key = "doc:" + path;
          const l = { kind: "doc", path, key, cb };
          listeners.push(l);
          arrive(path, key, arrivalOf(path === "snapshots/collisions" ? "collisions" : path));
          if (ready[key]) setTimeout(() => fire(l), 0);
          return () => { const i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1); };
        },
        async update(patch) {
          await new Promise((r) => setTimeout(r, 20));
          if (rejectCode) {
            const code = rejectCode; rejectCode = null;
            throw Object.assign(new Error(code), { code });
          }
          const [col, id] = path.split("/");
          if (!data[col] || !data[col][id]) throw Object.assign(new Error("update needs an existing document: " + path), { code: "invalid_argument" });
          if (hasMarker(patch)) console.error("page write to " + path + " carries __delete__, which the page db stores as data: " + JSON.stringify(patch));
          merge(data[col][id], patch);
          window.__updates.push({ path, patch: clone(patch) });
          listeners.filter((l) => (l.kind === "col" && l.col === col) || (l.kind === "doc" && l.path === path)).forEach(fire);
        },
      };
    },
  };
  data.snapshots = { collisions: cfg.snapshot };

  // The connector fake answers each (server, tool, input) from test/fixtures/mcp/; input key order does not
  // matter, as in the runtime's call identity. A call with no fixture is a miss, and a miss fails the run.
  const canon = (x) => Array.isArray(x) ? x.map(canon) : isObj(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, canon(x[k])])) : x;
  const sameInput = (a, b) => JSON.stringify(canon(a ?? null)) === JSON.stringify(canon(b ?? null));
  const servers = Object.fromEntries(cfg.mcp.servers.map((s) => [s.server, s]));
  const awaiting = new Set(cfg.mcp.approval);
  window.__mcpMisses = [];
  window.__mcpWatches = 0;
  const answer = (server, tool, input) => {
    const s = servers[server];
    if (!s) return { error: { code: "server_not_connected", server, message: server + " has no fixture file, so it reads as not connected" } };
    if (cfg.mcp.deny[s.key]) return { error: { code: cfg.mcp.deny[s.key], server, message: "denied by --deny=" + s.key } };
    if (awaiting.has(s.key)) return { error: { code: "approval_required", server, message: "waiting for approval (--approval=" + s.key + ")" } };
    const hit = s.calls.find((c) => c.tool === tool && sameInput(c.input, input));
    if (!hit) {
      window.__mcpMisses.push({ server, tool, input: clone(input ?? null) });
      return { error: { code: "tool_error", server, message: "no fixture for " + server + " " + tool + " " + JSON.stringify(input) } };
    }
    return { result: { content: [{ type: "text", text: JSON.stringify(hit.payload) }], payload: clone(hit.payload) } };
  };
  const watches = [];
  const deliver = (w) => {
    if (!w.live) return;
    const a = answer(w.server, w.tool, w.input);
    w.cb(a.error ? { type: "error", error: a.error } : { type: "data", result: a.result });
  };
  const mcp = {
    watchTool(server, tool, input, cb) {
      if (typeof cb !== "function") throw new TypeError("watchTool needs a handler");
      const w = { server, tool, input: clone(input ?? null), cb, live: true };
      if (watches.filter((x) => x.live).length >= 64) {
        setTimeout(() => cb({ type: "error", error: { code: "bad_request", message: "the 64-watch limit per view" } }), 0);
        return () => {};
      }
      watches.push(w);
      window.__mcpWatches = Math.max(window.__mcpWatches, watches.filter((x) => x.live).length);
      setTimeout(() => deliver(w), 50);
      return () => { w.live = false; };
    },
    async callTool(server, tool, input) {
      await new Promise((r) => setTimeout(r, 20));
      const s = servers[server];
      // The shell asks only while a page's own call waits; the harness answers Allow, which covers later calls.
      if (s && awaiting.has(s.key) && !cfg.mcp.deny[s.key]) awaiting.delete(s.key);
      const a = answer(server, tool, input);
      if (a.error) throw Object.assign(new Error(a.error.message), a.error);
      return a.result;
    },
    // Matching watches re-execute and deliver, as the runtime's invalidate does after a write or an allow.
    async invalidate(server) {
      await new Promise((r) => setTimeout(r, 20));
      watches.filter((w) => !server || w.server === server).forEach((w) => setTimeout(() => deliver(w), 30));
    },
  };
  // A check calls this to stand in for the next refetch of every watch, or of one server's.
  window.__mcpTick = (server) => watches.filter((w) => !server || w.server === server).forEach(deliver);
  const user = { can: async () => !cfg.readOnly };
  window.claude = {
    use: async (name) => {
      if (name === "db") return db;
      if (name === "user") return user;
      if (name === "mcp") return mcp;
      return null;
    },
  };
}

const wrapper = () => {
  const page = readFileSync(join(skillDir, "page.html"), "utf8");
  return `<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>[hidden]{display:none!important}</style></head><body>\n${page}\n</body></html>`;
};

// The Reference tab and the Map's blocks must not move while other views change; every run guards them.
// The Map has two baselines: with GitHub answering, and without it (denied, or waiting for approval).
const baseline = {
  reference: readFileSync(join(here, "baseline", "reference.txt"), "utf8").replace(/\n$/, ""),
  mapBlocks: JSON.parse(readFileSync(join(here, "baseline", "map-blocks.json"), "utf8")),
};
const githubAnswers = !opt.deny.github && !opt.approval.includes("github");

mkdirSync(join(here, "shots"), { recursive: true });
const browser = await chromium.launch();
let failed = false;
try {
  for (const hash of hashes) for (const vp of opt.viewports) for (const scheme of opt.schemes) {
    const [width, height] = vp.split("x").map(Number);
    const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: scheme });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
    page.on("pageerror", (e) => consoleErrors.push(String(e.message || e)));
    await page.route("https://fonts.googleapis.com/**", (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
    await page.route("https://fonts.gstatic.com/**", (r) => r.fulfill({ status: 200, contentType: "font/woff2", body: "" }));
    await page.route(ORIGIN + "/**", (r) => {
      const p = new URL(r.request().url()).pathname;
      if (p === "/index.html") return r.fulfill({ status: 200, contentType: "text/html", body: wrapper() });
      const f = join(skillDir, p);
      if (!f.startsWith(skillDir) || !existsSync(f)) return r.fulfill({ status: 404, body: "" });
      return r.fulfill({ status: 200, contentType: MIME[extname(f)] || "application/octet-stream", body: readFileSync(f) });
    });
    // Relative times ("3 d ago") would otherwise drift the saved baselines every day.
    await page.clock.setFixedTime(new Date(clockDay + "T15:00:00Z"));
    await page.addInitScript(installMock, config);
    await page.goto(`${ORIGIN}/index.html#${hash}`);
    await page.waitForTimeout(settleMs);
    await page.screenshot({ path: join(here, "shots", `${hash}-${vp}-${scheme}.png`), fullPage: true });

    const overflowPx = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
    const mapBlocks = await page.evaluate(() => {
      const byChip = { "your move": "you", agent: "agent", blocked: "blocked", parked: "parked" };
      const out = {};
      for (const b of document.querySelectorAll("#map [data-block]")) {
        const block = { count: b.querySelector("[data-count]")?.textContent ?? null, progress: b.querySelector("[data-progress]")?.dataset.progress ?? null, lanes: [] };
        for (const a of b.querySelectorAll("a.row[data-lane]")) {
          const chip = [...a.querySelectorAll(".row-top .chip")].map((c) => c.textContent.trim()).find((t) => t in byChip);
          block.lanes.push(a.dataset.lane + " " + (byChip[chip] || "?") + (a.querySelector("[data-noissue]") ? " · no issue yet" : ""));
        }
        out[b.dataset.block] = block;
      }
      return out;
    });
    const checks = { mapBlocks, text: {} };
    if (opt.script) {
      const mod = await import(pathToFileURL(opt.script).href);
      Object.assign(checks, (await mod.default({ page, hash, viewport: vp, scheme, opt, skillDir })) || {});
    }
    // Each section is read under the tab that shows it; "reference" keeps the baseline's order: bottlenecks, skills, tools.
    const tabs = { map: [["map", "map"]], decisions: [["decisions", "decisions"]], reference: [["reference", "bottlenecks"], ["skills", "skills"], ["reference", "tools"]] };
    const keep = await page.evaluate(() => location.hash);
    for (const [key, views] of Object.entries(tabs)) {
      const parts = [];
      for (const [tab, id] of views) {
        await page.evaluate((t) => { location.hash = "#" + t; }, tab);
        await page.waitForTimeout(150);
        parts.push(await page.evaluate((i) => document.getElementById("v-" + i)?.innerText ?? "", id));
      }
      checks.text[key] = parts.join("\n");
    }
    await page.evaluate((h) => { location.hash = h; }, keep);
    const updates = await page.evaluate(() => window.__updates);
    const mcp = await page.evaluate(() => ({ watches: window.__mcpWatches, misses: window.__mcpMisses }));
    const failures = [...(checks.failures || [])];
    for (const m of mcp.misses) failures.push("no connector fixture for " + m.server + " " + m.tool + " " + JSON.stringify(m.input));
    if (mcp.watches > 64) failures.push(mcp.watches + " watches registered at once; a view allows 64");
    if (checks.text.reference !== baseline.reference) failures.push("Reference text differs from test/baseline/reference.txt");
    const wantBlocks = baseline.mapBlocks[githubAnswers ? "github" : "nogithub"];
    if (JSON.stringify(checks.mapBlocks) !== JSON.stringify(wantBlocks)) failures.push("Map blocks differ from test/baseline/map-blocks.json (" + (githubAnswers ? "github" : "nogithub") + ")");
    checks.failures = failures;
    console.log(JSON.stringify({ hash, viewport: vp, scheme, overflowPx, consoleErrors, updates, watches: mcp.watches, checks }));
    if (overflowPx !== 0 || consoleErrors.length || failures.length) failed = true;
    await ctx.close();
  }
} finally {
  await browser.close();
}
process.exitCode = failed ? 1 : 0;
