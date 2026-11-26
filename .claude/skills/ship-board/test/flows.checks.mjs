// Run: node test/harness.mjs lane-data-views decisions map --viewport=1280x900,390x844 --script=test/flows.checks.mjs
export default async function ({ page, hash }) {
  const failures = [];
  const expect = (ok, msg) => { if (!ok) failures.push(msg); };
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  if (hash === "decisions") {
    const r = await page.evaluate(() => ({
      flowCards: document.querySelectorAll('#dec-list .lb-card[data-id*="-flow-"]').length,
      link: document.querySelector('#dec-list [data-lane="data-views"] [data-flows-link]')?.textContent,
      count: document.getElementById("dec-count").textContent,
    }));
    expect(r.flowCards === 0, "flows are not drawn as decision cards: " + r.flowCards);
    expect(r.link === "1 review flow to walk on its lane page →", "the lane's group links to its flows: " + r.link);
    return { failures };
  }
  if (hash === "map") {
    const chip = await page.evaluate(() => document.querySelector('#map a.row[data-lane="data-views"] [data-flows]')?.textContent ?? document.querySelector('#map [data-flows]')?.textContent);
    expect(chip === "1 flow to walk", "the map shows flows to walk apart from decisions: " + chip);
    return { failures };
  }

  const read = () => page.evaluate(() => ({
    order: [...document.querySelectorAll("#lane-view [data-section]")].map((e) => e.dataset.section),
    tiles: [...document.querySelectorAll("#lane-view .rf-tile")].map((t) => t.textContent + ":" + t.dataset.state),
    open: [...document.querySelectorAll("#lane-view details.rf[open]")].map((d) => d.id),
    preview: document.querySelector("#lane-view a.rf-open")?.getAttribute("href"),
    links: [...document.querySelectorAll("#rf-4 .rf-paths a, #rf-3 .rf-paths a")].map((a) => a.getAttribute("href")),
    steps: [...document.querySelectorAll("#rf-3 .rf-sn")].map((x) => x.textContent),
    marks: [...document.querySelectorAll("#rf-3 .rf-am")].map((x) => x.textContent),
    updates: window.__updates.length,
  }));
  const before = await read();
  expect(before.order[1] === "flows", "review flows sit right under the header: " + before.order);
  expect(eq(before.tiles, ["F1:works", "F3:open", "F8:wrong"]), "tiles are numbered and carry each answer: " + before.tiles);
  expect(before.preview === "https://tri-pros-website-git-feat-data-views-tri-pros.vercel.app/", "the preview button opens the branch's deploy: " + before.preview);

  await page.locator('#lane-view .lb-chips [data-flow]').click();
  await page.waitForTimeout(400);
  const opened = await read();
  expect(eq(opened.open, ["rf-3"]), "the header's flows chip opens the first flow to walk: " + opened.open);
  expect(eq(opened.links, ["https://tri-pros-website-git-feat-data-views-tri-pros.vercel.app/dashboard/customers"]), "a flow's page opens on the preview: " + opened.links);
  expect(eq(opened.steps, ["F3.1", "F3.2", "F3.3", "F3.4", "F3.5", "F3.6"]), "steps are named F<n>.<step>: " + opened.steps);
  expect(eq(opened.marks, ["✓", "✓", "✓", "you", "you", "you"]), "each step shows what the agent saw, owner-only steps marked: " + opened.marks);

  await page.locator('#rf-3 [data-answer="Not right"]').click();
  await page.waitForTimeout(300);
  const refused = await read();
  expect(refused.updates === before.updates, "Not right with no note writes nothing");
  expect(await page.evaluate(() => document.activeElement?.name === "note"), "Not right with no note puts the cursor in the note");

  await page.locator('#rf-3 [name="note"]').fill("F3.2: the table jumped to page 1");
  await page.locator('#rf-3 [data-answer="Not right"]').click();
  await page.waitForTimeout(500);
  const saved = await page.evaluate(() => window.__updates.at(-1));
  expect(saved && saved.path === "decisions/data-views-flow-f3" && saved.patch.answer === "Not right" && saved.patch.note === "F3.2: the table jumped to page 1" && saved.patch.appliedOn === null,
    "Not right with a note saves the answer, the note and clears applied: " + JSON.stringify(saved));
  const after = await read();
  expect(eq(after.tiles, ["F1:works", "F3:wrong", "F8:wrong"]), "the tile turns to Not right: " + after.tiles);
  expect(!after.open.includes("rf-3"), "an answered flow folds away: " + after.open);
  return { failures };
}
