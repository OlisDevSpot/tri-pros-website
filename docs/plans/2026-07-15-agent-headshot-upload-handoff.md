# Handoff: Agent-settings profile-photo (headshot) upload doesn't work

> Paste-ready brief for the session fixing agent-settings bugs. Investigation already done (2026-07-15, read-only trace) — start from the verification steps, not from scratch.

## Symptom

Uploading a profile photo from agent settings appears to do nothing. Every other agent-settings field saves correctly (confirmed writing to the new Wave-1 columns in Neon). Oliver believes this has never worked.

## What the investigation established (all hops verified in code)

The chain is **complete and structurally correct** — this is NOT dead UI and NOT a missing mutation:

1. `src/features/agent-settings/ui/views/settings-view.tsx:35` renders `<HeadshotUpload profile={...} />`.
2. `src/features/agent-settings/ui/components/headshot-upload.tsx:37-71` — `handleFileChange`: validates type + 5MB cap → `getHeadshotUploadUrl` tRPC mutation → **direct browser `fetch(PUT)` to R2** → `updateProfile.mutateAsync({ headshotUrl: publicUrl })` → invalidate + toast.
3. Presign: `src/trpc/routers/agent-settings.router.ts:49-69` — bucket **`R2_BUCKETS.companyDocs`** (`tpr-company-docs`), key `agent-headshots/{userId}/{ts}-{filename}`.
4. Persist: `src/shared/entities/users/dal/server/mutations.ts:36-48` — `headshotUrl` is in the allowed patch pick; column exists (`src/shared/db/schema/auth.ts:41`).

**Why only this field fails while the rest of settings saves:** the headshot is the ONLY settings field whose save depends on a browser→R2 direct PUT. The two known-working upload flows use the identical PUT pattern but DIFFERENT buckets — portfolio → `portfolioProjects` (`src/shared/hooks/use-media-upload.ts:35-39`), intake mp3 → `homeownerFiles` (`src/features/intake/ui/components/mp3-upload-field.tsx:41`). R2 CORS + public-read are configured **per bucket in the Cloudflare dashboard**, not in the repo.

The error is invisible because of a bare `catch { toast.error('Failed to upload headshot') }` at `headshot-upload.tsx:62-64` — CORS failures, presign failures, and mutation failures all collapse into the same generic toast.

## Ranked root-cause candidates

1. **`tpr-company-docs` bucket has no CORS policy allowing browser PUT from the app origin** (most likely). Verify: attempt an upload with DevTools Network open — look for a failed `PUT` to `*.r2.cloudflarestorage.com` with a CORS error. If `user.headshot_url` stays NULL after attempts, this is it.
2. **Public access (r2.dev) not enabled on `tpr-company-docs`**, or R2 creds unset in the deploy env. If `headshot_url` IS populated but the avatar 404s, it's public-read. If presign itself throws `NotConfiguredError`, it's creds (`src/shared/services/providers/r2/lib/config.ts`).
3. **Compounding display bug (real regardless of #1/#2):** the global sidebar/user-menu avatars read `user.image` only — `src/features/agent-dashboard/ui/components/sidebar-user-button.tsx:52,71`, `src/shared/components/buttons/user-button.tsx:25,46` — while the upload writes `headshotUrl`. Even a successful upload only changes the two agent-settings cards (they read `headshotUrl ?? image`), so the feature "does nothing" everywhere the user actually looks.

## Fix directions (pick after verifying #1)

- **Preferred if dashboard access is easy:** add a CORS policy to `tpr-company-docs` (allow PUT from app origins — see `APP_HOSTS` in `src/shared/config/roots.ts`) + confirm public read. Zero code change to the upload hop.
- **Repo-only alternative:** route bytes through the server — a tRPC mutation calling `r2Client.putObject` (already used by the media-optimization pipeline, `src/shared/services/providers/r2/client.ts`) sidesteps browser CORS entirely. 5MB cap makes server-side upload acceptable.
- **Either way, also fix:**
  - Display seam: point sidebar/user-menu at `headshotUrl ?? image`, or additionally write `user.image` in `updateUserProfile` (keep the disjoint-patch discipline — send only the fields being changed; drizzle skips `undefined`; see `agent-settings.router.ts:25-27`).
  - Error swallowing: split the bare catch at `headshot-upload.tsx:62-64` so presign vs PUT vs persist failures are distinguishable (at minimum `console.error` the cause).

## Constraints

- Verify with `pnpm tsc` + `pnpm lint` only — never `pnpm build`.
- `updateUserProfile` patches must stay disjoint (`{ headshotUrl }` only) to avoid the brand-vs-headshot race noted in `mutations.ts:29-35`.
- If testing in a real browser against R2, remember dev origin differs from prod — CORS policy needs both (ngrok host included if testing mobile).
