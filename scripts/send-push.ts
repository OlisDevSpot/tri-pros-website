/**
 * Fire a push notification at any user from the terminal. Useful for:
 *   - smoke-testing a fresh subscription (deep link, payload shape, app-badge)
 *   - reproducing what production code is about to send before wiring it in
 *   - verifying that 4xx cleanup actually deletes dead rows
 *
 * Usage:
 *   pnpm push:test --to <email> --title "<title>" [--body "<body>"] [--navigate <path>]
 *
 * Examples:
 *   pnpm push:test --to oliver@triprosremodeling.com --title "Test"
 *   pnpm push:test --to oliver@triprosremodeling.com --title "New lead" --body "Bob from Pasadena" --navigate /dashboard/customers
 *   pnpm push:test --to oliver@triprosremodeling.com --title "Proposal viewed" --navigate /dashboard/customers/abc123/proposals/xyz789
 *
 * Picks dev DB (DATABASE_DEV_URL) by default because NODE_ENV defaults to
 * 'development'. Set NODE_ENV=production to target the prod DB.
 */
import process from 'node:process'
import './lib/load-env'
import { eq } from 'drizzle-orm'
import { db } from '../src/shared/db'
import { user } from '../src/shared/db/schema/auth'
import { webPushClient } from '../src/shared/services/providers/web-push/client'

interface Args {
  to?: string
  title?: string
  body?: string
  navigate?: string
}

function parseArgs(argv: string[]): Args {
  const out: Args = {}
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    const value = argv[i + 1]
    if (!flag?.startsWith('--') || value?.startsWith('--')) {
      continue
    }
    const key = flag.slice(2) as keyof Args
    if (['to', 'title', 'body', 'navigate'].includes(key)) {
      out[key] = value
      i++
    }
  }
  return out
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (!args.to || !args.title) {
    console.error('Usage: pnpm push:test --to <email> --title "<title>" [--body "<body>"] [--navigate <path>]')
    process.exit(1)
  }

  const [target] = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(eq(user.email, args.to))
    .limit(1)

  if (!target) {
    console.error(`No user with email ${args.to}`)
    process.exit(1)
  }

  console.warn(`Sending push to ${target.name} <${target.email}>...`)

  const result = await webPushClient.sendToUser(target.id, {
    title: args.title,
    body: args.body,
    navigate: args.navigate ?? '/dashboard',
    urgency: 'high',
  })

  console.warn('\nResult:', JSON.stringify(result, null, 2))

  if (result.delivered === 0 && result.removed === 0 && result.failed === 0) {
    console.warn('\n  No subscriptions found for this user. They need to enable notifications first.')
  }
  else if (result.delivered > 0) {
    console.warn(`\n  Delivered to ${result.delivered} device(s). Check the device for the notification.`)
  }
  if (result.removed > 0) {
    console.warn(`  Pruned ${result.removed} dead subscription(s).`)
  }

  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
