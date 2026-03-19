// scripts/meta/index.ts
import { spawn } from 'node:child_process'

const command = process.argv[2]

const commands: Record<string, string> = {
  verify: 'scripts/meta/setup/verify-credentials.ts',
  performance: 'scripts/meta/reports/pull-performance.ts',
  'manage-ad': 'scripts/meta/ads/manage-ad.ts',
  'create-campaign': 'scripts/meta/campaigns/create-campaign.ts',
}

if (!command || !commands[command]) {
  console.log('\nUsage: pnpm meta <command>\n')
  console.log('Commands:')
  for (const [name, file] of Object.entries(commands)) {
    console.log(`  ${name.padEnd(20)} ${file}`)
  }
  console.log()
  process.exit(command ? 1 : 0)
}

// Re-run tsx with the target file, forwarding remaining args
const child = spawn(
  'node_modules/.bin/tsx',
  [commands[command], ...process.argv.slice(3)],
  { stdio: 'inherit', cwd: process.cwd() },
)
child.on('exit', code => process.exit(code ?? 0))
