(function () {
  const STEPS = ["prod", "release", "next", "later"];
  const STATUSES = ["shipped", "built", "building", "decided", "plan", "spec", "idea", "parked"];
  const OLD_KEYS = ["open", "notes", "orientPage", "statusBlock", "pr"];

  const deps = (l) => [...new Set([l.stackedOn, ...(l.blockedBy || [])].filter(Boolean))];
  const activeDeps = (l, m) => deps(l).filter((d) => m[d] && m[d].stage !== "shipped");
  const isLive = (l) => l.stage !== "shipped" && l.move !== "parked";
  function groupOf(l, m) {
    if (l.stage === "shipped") return "shipped";
    if (l.move === "parked") return "parked";
    if (activeDeps(l, m).length) return "blocked";
    if (l.move === "you") return "you";
    return "agent";
  }

  // Tarjan: a lane that only waits on a loop is not in it.
  function findCycle(lanes) {
    const live = lanes.filter(isLive);
    const ids = new Set(live.map((l) => l.id));
    const edges = new Map(live.map((l) => [l.id, deps(l).filter((d) => ids.has(d))]));
    const index = new Map(), low = new Map(), onStack = new Set(), stack = [], out = [];
    let i = 0;
    function visit(v) {
      index.set(v, i); low.set(v, i); i++; stack.push(v); onStack.add(v);
      for (const w of edges.get(v)) {
        if (!index.has(w)) { visit(w); low.set(v, Math.min(low.get(v), low.get(w))); }
        else if (onStack.has(w)) low.set(v, Math.min(low.get(v), index.get(w)));
      }
      if (low.get(v) === index.get(v)) {
        const comp = [];
        let w;
        do { w = stack.pop(); onStack.delete(w); comp.push(w); } while (w !== v);
        if (comp.length > 1 || edges.get(v).includes(v)) out.push(...comp);
      }
    }
    for (const id of ids) if (!index.has(id)) visit(id);
    return out;
  }

  const NODE = { w: 150, h: 52 }, NODE4 = { w: 110, h: 52 }, COL_GAP = 70, ROW_GAP = 36, MAX_COL = 4, OVERLAP_GAP = 20;
  function layoutBlockerMap(laneId, lanes, snapshot) {
    const m = Object.fromEntries(lanes.map((l) => [l.id, l]));
    const me = m[laneId];
    const placed = new Set([laneId]);
    const mk = (id, col) => ({ id, col, ...(m[id] && m[id].move === "parked" && m[id].stage !== "shipped" ? { parked: true } : {}) });
    const cols = [[], [mk(laneId, 1)], [], []];
    activeDeps(me, m).forEach((id) => { placed.add(id); cols[0].push(mk(id, 0)); });
    const dependents = (ids) => lanes.filter((l) => isLive(l) && !placed.has(l.id) && deps(l).some((d) => ids.includes(d))).map((l) => l.id);
    // Nothing waits on a lane that is already on prod.
    const c2 = me.stage === "shipped" ? [] : dependents([laneId]); c2.forEach((id) => placed.add(id));
    const c3 = dependents(c2); c3.forEach((id) => placed.add(id));
    c2.forEach((id) => cols[2].push(mk(id, 2)));
    c3.forEach((id) => cols[3].push(mk(id, 3)));

    const pairs = (snapshot && snapshot.pairs) || [];
    const pairWith = (id) => pairs.find((p) => (p.a === laneId && p.b === id) || (p.b === laneId && p.a === id));
    const overlap = [];
    for (const p of pairs) {
      const other = p.a === laneId ? p.b : p.b === laneId ? p.a : null;
      if (!other || placed.has(other) || !m[other] || m[other].stage === "shipped") continue;
      placed.add(other); overlap.push(mk(other, "overlap"));
    }

    const cap = (list, c) => {
      if (list.length <= MAX_COL) return list;
      return [...list.slice(0, MAX_COL - 1), { id: "more:" + c, col: c, more: list.slice(MAX_COL - 1).map((n) => n.id) }];
    };
    if (!cols[0].length) cols[0].push({ id: "none:0", col: 0 });
    const shown = [cap(cols[0], 0), cols[1], cap(cols[2], 2), cap(cols[3], 3)];
    const shownOverlap = cap(overlap, "overlap");

    const stackH = (n) => n * NODE.h + Math.max(0, n - 1) * ROW_GAP;
    const tallest = Math.max(...shown.map((c) => stackH(c.length)));
    const nodes = [];
    shown.forEach((list, c) => {
      const size = c === 3 ? NODE4 : NODE;
      const top = (tallest - stackH(list.length)) / 2;
      list.forEach((n, i) => nodes.push({ ...n, x: c * (NODE.w + COL_GAP), y: top + i * (NODE.h + ROW_GAP), w: size.w, h: size.h }));
    });
    shownOverlap.forEach((n, i) => nodes.push({ ...n, x: i * (NODE.w + OVERLAP_GAP), y: tallest + ROW_GAP, w: NODE.w, h: NODE.h }));

    const ids = new Set(nodes.map((n) => n.id));
    const edges = [];
    for (const n of nodes) {
      const l = m[n.id];
      if (!l) continue;
      for (const d of activeDeps(l, m)) if (ids.has(d)) edges.push({ from: d, to: n.id, kind: l.stackedOn === d ? "stack" : "wait", label: l.stackedOn === d ? "built on" : "waits" });
    }
    for (const n of shownOverlap) {
      if (n.more) continue;
      const p = pairWith(n.id);
      const conflicts = (p && p.conflicts) || 0, shared = (p && p.shared) || 0;
      edges.push(conflicts > 0
        ? { from: laneId, to: n.id, kind: "conflict", label: conflicts + (conflicts === 1 ? " file conflicts" : " files conflict") }
        : { from: laneId, to: n.id, kind: "clean", label: shared + " shared, clean" });
    }

    const inLoops = new Set(findCycle(lanes));
    const reach = (next) => {
      const seen = new Set([laneId]), todo = [laneId];
      while (todo.length) for (const w of next(todo.pop())) if (inLoops.has(w) && !seen.has(w)) { seen.add(w); todo.push(w); }
      return seen;
    };
    let cycle = [];
    if (inLoops.has(laneId)) {
      const fwd = reach((v) => deps(m[v])), back = reach((v) => lanes.filter((l) => deps(l).includes(v)).map((l) => l.id));
      cycle = [...fwd].filter((id) => back.has(id));
    }
    const width = Math.max(...nodes.map((n) => n.x + n.w));
    return { width, height: tallest + (shownOverlap.length ? ROW_GAP + NODE.h : 0), nodes, edges, cycle };
  }

  const pad = (n) => String(n).padStart(2, "0");
  const localDay = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const isEpic = (brief) => Array.isArray(brief && brief.phases) && brief.phases.length >= 5;
  const normalizeOptions = (options) => (options || []).map((o) => typeof o === "string" ? { label: o, consequence: "" } : { label: o.label, consequence: o.consequence || "" });

  const isCheck = (d) => d.kind === "check";
  function laneDecisions(decisions, laneId) {
    const mine = decisions.filter((d) => d.lane === laneId);
    return {
      open: mine.filter((d) => !isCheck(d) && !d.answer),
      answered: mine.filter((d) => d.answer),
      checks: mine.filter(isCheck),
    };
  }
  function openCount(decisions, laneId) {
    const pool = laneId === undefined ? decisions : decisions.filter((d) => d.lane === laneId);
    return pool.filter((d) => isCheck(d) ? !d.done : !d.answer).length;
  }

  function answerPatch(decision, choice, note, today) {
    let answer, own = false;
    if (typeof choice === "number") {
      const o = normalizeOptions(decision.options)[choice];
      if (!o) throw new Error("no such option: " + choice);
      answer = o.label;
    } else {
      answer = String(choice || "").trim();
      if (!answer) throw new Error("an answer is needed");
      own = true;
    }
    const n = String(note || "").trim();
    // The page's db has no delete marker: an update merges, so a cleared field is written as null.
    return { answer, answeredOn: today, own: own ? true : null, note: n || null, reply: null, replyOn: null, appliedOn: null };
  }

  function pinsByStep(brief, decisions, laneId) {
    const out = { prod: [], release: [], next: [], later: [] };
    const phases = (brief && brief.phases) || [];
    const stepOf = (d) => {
      const s = (phases.find((p) => p.id === d.phase) || {}).step;
      if (s === "parked") return "later"; // a decision on parked work must not read as this-release work
      return STEPS.includes(s) ? s : "release";
    };
    const { open, checks } = laneDecisions(decisions, laneId);
    const ordered = [...open].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    ordered.forEach((d, i) => out[stepOf(d)].push({ kind: "decision", id: d.id, n: i + 1 }));
    checks.filter((d) => !d.done).forEach((d, i) => out[stepOf(d)].push({ kind: "check", id: d.id, n: i + 1 }));
    ((brief && brief.watch) || []).forEach((_, i) => out.release.push({ kind: "watch", id: String(i), n: i + 1 }));
    return out;
  }

  const dayNum = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 864e5;
  function waitGap(lane, today) {
    const from = lane.brief && lane.brief.builtOn;
    if (!from || !["review", "preview", "ready"].includes(lane.stage)) return null;
    return { days: dayNum(today) - dayNum(from), from };
  }
  function collisionAsOf(snapshot) {
    const m = /^\d{4}-\d{2}-\d{2}/.exec((snapshot && snapshot.asOf) || "");
    return m ? m[0] : null;
  }
  function collisionStale(snapshot, today) {
    const a = collisionAsOf(snapshot);
    return a ? dayNum(today) - dayNum(a) > 3 : false;
  }

  const DAY = /^\d{4}-\d{2}-\d{2}$/;
  const isObj = (x) => !!x && typeof x === "object" && !Array.isArray(x);
  const isStr = (x) => typeof x === "string";
  // Optional fields: absent and null read the same, since the page clears a field by writing null.
  function validateBrief(b) {
    const p = [];
    if (!isObj(b)) return ["brief is missing"];
    const rows = (k) => {
      if (b[k] == null) return [];
      if (Array.isArray(b[k])) return b[k];
      p.push(k + " must be a list");
      return [];
    };
    if (!b.goal) p.push("missing goal");
    else if (!isStr(b.goal)) p.push("goal must be a string");
    if (b.stand != null && !isStr(b.stand)) p.push("stand must be a string");
    if (b.phases === undefined) p.push("missing phases");
    else if (!Array.isArray(b.phases)) p.push("phases must be a list");
    if (!b.tracker && !b.plan && !b.spec) p.push("needs one of tracker, plan or spec");
    rows("phases").forEach((ph, i) => {
      if (!isObj(ph)) { p.push("phase " + i + " must be an object"); return; }
      if (!ph.id || !ph.name) p.push("phase " + i + " needs id and name");
      if (!STATUSES.includes(ph.status)) p.push("phase " + (ph.id || i) + " has status " + JSON.stringify(ph.status));
      if (ph.step !== undefined && ph.step !== "parked" && !STEPS.includes(ph.step)) p.push("phase " + (ph.id || i) + " has step " + JSON.stringify(ph.step));
    });
    if (b.steps != null && !isObj(b.steps)) p.push("steps must be an object");
    else for (const [k, v] of Object.entries(b.steps || {})) {
      if (!STEPS.includes(k)) p.push("steps key " + k + " is not a step");
      if (!isStr(v)) p.push("steps." + k + " must be a string");
    }
    const areas = rows("areas");
    if (areas.length > 7) p.push("areas has more than 7 rows");
    areas.forEach((a, i) => { if (!isObj(a) || !isStr(a.area) || !a.area || typeof a.files !== "number") p.push("area row " + i + " needs area and files"); });
    rows("timeline").forEach((t, i) => {
      if (!isObj(t) || !t.date || !t.label) p.push("timeline row " + i + " needs date and label");
      else if (!isStr(t.date) || !DAY.test(t.date)) p.push("timeline row " + i + " date must be YYYY-MM-DD");
    });
    if (b.builtOn != null && !(isStr(b.builtOn) && DAY.test(b.builtOn))) p.push("builtOn must be YYYY-MM-DD");
    for (const k of ["worktree", "tracker", "plan", "spec", "verifiedAt"]) if (b[k] != null && !isStr(b[k])) p.push(k + " must be a string");
    if (b.files != null && typeof b.files !== "number") p.push("files must be a number");
    const lc = b.lastCommit;
    if (lc != null && !(isObj(lc) && isStr(lc.sha) && isStr(lc.date) && DAY.test(lc.date) && isStr(lc.subject))) p.push("lastCommit must be {sha, date: YYYY-MM-DD, subject}");
    const ab = b.aheadBehind;
    if (ab != null && !(isObj(ab) && typeof ab.ahead === "number" && typeof ab.behind === "number" && typeof ab.onCurrentProd === "boolean")) p.push("aheadBehind must be {ahead, behind, onCurrentProd}");
    for (const k of ["watch", "agent", "evidence"]) rows(k).forEach((x, i) => { if (!isStr(x)) p.push(k + " row " + i + " must be a string"); });
    if (rows("watch").length > 3) p.push("watch has more than 3 items");
    const decided = rows("decided");
    if (decided.length > 6) p.push("decided has more than 6 rows");
    decided.forEach((d, i) => { if (!isObj(d) || !isStr(d.date) || !DAY.test(d.date) || !isStr(d.text)) p.push("decided row " + i + " needs a YYYY-MM-DD date and text"); });
    for (const k of OLD_KEYS) if (k in b) p.push("old-shape key " + k);
    return p;
  }

  function validateDecision(d) {
    const p = [];
    if (!d || !d.question) p.push("missing question");
    if (!d) return p;
    if (d.kind !== undefined && d.kind !== "decision" && d.kind !== "check") p.push("kind must be decision or check");
    if (d.options !== undefined && !(Array.isArray(d.options) && d.options.every((o) => typeof o === "string" || (o && typeof o.label === "string")))) p.push("options must be strings or {label} objects");
    if (d.lane !== undefined && d.lane !== null && typeof d.lane !== "string") p.push("lane must be a string or null");
    return p;
  }

  function docId(laneId, key, taken) {
    const slug = String(key).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");
    const base = laneId + "-" + slug;
    let id = base, n = 2;
    while (taken.has(id)) id = base + "-" + n++;
    taken.add(id);
    return id;
  }

  function migrateBrief(lane, today, sort = {}, taken = new Set()) {
    const brief = JSON.parse(JSON.stringify(lane.brief || {}));
    const decisions = [];
    const agent = [...(brief.agent || [])];
    for (const item of brief.open || []) {
      if (item.owner === "agent") { agent.push(item.text); continue; }
      if (item.owner !== "you") continue;
      const id = docId(lane.id, item.id ?? item.text, taken);
      if (sort[id] === "drop") continue;
      decisions.push({ id, lane: lane.id, phase: null, kind: sort[id] === "check" ? "check" : "decision", question: item.text, ref: item.id ?? null, options: [], askedBy: "migrated", askedOn: today });
    }
    const notes = [lane.notes, brief.notes].filter(Boolean).join(" · ");
    for (const k of OLD_KEYS) delete brief[k];
    if (agent.length) brief.agent = agent;
    if (lane.risk) brief.watch = [...(brief.watch || []), lane.risk];
    if (brief.decided) brief.decided = [...brief.decided].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 6);
    return { brief, notes, decisions };
  }

  globalThis.LaneCore = { deps, activeDeps, isLive, groupOf, findCycle, layoutBlockerMap, localDay, isEpic, normalizeOptions, laneDecisions, openCount, answerPatch, pinsByStep, waitGap, collisionAsOf, collisionStale, validateBrief, validateDecision, docId, migrateBrief };
})();
