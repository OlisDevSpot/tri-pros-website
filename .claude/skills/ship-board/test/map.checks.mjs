import { join } from "node:path";

// The Map tab, measured from the DOM. Run with and without --deny=github / --approval=github; the harness compares
// the blocks themselves with test/baseline/map-blocks.json on every run.
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const settle = (page, ms = 250) => page.waitForTimeout(ms);
const NO_ISSUE = ["drain", "r19", "scene-lab", "foundation", "long-names"];

const smallTargets = (page) => page.evaluate(() => [...document.querySelectorAll("#v-map a, #v-map button, #v-map summary")]
  .filter((e) => e.offsetParent !== null)
  .map((e) => { const r = e.getBoundingClientRect(); return { what: (e.textContent || e.getAttribute("aria-label") || e.tagName).trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) }; })
  .filter((t) => t.w < 32 || t.h < 32));

export default async function ({ page, hash, viewport, scheme, opt, skillDir }) {
  const failures = [];
  const expect = (ok, msg) => { if (!ok) failures.push(msg); };
  if (hash !== "map") return { failures };
  const [width, height] = viewport.split("x").map(Number);
  const denied = opt.deny.github, asking = opt.approval.includes("github");

  const tabs = await page.evaluate(() => [...document.querySelectorAll("#tabs a")].map((a) => a.firstChild.textContent.trim()));
  expect(eq(tabs, ["Map", "Merge", "Flow", "Skills", "Setup", "Decisions", "Reference"]), "Now became Map and the other tabs stayed: " + JSON.stringify(tabs));

  const line = await page.evaluate(() => { const e = document.getElementById("status-line"); return { text: e.textContent, shown: getComputedStyle(e).display !== "none" }; });
  expect(line.text === "epic map · 15 lanes in flight", "status line counts lanes not shipped or parked: " + line.text);
  expect(line.shown === width > 600, "status line is hidden on the phone only (shown " + line.shown + " at " + width + ")");

  const noIssue = await page.evaluate(() => [...document.querySelectorAll("#map a.row[data-lane]")].filter((a) => a.querySelector("[data-noissue]")).map((a) => a.dataset.lane));
  expect(eq(noIssue.sort(), [...NO_ISSUE].sort()), "rows with no issue are marked no issue yet: " + JSON.stringify(noIssue));
  const noIssueBlock = await page.evaluate((ids) => ids.map((id) => document.querySelector(`#map a.row[data-lane="${id}"]`)?.closest("[data-block]")?.dataset.block), NO_ISSUE);
  expect(noIssueBlock.every((b) => b === "standalone"), "rows with no issue sit under Standalone plans: " + JSON.stringify(noIssueBlock));

  const notice = await page.evaluate(() => document.getElementById("gh-live").textContent);
  const watches = await page.evaluate(() => window.__mcpWatches);
  // Three issue lists and Vercel's deployments; one sub-issue list per epic row (4) once GitHub names the epics.
  const want = denied || asking ? 4 : 8;
  expect(watches === want, "the map holds " + want + " watches: " + watches);

  if (denied || asking) {
    const counts = await page.evaluate(() => Object.fromEntries(["standalone", "bugs", "backlog"].map((k) => [k, document.querySelector(`#map [data-block="${k}"] [data-count]`)?.textContent])));
    expect(eq(counts, { standalone: "—", bugs: "—", backlog: "—" }), "counts that need GitHub read — while it is missing: " + JSON.stringify(counts));
    expect(!(await page.evaluate(() => document.querySelector("#map .mb-epic"))), "no epic block is guessed without GitHub");
    expect(!/live/.test(notice) && /GitHub/.test(notice), "GitHub's own notice names what is missing: " + notice);
  }
  if (denied) {
    expect(notice.includes("isn't allowed to read GitHub"), "a declined connector says so: " + notice);
    expect(!(await page.evaluate(() => [...document.querySelectorAll("#gh-live button")].length)), "a denial offers no approval button");
    expect(/Live from Vercel/.test(await page.evaluate(() => document.getElementById("live").textContent)), "Vercel's notice is its own and still live");
  }
  if (asking) {
    const buttons = await page.evaluate(() => [...document.querySelectorAll("#gh-live button")].map((b) => b.textContent));
    expect(eq(buttons, ["Allow GitHub"]), "awaiting approval shows one button: " + JSON.stringify(buttons));
    if (width === 1280 && scheme === "light") await page.screenshot({ path: join(skillDir, "test", "shots", `map-approval-${viewport}-${scheme}.png`) });
    await page.locator("#gh-live button").click();
    await settle(page, 500);
    const after = await page.evaluate(() => ({ epics: [...document.querySelectorAll("#map .mb-epic")].map((e) => e.dataset.block), notice: document.getElementById("gh-live").textContent, standalone: document.querySelector('#map [data-block="standalone"] [data-count]')?.textContent }));
    expect(eq(after.epics, ["epic-315", "epic-305", "epic-302", "epic-313"]) && after.standalone === "9" && /live/.test(after.notice), "after Allow, one call and the refetch fill the map: " + JSON.stringify(after));
    const w = await page.evaluate(() => window.__mcpWatches);
    expect(w === 8, "after Allow the epics' sub-issue watches join: " + w);
  }
  if (!denied && !asking) {
    expect(/^GitHub: live/.test(notice), "GitHub reads as live: " + notice);
    const heads = await page.evaluate(() => [...document.querySelectorAll("#map .mb-epic .mb-head")].map((h) => ({
      name: h.querySelector("h2").textContent,
      href: h.querySelector("a.mb-name")?.getAttribute("href"),
      dot: h.querySelector("a.mb-name .sdot")?.className.replace("sdot ", ""),
      chips: [...h.querySelectorAll(".chip")].filter((c) => !c.closest(".mb-state")).map((c) => c.textContent),
      state: [...h.querySelectorAll(".mb-state .chip")].map((c) => c.textContent),
      progress: h.querySelector(".mb-prog").textContent,
      overview: h.querySelector("a.mb-over")?.getAttribute("href"),
      under: h.nextElementSibling?.classList.contains("mb-lines") ? [...h.nextElementSibling.children].map((x) => x.textContent) : [],
    })));
    expect(eq(heads[0], { name: "Dev cycle — Parallel Ship", href: "#lane-issue-315", dot: "agent", chips: ["#315 epic", "infrastructure"], state: ["Build", "agent", "no session"], progress: "1/6 plans", overview: "#lane-issue-315",
      under: ["Next: Epic lane: plans stack on this branch; the board UI and the sync skill are next."] }), "the dev cycle header carries its own lane's state, stage, move and session, and its Next under it: " + JSON.stringify(heads[0]));
    expect(heads[1] && heads[1].dot === "blocked" && eq(heads[1].state.slice(0, 2), ["Self-review", "blocked"]) && heads[1].under.length === 2 && /^waits on /.test(heads[1].under[0]) && /^Next: Agent first fixes/.test(heads[1].under[1]),
      "an epic that waits on a lane says so under its header, then its Next: " + JSON.stringify(heads[1]));
    expect(heads[3] && heads[3].progress === "no plans yet", "an epic with no sub-issues says no plans yet: " + JSON.stringify(heads[3]));
    const doubled = await page.evaluate(() => [...document.querySelectorAll("#map .mb-epic")].filter((b) => { const id = b.querySelector("a.mb-name").getAttribute("href").slice(6); return b.querySelector(`a.row[data-lane="${id}"]`); }).map((b) => b.dataset.block));
    expect(!doubled.length, "no epic block holds a row for its own epic: " + JSON.stringify(doubled));
    if (width >= 1000) {
      const spread = await page.evaluate(() => [...document.querySelectorAll("#map .mb-epic .mb-head")].map((h) => { const ys = [...h.querySelectorAll(".chev, h2, .chip, .mb-prog, a.mb-over")].map((c) => { const r = c.getBoundingClientRect(); return r.top + r.height / 2; }); return Math.round(Math.max(...ys) - Math.min(...ys)); }));
      expect(spread.every((d) => d <= 4), "on a wide screen every epic header is one line (centre spread per header " + JSON.stringify(spread) + " px)");
    }

    if (width <= 600) {
      const first = await page.evaluate(() => { scrollTo(0, 0); return document.querySelector("#map .mb-epic .mb-head").getBoundingClientRect().bottom; });
      expect(first <= height, "the first epic header is inside the phone's first screen (bottom " + Math.round(first) + " of " + height + ")");
      const hidden = await page.evaluate(() => [...document.querySelectorAll("#map .mb-area, #map a.mb-over")].every((e) => getComputedStyle(e).display === "none"));
      expect(hidden, "area labels and Overview hide on the phone");
    }

    // Fold: the header keeps one state dot per plan lane; the epic's own state is in its header already.
    await page.locator('#map [data-block="epic-315"] button.chev').click();
    await settle(page, 100);
    const folded = await page.evaluate(() => { const b = document.querySelector('#map [data-block="epic-315"]'); return { rows: b.querySelectorAll("a.row").length, dots: [...b.querySelectorAll(".mb-dots .sdot")].map((d) => d.className.replace("sdot ", "")), expanded: b.querySelector("button.chev").getAttribute("aria-expanded") }; });
    expect(eq(folded, { rows: 0, dots: ["blocked", "blocked"], expanded: "false" }), "a folded epic shows a dot per plan lane and no rows: " + JSON.stringify(folded));
    await page.locator('#map [data-block="epic-315"] button.chev').click();
    await settle(page, 100);

    // Backlog: folded, epics first, Start on issue shows a command and writes nothing.
    const closed = await page.evaluate(() => !document.querySelector('#map details[data-block="backlog"]').open);
    expect(closed, "the backlog starts folded");
    await page.locator('#map details[data-block="backlog"] > summary').click();
    await settle(page, 100);
    const bl = await page.evaluate(() => [...document.querySelectorAll("#map .bl-row")].map((r) => Number(r.dataset.issue)));
    expect(eq(bl.slice(0, 8), [336, 265, 222, 256, 248, 240, 233, 3]) && bl.length === 29, "backlog lists open issues with no row, epics first: " + JSON.stringify(bl.slice(0, 10)) + " … " + bl.length);
    const xss = await page.evaluate(() => ({ text: document.querySelector('#map .bl-row[data-issue="901"] .bl-title')?.textContent, imgs: document.querySelectorAll("#map img").length, ran: window.__ghXss === 1 }));
    expect(xss.text?.includes('<img src=x onerror="window.__ghXss=1">') && xss.imgs === 0 && !xss.ran, "a GitHub title is text, never markup: " + JSON.stringify(xss));
    const links = await page.evaluate(() => [...document.querySelectorAll("#map a[target=_blank]")].map((a) => a.href).filter((h) => !/^https:\/\/github\.com\//.test(h)));
    expect(!links.length, "links out of the map go to https github.com only: " + JSON.stringify(links));
    const n0 = (await page.evaluate(() => window.__updates.length));
    await page.locator('#map .bl-row[data-issue="336"] > button').click();
    await settle(page, 100);
    const cmd = await page.evaluate(() => document.querySelector('#map .bl-row[data-issue="336"] .bl-cmd code')?.textContent);
    expect(cmd === "git fetch -q origin && git worktree add -b chore/336-move-live-work-onto-github-issues .worktrees/336-move-live-work-onto-github-issues origin/main && (xargs -a .worktreeinclude -I{} cp --parents {} .worktrees/336-move-live-work-onto-github-issues/ || true) && cd .worktrees/336-move-live-work-onto-github-issues && pnpm install --frozen-lockfile && claude", "Start on issue shows the one-line command: " + cmd);
    expect((await page.evaluate(() => window.__updates.length)) === n0, "Start on issue writes no row");
    if (width === 1280 || width === 390) await page.locator('#map details[data-block="backlog"]').screenshot({ path: join(skillDir, "test", "shots", `map-backlog-${viewport}-${scheme}.png`) });

    // Board: decisions with no lane get one row that opens the Decisions tab.
    const board = await page.evaluate(() => {
      const keep = S.decisions;
      S.decisions = [...keep, { id: "tmp-board", question: "A board-wide question", options: [] }];
      renderMap();
      const b = document.querySelector('#map [data-block="board"]');
      const res = { first: document.querySelector("#map [data-block]") === b, count: b?.querySelector("[data-count]")?.textContent, href: b?.querySelector("a")?.getAttribute("href"), h: Math.round(b?.querySelector("a")?.getBoundingClientRect().height || 0) };
      S.decisions = keep;
      renderMap();
      return res;
    });
    expect(board.first && board.count === "1" && board.href === "#decisions" && board.h >= 32, "an open board-wide decision shows Board · 1 waiting on you first, linking to Decisions: " + JSON.stringify(board));
  }

  const small = await smallTargets(page);
  expect(!small.length, "every tap target on the map is 32 px or more: " + JSON.stringify(small.slice(0, 6)));
  return { failures };
}
