import { join } from "node:path";

const DEL = { __delete__: true };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const settle = (page, ms = 250) => page.waitForTimeout(ms);
const go = async (page, hash) => { await page.evaluate((h) => { location.hash = h; }, hash); await settle(page, 200); };
const updates = (page) => page.evaluate(() => window.__updates.slice());
const since = async (page, n) => (await updates(page)).slice(n);
const today = (page) => page.evaluate(() => LaneCore.localDay(new Date()));
const doc = (page, id) => page.evaluate((id) => S.decisions.find((d) => d.id === id), id);

// A snapshot fired straight on the mock store, the way another session's write reaches the page.
async function fire(page, what) {
  await page.evaluate(async (what) => {
    const db = await window.claude.use("db");
    if (what === "lanes") await db.doc("lanes/data-views").update({ "session.lastSeen": "2026-11-16T14:58:00Z" });
    else await db.doc("decisions/lane-size").update({ order: 4 });
  }, what);
  await settle(page, 150);
}

const laneCard = (page, id) => page.locator(`#lane-view [data-section=decisions] .lb-card[data-id="${id}"]`);
const tabCard = (page, id) => page.locator(`#dec-list .lb-card[data-id="${id}"]`);
const headerChip = (page) => page.evaluate(() => [...document.querySelectorAll("#lane-view [data-section=header] .lb-chips [data-sel]")].map((c) => c.textContent).find((t) => /waiting on you/.test(t)) || "");
const nowChip = (page, lane) => page.evaluate((lane) => {
  const row = document.querySelector(`#tree a.row[href="#lane-${lane}"]`);
  return row ? [...row.querySelectorAll(".chip")].map((c) => c.textContent).find((t) => /waiting on you/.test(t)) || "" : null;
}, lane);

async function firstOpen(page) {
  return page.evaluate(() => document.querySelector("#lane-view [data-section=decisions] .lb-card[data-kind=decision][data-state=open]")?.dataset.id || null);
}

async function answerOption(card, i, note) {
  await card.locator("input[type=radio]").nth(i).check();
  if (note != null) await card.locator("[name=note]").fill(note);
  await card.getByRole("button", { name: "Save answer" }).click();
}

// The page's own words, with every string that comes from lane or decision data taken out first.
async function staticCopy(page) {
  return page.evaluate(() => {
    const data = [];
    const walk = (v) => { if (typeof v === "string") data.push(v); else if (v && typeof v === "object") Object.values(v).forEach(walk); };
    walk(S.lanes); walk(S.decisions);
    data.sort((a, b) => b.length - a.length);
    const parts = [];
    for (const id of ["lane-view", "v-decisions"]) {
      const root = document.getElementById(id);
      parts.push(root.innerText);
      for (const e of root.querySelectorAll("[placeholder],[aria-label],[title]")) for (const a of ["placeholder", "aria-label", "title"]) if (e.getAttribute(a)) parts.push(e.getAttribute(a));
    }
    let text = parts.join("\n");
    for (const s of data) if (s) text = text.split(s).join(" ");
    return text;
  });
}

export default async function (ctx) {
  const failures = [];
  const expect = (ok, msg) => { if (!ok) failures.push(msg); };
  ctx.page.setDefaultTimeout(4000);
  try { await run(ctx, expect); } catch (e) { failures.push("stopped: " + String(e.message || e).split("\n")[0]); }
  return { failures };
}

async function run({ page, hash, viewport, scheme, opt, skillDir }, expect) {
  const shot = (name) => page.screenshot({ path: join(skillDir, "test", "shots", `dec-${name}-${viewport}-${scheme}.png`), fullPage: true });
  const n0 = (await updates(page)).length;

  if (hash === "now") {
    expect((await nowChip(page, "data-views")) === "3 waiting on you", "the Now row for Data views says 3 waiting on you (got " + JSON.stringify(await nowChip(page, "data-views")) + ")");
    return;
  }
  if (hash !== "lane-data-views") return;

  if (opt.readOnly) {
    for (const where of ["#lane-view [data-section=decisions]", "#dec-list"]) {
      if (where === "#dec-list") await go(page, "#decisions");
      const r = await page.evaluate((where) => {
        const cards = [...document.querySelectorAll(where + " .lb-card")];
        const fields = cards.flatMap((c) => [...c.querySelectorAll("input,textarea,button[type=submit]")]);
        const open = cards.filter((c) => c.dataset.state === "open");
        return { cards: cards.length, fields: fields.length, enabled: fields.filter((f) => !f.disabled).length, said: open.filter((c) => c.innerText.includes("This view can't save answers")).length, open: open.length };
      }, where);
      expect(r.cards > 0 && r.fields > 0 && r.enabled === 0, `read-only: every input is disabled in ${where} ${JSON.stringify(r)}`);
      expect(r.open > 0 && r.said === r.open, `read-only: each open card says This view can't save answers in ${where} ${JSON.stringify(r)}`);
    }
    expect((await since(page, n0)).length === 0, "read-only: nothing is written");
    if (viewport === "1280x900" || viewport === "390x844") await shot("read-only");
    return;
  }

  if (opt.rejectNext) {
    const id = await firstOpen(page);
    expect(!!id, "an open decision is on the lane page");
    if (!id) return;
    await answerOption(laneCard(page, id), 1, "only if cheap");
    await settle(page, 400);
    const toast = await page.evaluate(() => ({ on: document.getElementById("toast").classList.contains("on"), text: document.getElementById("toast").textContent }));
    expect(toast.on, "a refused save shows the toast " + JSON.stringify(toast));
    expect((await since(page, n0)).length === 0, "a refused save writes nothing and is not retried");
    const state = await page.evaluate((id) => {
      const c = document.querySelector(`#lane-view [data-section=decisions] .lb-card[data-id="${id}"]`);
      return { state: c?.dataset.state, radios: c?.querySelectorAll("input[type=radio]").length || 0, disabled: [...(c?.querySelectorAll("input,textarea,button[type=submit]") || [])].filter((f) => f.disabled).length, ro: c?.innerText.includes("This view can't save answers") };
    }, id);
    expect(state.state === "open" && state.radios > 0, "after a refused save the card still shows its options " + JSON.stringify(state));
    if (opt.rejectNext === "invalid_argument") {
      expect(/can't save/.test(toast.text), "invalid_argument toast says the view can't save: " + toast.text);
      expect(state.disabled > 0 && state.ro, "invalid_argument turns the card read-only " + JSON.stringify(state));
      await go(page, "#decisions");
      const tab = await page.evaluate(() => [...document.querySelectorAll("#dec-list .lb-card [name=note]")].every((f) => f.disabled));
      expect(tab, "invalid_argument turns the Decisions tab cards read-only too");
    } else {
      expect(state.disabled === 0 && !state.ro, "an ordinary refusal keeps the card writable " + JSON.stringify(state));
      const kept = await page.evaluate((id) => document.querySelector(`#lane-view [data-section=decisions] .lb-card[data-id="${id}"] [name=note]`)?.value, id);
      expect(kept === "only if cheap", "a refused save keeps the typed note: " + kept);
    }
    return;
  }

  const day = await today(page);

  // Counts: two open decisions and one open owner check.
  expect((await headerChip(page)) === "3 waiting on you", "the lane header says 3 waiting on you (got " + (await headerChip(page)) + ")");
  await go(page, "#now");
  expect((await nowChip(page, "data-views")) === "3 waiting on you", "the Now row for Data views says 3 waiting on you (got " + (await nowChip(page, "data-views")) + ")");
  const badge = await page.evaluate(() => document.getElementById("dec-count").textContent);
  const openAll = await page.evaluate(() => LaneCore.openCount(S.decisions));
  expect(badge === String(openAll) && openAll === 4, `the tab badge counts open decisions and checks (badge ${badge}, expected 4)`);
  await go(page, "#" + hash);

  if (viewport === "1280x900" || viewport === "390x844") await page.locator("#lane-view [data-section=decisions]").screenshot({ path: join(skillDir, "test", "shots", `dec-lane-open-${viewport}-${scheme}.png`) });

  // Drafts: an unsent answer survives a lane snapshot and a decisions snapshot, on the lane page and in the tab.
  const open = await page.evaluate(() => [...document.querySelectorAll("#lane-view [data-section=decisions] .lb-card[data-kind=decision][data-state=open]")].map((c) => c.dataset.id));
  expect(open.length === 2, "two open decision cards on the lane page " + JSON.stringify(open));
  const draftId = open[1];
  if (draftId) {
    await laneCard(page, draftId).locator("[name=own]").fill("draft text");
    await fire(page, "lanes");
    await fire(page, "decisions");
    const v1 = await laneCard(page, draftId).locator("[name=own]").inputValue();
    expect(v1 === "draft text", "the lane page keeps the draft across snapshots (got " + JSON.stringify(v1) + ")");
    await go(page, "#decisions");
    const v2 = await tabCard(page, draftId).locator("[name=own]").inputValue();
    expect(v2 === "draft text", "the Decisions tab shows the same draft (got " + JSON.stringify(v2) + ")");
    await fire(page, "decisions");
    const v3 = await tabCard(page, draftId).locator("[name=own]").inputValue();
    expect(v3 === "draft text", "the Decisions tab keeps the draft across a snapshot (got " + JSON.stringify(v3) + ")");
    await go(page, "#" + hash);
  }

  // Option 2 with a note: one write, with the free-text flag and the agent's old reply cleared.
  const id1 = await firstOpen(page);
  if (id1) {
    const d = await doc(page, id1);
    const label = (typeof d.options[1] === "string" ? d.options[1] : d.options[1].label);
    const n = (await updates(page)).length;
    await answerOption(laneCard(page, id1), 1, "only if cheap");
    await settle(page, 400);
    const got = await since(page, n);
    expect(got.length === 1, "answering writes exactly once (got " + got.length + ")");
    expect(eq(got[0], { path: "decisions/" + id1, patch: { answer: label, answeredOn: day, own: DEL, note: "only if cheap", reply: DEL, replyOn: DEL, appliedOn: DEL } }), "option answer patch " + JSON.stringify(got[0]));
    const st = await page.evaluate((id) => document.querySelector(`#lane-view [data-section=decisions] .lb-card[data-id="${id}"]`)?.dataset.state, id1);
    expect(st === "answered", "the answered card shows as answered (got " + st + ")");
    expect((await laneCard(page, id1).innerText()).includes("Answered · waiting for the agent"), "a fresh answer waits for the agent");
  }

  // Free text on a doc with no options.
  await go(page, "#lane-casl-285");
  const casl = laneCard(page, "casl-285-db1");
  expect((await casl.locator("input[type=radio]").count()) === 0, "a doc with options: [] shows no options");
  if (await casl.count()) {
    const n = (await updates(page)).length;
    await casl.locator("[name=own]").fill("ship it later");
    await casl.getByRole("button", { name: "Save answer" }).click();
    await settle(page, 400);
    const got = await since(page, n);
    expect(got.length === 1 && eq(got[0], { path: "decisions/casl-285-db1", patch: { answer: "ship it later", answeredOn: day, own: true, note: DEL, reply: DEL, replyOn: DEL, appliedOn: DEL } }), "free-text patch " + JSON.stringify(got));
  } else expect(false, "the casl-285-db1 card is on its lane page");
  await go(page, "#" + hash);

  // Change answer on an answered, replied, applied doc, then pick an option with no note.
  const mo = laneCard(page, "data-views-merge-order");
  const moText = await mo.innerText();
  const moDoc = await doc(page, "data-views-merge-order");
  expect(moText.includes(moDoc.reply) && moText.includes(moDoc.note) && moText.includes(moDoc.answer), "the answered card shows answer, note and reply");
  {
    const n = (await updates(page)).length;
    await mo.getByRole("button", { name: "Change answer" }).click();
    await settle(page, 100);
    await answerOption(mo, 0, null);
    await settle(page, 400);
    const got = await since(page, n);
    const label = moDoc.options[0].label;
    expect(got.length === 1 && eq(got[0], { path: "decisions/data-views-merge-order", patch: { answer: label, answeredOn: day, own: DEL, note: DEL, reply: DEL, replyOn: DEL, appliedOn: DEL } }), "changed answer patch " + JSON.stringify(got));
    expect((await mo.innerText()).includes("Answered · waiting for the agent"), "a changed answer waits for the agent again");
  }

  // The owner check is a tick box, open until ticked.
  const ck = laneCard(page, "data-views-prod-check");
  expect((await ck.locator("input[type=checkbox]").count()) === 1 && (await ck.locator("input[type=radio]").count()) === 0 && (await ck.locator("form").count()) === 0, "the owner check is a tick box, not a radio form");
  const before = await headerChip(page);
  {
    const n = (await updates(page)).length;
    await ck.locator("input[type=checkbox]").check();
    await settle(page, 400);
    const got = await since(page, n);
    expect(got.length === 1 && eq(got[0], { path: "decisions/data-views-prod-check", patch: { done: true } }), "ticking writes {done: true} " + JSON.stringify(got));
  }
  const after = await headerChip(page);
  expect(before === "2 waiting on you" && after === "1 waiting on you", `the check counts as open until ticked (${before} → ${after})`);
  if (viewport === "1280x900" || viewport === "390x844") await page.locator("#lane-view [data-section=decisions]").screenshot({ path: join(skillDir, "test", "shots", `dec-lane-answered-${viewport}-${scheme}.png`) });

  // The Decisions tab: every doc, grouped by lane, lane-less first, each with its own fields, styled.
  await go(page, "#decisions");
  const tab = await page.evaluate(() => {
    const groups = [...document.querySelectorAll("#dec-list [data-lane]")].map((g) => ({ lane: g.dataset.lane, ids: [...g.querySelectorAll(".lb-card")].map((c) => c.dataset.id) }));
    const cards = [...document.querySelectorAll("#dec-list .lb-card")];
    const missing = [];
    for (const d of S.decisions) {
      const c = document.querySelector(`#dec-list .lb-card[data-id="${CSS.escape(d.id)}"]`);
      if (!c) { missing.push(d.id + ": no card"); continue; }
      for (const k of ["question", "context", "area", "note", "reply"]) if (d[k] && !c.innerText.includes(d[k])) missing.push(d.id + ": " + k);
      if ((d.lane || "") !== c.closest("[data-lane]")?.dataset.lane) missing.push(d.id + ": wrong group");
    }
    const cs = cards[0] ? getComputedStyle(cards[0]) : null;
    return { groups, count: cards.length, docs: S.decisions.length, missing, border: cs ? cs.borderTopStyle + " " + cs.borderTopWidth : null };
  });
  expect(tab.count === 16 && tab.docs === 16, `the tab shows all 16 docs (${tab.count} cards, ${tab.docs} docs)`);
  expect(!tab.missing.length, "tab cards miss fields: " + tab.missing.join(", "));
  expect(tab.groups[0] && tab.groups[0].lane === "" && tab.groups[0].ids.length === 11, "lane-less docs come first " + JSON.stringify(tab.groups.map((g) => [g.lane, g.ids.length])));
  expect(tab.border && !/^none/.test(tab.border) && !/ 0px$/.test(tab.border), "tab cards are styled (border " + tab.border + ")");
  const legacy = tab.groups[0] ? tab.groups[0].ids[0] : null;
  if (legacy) {
    const c = tabCard(page, legacy);
    await c.getByRole("button", { name: "Change answer" }).click();
    await settle(page, 100);
    const d = await doc(page, legacy);
    const labels = await c.locator("input[type=radio]").evaluateAll((xs) => xs.map((x) => x.closest("label").querySelector(".lb-ot").textContent));
    expect(eq(labels, d.options), "legacy string options render as options " + JSON.stringify(labels));
    await c.getByRole("button", { name: "Keep answer" }).click();
    await settle(page, 100);
  }
  const states = await page.evaluate(() => [...document.querySelectorAll("#dec-list .lb-card")].reduce((o, c) => ({ ...o, [c.dataset.state]: (o[c.dataset.state] || 0) + 1 }), {}));
  expect(eq(states, { answered: 14, open: 1, done: 1 }), "after the run: 14 answered, 1 open, 1 done check " + JSON.stringify(states));
  if (viewport === "1280x900" || viewport === "390x844") await shot("tab");

  // The lane page and its side panel both hold an editable copy; saving from both still writes once.
  await go(page, "#" + hash);
  {
    const id = "data-views-busy";
    const opened = await page.evaluate((id) => {
      const pin = document.querySelector(`#lane-view .lb-main [data-sel="decision:${id}"]`);
      pin?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      return !!document.querySelector(`#lane-inspector .lb-card[data-id="${id}"]`);
    }, id);
    expect(opened, "the side panel holds a copy of the open decision");
    const main = laneCard(page, id);
    await main.locator("[name=own]").fill("");
    await main.locator("input[type=radio]").nth(1).check();
    const n = (await updates(page)).length;
    const clicked = await page.evaluate((id) => {
      const btns = [...document.querySelectorAll(`#lane-view .lb-card[data-id="${id}"] button[type=submit]`)];
      btns.forEach((b) => b.click());
      return btns.length;
    }, id);
    await settle(page, 500);
    const got = await since(page, n);
    expect(clicked === 2 && got.length === 1 && got[0].path === "decisions/" + id, `Save from both copies writes once (${clicked} buttons, ${got.length} writes)`);
  }

  // Copy: the page says decision and owner check, never call.
  const copyLane = await staticCopy(page);
  const hit = /\bcalls?\b/i.exec(copyLane);
  expect(!hit, "the page's own copy says call: …" + (hit ? copyLane.slice(Math.max(0, hit.index - 40), hit.index + 40) : "") + "…");

  return;
}
