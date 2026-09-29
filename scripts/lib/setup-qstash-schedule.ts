import process from 'node:process'

import './load-env'

// Shared driver for the "schedule a QStash job" CLIs. Dry-run by default, refuses
// duplicates for the same destination, and refuses dev-shaped URLs on a prod target.
//
// The app modules are imported lazily inside the function: server-env parses process.env
// at import time, so they must not be hoisted above the load-env side effect.
//
// URL resolution: DRIZZLE_TARGET=prod derives the origin from APP_HOSTS.prod[0] so a dev
// box with NGROK_URL in .env.local still targets prod; otherwise publicUrl() (ngrok in dev,
// since QStash cannot reach localhost).

export interface QstashScheduleSpec {
  jobKey: string
  cron: string
  cronLabel: string
  title: string
  verifyHints: string[]
}

function assertReachableDestination(url: string, isProd: boolean): void {
  const looksDev = /ngrok|localhost|127\.0\.0\.1/i.test(url)
  if (isProd && looksDev) {
    console.error('')
    console.error(`✗ Refusing: DRIZZLE_TARGET=prod but resolved URL looks dev-ish: ${url}`)
    console.error('  This usually means .env.local has NGROK_URL set and is leaking into a prod')
    console.error('  invocation. Run from an environment where only NEXT_PUBLIC_BASE_URL (the prod')
    console.error('  origin) is exported, or unset NGROK_URL for this invocation.')
    process.exit(1)
  }
  if (!isProd && url.startsWith('http://')) {
    console.error('')
    console.error(`✗ Refusing: resolved URL is plain HTTP: ${url}`)
    console.error('  QStash only delivers to HTTPS endpoints and cannot reach localhost. Start')
    console.error('  the ngrok tunnel (`pnpm tunnel`) so NGROK_URL is populated, then re-run.')
    process.exit(1)
  }
}

export async function setupQstashSchedule(spec: QstashScheduleSpec): Promise<void> {
  const [{ publicUrl }, { APP_HOSTS }, { qstashClient }] = await Promise.all([
    import('@/shared/config/public-url'),
    import('@/shared/config/roots'),
    import('@/shared/services/providers/upstash/qstash-client'),
  ])

  const apply = process.argv.includes('--apply')
  const force = process.argv.includes('--force')

  const isProd = process.env.DRIZZLE_TARGET === 'prod'
  const baseUrl = isProd ? `https://${APP_HOSTS.prod[0]}` : publicUrl()
  const destination = `${baseUrl}/api/qstash-jobs?job=${spec.jobKey}`

  console.log(`--- ${spec.title} ---`)
  console.log(`Mode:        ${apply ? 'APPLY' : 'dry-run (pass --apply to create)'}`)
  console.log(`DB target:   ${process.env.DRIZZLE_TARGET ?? '(unset → dev)'}`)
  console.log(`Base URL:    ${baseUrl}`)
  console.log(`Destination: ${destination}`)
  console.log(`Cron:        ${spec.cron} (${spec.cronLabel})`)
  console.log('')

  assertReachableDestination(baseUrl, isProd)

  const existing = await qstashClient.schedules.list()
  const dupes = existing.filter(s => s.destination === destination)

  if (dupes.length > 0) {
    console.warn(`⚠️  Found ${dupes.length} existing schedule(s) pointing at this destination:`)
    for (const s of dupes) {
      console.warn(`   - scheduleId=${s.scheduleId}  cron="${s.cron}"  paused=${s.isPaused}`)
    }
    if (!force) {
      console.warn('')
      console.warn('Refusing to create a duplicate. Delete the existing schedule in the')
      console.warn('QStash dashboard (https://console.upstash.com/qstash) or re-run with')
      console.warn('--force to create another. Aborting.')
      process.exit(1)
    }
    console.warn('--force set — proceeding to create another anyway.')
    console.warn('')
  }

  if (!apply) {
    console.log('Dry run — no schedule created. Re-run with --apply to commit.')
    process.exit(0)
  }

  const result = await qstashClient.schedules.create({
    destination,
    cron: spec.cron,
    method: 'POST',
    body: JSON.stringify({}),
    headers: { 'Content-Type': 'application/json' },
  })

  console.log('')
  console.log('--- CREATED ---')
  console.log(`scheduleId: ${result.scheduleId}`)
  console.log('')
  console.log('Verify the next tick fires by either:')
  for (const hint of spec.verifyHints) {
    console.log(`  - ${hint}`)
  }
}
