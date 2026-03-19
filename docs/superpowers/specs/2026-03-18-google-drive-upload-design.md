# Google Drive Upload Integration — Design Spec

**Date:** 2026-03-18
**Scope:** Upload button in `SortableMediaManager` → popover with "From Computer" + "From Google Drive"; persistent OAuth token flow; Google Picker API; API key security hardening.
**Audience:** Agents only (internal `@triprosremodeling.com` users)

---

## 1. Goals

1. Replace the Upload button in the edit-project photos tab with a popover offering two sources: local file system and Google Drive.
2. Use the agent's existing Google OAuth session for Drive access — no separate auth flow, no re-consent beyond the next natural login.
3. Keep all Google service logic within `src/shared/services/google-drive/`.
4. Harden the Maps API key: HTTP-referrer restrict it in GCP, scope it to only the APIs it serves (Maps JS, Places, Picker).
5. Zero new environment variables (one existing optional key becomes required — see §5).

---

## 2. Out of Scope

- Google Drive import for homeowners or external users.
- Video file support (already excluded from the media manager).
- Folder browsing inside Picker (images-only view is sufficient).
- Server-side Drive → R2 proxying (client-side download reuses the existing upload pipeline cleanly).

---

## 3. Architecture Overview

```
SortableMediaManager
  └── UploadSourcePopover          (new component, shared/components/portfolio/)
        ├── "From Computer"        → existing fileInputRef.current.click()  [no change]
        └── "From Google Drive"    → handleGoogleDriveClick(phase)
                                        ├── getGoogleAccessToken (tRPC agentProcedure)
                                        │     └── google-drive/lib/refresh-access-token.ts
                                        └── openPicker(accessToken)  [from useGooglePicker]
                                              └── onFilesPicked → downloadDriveFile() per file
                                                    └── useMediaUpload.upload() [single instance, unchanged]
```

All new Google Drive logic lives under `src/shared/services/google-drive/`.

---

## 4. GCP Console Changes (pre-requisite, non-code)

These must be done before deployment.

### 4.1 OAuth Consent Screen — Add Drive Scope ✅ Done

`https://www.googleapis.com/auth/drive.readonly` has already been added to the OAuth consent screen in GCP. Since `prompt: 'select_account consent'` is set in `server.ts`, agents will be prompted to grant Drive access on their next login.

### 4.2 Enable Google Picker API

In GCP Console → APIs & Services → Library: enable **Google Picker API** on the project. No API key is required for the Picker — `setDeveloperKey()` is omitted because the OAuth token alone is sufficient for accessing the user's own Drive files.

---

## 5. Environment Variables

No environment variable changes. `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is not used by the Picker — `setDeveloperKey()` is omitted since the OAuth token alone is sufficient for accessing the user's own Drive files. All token operations use the existing `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

---

## 6. Auth Config Change

**File:** `src/shared/auth/server.ts`

`scope` is not currently configured on the Google provider (defaults to `openid email profile`). Add it explicitly, including the new Drive scope. The `prompt` and `accessType` values are unchanged.

```ts
google: {
  clientId: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  redirectURI: `${env.NEXT_PUBLIC_BASE_URL}/api/auth/callback/google`,
  accessType: 'offline',
  prompt: 'select_account consent',
  // scope is new — first time this is explicitly configured on this provider
  scope: [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/drive.readonly',
  ],
},
```

`accessType: 'offline'` ensures a refresh token is issued. `prompt: 'select_account consent'` ensures the consent screen is shown with the new scope on next login — both are already present and unchanged.

---

## 7. New Service: `src/shared/services/google-drive/`

### 7.1 Directory Structure

```
src/shared/services/google-drive/
  types.ts
  lib/
    refresh-access-token.ts
    download-drive-file.ts
  hooks/
    use-google-picker.ts
```

### 7.2 `types.ts`

```ts
export interface PickedFile {
  id: string
  name: string
  mimeType: string
}
```

### 7.3 `lib/refresh-access-token.ts`

Server-side utility (used only by the tRPC procedure). Marked `server-only`.

**Input:** `{ refreshToken: string }`
**Output:** `{ accessToken: string; expiresAt: Date }`

**Logic:**
- POSTs `https://oauth2.googleapis.com/token` with body:
  - `grant_type: 'refresh_token'`
  - `client_id: env.GOOGLE_CLIENT_ID`
  - `client_secret: env.GOOGLE_CLIENT_SECRET`
  - `refresh_token: refreshToken`
- Parses `{ access_token, expires_in }` from the JSON response.
- Computes `expiresAt` as `new Date(Date.now() + expiresIn * 1000)` — `expires_in` is in seconds, `Date.now()` is in milliseconds.
- Throws a descriptive `Error` on non-200 response (includes the Google error message).

Uses `env.GOOGLE_CLIENT_ID` and `env.GOOGLE_CLIENT_SECRET` from `server-env.ts` — no new env vars.

### 7.4 `lib/download-drive-file.ts`

Client-side async utility. **Not a hook.** Exported as a plain async function.

**Signature:**
```ts
async function downloadDriveFile(file: PickedFile, accessToken: string): Promise<File>
```

**Logic:**
1. Fetches `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media` with header `Authorization: Bearer ${accessToken}`.
2. Reads response as a `Blob`.
3. Constructs and returns a `File` object: `new File([blob], file.name, { type: file.mimeType })`.
4. Throws on non-200 response (e.g. 403 = scope not granted, surfaced by the caller).

### 7.5 `hooks/use-google-picker.ts`

Client-side hook. Lazily loads the Google Picker script, then opens the picker modal when called.

**Signature:**
```ts
function useGooglePicker(options: {
  onFilesPicked: (files: PickedFile[]) => void
}): {
  openPicker: (accessToken: string) => void
  isLoading: boolean
}
```

The access token is accepted by `openPicker` at call time (not stored in hook state), avoiding stale-closure and re-render issues.

**Logic:**
1. `openPicker(accessToken)` is called imperatively from `handleGoogleDriveClick` after the token is fetched — no `useEffect` or intermediate state needed.
2. On first call, dynamically injects `<script src="https://apis.google.com/js/api.js">` if `window.gapi` doesn't exist. Sets `isLoading = true` until loaded.
3. Calls `gapi.load('picker', callback)`.
4. In callback, builds and opens the picker:
   ```ts
   const view = new google.picker.DocsView()
     .setMimeTypes('image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif')
     .setIncludeFolders(false)

   new google.picker.PickerBuilder()
     .setOAuthToken(accessToken)  // no setDeveloperKey — OAuth token is sufficient
     .addView(view)
     .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
     .setCallback(pickerCallback)
     .build()
     .setVisible(true)
   ```
   Using `DocsView` with explicit MIME types instead of `ViewId.DOCS_IMAGES` to restrict to image files only (DOCS_IMAGES also surfaces non-image document types).
5. In `pickerCallback`: when `action === google.picker.Action.PICKED`, maps `data.docs` to `PickedFile[]` and calls `onFilesPicked`:
   ```ts
   const files: PickedFile[] = data.docs.map(d => ({ id: d.id, name: d.name, mimeType: d.mimeType }))
   onFilesPicked(files)
   ```
   `PickerDocument` and `PickedFile` share identical fields so the mapping is a direct destructure. When `action === google.picker.Action.CANCEL`, no-op.
6. `isLoading` is `true` while the gapi script is loading; `false` once the picker is ready.
7. Script injection is idempotent — skips if `window.gapi` already exists.

---

## 8. New tRPC Procedure: `getGoogleAccessToken`

**Router:** `src/trpc/routers/showroom.router.ts`
**Procedure type:** `agentProcedure` (auth required — any authenticated user)
**Type:** query (no input)

> **Note:** `agentProcedure` checks that a session exists but does not enforce `role === 'agent'`. Access to this procedure is gated at the application level by the showroom route group being agent-only. This matches the existing pattern across all showroom procedures.

**Logic:**
1. Query `account` table: `WHERE userId = ctx.session.user.id AND providerId = 'google'`.
2. If no row found → throw `TRPCError({ code: 'NOT_FOUND', message: 'No Google account linked' })`.
3. If `account.refreshToken` is null → throw `TRPCError({ code: 'PRECONDITION_FAILED', message: 'Google Drive connection expired — please sign out and sign in again' })`.
4. If `accessTokenExpiresAt` is more than 5 minutes in the future → return `{ accessToken: account.accessToken }` immediately.
5. Otherwise, call `refreshAccessToken({ refreshToken: account.refreshToken })` from the lib.
6. Update the `account` row: `SET accessToken = ..., accessTokenExpiresAt = ...`.
7. Return `{ accessToken }`.

---

## 9. New Component: `src/shared/components/portfolio/upload-source-popover.tsx`

One file, one named export `UploadSourcePopover`. Located alongside `SortableMediaManager` in `shared/components/portfolio/` because it is consumed by that component (which is itself shared), and because the component is **props-driven with zero imports from `google-drive/`** — it has no Drive-specific knowledge at the import level, only UI labels.

**Props:**
```ts
interface UploadSourcePopoverProps {
  onLocalUpload: () => void
  onGoogleDriveUpload: () => void
  isUploading: boolean
  isPickerLoading: boolean
}
```

**Renders:** A shadcn `Popover` whose trigger is the existing "Upload" button (visually unchanged). The `PopoverContent` contains two rows:
- `Monitor` icon + "From Computer" → calls `onLocalUpload`, closes popover
- `HardDrive` icon (lucide) + "From Google Drive" → calls `onGoogleDriveUpload`, closes popover

The "From Computer" row is disabled when `isUploading` is true. The "From Google Drive" row is disabled when either `isUploading` or `isPickerLoading` is true (`isPickerLoading` covers the gapi script load on first use).

---

## 10. Changes to `SortableMediaManager`

**File:** `src/shared/components/portfolio/sortable-media-manager.tsx`

Changes are additive and localized to the upload section:

1. **Add tRPC query** (manually triggered):
   ```ts
   const { refetch: fetchAccessToken } = useQuery({
     ...trpc.showroomRouter.getGoogleAccessToken.queryOptions(),
     enabled: false,
   })
   ```

2. **Add `useGooglePicker`:**
   ```ts
   const { openPicker, isLoading: isPickerLoading } = useGooglePicker({
     onFilesPicked: async (files) => {
       for (const picked of files) {
         try {
           const file = await downloadDriveFile(picked, currentAccessTokenRef.current!)
           await upload({
             file,
             projectId,
             phase: activePhase,
             meta: {
               name: picked.name.replace(/\.[^/.]+$/, ''),
               mimeType: picked.mimeType,
               fileExtension: picked.name.includes('.') ? `.${picked.name.split('.').pop()}` : '',
               phase: activePhase,
               projectId,
             },
           })
         }
         catch {
           toast.error(`Failed to import ${picked.name} from Google Drive`)
         }
       }
       onUpdate()
     },
   })
   ```
   `upload` here is the same `upload` function from the existing `const { upload, isUploading } = useMediaUpload()` at the top of the component — no second instance is created.

3. **Add a ref** to hold the current access token across the async picker callback (avoids stale closure):
   ```ts
   const currentAccessTokenRef = useRef<string | null>(null)
   ```

4. **Add handler:**
   ```ts
   async function handleGoogleDriveClick(phase: MediaPhase) {
     // setActivePhase here is safe: isUploading disables the popover while an upload
     // is in progress, preventing a concurrent call that would race on activePhase.
     setActivePhase(phase)
     const { data } = await fetchAccessToken()
     if (!data?.accessToken) {
       toast.error('Could not connect to Google Drive')
       return
     }
     currentAccessTokenRef.current = data.accessToken
     openPicker(data.accessToken)
   }
   ```
   The token is fetched, stored in the ref for the async `onFilesPicked` callback, then `openPicker` is called immediately — no intermediate state or `useEffect` needed.

5. **Replace the Upload `<Button>`** (lines 418–430) with:
   ```tsx
   <UploadSourcePopover
     onLocalUpload={() => handleUploadClick(phase)}
     onGoogleDriveUpload={() => handleGoogleDriveClick(phase)}
     isUploading={isUploading}
     isPickerLoading={isPickerLoading}
   />
   ```

No changes to `handleFileChange`, the existing `useMediaUpload` instance, R2 presign flow, or any other existing logic.

---

## 11. Data Flow Summary

### Local Upload (unchanged)
```
Click "From Computer"
  → handleUploadClick(phase) → fileInputRef.current.click()
  → handleFileChange → useMediaUpload.upload()
  → getUploadUrl (tRPC) → R2 presigned PUT → createMediaFile (tRPC)
```

### Google Drive Upload (new)
```
Click "From Google Drive"
  → handleGoogleDriveClick(phase)
  → getGoogleAccessToken (tRPC, agentProcedure)
      → check/refresh token in DB using GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET
      → return { accessToken }
  → currentAccessTokenRef.current = accessToken
  → openPicker(accessToken) — immediate, no state/effect
  → useGooglePicker: load gapi script → gapi.load('picker') → DocsView + PickerBuilder → setVisible(true)
  → Agent selects images in Google's native Picker UI
  → onFilesPicked(PickedFile[])
      → for each file:
          downloadDriveFile(picked, currentAccessTokenRef.current!)   ← ref, not closure var
            → fetch drive.googleapis.com/v3/files/{id}?alt=media (Bearer token, client-side)
            → Blob → File
          → useMediaUpload.upload() [same single instance from component top]
            → getUploadUrl (tRPC) → R2 presigned PUT → createMediaFile (tRPC)
```

---

## 12. File Change Summary

| File | Change |
|---|---|
| `src/shared/auth/server.ts` | Add `scope` array (first time configured) |
| `src/shared/services/google-drive/types.ts` | **New** — `PickedFile` type |
| `src/shared/services/google-drive/lib/refresh-access-token.ts` | **New** — server-only token refresh utility |
| `src/shared/services/google-drive/lib/download-drive-file.ts` | **New** — client async Drive file downloader |
| `src/shared/services/google-drive/hooks/use-google-picker.ts` | **New** — picker hook |
| `src/shared/components/portfolio/upload-source-popover.tsx` | **New** — popover component |
| `src/shared/components/portfolio/sortable-media-manager.tsx` | Add Drive handler + ref + replace Upload button |
| `src/trpc/routers/showroom.router.ts` | Add `getGoogleAccessToken` agentProcedure |

**No environment variable changes.** Uses existing `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` only.

---

## 13. Google Picker — Type Declarations

The Google Picker JS library is not typed. Add `src/shared/services/google-drive/google-picker.d.ts`:

```ts
declare namespace google.picker {
  enum Action { PICKED = 'picked', CANCEL = 'cancel' }
  enum Feature { MULTISELECT_ENABLED = 'multiselect-enabled' }

  class DocsView {
    setMimeTypes(mimeTypes: string): DocsView
    setIncludeFolders(include: boolean): DocsView
  }

  class PickerBuilder {
    setDeveloperKey(key: string): PickerBuilder
    setOAuthToken(token: string): PickerBuilder
    addView(view: DocsView): PickerBuilder
    enableFeature(feature: Feature): PickerBuilder
    setCallback(cb: (data: PickerResponse) => void): PickerBuilder
    build(): Picker
  }

  interface Picker { setVisible(visible: boolean): void }

  interface PickerResponse {
    action: Action
    docs: PickerDocument[]
  }

  interface PickerDocument {
    id: string
    name: string
    mimeType: string
  }
}
```

---

## 14. Error Cases

| Scenario | Handling |
|---|---|
| Agent has no Google account linked | `getGoogleAccessToken` throws `NOT_FOUND`; caller shows `toast.error('Could not connect to Google Drive')` |
| `refreshToken` is null in DB (account linked before `offline` scope was set) | `getGoogleAccessToken` throws `PRECONDITION_FAILED`; caller shows `toast.error('Google Drive connection expired — please sign out and sign in again')` |
| Refresh token expired / revoked | `refreshAccessToken` throws; surfaced as generic `toast.error` |
| Agent hasn't granted Drive scope yet (403 on file fetch) | `downloadDriveFile` throws; per-file `toast.error('Drive access not granted — please sign out and sign in again')` |
| Picker cancelled by user | `action === 'cancel'` — no-op |
| Drive file fetch fails (non-403) | Per-file `toast.error(...)`, remaining files in batch continue |
| R2 upload fails | Existing `toast.error` in `useMediaUpload` unchanged |
