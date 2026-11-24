(function () {
  const STEPS = [["prod", "On prod"], ["release", "This release"], ["next", "Next"], ["later", "Later"]];
  const STEP_WHEN = Object.fromEntries(STEPS);
  const STATE_WORD = { you: "your move", agent: "agent", working: "working", quiet: "gone quiet", blocked: "blocked", parked: "parked", shipped: "shipped" };
  const BUCKET = { shipped: "shipped", built: "built", building: "built", decided: "decided", plan: "next", spec: "next", idea: "later", parked: "parked" };
  const BUCKET_KEY = [["shipped", "on prod"], ["built", "built"], ["decided", "decided"], ["next", "planned"], ["later", "ideas"], ["parked", "parked"]];
  const PHASE_CHIP = { shipped: "done", built: "agent", building: "agent", parked: "lb-parked" };
  const COL_HEAD = { 0: "WAITS ON", 1: "THIS LANE", 2: "WAITING ON IT", 3: "THEN" };
  // Room above the nodes for the column headings, and above the overlaps row for its rule, caption and edge labels.
  const TOP = 26, OV_DY = 34;

  let V = null;

  const plural = (n, one, many) => n + " " + (n === 1 ? one : many);
  const dayNum = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 864e5;
  const shortDate = (s) => /^\d{4}-\d{2}-\d{2}/.test(s || "") ? new Date(dayNum(s) * 864e5).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : String(s || "");
  const byOrder = (a, b) => (a.order ?? 99) - (b.order ?? 99);
  const watchOf = (l) => (l.brief && Array.isArray(l.brief.watch) ? l.brief.watch : l.risk ? [l.risk] : []);
  const pairWith = (a, b) => ((S.coll && S.coll.pairs) || []).find((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a));
  const pending = (ds) => ({ open: [...ds.open].sort(byOrder), checks: ds.checks.filter((d) => !d.done).sort(byOrder) });
  const decisionNo = (ds, id) => pending(ds).open.findIndex((d) => d.id === id) + 1;
  const downstream = (layout) => layout.nodes.filter((n) => n.col === 2 || n.col === 3).flatMap((n) => n.more || [n.id]);
  const head = (title, hint) => el("div", { class: "lb-viz-h" }, el("h3", { text: title }), hint ? el("small", { text: hint }) : null);
  const standP = (text) => {
    const m = /^(.+?[.:])(\s|$)/.exec(text);
    return el("p", { class: "lb-stand" }, m ? el("b", { text: m[1] }) : null, m ? text.slice(m[1].length) : text);
  };
  const phaseChip = (p) => el("span", { class: "chip lb-ph " + (PHASE_CHIP[p.status] || ""), title: p.name + (p.status === "parked" ? " (parked)" : "") }, p.id, p.status === "parked" ? " · parked" : "");
  // Lane names often end in their phase IDs ("Data views DV3 · DV3a"); the IDs are shown muted, and nodes drop them.
  function nameParts(l) {
    const name = (l && (l.name || l.id)) || "";
    const ids = new Set(((l && l.brief && l.brief.phases) || []).map((p) => p.id));
    const words = name.split(" ");
    const at = words.findIndex((w, i) => i > 0 && ids.has(w.replace(/^\(|[),·]+$/g, "")));
    return at > 0 ? [words.slice(0, at).join(" "), words.slice(at).join(" ")] : [name, ""];
  }
  const emptyBrief = (l) => el("p", { class: "lb-empty", "data-empty": "brief", text: "No overview yet. Run /orient " + ((l.brief && l.brief.tracker) || "on this lane's tracker") + " to fill it." });

  function laneHeader(l) {
    const m = laneMap(), b = l.brief || {};
    const ds = LaneCore.laneDecisions(S.decisions || [], l.id);
    const waiting = LaneCore.openCount(S.decisions || [], l.id);
    const risks = watchOf(l).length;
    const layout = V && V.l.id === l.id ? V.layout : LaneCore.layoutBlockerMap(l.id, S.lanes || [], S.coll);
    const holds = downstream(layout);
    const p = pending(ds), first = p.open[0] ? "decision:" + p.open[0].id : p.checks[0] ? "check:" + p.checks[0].id : null;
    const [title, ids] = nameParts(l);
    const chips = el("div", { class: "lb-chips" },
      waiting && first ? el("button", { type: "button", class: "chip you lb-chip", "data-sel": first }, waiting + " waiting on you") : null,
      risks ? el("button", { type: "button", class: "chip blocked lb-chip", "data-sel": "watch:0" }, plural(risks, "risk", "risks")) : null,
      holds.length ? el("button", { type: "button", class: "chip lb-chip", "data-sel": "lane:" + holds[0] }, "holds up " + plural(holds.length, "lane", "lanes")) : null);
    const box = el("div", { class: "lb-head", "data-section": "header" },
      el("a", { class: "back", href: "#now", text: "← Now" }),
      el("div", { class: "eyebrow", text: [l.kind, l.branch, l.briefAt ? "checked " + shortDate(l.briefAt) : null].filter(Boolean).join(" · ") }),
      el("h2", {}, title, ids ? el("span", { class: "lb-ids", text: " " + ids }) : null),
      b.goal ? el("p", { class: "lb-goal", text: b.goal }) : null,
      chips.children.length ? chips : null);
    if (S.canWrite && S.db) box.append(el("div", {}, el("button", { type: "button", onclick: () => { S.editing = S.editing === l.id ? null : l.id; renderLaneView(); } }, S.editing === l.id ? "Close editor" : "Edit stage, next step or dependencies")));
    if (S.editing === l.id) box.append(editForm(l, m));
    return box;
  }

  function pinButton(p, ds) {
    const all = [...ds.open, ...ds.checks];
    const d = all.find((x) => x.id === p.id);
    if (p.kind === "watch") return el("button", { type: "button", class: "lb-pin lb-pin-r", "data-sel": "watch:0", title: "Watch out", "aria-label": "Watch out" }, "!");
    if (p.kind === "check") return el("button", { type: "button", class: "lb-pin", "data-sel": "check:" + p.id, title: d ? d.question : "", "aria-label": "Owner check: " + (d ? d.question : p.id) }, "✓");
    return el("button", { type: "button", class: "lb-pin", "data-sel": "decision:" + p.id, title: d ? d.question : "", "aria-label": "Decision " + p.n + ": " + (d ? d.question : p.id) }, String(p.n));
  }

  function releaseMap(l, ds) {
    const b = l.brief;
    const pins = LaneCore.pinsByStep(b, S.decisions || [], l.id);
    const by = { prod: [], release: [], next: [], later: [] };
    for (const p of b.phases) by[LaneCore.stepFor(p)].push(p);
    return el("div", { class: "lb-map", role: "group", "aria-label": "Phases from prod to later" }, STEPS.map(([id, when]) => {
      const ps = [...pins[id].filter((p) => p.kind !== "watch"), ...pins[id].filter((p) => p.kind === "watch").slice(0, 1)];
      return el("div", { class: "lb-st" + (id === "release" ? " lb-now" : ""), "data-step": id },
        el("button", { type: "button", class: "lb-st-b", "data-sel": "step:" + id, "aria-label": when + (b.steps && b.steps[id] ? ": " + b.steps[id] : "") + ", " + plural(by[id].length, "phase", "phases") },
          el("span", { class: "lb-when", text: when }),
          b.steps && b.steps[id] ? el("h4", { text: b.steps[id] }) : null,
          by[id].length ? el("span", { class: "lb-phs" }, by[id].map(phaseChip)) : el("span", { class: "note", text: "Nothing here" })),
        ps.length ? el("div", { class: "lb-pins" }, ps.map((p) => pinButton(p, ds))) : null);
    }));
  }

  function phaseStrip(l) {
    const phases = l.brief.phases;
    const counts = {};
    for (const p of phases) { const k = BUCKET[p.status] || "later"; counts[k] = (counts[k] || 0) + 1; }
    return el("div", { class: "lb-phwrap" },
      el("div", { class: "lb-phstrip", role: "group", "aria-label": plural(phases.length, "phase", "phases"), style: `grid-template-columns:repeat(${phases.length},minmax(0,1fr))` },
        phases.map((p, i) => el("button", { type: "button", class: "lb-seg lb-s-" + (BUCKET[p.status] || "later"), "data-sel": "step:phase-" + i, title: p.id + " " + p.name, "aria-label": p.id + " " + p.name + ", " + p.status }))),
      el("div", { class: "lb-phkey" }, BUCKET_KEY.filter(([k]) => counts[k]).map(([k, t]) => el("span", {}, el("i", { class: "lb-s-" + k }), counts[k] + " " + t))));
  }

  function whereItStands(l, ds) {
    const b = l.brief;
    const sec = el("section", { class: "lb-viz", "data-section": "stands" });
    if (!b) { sec.append(head("Where it stands"), emptyBrief(l)); return sec; }
    const phases = b.phases || [];
    const stepMap = LaneCore.hasStepMap(b);
    sec.append(head("Where it stands", stepMap ? "tap a step · pins are what waits on you" : phases.length ? "tap a phase" : null));
    sec.append(stepMap ? releaseMap(l, ds) : phases.length ? phaseStrip(l) : el("p", { class: "note", text: "No phases recorded." }));
    if (b.stand) sec.append(standP(b.stand));
    return sec;
  }

  function nodeSub(o, w) {
    const word = STATE_WORD[LaneCore.stateOf(o, laneMap())];
    const both = o.stage + " · " + word;
    return w >= 150 && both.length <= 17 ? both : word;
  }

  function blockerMapSvg(layout) {
    const m = laneMap(), me = m[S.lane];
    const ov = layout.nodes.filter((n) => n.col === "overlap");
    const mainBottom = Math.max(...layout.nodes.filter((n) => n.col !== "overlap").map((n) => n.y + n.h));
    const pos = Object.fromEntries(layout.nodes.map((n) => [n.id, { ...n, y: n.y + TOP + (n.col === "overlap" ? OV_DY : 0) }]));
    const W = layout.width, H = TOP + layout.height + (ov.length ? OV_DY : 0);
    const svg = svgEl("svg", { class: "lb-bmap", width: W + 8, height: H + 8, viewBox: `-4 -4 ${W + 8} ${H + 8}`, role: "group", "aria-label": "Lanes around " + (me ? me.name : S.lane) });
    const root = svgEl("g", { class: "lb-root" });
    svg.append(root);

    for (const c of [0, 1, 2, 3]) {
      const xs = layout.nodes.filter((n) => n.col === c);
      if (xs.length) root.append(svgEl("text", { class: "lb-cap", x: xs[0].x, y: 14 }, COL_HEAD[c]));
    }
    if (ov.length) {
      const ry = TOP + mainBottom + 16;
      root.append(svgEl("line", { class: "lb-rule", x1: 0, y1: ry, x2: W, y2: ry }));
      // Right-aligned: the overlap edges leave this lane downwards on the left, so the caption stays clear of them.
      const cap = svgEl("text", { class: "lb-cap", x: W, y: ry + 18, "text-anchor": "end" }, "OVERLAPS · SAME FILES");
      if (S.coll && LaneCore.collisionStale(S.coll, today())) cap.append(svgEl("tspan", { class: "lb-stale", "data-stale": "" }, " · as of " + LaneCore.collisionAsOf(S.coll)));
      root.append(cap);
    }

    const edges = svgEl("g", { class: "lb-edges" }), labels = [];
    const ovIndex = Object.fromEntries(ov.map((n, i) => [n.id, i]));
    const fwd = layout.edges.filter((e) => pos[e.from] && pos[e.to] && typeof pos[e.from].col === "number" && pos[e.to].col > pos[e.from].col);
    const fanOut = (e) => { const mine = fwd.filter((x) => x.from === e.from); return (mine.indexOf(e) - (mine.length - 1) / 2) * 8; };
    for (const e of layout.edges) {
      const a = pos[e.from], b = pos[e.to];
      if (!a || !b) continue;
      let d, lx, ly, anchor = "middle";
      if (e.kind === "conflict" || e.kind === "clean") {
        const x1 = a.x + a.w / 2 + (ovIndex[e.to] - (ov.length - 1) / 2) * 14, y1 = a.y + a.h, x2 = b.x + b.w / 2, y2 = b.y, my = (y1 + y2) / 2;
        d = `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`;
        lx = x2 + 8; ly = y2 - 8; anchor = "start";
      } else if (a.col === "overlap" || b.col === "overlap") {
        // The overlaps row has no order with this lane; an order between two other lanes belongs on their own maps.
        continue;
      } else if (b.col > a.col) {
        const x1 = a.x + a.w, y1 = a.y + a.h / 2 + fanOut(e), x2 = b.x, y2 = b.y + b.h / 2, mx = (x1 + x2) / 2;
        d = `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
        // Labelled where the edge enters its target: the curves leaving one lane bunch together, the arrivals do not.
        lx = x2 - 5; ly = y2 - 6; anchor = "end";
      } else if (b.col < a.col) {
        // Only a loop sends an edge backwards; it runs below the forward one so both stay visible.
        const x1 = a.x, y1 = a.y + a.h / 2 + 10, x2 = b.x + b.w, y2 = b.y + b.h / 2 + 10, mx = (x1 + x2) / 2;
        d = `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
        lx = mx; ly = (y1 + y2) / 2 + 16;
      } else {
        const x = a.x + a.w, y1 = a.y + a.h / 2, y2 = b.y + b.h / 2;
        d = `M${x},${y1} C${x + 28},${y1} ${x + 28},${y2} ${x},${y2}`;
        lx = null;
      }
      const kind = { stack: "lb-stack", wait: "lb-wait", conflict: "lb-conf", clean: "lb-ok" }[e.kind];
      const path = svgEl("path", { class: "lb-e " + kind, d });
      const to = m[e.to];
      const rel = to && (relText(to, m).find((r) => r.d === e.from) || null);
      const pair = (e.kind === "conflict" || e.kind === "clean") && pairWith(e.from, e.to);
      const tip = rel ? to.name + " " + rel.text : pair && pair.files && pair.files.length ? pair.files.join("\n") : e.label;
      path.append(svgEl("title", {}, tip));
      edges.append(path);
      if (lx != null) labels.push(svgEl("text", { class: "lb-el" + (e.kind === "conflict" ? " lb-el-conf" : ""), x: lx, y: ly, "text-anchor": anchor }, e.label));
    }
    root.append(edges);

    for (const n of layout.nodes) {
      const p = pos[n.id];
      const g = svgEl("g", { class: "lb-n" + (n.w < 150 ? " lb-narrow" : ""), transform: `translate(${p.x} ${p.y})`, "data-col": String(n.col) });
      if (n.id === "none:0") {
        g.classList.add("lb-none");
        g.setAttribute("data-node", n.id);
        g.append(svgEl("rect", { width: n.w, height: n.h, rx: 8 }), svgEl("text", { x: n.w / 2, y: 31, "text-anchor": "middle" }, "no other lane"));
      } else if (n.noLane) {
        g.classList.add("lb-nolane");
        g.setAttribute("data-node", n.id);
        g.append(svgEl("title", {}, "#" + n.noLane + " has no lane yet; it still blocks this one"), svgEl("rect", { width: n.w, height: n.h, rx: 8 }),
          svgEl("text", { class: "lb-name", x: 12, y: 31 }, "#" + n.noLane + " · no lane"));
      } else if (n.more) {
        const names = n.more.map((id) => (m[id] ? m[id].name : id));
        g.classList.add("lb-more");
        for (const [k, v] of Object.entries({ "data-sel": "more:" + n.col, "data-more": n.more.join(","), tabindex: "0", role: "button", "aria-label": plural(n.more.length, "more lane", "more lanes") + ": " + names.join(", ") })) g.setAttribute(k, v);
        g.append(svgEl("title", {}, names.join("\n")), svgEl("rect", { width: n.w, height: n.h, rx: 8 }),
          svgEl("text", { x: n.w / 2, y: 23, "text-anchor": "middle" }, "+" + n.more.length + " more"),
          svgEl("text", { class: "lb-s", x: n.w / 2, y: 41, "text-anchor": "middle" }, "tap to list"));
      } else {
        const o = m[n.id];
        const isMe = n.id === S.lane;
        if (isMe) g.classList.add("lb-me");
        if (n.parked) g.classList.add("lb-parked");
        const name = (o && o.name) || n.id;
        const short = nameParts(o)[0] || name;
        const lines = wrapWords(short, n.w >= 150 ? 20 : 14);
        const first = lines.length > 1 || lines[0].length < short.length ? lines[0].replace(/[\s·,;:–-]+$/, "") + "…" : lines[0];
        for (const [k, v] of Object.entries({ "data-sel": isMe ? "status:" : "lane:" + n.id, tabindex: "0", role: "button", "aria-label": name + (o ? ": " + stageLabel(o) + ", " + STATE_WORD[LaneCore.stateOf(o, m)] : "") + (isMe ? " (this lane)" : "") })) g.setAttribute(k, v);
        g.append(svgEl("title", {}, name), svgEl("rect", { width: n.w, height: n.h, rx: 8 }),
          svgEl("text", { class: "lb-name", x: 12, y: 22, "data-avail": n.w - 22, "data-full": short }, first),
          o ? svgEl("text", { class: "lb-s", x: 12, y: 40, "data-avail": n.w - 22, "data-full": nodeSub(o, n.w) }, nodeSub(o, n.w)) : null);
      }
      root.append(g);
    }
    labels.forEach((t) => root.append(t));
    return svg;
  }

  // Text widths depend on the font the viewer actually got, so names are cut and the viewBox is sized after layout.
  function fitBlockerMap(scope, keepScroll) {
    for (const svg of scope.querySelectorAll("svg.lb-bmap")) {
      for (const t of svg.querySelectorAll("text[data-avail]")) {
        const avail = +t.dataset.avail, cut = (x) => x.replace(/[\s·,;:–(-]+$/, "") + "…";
        const fits = () => t.getComputedTextLength() <= avail;
        t.textContent = t.dataset.full;
        if (fits()) continue;
        const words = t.dataset.full.split(" ");
        while (words.length > 1 && !fits()) { words.pop(); t.textContent = cut(words.join(" ")); }
        let s = words.join(" ");
        while (!fits() && s.length > 1) { s = s.slice(0, -1); t.textContent = cut(s); }
      }
      const bb = svg.querySelector(".lb-root").getBBox();
      if (!bb.width) continue;
      const x = Math.floor(bb.x) - 4, y = Math.floor(bb.y) - 4, w = Math.ceil(bb.x + bb.width) + 4 - x, h = Math.ceil(bb.y + bb.height) + 4 - y;
      svg.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
      svg.setAttribute("width", w);
      svg.setAttribute("height", h);
      // On a phone the map is wider than the screen; open it on this lane, not on the empty upstream column.
      const sc = svg.parentNode, me = svg.querySelector(".lb-me");
      if (keepScroll != null) sc.scrollLeft = keepScroll;
      else if (me && sc.scrollWidth > sc.clientWidth) sc.scrollLeft = me.getBoundingClientRect().left - svg.getBoundingClientRect().left - 12;
    }
  }

  function blocksSection(l, layout) {
    const sec = el("section", { class: "lb-viz", "data-section": "blocks" }, head("What it blocks", "tap a lane"));
    if (layout.cycle.length) sec.append(el("div", {}, el("button", { type: "button", class: "chip blocked lb-chip", "data-sel": "more:cycle" }, "Loop: " + plural(layout.cycle.length, "lane waits", "lanes wait") + " on each other")));
    sec.append(el("div", { class: "lb-scroll" }, blockerMapSvg(layout)),
      el("div", { class: "lb-lg" },
        el("span", {}, el("i", { class: "lb-k-stack" }), "built on (stacked)"),
        el("span", {}, el("i", { class: "lb-k-wait" }), "waits until it merges"),
        el("span", {}, el("i", { class: "lb-k-conf" }), "files conflict"),
        el("span", {}, el("i", { class: "lb-k-ok" }), "overlap, merges clean"),
        el("span", {}, el("i", { class: "lb-k-parked" }), "dashed box: parked")));
    return sec;
  }

  function areaBars(brief) {
    const rows = brief.areas || [];
    const sum = rows.reduce((t, a) => t + (+a.files || 0), 0);
    const total = Math.max(+brief.files || 0, sum, 1);
    return el("div", { class: "lb-bars" }, rows.map((a, i) => el("button", { type: "button", class: "lb-bar", "data-sel": "area:" + i, "aria-label": a.area + ": " + plural(+a.files || 0, "file", "files") },
      el("span", { class: "lb-k", title: a.area, text: a.area }),
      el("span", { class: "lb-t" }, el("i", { style: `width:${Math.max(1, (+a.files || 0) / total * 100).toFixed(1)}%` })),
      el("span", { class: "lb-v", text: String(a.files) }))));
  }

  function waitTimeline(l) {
    const b = l.brief || {}, T = b.timeline || [], gap = LaneCore.waitGap(l, today());
    const now = today();
    const dates = [...T.map((t) => t.date), gap ? gap.from : null].filter((d) => /^\d{4}-\d{2}-\d{2}/.test(d || ""));
    const t0 = dates.length ? Math.min(...dates.map(dayNum)) : dayNum(now);
    const t1 = Math.max(dayNum(now), t0 + 1);
    const pct = (d) => Math.min(100, Math.max(0, (dayNum(d) - t0) / (t1 - t0) * 100));
    const box = el("div", { class: "lb-tl" }, el("div", { class: "lb-axis" }));
    if (gap) {
      const left = pct(gap.from);
      const txt = plural(gap.days, "day", "days") + " built, not shipped";
      box.append(el("button", { type: "button", class: "lb-gap", "data-sel": "gap:0", style: `left:${left}%;width:${100 - left}%`, "aria-label": txt }), el("span", { class: "lb-glab", text: txt }));
    }
    T.forEach((t, i) => box.append(el("button", { type: "button", class: "lb-ms", "data-sel": "milestone:" + i, style: `left:${pct(t.date)}%`, title: shortDate(t.date) + " · " + t.label, "aria-label": shortDate(t.date) + ": " + t.label })));
    box.append(el("span", { class: "lb-today", style: "left:100%", title: "Today" }));
    box.append(el("span", { class: "lb-lab", style: "left:0;transform:none", text: shortDate(new Date(t0 * 864e5).toISOString().slice(0, 10)) }));
    if (gap && pct(gap.from) > 22 && pct(gap.from) < 78) box.append(el("span", { class: "lb-lab", style: `left:${pct(gap.from)}%`, text: shortDate(gap.from) }));
    box.append(el("span", { class: "lb-lab", style: "left:100%;transform:translateX(-100%)", text: "today" }));
    return box;
  }

  const isCheck = (d) => d.kind === "check";
  // Open decisions, then open owner checks, then what is already answered or ticked.
  const cardRank = (d) => (isCheck(d) ? (d.done ? 3 : 1) : d.answer ? 2 : 0);
  const byCard = (a, b) => cardRank(a) - cardRank(b) || byOrder(a, b);
  const drafts = () => (S.drafts ??= {});
  const copiesOf = (id, scope = document) => [...scope.querySelectorAll(`.lb-card[data-id="${CSS.escape(id)}"]`)];
  function redrawCards() { renderDecisions(); if (S.lane) renderLaneView(); }
  // One write per change: every copy of a doc shares this guard, and a redraw mid-save keeps its controls disabled.
  const inFlight = () => (S.saving ??= new Set());
  function startSaving(id) {
    if (inFlight().has(id)) return false;
    inFlight().add(id);
    for (const c of copiesOf(id)) for (const b of c.querySelectorAll("button[type=submit], input[name=done]")) b.disabled = true;
    return true;
  }

  function fillForm(form, dr) {
    for (const r of form.querySelectorAll("[name=choice]")) r.checked = dr.choice != null && +r.value === dr.choice;
    if (form.elements.own) form.elements.own.value = dr.own || "";
    if (form.elements.note) form.elements.note.value = dr.note || "";
  }

  // The same doc can be drawn on the lane page, in its side panel and in the Decisions tab; typing in one keeps the others in step.
  function onDraft(e, form, id) {
    const dr = (drafts()[id] ??= {});
    const t = e.target;
    if (t.name === "choice") { dr.choice = +t.value; dr.own = ""; }
    else if (t.name === "own") { dr.own = t.value; if (t.value.trim()) dr.choice = null; }
    else if (t.name === "note") dr.note = t.value;
    fillForm(form, dr);
    for (const c of copiesOf(id)) { const f = c.querySelector("form"); if (f && f !== form) fillForm(f, dr); }
  }

  async function submitAnswer(e, form, d) {
    e.preventDefault();
    const own = String(form.elements.own ? form.elements.own.value : "").trim();
    const picked = form.querySelector("[name=choice]:checked");
    const choice = own || (picked ? +picked.value : null);
    if (choice == null) { toast("Pick an option or write your own answer"); return; }
    const patch = LaneCore.answerPatch(d, choice, form.elements.note ? form.elements.note.value : "", today());
    if (!startSaving(d.id)) return;
    let ok = false;
    try { ok = await save("decisions", d.id, patch); } finally { inFlight().delete(d.id); }
    if (ok) delete drafts()[d.id];
    redrawCards();
  }

  async function toggleCheck(e, d) {
    const done = e.target.checked;
    if (!startSaving(d.id)) { e.target.checked = !done; return; }
    try { await save("decisions", d.id, { done: done ? true : null }); } finally { inFlight().delete(d.id); }
    redrawCards();
  }

  // Changing only the option must not drop the note, so the form opens on the answer as it stands.
  function currentAnswer(d) {
    const at = d.own ? -1 : LaneCore.normalizeOptions(d.options).findIndex((o) => o.label === d.answer);
    return at >= 0 ? { choice: at, own: "", note: d.note || "" } : { choice: null, own: d.answer || "", note: d.note || "" };
  }

  function reopen(btn, d) {
    const card = btn.closest(".lb-card"), scope = card.closest("#lane-view, #dec-list") || document;
    const at = copiesOf(d.id, scope).indexOf(card);
    drafts()[d.id] = { editing: true, ...currentAnswer(d) };
    redrawCards();
    const again = copiesOf(d.id, scope)[at];
    const first = again && again.querySelector("[name=choice], [name=own]");
    if (first) first.focus();
  }

  function answeredBody(d, can) {
    return el("div", { class: "lb-done" },
      el("p", { class: "lb-a" }, el("span", { class: "lb-lbl", text: "Your answer" + (d.answeredOn ? " · " + shortDate(d.answeredOn) : "") }),
        el("span", {}, el("b", { text: d.answer }), !d.own && d.recommended === d.answer ? el("em", { class: "lb-pick", text: "Claude's pick" }) : null)),
      d.note ? el("p", { class: "lb-note" }, el("span", { class: "lb-lbl", text: "Your note" }), d.note) : null,
      d.reply ? el("p", { class: "lb-reply" }, el("span", { class: "lb-lbl", text: "The agent" + (d.replyOn ? " · " + shortDate(d.replyOn) : "") }), d.reply)
        : d.appliedOn ? el("p", { class: "lb-wait lb-applied", text: "Answered · applied " + shortDate(d.appliedOn) })
        : el("p", { class: "lb-wait", text: "Answered · waiting for the agent" }),
      can ? el("div", { class: "lb-act" }, el("button", { type: "button", onclick: (e) => reopen(e.currentTarget, d) }, "Change answer")) : null);
  }

  function answerForm(d, can, editing) {
    const opts = LaneCore.normalizeOptions(d.options);
    const off = !can;
    const own = opts.length
      ? el("input", { type: "text", name: "own", placeholder: "Or say something else…", disabled: off, autocomplete: "off" })
      : el("textarea", { name: "own", rows: "2", placeholder: "Write your answer", disabled: off });
    const form = el("form", { class: "lb-form", novalidate: true },
      editing && d.answer ? el("p", { class: "lb-now" }, el("span", { class: "lb-lbl", text: "Answer now" }), d.answer) : null,
      opts.length ? el("div", { class: "lb-opts", role: "radiogroup", "aria-label": "Options" }, opts.map((o, i) => el("label", { class: "lb-opt" },
        el("input", { type: "radio", name: "choice", value: String(i), disabled: off }),
        el("span", {}, el("span", { class: "lb-ot", text: o.label }), d.recommended === o.label ? el("em", { class: "lb-pick", text: "Claude's pick" }) : null),
        o.consequence ? el("span", { class: "lb-oc", text: o.consequence }) : null))) : null,
      el("div", { class: "lb-fields" },
        el("label", { class: "lb-field" }, el("span", { class: "lb-lbl", text: opts.length ? "Your own answer" : "Your answer" }), own),
        el("label", { class: "lb-field" }, el("span", { class: "lb-lbl", text: "Note (optional)" }), el("input", { type: "text", name: "note", disabled: off, autocomplete: "off" }))),
      can ? el("div", { class: "lb-act" },
        el("button", { class: "primary", type: "submit", disabled: inFlight().has(d.id) }, "Save answer"),
        editing ? el("button", { type: "button", onclick: () => { delete drafts()[d.id]; redrawCards(); } }, "Keep answer") : null)
        : el("p", { class: "lb-ro", text: "This view can't save answers" }));
    fillForm(form, drafts()[d.id] || {});
    form.addEventListener("input", (e) => onDraft(e, form, d.id));
    form.addEventListener("change", (e) => onDraft(e, form, d.id));
    form.addEventListener("submit", (e) => submitAnswer(e, form, d).catch((err) => toast(err.message)));
    return form;
  }

  function decisionCard(d, { compact = false } = {}) {
    const can = !!(S.canWrite && S.db);
    const problems = LaneCore.validateDecision(d);
    const dr = drafts()[d.id] || {};
    const state = isCheck(d) ? (d.done ? "done" : "open") : d.answer && !dr.editing ? "answered" : "open";
    const card = (...kids) => el("article", { class: "lb-card" + (compact ? " lb-compact" : "") + (isCheck(d) ? " lb-check" : ""), "data-id": d.id, "data-kind": isCheck(d) ? "check" : "decision", "data-state": state }, ...kids);
    const area = d.area ? el("span", { class: "chip", text: d.area }) : null;
    const why = d.context ? el("p", { class: "lb-why", text: d.context }) : null;
    if (problems.length) return card(el("div", { class: "lb-card-h" }, el("h4", { class: "lb-q", text: d.question || d.id }), area), why, el("p", { class: "lb-ro", text: "This doc can't be answered here: " + problems.join("; ") + "." }));
    if (isCheck(d)) return card(
      el("label", { class: "lb-tick" },
        el("input", { type: "checkbox", name: "done", checked: !!d.done, disabled: !can || inFlight().has(d.id), onchange: (e) => toggleCheck(e, d) }),
        el("span", { class: "lb-tick-t" }, el("span", { class: "lb-q", text: d.question }), why), area),
      !can && !d.done ? el("p", { class: "lb-ro", text: "This view can't save answers" }) : null);
    return card(el("div", { class: "lb-card-h" }, el("h4", { class: "lb-q", text: d.question }), area), why,
      state === "answered" ? answeredBody(d, can) : answerForm(d, can, !!dr.editing));
  }

  // A redraw replaces the nodes under the owner's hands: put back open folds, the focused field and its caret.
  function keepUiState(box, rebuild) {
    const a = document.activeElement;
    let focus = null;
    if (a && a !== document.body && box.contains(a)) {
      const card = a.closest(".lb-card");
      const sel = a.closest("[data-sel]");
      if (card && a.name) focus = { id: card.dataset.id, at: copiesOf(card.dataset.id, box).indexOf(card), name: a.name, value: a.type === "radio" ? a.value : null, s: a.selectionStart, e: a.selectionEnd };
      else if (sel) focus = { sel: sel.dataset.sel, side: !!a.closest("#lane-inspector") };
    }
    const open = new Set([...box.querySelectorAll("details[data-fold]")].filter((d) => d.open).map((d) => d.dataset.fold));
    rebuild();
    for (const d of box.querySelectorAll("details[data-fold]")) if (open.has(d.dataset.fold)) d.open = true;
    if (!focus) return;
    let t = null;
    if (focus.id) {
      const c = copiesOf(focus.id, box)[focus.at];
      t = c && c.querySelector(`[name="${focus.name}"]` + (focus.value != null ? `[value="${focus.value}"]` : ""));
    } else {
      const all = [...box.querySelectorAll(`[data-sel="${CSS.escape(focus.sel)}"]`)];
      t = all.find((x) => !!x.closest("#lane-inspector") === focus.side) || null;
    }
    if (!t || t.disabled) return;
    t.focus({ preventScroll: true });
    if (focus.s != null && typeof t.setSelectionRange === "function") try { t.setSelectionRange(focus.s, focus.e); } catch { /* radios and checkboxes have no caret */ }
  }

  function decisionsList(l, ds) {
    const p = pending(ds);
    const n = p.open.length + p.checks.length;
    const sec = el("section", { class: "lb-sec", "data-section": "decisions" },
      el("div", { class: "lb-sec-h" }, el("h3", { text: "Your decisions" }),
        S.decisions && n ? el("small", { text: n + " waiting on you · " + [p.open.length ? plural(p.open.length, "decision", "decisions") : null, p.checks.length ? plural(p.checks.length, "owner check", "owner checks") : null].filter(Boolean).join(", ") }) : null));
    if (!S.decisions) { sec.append(el("p", { class: "note", text: "Loading decisions." })); return sec; }
    const all = (S.decisions || []).filter((d) => d.lane === l.id).sort(byCard);
    if (!n) sec.append(el("p", { class: "note", text: "Nothing waiting on you." }));
    if (all.length) sec.append(el("div", { class: "lb-cards" }, all.map((d) => decisionCard(d))));
    return sec;
  }

  function foldedSection(l) {
    const b = l.brief || {};
    const agent = b.agent || [], decided = b.decided || [], ev = b.evidence || [];
    if (!agent.length && !decided.length && !ev.length) return null;
    return el("section", { class: "lb-sec", "data-section": "folded" },
      agent.length ? el("div", { class: "lb-sec" }, el("div", { class: "lb-sec-h" }, el("h3", { text: "The agent is handling" }), el("small", { text: "nothing needed from you" })), el("ul", { class: "lb-agent" }, agent.map((t) => el("li", { text: t })))) : null,
      decided.length ? el("details", { class: "lb-fold", "data-fold": "decided" }, el("summary", { text: "Already decided · " + decided.length }), el("ul", { class: "lb-decided" }, decided.map((d) => el("li", {}, el("time", { text: d.date || "" }), el("span", { text: d.text || "" }))))) : null,
      ev.length ? el("details", { class: "lb-fold", "data-fold": "evidence" }, el("summary", { text: "How the agent checked this" }), el("div", { class: "lb-ev" }, ev.map((t) => el("span", { text: t })), b.verifiedAt ? el("span", { text: "Verified at " + b.verifiedAt }) : null)) : null);
  }

  function selButton(sel, ...kids) { return el("button", { type: "button", class: "lb-link", "data-sel": sel }, ...kids); }

  function statusPanel(l) {
    const m = laneMap(), b = l.brief || {}, g = LaneCore.stateOf(l, m), s = l.session;
    const lc = b.lastCommit, ab = b.aheadBehind;
    const out = [
      el("div", { class: "lb-row" }, el("span", { class: "chip", text: stageLabel(l) }), moveChip(l, g), l.pr ? el("a", { class: "chip agent", href: "https://github.com/OlisDevSpot/tri-pros-website/pull/" + l.pr, target: "_blank", rel: "noopener", text: "PR #" + l.pr }) : el("span", { class: "chip", text: "no PR yet" }),
        el("span", { class: "chip" }, el("i", { class: "dot" + (sessionOn(l) ? " on" : "") }), s && s.lastSeen ? "session " + ago(s.lastSeen) : "no session linked")),
      l.next ? el("p", {}, el("b", { text: g === "you" ? "Your move: " : "Next: " }), l.next) : null,
      !l.branch ? el("p", { class: "note", text: "No branch yet, so there are no change bars and no wait gap." }) : null,
      V && V.layout.cycle.length ? selButton("more:cycle", "These lanes wait on each other →") : null,
      facts([
        ["Preview", previewFact(l)],
        ["Session", s && s.id ? s.id.slice(0, 8) + " · last wrote " + ago(s.lastSeen) : null, 1],
        ["Branch", l.branch, 1], ["Worktree", b.worktree, 1], ["Port", l.port], ["Neon branch", l.neon, 1],
        ["Tracker", b.tracker, 1], ["Spec", b.spec, 1], ["Plan", b.plan, 1],
        ["Last commit", lc ? lc.sha + " · " + lc.date + " · " + lc.subject : null],
        ["Against prod", ab ? ab.ahead + " ahead, " + ab.behind + " behind" + (ab.onCurrentProd ? "" : " · not on current prod") : null],
        ["Files changed", b.files != null ? String(b.files) : null],
        ["Overview synced", l.briefAt || null],
        ["Notes", [l.notes, b.notes].filter(Boolean).join(" · ") || null]]),
      el("p", { class: "note", text: "Tap anything on the page to see it here." })];
    return { label: "Live status", body: out };
  }

  function lanePanel(l, id) {
    const m = laneMap(), o = m[id];
    if (!o) return null;
    const g = LaneCore.stateOf(o, m);
    const rels = [
      ...relText(l, m).filter((r) => r.d === id).map((r) => (l.name || l.id) + " " + r.text),
      ...relText(o, m).map((r) => (o.name || o.id) + " " + r.text)];
    const pair = pairWith(l.id, id);
    return { label: "Lane", body: [
      el("h4", { text: o.name || o.id }),
      el("div", { class: "lb-row" }, el("span", { class: "chip", text: stageLabel(o) }), moveChip(o, g)),
      rels.length ? el("ul", {}, rels.map((t) => el("li", { text: t }))) : null,
      pair ? el("p", { text: pair.stacked ? "Stacked with this lane." : pair.conflicts ? plural(pair.conflicts, "file conflicts", "files conflict") + " with this lane, out of " + plural(pair.shared || 0, "shared file", "shared files") + "." : plural(pair.shared || 0, "shared file", "shared files") + " with this lane; they merge clean." }) : null,
      pair && pair.conflicts && pair.files && pair.files.length ? el("ul", { class: "lb-files" }, pair.files.map((f) => el("li", { class: "mono", text: f }))) : null,
      o.next ? el("p", { class: "muted", text: "Next: " + o.next }) : null,
      el("a", { href: "#lane-" + id, class: "lb-open", text: "Open its lane page →" })] };
  }

  function decisionItems(ds, phaseIds, withWatch, l) {
    const p = pending(ds);
    const inStep = (d) => phaseIds(d.phase);
    const items = [
      ...p.open.filter(inStep).map((d) => el("li", {}, selButton("decision:" + d.id, el("b", { text: decisionNo(ds, d.id) + ". " }), d.question))),
      ...p.checks.filter(inStep).map((d) => el("li", {}, selButton("check:" + d.id, el("b", { text: "✓ " }), d.question))),
      ...(withWatch && watchOf(l).length ? [el("li", {}, selButton("watch:0", el("b", { text: "! " }), "Watch out: " + plural(watchOf(l).length, "risk", "risks")))] : [])];
    return items.length ? [el("span", { class: "lb-lbl", text: "Waiting on you here" }), el("ul", {}, items)] : [];
  }

  function stepPanel(l, ds, id) {
    const b = l.brief || {}, phases = b.phases || [];
    const known = new Set(phases.map((p) => p.id));
    if (id.startsWith("phase-")) {
      const p = phases[+id.slice(6)];
      if (!p) return null;
      return { label: "Phase", body: [
        el("h4", {}, el("span", { class: "lb-ids", text: p.id + " " }), p.name),
        el("div", { class: "lb-row" }, el("span", { class: "chip " + (PHASE_CHIP[p.status] || ""), text: p.status })),
        p.note ? el("p", { class: "muted", text: p.note }) : null,
        ...decisionItems(ds, (ph) => ph === p.id, false, l)] };
    }
    if (!STEP_WHEN[id] || !LaneCore.hasStepMap(b)) return null;
    const ps = phases.filter((p) => LaneCore.stepFor(p) === id);
    const ids = new Set(ps.map((p) => p.id));
    const here = (ph) => ids.has(ph) || (id === "release" && (!ph || !known.has(ph)));
    return { label: STEP_WHEN[id], body: [
      b.steps && b.steps[id] ? el("h4", { text: b.steps[id] }) : null,
      ps.length ? el("ul", {}, ps.map((p) => el("li", { class: "lb-phl" }, el("b", { text: p.id }), el("span", {}, p.name, p.note ? el("span", { class: "muted", text: " · " + p.note }) : null), el("span", { class: "chip " + (PHASE_CHIP[p.status] || ""), text: p.status })))) : el("p", { class: "muted", text: "No phases in this step." }),
      id === "release" && b.stand ? standP(b.stand) : null,
      ...decisionItems(ds, here, id === "release", l)] };
  }

  function decisionPanel(l, ds, id, kind) {
    const d = (S.decisions || []).find((x) => x.id === id && x.lane === l.id && (kind === "check") === isCheck(x));
    if (!d) return null;
    const no = decisionNo(ds, d.id);
    const label = kind === "check" ? "Owner check" : "Decision" + (no ? " " + no : "");
    return { label: label + (d.phase ? " · on " + d.phase : ""), body: [decisionCard(d, { compact: true })] };
  }

  function morePanel(l, id) {
    const m = laneMap();
    const layout = V.layout;
    if (id === "cycle") {
      if (!layout.cycle.length) return null;
      return { label: "Loop", body: [el("h4", { text: "These lanes wait on each other" }), el("p", { class: "muted", text: "None of them can merge until one stops waiting. Break the loop in the editor of one lane." }), el("ul", {}, layout.cycle.map((x) => el("li", {}, selButton("lane:" + x, (m[x] && m[x].name) || x))))] };
    }
    const node = layout.nodes.find((n) => n.more && String(n.col) === id);
    if (!node) return null;
    const head2 = id === "overlap" ? "More lanes sharing files" : id === "0" ? "More lanes it waits on" : "More lanes waiting";
    return { label: plural(node.more.length, "more lane", "more lanes"), body: [el("h4", { text: head2 }),
      el("ul", {}, node.more.map((x) => {
        const p = id === "overlap" ? pairWith(l.id, x) : null;
        return el("li", {}, selButton("lane:" + x, (m[x] && m[x].name) || x), p ? el("span", { class: "muted", text: " · " + plural(p.shared || 0, "shared", "shared") + ", " + plural(p.conflicts || 0, "conflict", "conflicts") }) : null);
      }))] };
  }

  function inspector(l, ds) {
    const s = S.sel, b = l.brief || {};
    let r = null;
    if (s) {
      if (s.t === "lane") r = lanePanel(l, s.id);
      else if (s.t === "step") r = stepPanel(l, ds, s.id);
      else if (s.t === "decision" || s.t === "check") r = decisionPanel(l, ds, s.id, s.t);
      else if (s.t === "watch") r = watchOf(l).length ? { label: "Watch out", body: [el("ul", { class: "lb-watch" }, watchOf(l).map((w) => el("li", { text: w })))] } : null;
      else if (s.t === "area") {
        const a = (b.areas || [])[+s.id];
        const total = b.files || (b.areas || []).reduce((t, x) => t + (+x.files || 0), 0);
        r = a ? { label: "Where the change lands", body: [el("h4", { text: a.area }), el("p", {}, el("b", { text: a.files + " of " + plural(total, "file", "files") }), " (" + Math.round(a.files / (total || 1) * 100) + "%)."), a.note ? el("p", { text: a.note }) : null] } : null;
      } else if (s.t === "milestone") {
        const t = (b.timeline || [])[+s.id];
        r = t ? { label: shortDate(t.date), body: [el("h4", { text: t.label }), t.note ? el("p", { text: t.note }) : null] } : null;
      } else if (s.t === "gap") {
        const gp = LaneCore.waitGap(l, today());
        r = gp ? { label: "The wait", body: [el("h4", { text: plural(gp.days, "day", "days") + " built, not shipped" }), el("p", { text: "Built by " + shortDate(gp.from) + "; it has waited since, and is at " + stageLabel(l).toLowerCase() + " now." }), l.next ? el("p", { class: "muted", text: "Next: " + l.next }) : null] } : null;
      } else if (s.t === "more") r = morePanel(l, s.id);
      if (!r) S.sel = null;
    }
    const kind = S.sel ? S.sel.t : "status";
    if (!r) r = statusPanel(l);
    return el("div", { class: "lb-ib", "data-kind": kind },
      el("div", { class: "lb-ih" }, el("span", { class: "lb-lbl", text: r.label }), kind !== "status" ? el("button", { type: "button", class: "lb-x", "data-sel": "status:" }, "Back to status") : null),
      ...r.body);
  }

  function renderInspector() {
    const box = document.getElementById("lane-inspector");
    if (!box || !V) return;
    box.replaceChildren(inspector(V.l, V.ds));
  }

  // Vercel feeds only the status panel's preview line; a full redraw would replace a focused field and close the iPad keyboard.
  function renderLaneLive() {
    const box = document.getElementById("lane-inspector");
    if (!box || !V || V.l.id !== S.lane || S.sel) return;
    keepUiState(box, renderInspector);
  }

  function markSel() {
    const main = document.querySelector("#lane-view .lb-main");
    if (!main) return;
    const key = S.sel ? S.sel.t + ":" + S.sel.id : null;
    for (const e of main.querySelectorAll("[data-sel]")) {
      if (e.dataset.sel === "status:") continue;
      const on = e.dataset.sel === key;
      e.setAttribute("aria-pressed", on ? "true" : "false");
      e.classList.toggle("lb-sel", on);
    }
  }

  function renderLaneView() {
    const box = $("#lane-view");
    if (!S.lane) return;
    if (V && V.l.id === S.lane) keepUiState(box, () => drawLane(box)); else drawLane(box);
  }

  function drawLane(box) {
    if (!S.lanes) { box.replaceChildren(el("div", { class: "loading", text: "Loading lane." })); return; }
    const m = laneMap(), l = m[S.lane];
    if (!l) { V = null; box.replaceChildren(el("a", { class: "back", href: "#now", text: "← Now" }), el("div", { class: "loading", text: "No lane called " + S.lane + "." })); return; }
    const ds = LaneCore.laneDecisions(S.decisions || [], l.id);
    const layout = LaneCore.layoutBlockerMap(l.id, S.lanes, S.coll);
    const b = l.brief;
    const oldScroll = V && V.l.id === l.id && box.querySelector(".lb-scroll") ? box.querySelector(".lb-scroll").scrollLeft : null;
    V = { l, ds, layout };
    const lands = b && l.branch && (b.areas || []).length ? el("section", { class: "lb-viz", "data-section": "lands" }, head("Where the change lands", (b.files != null ? plural(b.files, "file", "files") + " · " : "") + "tap a bar"), areaBars(b)) : null;
    const waited = b && l.branch && ((b.timeline || []).length || LaneCore.waitGap(l, today())) ? el("section", { class: "lb-viz", "data-section": "waited" }, head("How long it has waited", "tap a point"), waitTimeline(l)) : null;
    const main = el("div", { class: "lb-main" },
      laneHeader(l), whereItStands(l, ds), blocksSection(l, layout),
      lands && waited ? el("div", { class: "lb-two" }, lands, waited) : lands || waited,
      b && l.branch && !lands && !waited ? el("p", { class: "lb-empty", "data-empty": "brief", text: "Where the change lands and how long it has waited fill in on the next /orient run" + (b.tracker ? " on " + b.tracker : "") + "." }) : null,
      decisionsList(l, ds), foldedSection(l));
    box.replaceChildren(el("div", { class: "lb-grid" }, main, el("aside", { id: "lane-inspector", class: "lb-insp", "aria-live": "polite", "aria-label": "Details" })));
    fitBlockerMap(box, oldScroll);
    renderInspector();
    markSel();
  }

  function wire() {
    const box = document.getElementById("lane-view");
    if (!box) return;
    box.addEventListener("click", (e) => {
      const t = e.target.closest("[data-sel]");
      if (!t || !box.contains(t)) return;
      const v = t.dataset.sel, i = v.indexOf(":");
      const k = v.slice(0, i), id = v.slice(i + 1);
      S.sel = k === "status" ? null : { t: k, id };
      renderInspector();
      markSel();
    });
    box.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const n = e.target.closest && e.target.closest("svg [data-sel]");
      if (!n) return;
      e.preventDefault();
      n.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire); else wire();

  Object.assign(globalThis, { renderLaneView, renderLaneLive, laneHeader, whereItStands, blockerMapSvg, areaBars, waitTimeline, decisionsList, inspector, decisionCard, keepUiState, byCard });
})();
