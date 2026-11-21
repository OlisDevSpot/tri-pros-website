export const REVIEW_PORT = 3001
export const REVIEW_SLOT_DIR = '.worktrees/review'

const SCHEMA_PREFIXES = ['src/shared/db/schema/', 'src/shared/constants/enums/']
const DROPPED_KEYS = ['PORT', 'DATABASE_DEV_URL', 'NEON_BRANCH_ID']

export interface Worktree {
  path: string
  branch: string | null
  head: string
}

export function parseWorktrees(porcelain: string): Worktree[] {
  const worktrees: Worktree[] = []
  for (const block of porcelain.split(/\r?\n\r?\n/)) {
    let path: string | null = null
    let head = ''
    let branch: string | null = null
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('worktree ')) {
        path = line.slice('worktree '.length)
      }
      else if (line.startsWith('HEAD ')) {
        head = line.slice('HEAD '.length)
      }
      else if (line.startsWith('branch ')) {
        branch = line.slice('branch '.length).replace(/^refs\/heads\//, '')
      }
    }
    if (path !== null) {
      worktrees.push({ path, branch, head })
    }
  }
  return worktrees
}

export function resolveBranch(
  worktrees: Worktree[],
  branches: string[],
  arg: string,
): { branch: string, path: string | null } | null {
  if (branches.includes(arg)) {
    const holder = worktrees.find(w => w.branch === arg)
    return { branch: arg, path: holder?.path ?? null }
  }
  const byFolder = worktrees.filter(w => w.branch !== null && w.path.split('/').pop() === arg)
  if (byFolder.length === 1 && byFolder[0].branch !== null) {
    return { branch: byFolder[0].branch, path: byFolder[0].path }
  }
  return null
}

export function installNeeded(installedHash: string | null, targetHash: string): boolean {
  return installedHash !== targetHash
}

function lineFor(key: string, text: string): string | null {
  const pattern = new RegExp(`^${key}\\s*=`)
  return text.split(/\r?\n/).find(line => pattern.test(line)) ?? null
}

export function dbUrlLine(envText: string): string | null {
  const line = lineFor('DATABASE_DEV_URL', envText)
  if (line === null) {
    return null
  }
  const value = line.slice(line.indexOf('=') + 1).trim()
  return value === '' || value === '""' || value === '\'\'' ? null : line
}

export function slotEnvLocal(input: {
  mainEnvLocal: string
  mainEnv: string
  laneEnvLocal: string | null
}): { text: string, db: 'lane copy' | 'shared dev' } {
  const laneLine = input.laneEnvLocal === null ? null : dbUrlLine(input.laneEnvLocal)
  const sharedLine = dbUrlLine(input.mainEnvLocal) ?? dbUrlLine(input.mainEnv)
  const inheritedOnly = laneLine !== null && laneLine === sharedLine
  const chosen = laneLine ?? sharedLine
  if (chosen === null) {
    throw new Error('no DATABASE_DEV_URL in the lane .env.local, main .env.local or main .env')
  }
  const dropped = DROPPED_KEYS.map(key => new RegExp(`^${key}\\s*=`))
  const kept = input.mainEnvLocal
    .split(/\r?\n/)
    .filter(line => line !== '' && !dropped.some(pattern => pattern.test(line)))
  return {
    text: `${[...kept, `PORT=${REVIEW_PORT}`, chosen].join('\n')}\n`,
    db: laneLine === null || inheritedOnly ? 'shared dev' : 'lane copy',
  }
}

export function schemaChanged(paths: string[]): boolean {
  return paths.some(path => SCHEMA_PREFIXES.some(prefix => path.startsWith(prefix)))
}
