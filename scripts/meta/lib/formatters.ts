// scripts/meta/lib/formatters.ts

export function printSuccess(message: string): void {
  console.log(`\n✅  ${message}`)
}

export function printError(message: string): void {
  console.error(`\n❌  ${message}`)
}

export function printInfo(message: string): void {
  console.log(`\nℹ️   ${message}`)
}

export function printTable(rows: Record<string, string | number>[]): void {
  if (rows.length === 0) {
    console.log('  (no data)')
    return
  }
  const keys = Object.keys(rows[0])
  const widths = keys.map(k =>
    Math.max(k.length, ...rows.map(r => String(r[k] ?? '').length)),
  )
  const header = keys.map((k, i) => k.padEnd(widths[i])).join('  │  ')
  const divider = widths.map(w => '─'.repeat(w)).join('──┼──')
  console.log(`\n  ${header}`)
  console.log(`  ${divider}`)
  for (const row of rows) {
    console.log(`  ${keys.map((k, i) => String(row[k] ?? '').padEnd(widths[i])).join('  │  ')}`)
  }
  console.log()
}

export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2))
}
