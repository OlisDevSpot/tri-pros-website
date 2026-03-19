# Google Drive Upload Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Upload button in the edit-project photos tab with a popover offering "From Computer" and "From Google Drive", using the agent's existing Google OAuth session for Drive access with zero new environment variables.

**Architecture:** The Google Picker widget is loaded lazily client-side using the agent's OAuth access token (fetched/refreshed via a new tRPC procedure that reads from the better-auth `account` table). Once files are selected in the Picker, they are downloaded client-side via the Drive API and fed into the existing `useMediaUpload` upload pipeline unchanged.

**Tech Stack:** Next.js 15, tRPC, Drizzle (Postgres), better-auth, shadcn/ui (Popover), lucide-react, Google Picker API (gapi), Google Drive API v3, Cloudflare R2 (existing upload pipeline, untouched)

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `src/shared/auth/server.ts` | Modify | Add `drive.readonly` scope to Google OAuth provider |
| `src/shared/services/google-drive/types.ts` | Create | `PickedFile` interface |
| `src/shared/services/google-drive/google-picker.d.ts` | Create | TypeScript declarations for gapi Picker JS library |
| `src/shared/services/google-drive/lib/refresh-access-token.ts` | Create | Server-only: refresh Google OAuth token via token endpoint |
| `src/shared/services/google-drive/lib/download-drive-file.ts` | Create | Client-side: download a Drive file to a `File` object |
| `src/shared/services/google-drive/hooks/use-google-picker.ts` | Create | Client-side: lazily load gapi, open Picker, call back with selections |
| `src/shared/components/portfolio/upload-source-popover.tsx` | Create | UI-only popover: "From Computer" / "From Google Drive" options |
| `src/trpc/routers/showroom.router.ts` | Modify | Add `getGoogleAccessToken` agentProcedure |
| `src/shared/components/portfolio/sortable-media-manager.tsx` | Modify | Wire Drive handler, ref, picker hook; replace Upload button |

---

## Task 1: Add Drive Scope to Better-Auth Google Provider

**Files:**
- Modify: `src/shared/auth/server.ts`

This adds `drive.readonly` to the OAuth scopes requested at login. Since `prompt: 'select_account consent'` is already present, agents will see the updated consent screen on their next login automatically.

- [ ] **Step 1: Open `src/shared/auth/server.ts` and add the `scope` array**

  Find the `google:` block (lines 21–28). Add `scope` after `accessType`:

  ```ts
  google: {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectURI: `${env.NEXT_PUBLIC_BASE_URL}/api/auth/callback/google`,
    accessType: 'offline',
    prompt: 'select_account consent',
    scope: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  },
  ```

- [ ] **Step 2: Verify no lint errors**

  ```bash
  pnpm lint
  ```
  Expected: no new errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/shared/auth/server.ts
  git commit -m "feat(auth): add drive.readonly scope to Google OAuth provider"
  ```

---

## Task 2: Types and Type Declarations

**Files:**
- Create: `src/shared/services/google-drive/types.ts`
- Create: `src/shared/services/google-drive/google-picker.d.ts`

The Google Picker JS library has no npm types package. We declare just enough to type our usage. `PickedFile` is the shape we extract from the Picker's response — used by both the hook and the download function.

- [ ] **Step 1: Create `types.ts`**

  ```ts
  // src/shared/services/google-drive/types.ts
  export interface PickedFile {
    id: string
    name: string
    mimeType: string
  }
  ```

- [ ] **Step 2: Create `google-picker.d.ts`**

  ```ts
  // src/shared/services/google-drive/google-picker.d.ts
  declare namespace google.picker {
    enum Action {
      PICKED = 'picked',
      CANCEL = 'cancel',
    }

    enum Feature {
      MULTISELECT_ENABLED = 'multiselect-enabled',
    }

    class DocsView {
      setMimeTypes(mimeTypes: string): DocsView
      setIncludeFolders(include: boolean): DocsView
    }

    class PickerBuilder {
      setOAuthToken(token: string): PickerBuilder
      addView(view: DocsView): PickerBuilder
      enableFeature(feature: Feature): PickerBuilder
      setCallback(cb: (data: PickerResponse) => void): PickerBuilder
      build(): Picker
    }

    interface Picker {
      setVisible(visible: boolean): void
    }

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

- [ ] **Step 3: Verify TypeScript picks up the declarations**

  ```bash
  pnpm lint
  ```
  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/shared/services/google-drive/types.ts src/shared/services/google-drive/google-picker.d.ts
  git commit -m "feat(google-drive): add PickedFile type and gapi Picker declarations"
  ```

---

## Task 3: Token Refresh Server Utility

**Files:**
- Create: `src/shared/services/google-drive/lib/refresh-access-token.ts`

Server-only function. Calls Google's token endpoint to exchange a refresh token for a new access token. Marked `server-only` so it can never be accidentally bundled into client JS.

- [ ] **Step 1: Create `refresh-access-token.ts`**

  ```ts
  // src/shared/services/google-drive/lib/refresh-access-token.ts
  import 'server-only'
  import env from '@/shared/config/server-env'

  interface RefreshInput {
    refreshToken: string
  }

  interface RefreshOutput {
    accessToken: string
    expiresAt: Date
  }

  export async function refreshAccessToken({ refreshToken }: RefreshInput): Promise<RefreshOutput> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(
        `Failed to refresh Google token: ${error.error_description ?? error.error ?? response.statusText}`,
      )
    }

    const data = await response.json() as { access_token: string, expires_in: number }
    // expires_in is in seconds; Date.now() is in milliseconds
    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    }
  }
  ```

- [ ] **Step 2: Lint check**

  ```bash
  pnpm lint
  ```
  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/shared/services/google-drive/lib/refresh-access-token.ts
  git commit -m "feat(google-drive): add server-only token refresh utility"
  ```

---

## Task 4: `getGoogleAccessToken` tRPC Procedure

**Files:**
- Modify: `src/trpc/routers/showroom.router.ts`

An `agentProcedure` query (no input) that returns a fresh Google access token for the calling agent. Reads from the `account` table, refreshes if expired, updates the row, returns the token to the client. The client uses this token to authenticate the Picker widget and Drive file downloads.

- [ ] **Step 1: Add imports to `showroom.router.ts`**

  At the top of the file, add the new imports alongside the existing ones (keep `perfectionist/sort-imports` ordering — external packages first, then `@/` internal paths):

  ```ts
  import { and, eq, inArray } from 'drizzle-orm'
  import { account } from '@/shared/db/schema'
  import { refreshAccessToken } from '@/shared/services/google-drive/lib/refresh-access-token'
  ```

  > **Note:** `eq` and `inArray` may already be imported — only add what's missing. Add `and` if not present. The `account` table is from `@/shared/db/schema` (already wildcard-imported as `schema` — you may import `account` specifically or use `schema.account` if the file already has a named import of `schema`). Check the current imports first and follow the existing pattern.

- [ ] **Step 2: Add the `getGoogleAccessToken` procedure inside `createTRPCRouter({...})`**

  Add after the last existing procedure, before the closing `})`:

  ```ts
  // ── Agent: Google Drive token ──────────────────────────────────────

  getGoogleAccessToken: agentProcedure
    .query(async ({ ctx }) => {
      const googleAccount = await db.query.account.findFirst({
        where: and(
          eq(account.userId, ctx.session.user.id),
          eq(account.providerId, 'google'),
        ),
      })

      if (!googleAccount) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No Google account linked',
        })
      }

      if (!googleAccount.refreshToken) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Google Drive connection expired — please sign out and sign in again',
        })
      }

      const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000)
      if (googleAccount.accessTokenExpiresAt && googleAccount.accessTokenExpiresAt > fiveMinutesFromNow) {
        return { accessToken: googleAccount.accessToken! }
      }

      const { accessToken, expiresAt } = await refreshAccessToken({
        refreshToken: googleAccount.refreshToken,
      })

      await db
        .update(account)
        .set({ accessToken, accessTokenExpiresAt: expiresAt })
        .where(eq(account.id, googleAccount.id))

      return { accessToken }
    }),
  ```

- [ ] **Step 3: Lint check**

  ```bash
  pnpm lint
  ```
  Expected: no errors. If you see import sort errors, reorder the new imports to match the `perfectionist/sort-imports` rule (external packages before `@/` paths, alphabetical within groups).

- [ ] **Step 4: Commit**

  ```bash
  git add src/trpc/routers/showroom.router.ts
  git commit -m "feat(trpc): add getGoogleAccessToken procedure to showroom router"
  ```

---

## Task 5: Drive File Downloader

**Files:**
- Create: `src/shared/services/google-drive/lib/download-drive-file.ts`

Plain async function (not a hook). Downloads a single Drive file by ID using the access token and returns a `File` object that can be fed directly into `useMediaUpload.upload()`.

- [ ] **Step 1: Create `download-drive-file.ts`**

  ```ts
  // src/shared/services/google-drive/lib/download-drive-file.ts
  import type { PickedFile } from '../types'

  export async function downloadDriveFile(file: PickedFile, accessToken: string): Promise<File> {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )

    if (!response.ok) {
      throw new Error(
        `Failed to download Drive file "${file.name}": ${response.status} ${response.statusText}`,
      )
    }

    const blob = await response.blob()
    return new File([blob], file.name, { type: file.mimeType })
  }
  ```

- [ ] **Step 2: Lint check**

  ```bash
  pnpm lint
  ```
  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/shared/services/google-drive/lib/download-drive-file.ts
  git commit -m "feat(google-drive): add Drive file downloader utility"
  ```

---

## Task 6: Google Picker Hook

**Files:**
- Create: `src/shared/services/google-drive/hooks/use-google-picker.ts`

Client-side hook. Lazily injects the `gapi` script on first use (idempotent), then builds and opens the Google Picker modal when `openPicker(accessToken)` is called. The token is passed at call time — no state, no `useEffect`.

`gapi` is loaded globally via script injection. The `isLoading` flag covers the brief window while the script loads on first use.

- [ ] **Step 1: Create `use-google-picker.ts`**

  ```ts
  // src/shared/services/google-drive/hooks/use-google-picker.ts
  'use client'

  import { useCallback, useRef, useState } from 'react'
  import type { PickedFile } from '../types'

  interface UseGooglePickerOptions {
    onFilesPicked: (files: PickedFile[]) => void
  }

  interface UseGooglePickerReturn {
    openPicker: (accessToken: string) => void
    isLoading: boolean
  }

  function loadGapiScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('Cannot load gapi outside browser'))
        return
      }
      if (window.gapi) {
        resolve()
        return
      }
      const script = document.createElement('script')
      script.src = 'https://apis.google.com/js/api.js'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load Google API script'))
      document.head.appendChild(script)
    })
  }

  export function useGooglePicker({ onFilesPicked }: UseGooglePickerOptions): UseGooglePickerReturn {
    const [isLoading, setIsLoading] = useState(false)
    const onFilesPickedRef = useRef(onFilesPicked)
    onFilesPickedRef.current = onFilesPicked

    const openPicker = useCallback((accessToken: string) => {
      setIsLoading(true)

      loadGapiScript()
        .then(() => {
          window.gapi.load('picker', () => {
            setIsLoading(false)

            const view = new google.picker.DocsView()
              .setMimeTypes('image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif')
              .setIncludeFolders(false)

            new google.picker.PickerBuilder()
              .setOAuthToken(accessToken)
              .addView(view)
              .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
              .setCallback((data: google.picker.PickerResponse) => {
                if (data.action !== google.picker.Action.PICKED)
                  return
                const files: PickedFile[] = data.docs.map(d => ({
                  id: d.id,
                  name: d.name,
                  mimeType: d.mimeType,
                }))
                onFilesPickedRef.current(files)
              })
              .build()
              .setVisible(true)
          })
        })
        .catch(() => {
          setIsLoading(false)
        })
    }, [])

    return { openPicker, isLoading }
  }
  ```

  > **Why `onFilesPickedRef`?** The `onFilesPicked` callback is defined inline in `SortableMediaManager` and closes over `upload`, `activePhase`, etc. Storing it in a ref means the picker callback always calls the latest version without the hook needing to re-create `openPicker` on every render.

- [ ] **Step 2: Add `gapi` to the global `Window` type so TypeScript doesn't complain**

  Create `src/shared/services/google-drive/gapi.d.ts` (this is a new file — there is no existing global Window declarations file in this codebase):

  ```ts
  // src/shared/services/google-drive/gapi.d.ts
  interface Window {
    gapi: {
      load: (library: string, callback: () => void) => void
    }
  }
  ```

  > **Note:** Do not add this to `google-picker.d.ts` — keep the `gapi` (script loader) and `google.picker` (Picker widget API) declarations in separate files for clarity.

- [ ] **Step 3: Lint check**

  ```bash
  pnpm lint
  ```
  Expected: no errors. Fix any import sort issues.

- [ ] **Step 4: Commit**

  ```bash
  git add src/shared/services/google-drive/hooks/use-google-picker.ts src/shared/services/google-drive/gapi.d.ts
  git commit -m "feat(google-drive): add useGooglePicker hook with lazy gapi script loading"
  ```

---

## Task 7: Upload Source Popover Component

**Files:**
- Create: `src/shared/components/portfolio/upload-source-popover.tsx`

Pure UI component. Props-driven — no imports from `google-drive/`. The Drive-specific label exists only as text. Lives in `shared/components/portfolio/` alongside `SortableMediaManager` which consumes it.

- [ ] **Step 1: Create `upload-source-popover.tsx`**

  ```tsx
  // src/shared/components/portfolio/upload-source-popover.tsx
  'use client'

  import { HardDrive, Loader2, Monitor, Plus } from 'lucide-react'
  import { useState } from 'react'
  import { Button } from '@/shared/components/ui/button'
  import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'

  interface UploadSourcePopoverProps {
    isPickerLoading: boolean
    isUploading: boolean
    onGoogleDriveUpload: () => void
    onLocalUpload: () => void
  }

  export function UploadSourcePopover({
    isPickerLoading,
    isUploading,
    onGoogleDriveUpload,
    onLocalUpload,
  }: UploadSourcePopoverProps) {
    const [open, setOpen] = useState(false)

    function handleLocalClick() {
      setOpen(false)
      onLocalUpload()
    }

    function handleDriveClick() {
      setOpen(false)
      onGoogleDriveUpload()
    }

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isUploading || isPickerLoading}
          >
            {isUploading || isPickerLoading
              ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              : <Plus className="mr-1.5 h-3.5 w-3.5" />}
            Upload
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-1" align="end">
          <button
            type="button"
            disabled={isUploading}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
            onClick={handleLocalClick}
          >
            <Monitor className="h-4 w-4 shrink-0" />
            From Computer
          </button>
          <button
            type="button"
            disabled={isUploading || isPickerLoading}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
            onClick={handleDriveClick}
          >
            <HardDrive className="h-4 w-4 shrink-0" />
            From Google Drive
          </button>
        </PopoverContent>
      </Popover>
    )
  }
  ```

  > **Note:** We use plain `<button>` elements inside `PopoverContent` rather than `DropdownMenuItem` to avoid nesting interactive elements. The styling matches shadcn's `DropdownMenuItem` visually.

- [ ] **Step 2: Lint check**

  ```bash
  pnpm lint
  ```
  Expected: no errors. Fix any import sort issues.

- [ ] **Step 3: Commit**

  ```bash
  git add src/shared/components/portfolio/upload-source-popover.tsx
  git commit -m "feat(portfolio): add UploadSourcePopover component"
  ```

---

## Task 8: Wire Everything into `SortableMediaManager`

**Files:**
- Modify: `src/shared/components/portfolio/sortable-media-manager.tsx`

This is the final integration step. Replace the Upload `<Button>` (lines 418–430) with `<UploadSourcePopover>`, add the Google Drive handler, wire the picker hook and ref. The existing local upload path is untouched.

- [ ] **Step 1: Add new imports to `sortable-media-manager.tsx`**

  Add alongside existing imports (maintain sort order):

  ```ts
  import { useQuery } from '@tanstack/react-query'
  import { downloadDriveFile } from '@/shared/services/google-drive/lib/download-drive-file'
  import { useGooglePicker } from '@/shared/services/google-drive/hooks/use-google-picker'
  import { UploadSourcePopover } from './upload-source-popover'
  ```

  > **Note:** `useQuery` may already be imported (check the existing imports). Only add the import if it's missing.

- [ ] **Step 2: Add the ref and tRPC query inside the component body, after the existing `useRef` and hook calls**

  Add after `const fileInputRef = useRef<HTMLInputElement>(null)`:

  ```ts
  const currentAccessTokenRef = useRef<string | null>(null)
  ```

  Add after the existing `useMutation` calls:

  ```ts
  const { refetch: fetchAccessToken } = useQuery({
    ...trpc.showroomRouter.getGoogleAccessToken.queryOptions(),
    enabled: false,
  })
  ```

  > **Verify router key:** `showroomRouter` is registered under the key `showroomRouter` in `src/trpc/routers/app.ts` — confirmed. The call `trpc.showroomRouter.getGoogleAccessToken` is correct.

- [ ] **Step 3: Add `useGooglePicker` after the `fetchAccessToken` query**

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

- [ ] **Step 4: Add the `handleGoogleDriveClick` handler after `handleUploadClick`**

  ```ts
  async function handleGoogleDriveClick(phase: MediaPhase) {
    // setActivePhase here is safe: isUploading disables the popover while an
    // upload is in progress, preventing concurrent calls that would race on activePhase.
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

- [ ] **Step 5: Replace the Upload `<Button>` with `<UploadSourcePopover>`**

  Find the block (around lines 418–430):

  ```tsx
  <div className="ml-auto">
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isUploading}
      onClick={() => handleUploadClick(phase)}
    >
      {isUploading
        ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        : <Plus className="mr-1.5 h-3.5 w-3.5" />}
      Upload
    </Button>
  </div>
  ```

  Replace with:

  ```tsx
  <div className="ml-auto">
    <UploadSourcePopover
      onLocalUpload={() => handleUploadClick(phase)}
      onGoogleDriveUpload={() => handleGoogleDriveClick(phase)}
      isUploading={isUploading}
      isPickerLoading={isPickerLoading}
    />
  </div>
  ```

  After replacing, remove the `Loader2` and `Plus` imports from the top of the file **only if they are no longer used elsewhere in the file**. Check before removing — they may be used in other parts of the component (e.g. `bulkDeleteMutation.isPending` spinner).

- [ ] **Step 6: Lint check**

  ```bash
  pnpm lint
  ```
  Expected: no errors. Fix any import sort issues.

- [ ] **Step 7: Commit**

  ```bash
  git add src/shared/components/portfolio/sortable-media-manager.tsx
  git commit -m "feat(portfolio): wire Google Drive upload into SortableMediaManager"
  ```

---

## Task 9: Smoke Test Checklist

**Pre-flight:** Verify the Google Picker API is enabled in GCP Console → APIs & Services → Library. If it isn't, the Picker will fail to load silently. The OAuth consent screen `drive.readonly` scope is already done (confirmed).

Manual verification steps. Run `pnpm dev` and navigate to an edit-project page.

- [ ] **Local upload still works**
  1. Click "Upload" — popover appears with "From Computer" and "From Google Drive"
  2. Click "From Computer" — native file picker opens
  3. Select one or more images — they upload and appear in the grid
  4. Verify the tab count increments correctly

- [ ] **Google Drive Picker opens**
  1. Click "Upload" → "From Google Drive"
  2. Button shows spinner briefly (first use: gapi script loads)
  3. Google Picker modal opens showing image files from Drive
  4. Verify multiselect works (can select multiple images)
  5. Verify only image files are visible (no PDFs, Docs, etc.)

- [ ] **Drive import completes**
  1. Select 1–3 images in the Picker and confirm
  2. Picker closes, files upload and appear in the grid
  3. Verify file names match the Drive file names

- [ ] **Token refresh path** (manual — requires expired token)
  - If you can wait for a token to expire (~1 hour) or null out `accessTokenExpiresAt` in the DB directly, verify clicking "From Google Drive" still works and updates the `access_token` in the `account` table

- [ ] **Error path: Drive scope not yet granted**
  - Sign in with a Google account that hasn't consented to Drive access
  - Click "From Google Drive" — expect a toast error about Drive access

- [ ] **Build check**

  ```bash
  pnpm build
  ```
  Expected: builds without errors.

- [ ] **Final commit (if any cleanup needed)**

  ```bash
  git add -A
  git commit -m "chore: post-integration cleanup"
  ```
