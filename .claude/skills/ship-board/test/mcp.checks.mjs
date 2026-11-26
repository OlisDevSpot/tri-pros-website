// Checks the harness's fake connector itself: it answers by (server, tool, input), and --deny / --approval
// shape what a watch and a call get. Run it with and without those flags.
const ISSUE = { method: "get", owner: "OlisDevSpot", repo: "tri-pros-website", issue_number: 327 };
const DEPLOYS = { projectId: "prj_TgWp6nu2nibQnDxQOWNpCJ4i2Kxx", teamId: "team_jzIVLz9O56V8f1agRDUZPnLT", limit: 60 };

export default async function ({ page, opt }) {
  const failures = [];
  const expect = (ok, msg) => { if (!ok) failures.push(msg); };
  const denied = (key) => opt.deny[key];

  const r = await page.evaluate(async ({ ISSUE, DEPLOYS }) => {
    const mcp = await window.claude.use("mcp");
    const watch = (server, tool, input) => new Promise((done) => {
      const events = [];
      const stop = mcp.watchTool(server, tool, input, (ev) => events.push(ev.type === "data" ? { data: ev.result.payload } : { error: ev.error.code }));
      setTimeout(() => { stop(); done(events); }, 150);
    });
    const call = (server, tool, input) => mcp.callTool(server, tool, input).then((res) => ({ data: res.payload }), (e) => ({ error: e.code }));
    const out = {};
    out.ghWatch = await watch("github", "issue_read", ISSUE);
    out.vcWatch = await watch("Vercel", "list_deployments", { limit: 60, teamId: DEPLOYS.teamId, projectId: DEPLOYS.projectId });
    out.ghCall = await call("github", "issue_read", ISSUE);
    // After an allowed call, the same watch's next refetch delivers.
    const later = [];
    const stop = mcp.watchTool("github", "issue_read", ISSUE, (ev) => later.push(ev.type === "data" ? "data" : ev.error.code));
    await new Promise((r) => setTimeout(r, 120));
    window.__mcpTick("github");
    await new Promise((r) => setTimeout(r, 30));
    stop();
    out.ghLater = later;
    out.missesBefore = window.__mcpMisses.length;
    out.unknownInput = await call("github", "issue_read", { ...ISSUE, issue_number: 1 });
    out.unknownServer = await call("Linear", "list_issues", {});
    out.misses = window.__mcpMisses.splice(out.missesBefore).map((m) => m.server + " " + m.tool);
    return out;
  }, { ISSUE, DEPLOYS });

  const gh = denied("github"), vc = denied("vercel"), ask = opt.approval.includes("github");
  if (gh) {
    expect(r.ghWatch.length === 1 && r.ghWatch[0].error === gh, "--deny=github: the GitHub watch gets " + gh + " " + JSON.stringify(r.ghWatch));
    expect(r.ghCall.error === gh, "--deny=github: a GitHub call rejects " + gh + " " + JSON.stringify(r.ghCall));
  } else if (ask) {
    expect(r.ghWatch.length === 1 && r.ghWatch[0].error === "approval_required", "--approval=github: a watch cannot ask, so it gets approval_required " + JSON.stringify(r.ghWatch));
    expect(r.ghCall.data?.issue?.number === 327, "--approval=github: the page's own call is allowed and answers " + JSON.stringify(r.ghCall).slice(0, 120));
    expect(r.ghLater.length >= 2 && r.ghLater.every((x) => x === "data"), "after the allow, the watch's next refetch delivers " + JSON.stringify(r.ghLater));
  } else {
    expect(r.ghWatch.length === 1 && r.ghWatch[0].data?.issue?.number === 327, "the GitHub watch answers from fixtures/mcp/github.json " + JSON.stringify(r.ghWatch).slice(0, 160));
    expect(r.ghCall.data?.issue?.title?.startsWith("chore(ship-board): one shared rule set"), "callTool answers the same fixture " + JSON.stringify(r.ghCall).slice(0, 160));
  }
  if (vc) expect(r.vcWatch.length === 1 && r.vcWatch[0].error === vc, "--deny=vercel: the Vercel watch gets " + vc + " " + JSON.stringify(r.vcWatch));
  else expect(r.vcWatch.length === 1 && r.vcWatch[0].data?.result?.deployments?.deployments?.length === 3, "input key order does not matter to a match " + JSON.stringify(r.vcWatch).slice(0, 160));
  expect(r.unknownServer.error === "server_not_connected", "a server with no fixture file is not connected " + JSON.stringify(r.unknownServer));
  if (!gh) expect(r.unknownInput.error === "tool_error" && r.misses.includes("github issue_read"), "an input with no fixture rejects tool_error and is recorded as a miss " + JSON.stringify(r));

  // The page itself: a denied Vercel clears the live line to the connector's notice.
  const live = await page.evaluate(() => document.getElementById("live")?.textContent || "");
  if (vc) expect(!/Live from Vercel/.test(live) && /Vercel/.test(live), "--deny=vercel: the page shows Vercel's notice, not live data: " + live);
  else expect(/Live from Vercel/.test(live), "the page reads Vercel from the fixture: " + live);
  return { failures };
}
