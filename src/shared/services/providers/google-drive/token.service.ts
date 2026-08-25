// ⚠️ TEMPORARY HOME — REFACTOR PENDING (backend-refactor epic tail).
// This is a convention break: an internal-service orchestrator (reads the accounts
// DAL, throws TRPCError) physically living inside the `providers/` leaf directory.
// Providers must be app-unaware (no DAL, no TRPCError) — see ADR-0003 / service-architecture.md.
// PLAN: extract a centralized `src/shared/services/google-oauth.service.ts` that owns
// ALL Google OAuth account+token concerns for BOTH google-drive AND google-calendar
// (getGoogleAccountForUser + refresh + persist). `scheduling.service.ts` should then
// STOP retrieving google accounts / touching auth and only SCHEDULE — it consumes the
// oauth service for a valid token. Tracked in docs/plans/2026-08-20-backend-refactor-roadmap.md
// §⑥ (Google OAuth service consolidation) + memory project-backend-refactor-roadmap.

import { TRPCError } from '@trpc/server'

import { getGoogleAccountForUser, updateAccountTokens } from '@/shared/entities/accounts/dal/server/google-calendar'

import { googleDriveClient } from './client'

/**
 * Resolve a valid Google access token for a user: read the linked google account,
 * refresh via the refresh token when the current access token is missing/expiring
 * (<5 min), persist the refreshed token, and return it. Unifies the two inline
 * copies the projects google-drive router used to carry (getAccessToken +
 * uploadFromFile) onto one code path.
 */
export const googleDriveTokenService = {
  async getValidAccessToken(userId: string): Promise<string> {
    const acct = await getGoogleAccountForUser(userId)
    if (!acct) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'No Google account linked' })
    }
    if (!acct.refreshToken) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Google Drive connection expired — please sign out and sign in again' })
    }

    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000)
    if (acct.accessToken && acct.accessTokenExpiresAt && acct.accessTokenExpiresAt > fiveMinutesFromNow) {
      return acct.accessToken
    }

    const { accessToken, expiresAt } = await googleDriveClient.refreshAccessToken({ refreshToken: acct.refreshToken })
    await updateAccountTokens(acct.id, { accessToken, accessTokenExpiresAt: expiresAt })
    return accessToken
  },
}
