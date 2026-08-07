# Cloudflare Worker + Wrangler — Operational Reality Report

> **Scope:** Costing and operationalizing an already-decided design: ONE Cloudflare Worker bound to both R2 buckets, on `media.triprosremodeling.com`, path-routing `/projects/*` (public passthrough) and `/proposals/*` (HMAC-gated), edge-caching via the Cache API. The design itself is settled — this report answers *how you actually run it day-to-day, what it costs, and how to cut over without downtime.*
>
> **Sourcing:** Every price/limit/command below is cited to current Cloudflare docs pulled via context7 on 2026-08-06. Prices and limits **may change — verify at deploy time** at the cited URL. Where context7 could not confirm a number, it is flagged **[UNCONFIRMED]** rather than guessed.
>
> **Headline caveat found during research:** Cache hits on a Worker **still bill a request** (they just don't bill CPU). This is the single most important cost fact for an image-delivery Worker and is covered in §3.
>
> **⚠️ Repo-reality correction (verified 2026-08-06, post-report):** The research prompt described the app as "a pnpm workspace with multiple Next.js apps under `nextjs/`." **It is not.** `tri-pros-website` is its **own standalone git repo** with **no `pnpm-workspace.yaml`** and no `workspaces` field in `package.json`; the sibling projects under `nextjs/` are independent repos, not workspace members. Therefore the "sibling `workers/` workspace package" framing below (§1, §4 step 1, §8) is **inaccurate as written**. Two real options instead: **(A)** put the Worker as a nested folder **inside this repo** — `tri-pros-website/workers/media-router/` — with its **own** `package.json` + `node_modules` (not a workspace member; just a subdirectory the signer repo also holds), or **(B)** convert `tri-pros-website` into a small pnpm workspace by adding a `pnpm-workspace.yaml` with `packages: ['.', 'workers/*']`. Option A is the smaller change and keeps the app's install topology untouched; option B is cleaner if you want `pnpm --filter` ergonomics. Either way the Worker lives **in the tri-pros-website repo** (same repo as the signer), not in a workspace that doesn't exist. Read every "workspace package" mention below through this lens.

---

## Orientation — what you're actually adopting

Today `media.triprosremodeling.com` is a **DNS + R2 feature**: the hostname is "connected" directly to the `tpr-portfolio-projects` bucket, no code involved. Adopting a Worker means that hostname stops pointing at R2's public-bucket machinery and instead points at **your code**, which runs on every request at the edge, decides whether to serve, reads from R2 via a binding, and caches. You gain: HMAC gating for private files, shared edge cache, `srcSet` variants for proposals. You take on: a second deploy target (Cloudflare, separate from Vercel), a new CLI (Wrangler), and a shared secret that must stay in lockstep between the Vercel signer and the Worker verifier.

The mental model: **the Worker is a tiny separate backend service.** It lives in your monorepo, is code-reviewed like everything else, but deploys to Cloudflare on its own cadence — not through Vercel.

---

## 1. Day-to-day workflow (Wrangler + Workers)

### Where the Worker lives

⚠️ **See the Repo-reality correction at top** — `tri-pros-website` is a **standalone repo, not a pnpm workspace**. Put the Worker in its **own folder inside this repo**, `workers/media-router/`, with its own `package.json` (depending on `wrangler` + `@cloudflare/workers-types`), its own `tsconfig.json`, and a `wrangler.jsonc`. That isolates the Worker's toolchain (Wrangler, workerd runtime types) from the Next app's dependency/TS config while sharing the same repo, PR flow, and CI. (If you'd rather have `pnpm --filter` ergonomics, promote the repo to a workspace — option B in the correction.)

```
tri-pros-website/           # standalone repo = the Vercel app (the signer)
  src/ …                    # the Next.js app
  package.json              # name: "tri-pros-remodeling" (NO workspaces field)
  workers/
    media-router/
      src/index.ts          # the Worker
      wrangler.jsonc        # config + bindings + routes
      package.json          # devDeps: wrangler, @cloudflare/workers-types
      .dev.vars             # local-only secrets (gitignored)
      tsconfig.json         # workerd types, isolated from the app
```

Wrangler supports **`wrangler.json` / `wrangler.jsonc` or `wrangler.toml`** as of v3.91.0, and Cloudflare **recommends JSON(C) for new projects** because some newer features are JSON-only ([Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)). Use `wrangler.jsonc` so you can comment the config.

Trade-off vs. putting it inside `tri-pros-website`: a sibling `workers/` package is cleaner ownership (independent deploy, independent CI job, no risk of Next's build touching it) at the cost of one more workspace entry. Given this Worker deploys to a *different platform* than the app, the separate package is the right call.

### The `wrangler.jsonc` (two R2 bindings + custom-domain route)

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "media-router",
  "main": "src/index.ts",
  "compatibility_date": "2026-08-01",
  "compatibility_flags": ["nodejs_compat"], // for node:buffer in the HMAC example

  "r2_buckets": [
    { "binding": "PORTFOLIO", "bucket_name": "tpr-portfolio-projects" },
    { "binding": "HOMEOWNER", "bucket_name": "tpr-homeowner-files" }
  ],

  // Custom domain: the Worker becomes the origin for this hostname and
  // Cloudflare manages the DNS record automatically.
  "routes": [
    { "pattern": "media.triprosremodeling.com", "custom_domain": true }
  ]
}
```

R2 binding shape and the `custom_domain` route are both from current docs ([R2 bucket binding](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/), [Custom Domains config](https://developers.cloudflare.com/workers/configuration/routing/custom-domains)). `custom_domain: true` means "Worker is the origin, DNS is managed automatically" ([Workers best practices — routing](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)).

### The inner dev loop: `wrangler dev`

`wrangler dev` runs your Worker locally on **workerd** (the real Workers runtime, via Miniflare) with hot reload. The critical axis is **local vs. remote bindings**:

- **Local (default):** R2 bindings are simulated on your disk. Fast, offline, but the bucket is empty unless you seed it — your real portfolio/proposal objects aren't there.
- **Remote:** add `"remote": true` to a binding (or run against a `--remote`-flagged env) and that binding talks to the **real R2 bucket** during local dev ([Local development — remote bindings](https://developers.cloudflare.com/workers/local-development/)). This is how you test against actual objects without deploying.

```bash
# from workers/media-router/
pnpm wrangler dev                 # local everything (workerd + local R2 sim)
pnpm wrangler dev --env staging   # load the staging env's bindings/vars
```

`wrangler dev` prints binding connection status on startup, e.g. `Your worker has access to the following bindings: ...[connected]` ([Service bindings — local dev](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)).

**Testing the HMAC sign(app) ↔ verify(Worker) roundtrip locally.** The Web Crypto HMAC-SHA256 code is byte-identical on both sides (Vercel Node runtime and workerd both implement the Web Crypto API — [Web Crypto supported algorithms](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/) lists `HMAC` with `sign`/`verify`). To validate locally:
1. Put the **same** `IMAGE_SIGNING_SECRET` in the Worker's `.dev.vars` and in the app's `.env.local`.
2. Have the app mint a signed URL (its normal `getFullView` path) pointing at `http://localhost:8787/proposals/...`.
3. Hit that URL against `wrangler dev` with a `--remote` HOMEOWNER binding so a real object is served.
4. Confirm 200 on valid sig, 403 zero-bytes on a tampered sig.

Cloudflare's canonical [signing-requests example](https://developers.cloudflare.com/workers/examples/signing-requests/) is exactly this pattern (`crypto.subtle.importKey` → `crypto.subtle.verify`, 403 on `Invalid MAC`), and it explicitly uses `crypto.subtle.verify()` **rather than string-comparing** the MAC to avoid timing attacks — adopt that.

### Coexistence with `pnpm dev` / Vercel

It's a **separate terminal / process.** `pnpm dev` (Next on Vercel's local runtime, port 3000/3001) and `pnpm wrangler dev` (workerd, port 8787) run side by side with no shared process. Friction is low and mostly conceptual: the app generates URLs pointing at `media.triprosremodeling.com` in prod, so for local end-to-end you either point the app at `localhost:8787` via an env var, or just trust the roundtrip test above. There is **no** integration into the Next/Vercel dev server — they don't know about each other.

### Observability

- **`wrangler tail`** livestreams production logs (`console.log`, exceptions, request metadata) from the deployed Worker in real time — this is your primary tool for debugging a 403 or a cache miss in prod ([tail exists for both Workers and Pages deployments](https://developers.cloudflare.com/workers/wrangler/commands/pages/)). Run `pnpm wrangler tail` and reproduce the request.
- Add structured `console.log` at decision points: `console.log({ path, sigValid, cache: hit ? "HIT" : "MISS" })`. For a 403, log *why* (missing param vs. bad MAC vs. expired). For a cache miss, log the normalized cache key you computed so you can confirm two viewers really do collapse to one key.
- The Cloudflare dashboard also shows per-Worker request counts, error rate, and CPU-time distribution.

---

## 2. Deployment

### Deploy mechanics

```bash
pnpm wrangler deploy                 # build + upload + activate on the route
pnpm wrangler deploy --dry-run       # validate config without shipping
```

`wrangler deploy --dry-run` validates configuration before shipping ([pages-to-workers prompt](https://developers.cloudflare.com/workers/prompts/pages-to-workers.txt)). **The very first upload of a new Worker must be `wrangler deploy` (or C3)** — `wrangler versions upload` will fail on the initial upload ([Deployment management — limits](https://developers.cloudflare.com/workers/versions-and-deployments/deployment-management/)).

### Environments (dev / staging / prod)

Define per-environment config under `env` in `wrangler.jsonc` — each env can have its own bindings, vars, and even its own bucket ([Cloudflare environments](https://developers.cloudflare.com/workers/vite-plugin/reference/cloudflare-environments)):

```jsonc
{
  "name": "media-router",
  "compatibility_date": "2026-08-01",
  "r2_buckets": [
    { "binding": "PORTFOLIO", "bucket_name": "tpr-portfolio-projects" },
    { "binding": "HOMEOWNER", "bucket_name": "tpr-homeowner-files" }
  ],
  "env": {
    "staging": {
      "routes": [{ "pattern": "media-staging.triprosremodeling.com", "custom_domain": true }],
      "r2_buckets": [
        { "binding": "PORTFOLIO", "bucket_name": "tpr-portfolio-projects", "remote": true },
        { "binding": "HOMEOWNER", "bucket_name": "tpr-homeowner-files",  "remote": true }
      ]
    },
    "production": {
      "routes": [{ "pattern": "media.triprosremodeling.com", "custom_domain": true }]
    }
  }
}
```

Deploy a specific env: `pnpm wrangler deploy --env staging`. Wrangler names the Worker `media-router-staging` for named envs, so staging and prod are distinct Workers on distinct hostnames.

### Versioned deployments, gradual rollout, instant rollback

- **Upload without activating:** `pnpm wrangler versions upload` (stages a new version, no traffic) ([Deployment management](https://developers.cloudflare.com/workers/versions-and-deployments/deployment-management/)).
- **Gradual rollout:** `pnpm wrangler versions deploy` prompts you to pick a version **and a traffic percentage** — deploying at <100% is a canary/gradual rollout ([same doc: "supports gradual deployments with traffic percentages under 100%"]).
- **List history:** `pnpm wrangler deployments list` shows the 10 most recent deployments ([wrangler deployments list](https://developers.cloudflare.com/workers/wrangler/commands/workers/)).
- **Rollback:** re-run `wrangler versions deploy` and select a prior version at 100% (deployments can be created from the last 100 uploaded versions — [same doc]). This is near-instant because the version is already uploaded.

### Secrets: `IMAGE_SIGNING_SECRET`

Secrets are encrypted and **never live in `wrangler.jsonc`** — vars there are plaintext and version-controlled ([Workers best practices — secrets](https://developers.cloudflare.com/workers/best-practices/workers-best-practices)). The rule: **non-secret config → `vars` in the file; sensitive values → `wrangler secret`.**

```bash
# production secret (prompts for the value, stored encrypted):
pnpm wrangler secret put IMAGE_SIGNING_SECRET

# for a named env:
pnpm wrangler secret put IMAGE_SIGNING_SECRET --env staging

# gradual/versioned secret change (pairs with versioned deploys):
pnpm wrangler versions secret put IMAGE_SIGNING_SECRET
```

`wrangler secret put` deploys immediately; `wrangler versions secret put` stages it for a gradual deployment ([Secrets](https://developers.cloudflare.com/workers/configuration/secrets)). **Local dev** uses a gitignored **`.dev.vars`** (dotenv syntax) in the Worker dir — defining `.dev.vars` makes `.env` be ignored, and it must be in `.gitignore` ([Local dev env vars](https://developers.cloudflare.com/workers/local-development/environment-variables/)).

**Keeping the SAME secret in sync between Vercel (signer) and Worker (verifier).** There is no automatic sync — you set the identical value in **two** places:
- Vercel: `IMAGE_SIGNING_SECRET` in the app's Environment Variables (Production/Preview).
- Worker: `pnpm wrangler secret put IMAGE_SIGNING_SECRET`.

Generate once (`openssl rand -hex 32`), paste into both. **Rotation with an accept-both-versions window** (because signed URLs have ~30-day validity, a hard swap would 403 every already-minted URL):
1. Introduce `IMAGE_SIGNING_SECRET_NEXT` alongside the current secret on **both** sides.
2. **Worker verifier:** accept a signature if it validates under *either* the current *or* the next secret (try both keys). Version-tag the signature (e.g. prefix `v2:`) so you know which to try first.
3. **App signer:** start signing with the new secret only after the Worker is deployed to accept both.
4. After the old window fully expires (~30 days), drop the old secret from both sides.

This is the same "signature versioning" discipline the HMAC example gestures at by embedding metadata in the signed payload — put a key-version byte in the signed string so the verifier can select the right key deterministically.

### CI/CD and split ownership

The Worker **deploys independently of Vercel** — this is the core split-ownership fact. Two options:
- **Manual:** `pnpm wrangler deploy` from a laptop with `wrangler login` done. Fine for a small team and a rarely-changing Worker.
- **GitHub Actions:** a job that runs `pnpm wrangler deploy --env production` on merge to `main`, authenticated with a `CLOUDFLARE_API_TOKEN` repo secret (scoped to Workers Scripts + R2). Path-filter it to `workers/**` so app-only PRs don't redeploy the Worker.

**Split-ownership implications to internalize:**
- The app (Vercel) and the Worker (Cloudflare) have **two dashboards, two deploy logs, two rollback buttons.**
- The **only contract** between them is the shared secret + the URL scheme (`/proposals/<pid>/<fileId>` signed payload shape). Change that shape on one side and you must ship the other in lockstep.
- A Worker deploy does **not** trigger a Vercel deploy and vice-versa. Coordinate the two only when the contract changes.

### Attaching the custom domain + the cutover

`custom_domain: true` makes Cloudflare **provision the DNS record and TLS cert automatically** when the Worker deploys ([Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains)). The wrinkle: `media.triprosremodeling.com` is *already* claimed by the R2 bucket's public-domain binding, and **one hostname can only route to one thing.** See §4 for the exact ordered cutover and §8 for the downtime-avoidance detail.

---

## 3. Cost (specific and honest)

### Workers plans

| | **Free** | **Paid — Standard ($5/mo)** |
|---|---|---|
| Requests | 100,000 **per day** | 10,000,000 **per month** included, then **$0.30 / additional million** |
| CPU time | 10 ms **per invocation** cap; no duration charge | 30,000,000 CPU-ms/mo included, then **$0.02 / additional million CPU-ms**; up to 5 min CPU/invocation |

Source: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) — *(may change — verify at deploy time).*

### The three cost facts that matter for an image Worker

1. **Cache hits still count as billable requests** — but consume **zero CPU time.** Verbatim: *"cache hits count as requests but do not consume CPU time"* ([Workers pricing — caching](https://developers.cloudflare.com/workers/platform/pricing/)) and *"All requests are billed at the standard Workers request rate, regardless of whether the response is a cache hit or miss. CPU time is only billed when the Worker code actually executes, meaning cache hits do not consume CPU time"* ([Workers Cache](https://developers.cloudflare.com/workers/cache)). So edge caching slashes your CPU bill to near-zero but does **not** reduce your request count.
2. **R2 egress is free through the Worker.** R2 has **zero egress fees for all storage classes** ([R2 pricing free tier](https://developers.cloudflare.com/r2/pricing/)). R2→Worker→edge stays in-network and free — confirmed.
3. **R2 Class B (reads) bill only on cache MISS** (a hit never touches R2). Free tier: **10,000,000 Class B ops/month**; **Class A (writes) free tier: 1,000,000/month**; **storage free tier: 10 GB-month** ([R2 pricing — free tier](https://developers.cloudflare.com/r2/pricing/)).
   - Class B rate: the context7 snippet states "$0.00036 per 10,000 operations," **but its own worked example (290M ops → $104.40) implies $0.36 per million** (= $0.0036/10k). ⚠️ **Stale/typo flag:** the per-10k figure and the worked example are internally inconsistent by 10×; the worked example is the reliable anchor, so **treat Class B as ≈ $0.36 per million.** Verify the exact rate at [R2 pricing](https://developers.cloudflare.com/r2/pricing/) at deploy time.
   - **[UNCONFIRMED]** Class A write rate and per-GB storage rate were not returned cleanly by context7 — verify at the same page.

### Worked cost for the proposal/portfolio page

Assumptions: a page shows **~15 images**. With `srcSet`, a browser downloads **one variant per image** (the one matching its DPR/viewport), so realistic image requests ≈ **15 per page view**, not 45. (I compute the 45 worst case too, for honesty — that would only happen if a client fetched every variant.)

**Requests to the Worker = image requests (cache hit or miss both count).**

| Monthly page views (N) | Requests @15/view | Requests @45/view (worst) | vs. Free (100k/day ≈ 3M/mo) |
|---|---|---|---|
| **1,000** | 15,000/mo (~500/day) | 45,000/mo | Free ✅ (nowhere near) |
| **50,000** | 750,000/mo (~25k/day) | 2,250,000/mo (~75k/day) | Free ✅ (under 100k/day even worst-case) |

**R2 Class B ops = cache MISSES only.** With 30-day `immutable` caching and a normalized cache key, hit ratio is high (assume a conservative 90% — first view per edge PoP per variant misses, the rest hit). At N=50,000 × 15 × 10% miss ≈ **75,000 Class B ops/month** — versus **10,000,000 free.** Not close to billable.

**Net at your volume: $0.** Both N=1k and N=50k sit comfortably inside the Workers free tier *and* the R2 free tier. Nothing here forces the $5 plan.

**When cost becomes non-trivial:**
- The **free-tier ceiling is a daily cap (100k requests/day)**, not monthly. You'd breach it around **~6,600 page views/day at 15 img/view** (or ~2,200/day at the 45-variant worst case). Sustained traffic above that pushes you to the **$5/mo Standard** plan — where 10M requests/mo are included, i.e. ~330k/day, with overage at $0.30/million. Even at, say, 300k page views/month (4.5M Worker requests), you're inside the $5 plan's included 10M with effectively no CPU cost (cache hits = 0 CPU). So the practical answer is: **$0 until you outgrow the free daily cap, then a flat $5/mo covers a very large range.**
- R2 Class B only becomes a line item at **tens of millions of cache-miss reads/month**, which requires either enormous traffic or a broken cache (e.g. cache key not normalized, so every viewer misses — see §8).

### Cloudflare Images / `IMAGES` binding alternative (you're keeping sharp — quantifying anyway)

If you did on-the-fly transforms instead of pre-baked sharp variants, you'd add a **per-transformation** cost on top of Workers+R2. **[UNCONFIRMED via context7]** — I did not retrieve current Cloudflare Images pricing from the docs in this session, so I won't quote a number. Directionally: Images bills per *unique transformation delivered* (and/or stored images), which for 15 images × 3 variants × many first-views is a recurring per-image charge that **pre-baked sharp avoids entirely** (your variants are just static R2 objects served free through the Worker). Keeping sharp is the cheaper path at your scale; verify Images pricing at [Cloudflare Images pricing](https://developers.cloudflare.com/images/pricing/) only if you ever reconsider.

---

## 4. Exact ordered setup steps (end to end)

```bash
# 0. One-time auth (opens browser; do once per machine)
pnpm dlx wrangler login

# 1. Scaffold the Worker INSIDE the tri-pros-website repo (see Repo-reality
#    correction at top — this is NOT a pnpm workspace).
#    Option A (smaller change): a self-contained nested folder with its own install.
mkdir -p workers/media-router/src
cd workers/media-router
pnpm init
pnpm add -D wrangler @cloudflare/workers-types
#    Option B (if you want pnpm --filter): add a pnpm-workspace.yaml at the repo
#    root with  packages: ['.', 'workers/*']  BEFORE running the install above.
```

2. **Write `wrangler.jsonc`** (two R2 bindings + prod route + staging env) — the config from §1/§2. Point `routes` prod at `media.triprosremodeling.com` and staging at `media-staging.triprosremodeling.com`.

3. **Write `src/index.ts`** — path-router: `/projects/*` public passthrough from `PORTFOLIO`; `/proposals/*` HMAC-verify (`crypto.subtle.importKey`/`verify`) then serve from `HOMEOWNER`; Cache API with a **normalized cache key** (path only, sig stripped). Skeleton in §5.

4. **Set the secret** (same value you'll put in Vercel):

```bash
# generate once
openssl rand -hex 32
pnpm wrangler secret put IMAGE_SIGNING_SECRET            # prod
pnpm wrangler secret put IMAGE_SIGNING_SECRET --env staging
# local:
echo 'IMAGE_SIGNING_SECRET="<same-hex>"' > .dev.vars     # gitignored
```
Also add the identical value to the Vercel app's env (`IMAGE_SIGNING_SECRET`).

5. **Validate + deploy staging first** (does NOT touch the live domain):

```bash
pnpm wrangler deploy --dry-run
pnpm wrangler deploy --env staging
```
`media-staging.triprosremodeling.com` gets an auto-provisioned DNS record + cert. Test `/projects/*` and signed `/proposals/*` against it (real R2 via the staging `remote` bindings).

6. **The domain cutover** — move `media.triprosremodeling.com` off the R2 bucket's direct binding onto the Worker. Because a hostname can route to only one target, remove the R2 custom domain, then attach the Worker route:

```bash
# remove the R2 public custom domain (needs the zone id)
pnpm wrangler r2 bucket domain remove tpr-portfolio-projects \
  --domain media.triprosremodeling.com

# deploy prod — custom_domain:true re-creates the DNS/cert pointing at the Worker
pnpm wrangler deploy --env production
```
`r2 bucket domain remove` / `add` are current commands ([R2 domain commands](https://developers.cloudflare.com/r2/buckets/public-buckets/)). Do this in a low-traffic window; see §8 for making the gap effectively zero.

7. **Verify** post-cutover:

```bash
# public passthrough still works (existing /projects URLs must not break):
curl -I https://media.triprosremodeling.com/projects/<id>/<phase>/<uuid>.webp
# gated: valid signature → 200
curl -I "https://media.triprosremodeling.com/proposals/<pid>/<fileId>-md.webp?sig=<valid>"
# gated: tampered signature → 403, zero bytes
curl -I "https://media.triprosremodeling.com/proposals/<pid>/<fileId>-md.webp?sig=deadbeef"
pnpm wrangler tail   # watch the above live
```

---

## 5. Single image-request lifecycle (hop-by-hop)

Worker skeleton (illustrative — combines the R2 GET pattern, HMAC verify, and Cache API, all from cited examples):

```ts
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const cache = caches.default;

    // Normalize cache key to the OBJECT PATH only (sig/token excluded) so every
    // viewer shares one cached copy per variant.
    const cacheKey = new Request(new URL(url.pathname, url.origin).toString(), { method: "GET" });

    // 1. Edge cache lookup
    const cached = await cache.match(cacheKey);
    if (cached) return cached;                          // (a) CACHE HIT

    // 2. Route
    if (url.pathname.startsWith("/proposals/")) {
      const ok = await verifyHmac(url, env.IMAGE_SIGNING_SECRET); // crypto.subtle.verify
      if (!ok) return new Response(null, { status: 403 });        // (c) zero bytes, zero R2 read
      const obj = await env.HOMEOWNER.get(url.pathname.slice(1));  // (b) R2 read on miss
      if (!obj) return new Response("Not Found", { status: 404 });
      const headers = new Headers();
      obj.writeHttpMetadata(headers);                   // Content-Type from R2 metadata
      headers.set("etag", obj.httpEtag);
      headers.set("Cache-Control", "public, max-age=2592000, immutable");
      const res = new Response(obj.body, { headers });
      ctx.waitUntil(cache.put(cacheKey, res.clone()));  // populate edge cache
      return res;
    }

    if (url.pathname.startsWith("/projects/")) {        // (d) PUBLIC PASSTHROUGH
      const obj = await env.PORTFOLIO.get(url.pathname.slice(1));
      if (!obj) return new Response("Not Found", { status: 404 });
      const headers = new Headers();
      obj.writeHttpMetadata(headers);
      headers.set("etag", obj.httpEtag);
      headers.set("Cache-Control", "public, max-age=2592000, immutable");
      const res = new Response(obj.body, { headers });
      ctx.waitUntil(cache.put(cacheKey, res.clone()));
      return res;
    }
    return new Response("Not Found", { status: 404 });
  },
};
```

- `caches.default` + `cache.match` / `cache.put` are the documented Cache API ([Cache runtime API](https://developers.cloudflare.com/workers/runtime-apis/cache)). Building a synthetic `Request` as the key to strip query params is the documented normalization pattern ([cache-post-request example](https://developers.cloudflare.com/workers/examples/cache-post-request/), [cache keys](https://developers.cloudflare.com/workers/cache/cache-keys/)). **Note:** `cf.cacheKey` on `fetch()` is Enterprise-only, but the **Cache API (`caches.default`) is available on all plans** and lets you pass any Request as the key ([cache-using-fetch](https://developers.cloudflare.com/workers/examples/cache-using-fetch/)) — so use the Cache API, not `cf.cacheKey`.
- `obj.writeHttpMetadata(headers)` + `obj.httpEtag` is the documented way to echo `Content-Type`/`ETag` from R2 ([R2 Workers API usage](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/)).

**The four traces:**
- **(a) Cache hit:** browser → nearest CF PoP → `cache.match` returns the stored Response → served. **Worker still bills 1 request, 0 CPU-of-note, 0 R2 op.** Fastest path.
- **(b) Cache miss:** browser → PoP → `cache.match` null → (proposals) HMAC verify passes → `env.HOMEOWNER.get(path)` = **1 R2 Class B op** → response built with `Cache-Control: immutable` → `ctx.waitUntil(cache.put(...))` stores it for next time → served. Bills 1 request + 1 Class B.
- **(c) Invalid/expired signature:** browser → PoP → cache miss → `verifyHmac` false → **`403` with `null` body, before any `.get()`.** Zero R2 read, zero bytes out. `crypto.subtle.verify` (not string compare) guards against timing attacks ([signing-requests](https://developers.cloudflare.com/workers/examples/signing-requests/)).
- **(d) Public `/projects/*` passthrough:** same as (b) minus the HMAC step — straight to `PORTFOLIO.get` and cache. Existing portfolio URLs behave exactly as before, now with edge caching in front.

**HTTP Range (video):** R2's `.get(key, { range: request.headers })` honors the `Range` header and returns a partial object; you then respond `206 Partial Content` with `Content-Range` ([R2 GET supports range requests](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/), [S3 GetObject Range](https://developers.cloudflare.com/r2/api/s3/api/)). **Caveat for the Cache API:** `cache.put` **throws on a `206` response** ([cache.put](https://developers.cloudflare.com/workers/runtime-apis/cache)). So for range/video requests, **do not `cache.put`** the partial — detect a `Range` header and skip caching (serve the 206 straight from R2). Call recordings stay on presigned URLs and are out of the Worker's scope, but if you ever route audio/video through the Worker, handle Range this way.

---

## 6. Full asset lifecycle (proposal image, end to end)

1. **Upload:** browser does a presigned `PUT` directly into `tpr-homeowner-files` (unchanged from today) → `proposals/<pid>/<fileId>.ext`.
2. **sharp optimize:** your pipeline generates `-sm/-md/-lg.webp` siblings + a base64 blur placeholder, stored next to the original. These are **plain R2 objects** — the Worker serves them as-is (no transform cost).
3. **`getFullView` mints signed URLs:** at the tRPC choke point (already gated by `proposals.token`), the server signs a payload over the **object prefix** `proposals/<pid>/<fileId>` (covering all three variants) with `IMAGE_SIGNING_SECRET`, using a **quantized ~30-day expiry** — the expiry is rounded to a window boundary so the *same* URL is emitted for ~30 days → stable → edge-cacheable.
4. **Browser builds `srcSet`:** the client assembles `…-sm.webp 480w, …-md.webp 960w, …-lg.webp 1440w`, each carrying the signature, and requests the **one** variant its viewport needs.
5. **Worker verifies + serves + caches:** §5 (b)/(c). Because the **cache key is the object path only** (sig excluded), the first viewer of a variant populates the cache and **all subsequent viewers share that one cached copy** — even though their signed URLs differ. This is what makes the private path as cheap as the public one.
6. **Revocation = secret rotation:** rotating `IMAGE_SIGNING_SECRET` invalidates **every** outstanding signature globally on next verify (the accept-both-versions window from §2 avoids nuking valid in-flight URLs during the changeover). There's no per-file revocation — it's an all-or-nothing kill switch, which matches the "capability token" model.
7. **Re-optimization / new variants vs. `immutable`:** `Cache-Control: immutable` tells browsers/edge never to revalidate within `max-age`. So if you **replace** `…-md.webp` in place, cached copies won't pick up the change until TTL expiry. **Rule: treat variants as immutable — never overwrite a key.** If you re-optimize, write to a **new key** (e.g. include a content hash or a `v2` segment) and mint URLs to that key. New key = new cache entry = instant correctness; old key ages out.
8. **Quantized expiry rollover without a thundering herd:** because expiry is quantized to a window, *many* URLs would nominally flip at the same window boundary. Two mitigations: (a) the **cache key is the object path, not the signed URL**, so a window rollover changes the *query string* but **not** the cache key — cached objects keep serving, no mass re-fetch from R2; only the *signature check* re-runs at the edge (cheap, no R2 op on a hit). (b) If you ever key partly on the window, **jitter** the quantization per-object (hash the fileId into the boundary) so rollovers spread out. With the path-only cache key, thundering herd essentially can't happen on the R2 side.

---

## 7. Testing before production

- **`wrangler dev` (local):** workerd + simulated R2. Validates routing, HMAC logic, cache behavior, 403 paths — fully offline. Fast iteration.
- **`wrangler dev --remote` / `remote: true` bindings:** same code against **real R2 objects** without deploying — the honest end-to-end for "does it actually serve my real proposal image."
- **Staging Worker + staging subdomain:** `wrangler deploy --env staging` puts a full copy on `media-staging.triprosremodeling.com` (auto DNS+cert), pointed at real buckets, **without touching the live domain.** Point a preview build of the app (or a manual `curl` with an app-minted signature) at it and confirm: valid→200, tampered→403 zero-bytes, second request→cache hit, `/projects/*`→passthrough. Only after staging is green do you run the §4 cutover.
- **Fit with the team's existing testing (`pnpm tsc` + `pnpm lint`, no unit runner, Playwright + dev-login):**
  - Add `pnpm --filter media-router exec tsc --noEmit` and `wrangler deploy --dry-run` to the Worker package's checks — that's the Worker's equivalent of the app's `tsc`/`lint` gate, and it catches config/type breaks with no runtime.
  - No new test runner required. The "test" for the Worker is the staging roundtrip above, done by hand or scripted with `curl`.
  - Playwright already drives the real app via the dev-login route; once the Worker is on staging, a Playwright flow that opens a proposal and asserts images render (200, correct dimensions) covers the sign→serve path end-to-end without any Workers-specific tooling.

---

## 8. Risks & gotchas

- **Domain cutover downtime window.** `media.triprosremodeling.com` can point at the R2 bucket **or** the Worker, not both — there's a brief gap between `r2 bucket domain remove` and the Worker's `custom_domain` DNS taking effect. To make it **seamless / same-zone:**
  1. Fully validate the Worker on `media-staging.…` first (real buckets).
  2. Do the swap **in the same Cloudflare zone** (both R2 domain and Worker route live in `triprosremodeling.com`) so propagation is internal and near-instant, not a public DNS TTL wait.
  3. Sequence tightly: `r2 bucket domain remove …` immediately followed by `wrangler deploy --env production`. The window is seconds; run it off-peak.
  4. **Rollback plan:** if anything's wrong, `r2 bucket domain add tpr-portfolio-projects --domain media.triprosremodeling.com --zone-id <id>` re-points the hostname straight back at the bucket (portfolio serves again immediately; only the not-yet-live proposal gating is lost).
  5. Because portfolio objects are `immutable`-cached, even a brief origin gap mostly serves from edge cache for existing URLs.
- **Signer/verifier lockstep.** The shared secret and the signed-payload shape are the *entire* contract across two platforms. Guard it: (a) **version the signature** (a leading `v2:`/key-id byte) so rotation and format changes are unambiguous; (b) rotate with the **accept-both** window (§2) because URLs live ~30 days; (c) keep the sign and verify code as a **single shared function** if you can import it into both, or at minimum a shared spec doc + a roundtrip test, so they never drift.
- **Cache-key correctness is load-bearing for cost.** If you forget to normalize and key on the full signed URL, **every viewer misses** (their sigs differ) → every request hits R2 → Class B ops explode and cache does nothing. The path-only synthetic-Request key (§5) is not optional; add a `wrangler tail` log of the computed key and confirm two different signed URLs collapse to one key.
- **`cache.put` throws on `206`.** Any Range/video response must skip caching (§5). Also `cache.put` returns 413 / refuses if `Cache-Control` says don't-cache or the body is too large ([cache.put](https://developers.cloudflare.com/workers/runtime-apis/cache)).
- **Monorepo placement with pnpm.** ⚠️ Per the Repo-reality correction at top, `tri-pros-website` is a **standalone repo, not a pnpm workspace** — there is no `pnpm-workspace.yaml` to add `workers/*` to. Put the Worker in `tri-pros-website/workers/media-router/` with its **own** `package.json`/`wrangler` devDep (option A), or first convert the repo to a workspace (`pnpm-workspace.yaml` → `packages: ['.', 'workers/*']`, option B). Don't hoist Wrangler into the Next app. The Worker's `tsconfig`/types (`@cloudflare/workers-types`) are workerd-flavored and must **not** leak into the Next app's TS config — a separate `tsconfig.json` in the Worker folder handles this regardless of option A vs B.
- **Split ownership (Vercel app ⟷ Cloudflare Worker).** Two deploy targets, two dashboards, two rollback paths, one shared secret. Budget for the mental overhead: a checklist for "changing the URL contract" that says *deploy Worker first (accept-both), then app.* Document where each config lives (secret in Vercel env **and** `wrangler secret`; route in `wrangler.jsonc`; bucket names in `wrangler.jsonc`).
- **First-time-adopter facts worth knowing:** the **first** deploy must be `wrangler deploy` (not `versions upload`); `compatibility_date` should be set and is meaningful (pin it, bump deliberately); `nodejs_compat` is needed if you use `node:buffer` (the HMAC example does — or avoid it with pure `Uint8Array`/base64url and drop the flag); CPU limit config only applies on the deployed network, not local; Cache API contents **don't replicate across PoPs** (each data center caches independently — [caches.default](https://developers.cloudflare.com/workers/runtime-apis/cache)), so your first-view-per-PoP miss rate is per-region, which is why a global audience has a slightly lower aggregate hit ratio than a single-region one (still fine at your volume).

---

## What your day-to-day actually changes

You gain a second, tiny deploy target that you touch rarely. Almost all of your work stays exactly as it is (`pnpm dev`, Vercel, `pnpm tsc`/`lint`, Playwright). When you *do* work on media delivery, you open a separate terminal in `workers/media-router`, run `pnpm wrangler dev` (optionally `--remote` to hit real R2), edit `src/index.ts`, verify the sign→verify→serve→cache roundtrip locally, then `wrangler deploy --env staging` to a staging subdomain, and finally `wrangler deploy` to prod — a flow that lives entirely in Cloudflare and never blocks or waits on a Vercel deploy. The one genuinely new discipline is **keeping the `IMAGE_SIGNING_SECRET` identical in two places** and rotating it with an accept-both window; everything else is ordinary code in your ordinary repo.

## Go / No-Go

**GO — the operational overhead is worth it for a small team.** Confidence: **high (≈85%).**

Rationale: the design solves a real problem (uncached, srcSet-less, presigned proposal images) and the running cost is **$0 at your stated volumes** (1k–50k page views/month sit inside both the Workers and R2 free tiers, with the only ceiling being the 100k-requests/**day** free cap that a flat $5/mo lifts far above your needs). The new surface area is small and bounded: one Worker package, one CLI, one shared secret. The two real risks — the domain cutover gap and signer/verifier drift — are both mitigable to near-zero (same-zone tight-sequenced swap with an instant R2 rollback; signature versioning + accept-both rotation). The residual 15% of doubt is purely the *human* cost of a second deploy platform for a team that has only ever shipped through Vercel; that's a learning-curve tax, not a technical blocker, and it's paid once. If the team wants to de-risk the unknowns before committing, stand up the **staging Worker on `media-staging.…` first** (zero production impact) and run the full roundtrip — that converts most of the remaining uncertainty into evidence before you ever touch the live domain.

---

### Sources (all via context7, Cloudflare official docs, retrieved 2026-08-06 — prices/limits may change; verify at deploy time)
- Workers pricing (Free/Paid, requests, CPU, **cache hits bill requests not CPU**): https://developers.cloudflare.com/workers/platform/pricing/
- Workers Cache API + caching billing: https://developers.cloudflare.com/workers/cache/ · https://developers.cloudflare.com/workers/runtime-apis/cache/ · https://developers.cloudflare.com/workers/cache/cache-keys/
- R2 pricing / free tier / zero egress: https://developers.cloudflare.com/r2/pricing/
- R2 Workers API (get/range/writeHttpMetadata/httpEtag): https://developers.cloudflare.com/r2/api/workers/workers-api-usage/ · https://developers.cloudflare.com/r2/api/s3/api/
- R2 public buckets + custom domain add/remove: https://developers.cloudflare.com/r2/buckets/public-buckets/
- Wrangler configuration (jsonc, bindings, limits): https://developers.cloudflare.com/workers/wrangler/configuration/
- Custom Domains routing: https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- Local development (local vs remote bindings): https://developers.cloudflare.com/workers/local-development/ · env vars/secrets: https://developers.cloudflare.com/workers/local-development/environment-variables/
- Secrets: https://developers.cloudflare.com/workers/configuration/secrets/
- Versions & deployments (upload/deploy/gradual/rollback): https://developers.cloudflare.com/workers/versions-and-deployments/deployment-management/ · https://developers.cloudflare.com/workers/wrangler/commands/workers/
- Web Crypto HMAC-SHA256 + signing-requests example: https://developers.cloudflare.com/workers/runtime-apis/web-crypto/ · https://developers.cloudflare.com/workers/examples/signing-requests/
- Workers best practices (routing, secrets): https://developers.cloudflare.com/workers/best-practices/workers-best-practices/
- **[UNCONFIRMED this session]** R2 Class A write rate & per-GB storage rate; Cloudflare Images pricing — verify at https://developers.cloudflare.com/r2/pricing/ and https://developers.cloudflare.com/images/pricing/
