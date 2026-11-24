import { join } from "node:path";

const FULL = ["header", "stands", "blocks", "lands", "waited", "decisions", "folded"];
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Reads what one lane page shows right now; every check below is measured from the DOM, not from the data.
async function snapshot(page) {
  return page.evaluate(() => {
    const root = document.getElementById("lane-view");
    const sections = [...root.querySelectorAll("[data-section]")].map((e) => e.dataset.section);
    const kind = root.querySelector("#lane-inspector [data-kind]")?.dataset.kind ?? null;
    const insp = root.querySelector("#lane-inspector");
    const main = root.querySelector(".lb-main");
    let inspectorMode = null;
    if (insp && main) {
      const r = insp.getBoundingClientRect(), mr = main.getBoundingClientRect(), cs = getComputedStyle(insp);
      if (r.left >= mr.right - 1) inspectorMode = "side";
      else if (Math.abs(r.left - mr.left) < 2 && cs.position === "sticky" && cs.bottom === "0px" && Math.abs(parseFloat(cs.maxHeight) - innerHeight * 0.42) < 2) inspectorMode = "sheet";
      else inspectorMode = "other";
    }
    const svg = [];
    for (const s of root.querySelectorAll(".lb-main svg")) {
      const sr = s.getBoundingClientRect();
      const vb = s.viewBox.baseVal;
      const scale = vb && vb.width ? sr.width / vb.width : 1;
      const out = { textOutside: [], smallText: [], nodeOverlaps: [], nodeOutside: [] };
      for (const t of s.querySelectorAll("text")) {
        if (!t.textContent.trim()) continue;
        const r = t.getBoundingClientRect();
        if (r.left < sr.left - 0.5 || r.top < sr.top - 0.5 || r.right > sr.right + 0.5 || r.bottom > sr.bottom + 0.5) out.textOutside.push(t.textContent);
        const px = parseFloat(getComputedStyle(t).fontSize) * scale;
        if (px < 12) out.smallText.push(t.textContent + " " + px.toFixed(1));
      }
      const boxes = [...s.querySelectorAll(".lb-n > rect")].map((r) => ({ id: r.parentNode.dataset.sel || r.parentNode.dataset.node, b: r.getBoundingClientRect() }));
      for (const { id, b } of boxes) if (b.left < sr.left - 2 || b.top < sr.top - 2 || b.right > sr.right + 2 || b.bottom > sr.bottom + 2) out.nodeOutside.push(id);
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i].b, b = boxes[j].b;
        if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) out.nodeOverlaps.push(boxes[i].id + " × " + boxes[j].id);
      }
      svg.push(out);
    }
    const sels = {};
    for (const e of root.querySelectorAll(".lb-main [data-sel]")) {
      const t = e.dataset.sel.split(":")[0];
      (sels[t] ??= []).push(e.dataset.sel);
    }
    return {
      sections,
      empty: [...root.querySelectorAll("[data-empty]")].map((e) => e.dataset.empty),
      releaseMap: !!root.querySelector("[data-section=stands] .lb-map"),
      phaseStrip: !!root.querySelector("[data-section=stands] .lb-phstrip"),
      kind,
      inspectorMode,
      inspectorText: insp?.innerText ?? "",
      text: root.innerText,
      svg,
      sels,
      pins: root.querySelectorAll(".lb-map .lb-pin[data-sel^='decision:'], .lb-map .lb-pin[data-sel^='check:']").length,
      overlaps: root.querySelectorAll(".lb-bmap [data-col=overlap]").length,
    };
  });
}

const settle = (page, ms = 60) => page.waitForTimeout(ms);
async function select(page, sel) {
  await page.evaluate((s) => {
    const e = document.querySelector(`#lane-view .lb-main [data-sel="${CSS.escape(s)}"]`);
    e.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }, sel);
  await settle(page);
  return page.evaluate(() => document.querySelector("#lane-inspector [data-kind]")?.dataset.kind);
}
async function backToStatus(page) {
  await page.evaluate(() => document.querySelector('#lane-inspector [data-sel="status:"]')?.click());
  await settle(page);
  return page.evaluate(() => document.querySelector("#lane-inspector [data-kind]")?.dataset.kind);
}

export default async function ({ page, hash, viewport, scheme, opt, skillDir }) {
  const failures = [];
  const expect = (ok, msg) => { if (!ok) failures.push(msg); };
  const lane = hash.replace(/^lane-/, "");
  const newBrief = opt.briefs.some((b) => b.startsWith(lane + "="));
  const width = Number(viewport.split("x")[0]);

  if (opt.delay.lanes) {
    await page.reload();
    await settle(page, 300);
    const early = await page.evaluate(() => document.getElementById("lane-view").innerText);
    expect(early.includes("Loading lane."), "before the lanes arrive the page says Loading lane.");
    await page.waitForFunction(() => !document.getElementById("lane-view").innerText.includes("Loading lane."), null, { timeout: opt.delay.lanes + 3000 });
    await settle(page, 400);
  }

  const lastIsDecisions = opt.order[opt.order.length - 1] === "decisions" && opt.order.indexOf("collisions") > 0 && opt.order[0] === "lanes";
  if (lastIsDecisions && lane === "data-views") {
    await page.reload();
    await page.waitForSelector("#lane-view [data-section=header]");
    const early = await snapshot(page);
    expect(early.pins === 0, "decision pins wait for the decisions collection (early pins " + early.pins + ")");
    await settle(page, 600);
  }

  if (lane === "nope") {
    const t = await page.evaluate(() => ({ text: document.getElementById("lane-view").innerText, back: !!document.querySelector('#lane-view a.back[href="#map"]') }));
    expect(t.back, "unknown lane keeps the back link");
    expect(t.text.includes("No lane called nope"), "unknown lane says No lane called nope");
    return { failures };
  }

  const s = await snapshot(page);
  const out = { sections: s.sections, releaseMap: s.releaseMap, inspectorMode: s.inspectorMode, empty: s.empty, kinds: Object.keys(s.sels) };

  // Layout and drawing rules hold in every state.
  expect(s.inspectorMode === (width >= 1280 ? "side" : "sheet"), "inspector mode " + s.inspectorMode + " at " + width);
  s.svg.forEach((g, i) => {
    expect(!g.textOutside.length, `svg ${i} text outside the viewBox: ${g.textOutside.join(" | ")}`);
    expect(!g.smallText.length, `svg ${i} labels under 12px: ${g.smallText.join(" | ")}`);
    expect(!g.nodeOverlaps.length, `svg ${i} nodes intersect: ${g.nodeOverlaps.join(" | ")}`);
    expect(!g.nodeOutside.length, `svg ${i} nodes outside the svg: ${g.nodeOutside.join(" | ")}`);
  });
  expect(s.svg.length >= 1, "the blocker map is drawn");
  expect(s.kind === "status", "the inspector opens on status (got " + s.kind + ")");

  if (lane === "data-views" && newBrief) {
    expect(eq(s.sections, FULL), "data views sections " + JSON.stringify(s.sections));
    expect(s.releaseMap, "data views draws the release map");
    expect(!s.empty.includes("brief"), "a full brief has no empty state");
  } else if (lane === "data-views") {
    expect(eq(s.sections, ["header", "stands", "blocks", "decisions", "folded"]), "old-shape data views sections " + JSON.stringify(s.sections));
    expect(s.empty.includes("brief"), "old-shape data views shows the brief empty state");
    expect(s.releaseMap, "old-shape data views still draws the release map");
    const steps = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll("#lane-view .lb-map [data-step]")].map((e) => [e.dataset.step, e.querySelectorAll(".lb-ph").length])));
    expect(eq(steps, { prod: 2, release: 3, next: 3, later: 5 }), "phases with no step are placed by their status " + JSON.stringify(steps));
  }
  if (lane === "superseded") {
    expect(eq(s.sections, ["header", "stands", "blocks", "decisions"]), "superseded sections " + JSON.stringify(s.sections));
    expect(s.empty.includes("brief"), "superseded shows the brief empty state");
  }
  if (lane === "dev-flow") {
    expect(!s.sections.includes("lands") && !s.sections.includes("waited"), "a lane with no branch has no change bars or wait gap");
    expect(/no branch/i.test(s.inspectorText), "the panel says why dev-flow has no bars or gap");
  }
  if (lane === "r19") {
    expect(s.releaseMap, "r19 (6 phases) draws the release map");
    expect(s.inspectorText.includes("#290"), "r19 status names its PR");
    expect(/Preview/.test(s.inspectorText), "r19 status has a preview line");
  }
  if (lane === "pe4") {
    expect(!s.releaseMap && s.phaseStrip, "pe4 (4 phases) draws the phase strip");
  }
  if (lane === "hv") {
    const parked = await page.evaluate(() => !!document.querySelector("#lane-view .lb-bmap .lb-n.lb-me.lb-parked"));
    expect(parked, "the parked lane's own node is dashed");
  }
  if (lane === "long-names") {
    const h = await page.evaluate(() => document.querySelector("#lane-view [data-section=header] h2")?.textContent || "");
    expect(h.startsWith("Long running cross-cutting permissions"), "the header keeps the long name");
  }

  // Header: editor button opens the form; each chip switches the inspector.
  const hasEdit = await page.evaluate(() => [...document.querySelectorAll("#lane-view [data-section=header] button")].some((b) => /Edit stage/.test(b.textContent)));
  expect(hasEdit, "the header holds the editor button");
  if (hasEdit) {
    await page.locator("#lane-view [data-section=header] button", { hasText: "Edit stage" }).click();
    await settle(page);
    expect(await page.evaluate(() => !!document.querySelector("#lane-view form.edit")), "the editor button opens form.edit");
    await page.locator("#lane-view [data-section=header] button", { hasText: "Close editor" }).click();
    await settle(page);
  }
  const chips = await page.evaluate(() => [...document.querySelectorAll("#lane-view [data-section=header] .lb-chips [data-sel]")].map((c) => ({ sel: c.dataset.sel, text: c.textContent })));
  for (const c of chips) {
    const k = await select(page, c.sel);
    expect(k === c.sel.split(":")[0], `chip "${c.text}" opens ${c.sel.split(":")[0]} (got ${k})`);
    await backToStatus(page);
  }
  if (lane === "data-views") {
    const texts = chips.map((c) => c.text);
    const want = await page.evaluate((id) => {
      const l = S.lanes.find((x) => x.id === id);
      const watch = l.brief && Array.isArray(l.brief.watch) ? l.brief.watch : l.risk ? [l.risk] : [];
      const holds = LaneCore.layoutBlockerMap(id, S.lanes, S.coll).nodes.filter((n) => n.col === 2 || n.col === 3).flatMap((n) => n.more || [n.id]);
      const count = (n, one, many) => n + " " + (n === 1 ? one : many);
      const open = LaneCore.openCount(S.decisions, id);
      return [open ? open + " waiting on you" : null, watch.length ? count(watch.length, "risk", "risks") : null, holds.length ? "holds up " + count(holds.length, "lane", "lanes") : null].filter(Boolean);
    }, lane);
    expect(eq(texts, want), `data views chips ${JSON.stringify(texts)} should read the page's own data: ${JSON.stringify(want)}`);
    const handWritten = newBrief && opt.briefs.every((b) => b.endsWith("/brief-data-views.json"));
    if (handWritten) {
      expect(eq(texts, ["3 waiting on you", "2 risks", "holds up 4 lanes"]), "hand-written brief: data views chips " + JSON.stringify(texts));
    }
  }

  // Every selectable kind opens its own panel, and Back to status returns.
  for (const [t, list] of Object.entries(s.sels)) {
    const k = await select(page, list[0]);
    expect(k === t, `[data-sel=${list[0]}] opens ${t} (got ${k})`);
    if (t === "more") {
      const txt = await page.evaluate(() => document.getElementById("lane-inspector").innerText);
      const ids = await page.evaluate((sel) => {
        const n = document.querySelector(`#lane-view [data-sel="${sel}"]`);
        return (n?.dataset.more || "").split(",").filter(Boolean);
      }, list[0]);
      for (const id of ids) {
        const name = await page.evaluate((id) => document.querySelector(`#lane-inspector [data-sel="lane:${id}"]`)?.textContent || "", id);
        expect(!!name, `the +more panel lists ${id}`);
      }
      if (list[0] === "more:overlap") expect(/shared/.test(txt), "the overlap +more panel gives shared/conflict counts");
    }
    const back = await backToStatus(page);
    expect(back === "status", `Back to status after ${t} (got ${back})`);
  }
  if (lane === "data-views" && newBrief) {
    for (const t of ["status", "lane", "step", "decision", "check", "watch", "area", "milestone", "gap"]) expect(t in s.sels, `data views has a ${t} target`);
  }
  if (["r19", "pe4", "hv"].includes(lane)) expect("more" in s.sels, lane + " folds its overlaps into +N more");

  // Keyboard: an SVG lane node takes Enter.
  const svgNode = await page.evaluate(() => document.querySelector("#lane-view .lb-bmap [data-sel^='lane:']")?.dataset.sel || null);
  if (svgNode) {
    await page.focus(`#lane-view .lb-bmap [data-sel="${svgNode}"]`);
    await page.keyboard.press("Enter");
    await settle(page);
    const k = await page.evaluate(() => document.querySelector("#lane-inspector [data-kind]")?.dataset.kind);
    expect(k === "lane", "Enter on an SVG node opens the lane panel (got " + k + ")");
    const pressed = await page.evaluate((sel) => document.querySelector(`#lane-view [data-sel="${sel}"]`).getAttribute("aria-pressed"), svgNode);
    expect(pressed === "true", "the selected node is marked aria-pressed");
    if (lane === "data-views") {
      const long = await select(page, "lane:long-names");
      const ok = await page.evaluate(() => ({
        node: document.querySelector('#lane-view .lb-bmap [data-sel="lane:long-names"] text')?.textContent || "",
        panel: document.getElementById("lane-inspector").innerText,
      }));
      expect(long === "lane" && ok.node.endsWith("…"), "a long name is cut short in its node: " + ok.node);
      expect(ok.panel.includes("Long running cross-cutting permissions and sharing work with an extraordinarily lengthy la"), "the panel shows the full name");
      if (width === 1280) await page.screenshot({ path: join(skillDir, "test", "shots", `${hash}-${viewport}-${scheme}-lane.png`), fullPage: true });
    }
    await backToStatus(page);
  }

  // A snapshot from another session redraws the page; an open fold stays open and a focused map node keeps focus.
  const fold = await page.evaluate(() => {
    const d = document.querySelector("#lane-view details.lb-fold");
    if (d) d.open = true;
    return d ? d.querySelector("summary").textContent : null;
  });
  const focusSel = await page.evaluate(() => document.querySelector("#lane-view .lb-bmap [data-sel]")?.dataset.sel || null);
  if (focusSel) await page.focus(`#lane-view .lb-bmap [data-sel="${focusSel}"]`);
  await page.evaluate(async (lane) => {
    const db = await window.claude.use("db");
    await db.doc("lanes/" + lane).update({ "session.lastSeen": "2026-11-16T14:58:00Z" });
  }, lane);
  await settle(page, 150);
  if (fold) expect(await page.evaluate((t) => [...document.querySelectorAll("#lane-view details.lb-fold")].some((d) => d.open && d.querySelector("summary").textContent === t), fold), "an open fold stays open across a lane snapshot: " + fold);
  if (focusSel) {
    const now = await page.evaluate(() => document.activeElement?.closest?.("[data-sel]")?.dataset.sel || document.activeElement?.tagName);
    expect(now === focusSel, `a focused map node keeps focus across a lane snapshot (${focusSel} → ${now})`);
  }

  // A selection does not follow you to another lane.
  if (lane === "data-views") {
    const pin = await page.evaluate(() => document.querySelector("#lane-view .lb-map .lb-pin[data-sel^='decision:']")?.dataset.sel || null);
    expect(!!pin, "a decision pin sits on the release map");
    if (pin) {
      expect((await select(page, pin)) === "decision", "a decision pin opens the decision");
      if (width === 1280 || width === 390) await page.screenshot({ path: join(skillDir, "test", "shots", `${hash}-${viewport}-${scheme}-pin.png`), fullPage: false });
      await page.evaluate(() => { location.hash = "#lane-r19"; });
      await settle(page, 150);
      const k = await page.evaluate(() => document.querySelector("#lane-inspector [data-kind]")?.dataset.kind);
      expect(k === "status", "a new lane opens on status (got " + k + ")");
      await page.evaluate((h) => { location.hash = "#" + h; }, hash);
      await settle(page, 150);
    }
    const check = await page.evaluate(() => document.querySelector("#lane-view .lb-map .lb-pin[data-sel^='check:']")?.dataset.sel || null);
    expect(!!check, "an owner-check pin sits on the release map");
    const late = await snapshot(page);
    expect(late.pins > 0 && late.overlaps > 0, `pins (${late.pins}) and overlaps (${late.overlaps}) are drawn once everything has arrived`);

    // An old snapshot is labelled with its date in the owner colour.
    const stale = await page.evaluate(() => {
      const keep = S.coll;
      S.coll = { ...keep, asOf: "2026-11-01, test" };
      renderLaneView();
      const e = document.querySelector("#lane-view .lb-bmap [data-stale]");
      const res = e ? { text: e.textContent, fill: getComputedStyle(e).fill } : null;
      S.coll = keep;
      renderLaneView();
      return res;
    });
    expect(!!stale && stale.text.includes("2026-11-01"), "a stale snapshot shows its date: " + JSON.stringify(stale));

    // A loop is drawn once and named in the panel, without the lanes that only wait on it.
    const loop = await page.evaluate(() => {
      const keep = S.lanes;
      S.lanes = keep.map((l) => (l.id === "data-views" ? { ...l, blockedBy: ["proposal-page"] } : l));
      renderLaneView();
      const flag = document.querySelector('#lane-view .lb-main [data-sel="more:cycle"]');
      flag?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      const res = { flag: !!flag, kind: document.querySelector("#lane-inspector [data-kind]")?.dataset.kind, names: [...document.querySelectorAll("#lane-inspector [data-sel^='lane:']")].map((b) => b.dataset.sel) };
      S.lanes = keep;
      S.sel = null;
      renderLaneView();
      return res;
    });
    expect(loop.flag && loop.kind === "more" && eq(loop.names.sort(), ["lane:data-views", "lane:proposal-page"]), "a loop opens in the panel naming only its lanes: " + JSON.stringify(loop));

    // A blocker issue with no lane row still blocks: drawn as its own node, and the row agrees.
    const noLane = await page.evaluate(() => {
      const keep = S.lanes;
      S.lanes = keep.map((l) => (l.id === "data-views" ? { ...l, blockedBy: ["issue-999"] } : l));
      renderLanes();
      const n = document.querySelector('#lane-view .lb-bmap [data-node="issue-999"]');
      const t = n?.querySelector("text"), r = n?.querySelector("rect");
      const fits = !!t && t.getBoundingClientRect().right <= r.getBoundingClientRect().right;
      const edge = [...document.querySelectorAll("#lane-view .lb-bmap path.lb-wait title")].some((e) => /no lane/.test(e.textContent));
      const row = [...document.querySelectorAll('#map a.row[href="#lane-data-views"] .chip')].map((c) => c.textContent);
      const res = { text: t?.textContent, fits, edge, row, col: n?.getAttribute("data-col") };
      S.lanes = keep;
      renderLanes();
      return res;
    });
    expect(noLane.text === "#999 · no lane" && noLane.fits && noLane.col === "0", "a blocker issue with no row is drawn as #999 · no lane in the waits-on column " + JSON.stringify(noLane));
    expect(noLane.edge && noLane.row.includes("blocked"), "the no-lane blocker draws a waits edge and the row reads blocked " + JSON.stringify(noLane));
  }

  return { ...out, failures };
}
