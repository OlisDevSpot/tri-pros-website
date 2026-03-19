// scripts/meta/index.ts
import { spawn } from 'node:child_process'

const command = process.argv[2]

const commands: Record<string, { file: string; description: string }> = {
  verify: { file: 'scripts/meta/setup/verify-credentials.ts', description: 'Smoke test all credentials' },
  performance: { file: 'scripts/meta/reports/pull-performance.ts', description: 'Pull campaign stats (optional: date preset)' },
  'manage-ad': { file: 'scripts/meta/ads/manage-ad.ts', description: 'Interactively pause or activate an ad' },
  'create-campaign': { file: 'scripts/meta/campaigns/create-campaign.ts', description: 'Wizard: create campaign → ad set → ad' },
}

if (!command || !commands[command]) {
  console.log('\nUsage: pnpm meta <command>\n')
  console.log('Commands:')
  for (const [name, { description }] of Object.entries(commands)) {
    console.log(`  ${name.padEnd(20)} ${description}`)
  }
  console.log()
  process.exit(command ? 1 : 0)
}

// Re-run tsx with the target file, forwarding remaining args
const child = spawn(
  'node_modules/.bin/tsx',
  [commands[command].file, ...process.argv.slice(3)],
  { stdio: 'inherit', cwd: process.cwd() },
)
child.on('error', (err) => {
  const isNotFound = (err as NodeJS.ErrnoException).code === 'ENOENT'
  console.error(isNotFound
    ? '❌  tsx not found — run `pnpm install` first'
    : `❌  Failed to spawn process: ${err.message}`)
  process.exit(1)
})
child.on('exit', code => process.exit(code ?? 0))
