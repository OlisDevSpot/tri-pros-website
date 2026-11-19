import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { connect } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'

import { dbUrlLine, installNeeded, parseWorktrees, resolveBranch, REVIEW_PORT, REVIEW_SLOT_DIR, schemaChanged, slotEnvLocal } from './lib/review-slot'

function git(args: string[], cwd?: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' })
}

function readOr(path: string, fallback: string): string
function readOr(path: string, fallback: null): string | null
function readOr(path: string, fallback: string | null): string | null {
  return existsSync(path) ? readFileSync(path, 'utf8') : fallback
}

function portAnswers(port: number): Promise<boolean> {
  return new Promise((done) => {
    const socket = connect({ host: '127.0.0.1', port })
    const finish = (answered: boolean) => {
      socket.destroy()
      done(answered)
    }
    socket.setTimeout(500, () => finish(false))
    socket.once('connect', () => finish(true))
    socket.once('error', () => finish(false))
  })
}

function fail(...lines: string[]): void {
  console.error(lines.join('\n'))
  process.exitCode = 1
}

async function main(): Promise<void> {
  const arg = process.argv[2]
  if (!arg) {
    fail('usage: pnpm review <branch | worktree folder>')
    return
  }

  const commonDir = git(['rev-parse', '--path-format=absolute', '--git-common-dir']).trim()
  const root = dirname(commonDir)
  const slot = resolve(root, REVIEW_SLOT_DIR)

  if (!existsSync(slot)) {
    fail(
      `No review slot at ${REVIEW_SLOT_DIR}. One-time setup, from the repo root:`,
      `  git worktree add --detach ${REVIEW_SLOT_DIR} origin/main`,
      `  cp .env ${REVIEW_SLOT_DIR}/.env`,
      `  pnpm --dir ${REVIEW_SLOT_DIR} install`,
      `then: pnpm review ${arg}`,
    )
    return
  }

  const worktrees = parseWorktrees(git(['worktree', 'list', '--porcelain'], root))
  const branches = git(['for-each-ref', '--format=%(refname:short)', 'refs/heads'], root).split('\n').filter(Boolean)
  const resolved = resolveBranch(worktrees, branches, arg)
  if (resolved === null) {
    fail(
      `No branch or worktree folder matches "${arg}". Worktrees:`,
      ...worktrees.map(w => `  ${w.path.split('/').pop()}  ${w.branch ?? '(detached)'}`),
      'A branch name works too.',
    )
    return
  }
  const { branch, path: lanePath } = resolved

  const sha = git(['rev-parse', `refs/heads/${branch}`], root).trim()

  const dirty = git(['status', '--porcelain'], slot).trim()
  if (dirty !== '') {
    fail(`The review slot has uncommitted changes; clean them first:`, dirty)
    return
  }

  const targetHash = createHash('sha256')
    .update(git(['show', `${sha}:package.json`], root))
    .update(git(['show', `${sha}:pnpm-lock.yaml`], root))
    .digest('hex')
  const installedHash = (() => {
    try {
      return git(['config', '--get', 'lanes.reviewInstalled'], root).trim() || null
    }
    catch {
      return null
    }
  })()
  const needsInstall = installNeeded(installedHash, targetHash)
  if (needsInstall && await portAnswers(REVIEW_PORT)) {
    fail(`stop the dev server on :${REVIEW_PORT}, then run pnpm review ${arg} again`)
    return
  }

  git(['checkout', '--detach', sha], slot)

  if (needsInstall) {
    try {
      execFileSync('pnpm', ['install', '--frozen-lockfile'], { cwd: slot, stdio: 'inherit' })
    }
    catch {
      fail('pnpm install failed in the review slot; the next run retries it.')
      return
    }
    git(['config', 'lanes.reviewInstalled', targetHash], root)
  }

  const slotEnvPath = join(slot, '.env.local')
  const oldEnv = readOr(slotEnvPath, '')
  let env: ReturnType<typeof slotEnvLocal>
  try {
    env = slotEnvLocal({
      mainEnvLocal: readOr(join(root, '.env.local'), ''),
      mainEnv: readOr(join(root, '.env'), ''),
      laneEnvLocal: lanePath === null ? null : readOr(join(lanePath, '.env.local'), null),
    })
  }
  catch (error) {
    fail(error instanceof Error ? error.message : String(error))
    return
  }
  const dbChanged = dbUrlLine(oldEnv) !== dbUrlLine(env.text)
  writeFileSync(slotEnvPath, env.text)

  const changed = git(['diff', '--name-only', `origin/main...${sha}`], root).split('\n').filter(Boolean)
  if (schemaChanged(changed) && env.db === 'shared dev') {
    console.log('warning: this lane changes the schema but runs on shared dev; its pages may fail')
  }

  const [short, subject] = git(['show', '-s', '--format=%h%n%s', sha], root).trim().split('\n')
  console.log(`branch:  ${branch}`)
  console.log(`commit:  ${short} ${subject}`)
  console.log(`url:     http://localhost:${REVIEW_PORT}`)
  console.log(`db:      ${env.db}`)
  console.log(needsInstall || dbChanged ? 'restart the dev server (only you start it)' : 'hot reload picks it up')
  if (dbChanged) {
    console.log('you will be signed out: sessions live in the database')
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
