import assert from 'node:assert/strict'

import { dbUrlLine, installNeeded, parseWorktrees, resolveBranch, schemaChanged, slotEnvLocal } from './lib/review-slot'

const porcelain = [
  'worktree /repo',
  'HEAD aaa',
  'branch refs/heads/main',
  '',
  'worktree /repo/.worktrees/data-views',
  'HEAD bbb',
  'branch refs/heads/feat/data-views',
  '',
  'worktree /repo/.worktrees/review',
  'HEAD ccc',
  'detached',
  '',
  'worktree /repo/.worktrees/prod',
  'HEAD ddd',
  'detached',
  '',
].join('\n')
const wts = parseWorktrees(porcelain)
assert.equal(wts.length, 4)
assert.deepEqual(wts[1], { path: '/repo/.worktrees/data-views', branch: 'feat/data-views', head: 'bbb' })
assert.equal(wts[2].branch, null)

const branches = ['main', 'feat/data-views', 'feat/pushed-only']
assert.deepEqual(resolveBranch(wts, branches, 'feat/data-views'), { branch: 'feat/data-views', path: '/repo/.worktrees/data-views' })
assert.deepEqual(resolveBranch(wts, branches, 'data-views'), { branch: 'feat/data-views', path: '/repo/.worktrees/data-views' })
assert.deepEqual(resolveBranch(wts, branches, 'feat/pushed-only'), { branch: 'feat/pushed-only', path: null })
assert.equal(resolveBranch(wts, branches, 'review'), null)
assert.equal(resolveBranch(wts, branches, 'prod'), null)
assert.equal(resolveBranch(wts, branches, 'nope'), null)

assert.equal(installNeeded(null, 'h1'), true)
assert.equal(installNeeded('h1', 'h1'), false)
assert.equal(installNeeded('h0', 'h1'), true)

const main = 'DEV_LOGIN_SECRET=s\nPORT=3000\nEMAIL_DEV_OVERRIDE=x@y\n'
const lane = 'PORT=3010\nNEON_BRANCH_ID=br-lane\nDATABASE_DEV_URL="postgres://lane"\n'
const fromLane = slotEnvLocal({ mainEnvLocal: main, mainEnv: 'DATABASE_DEV_URL=postgres://shared\n', laneEnvLocal: lane })
assert.equal(fromLane.db, 'lane copy')
assert.match(fromLane.text, /^DATABASE_DEV_URL="postgres:\/\/lane"$/m)
assert.match(fromLane.text, /^PORT=3001$/m)
assert.doesNotMatch(fromLane.text, /PORT=30(00|10)|NEON_BRANCH_ID/)
assert.match(fromLane.text, /^DEV_LOGIN_SECRET=s$/m)

const fromEnv = slotEnvLocal({ mainEnvLocal: main, mainEnv: 'DATABASE_DEV_URL=postgres://shared\n', laneEnvLocal: null })
assert.equal(fromEnv.db, 'shared dev')
assert.match(fromEnv.text, /^DATABASE_DEV_URL=postgres:\/\/shared$/m)

const mainWithUrl = 'NEON_BRANCH_ID=br-main\nPORT=3000\nDATABASE_DEV_URL=postgres://mainlocal\n'
const fromMainLocal = slotEnvLocal({ mainEnvLocal: mainWithUrl, mainEnv: 'DATABASE_DEV_URL=postgres://shared\n', laneEnvLocal: null })
assert.equal(fromMainLocal.db, 'shared dev')
assert.equal(fromMainLocal.text.split('\n').filter(line => line.startsWith('DATABASE_DEV_URL=')).length, 1)
assert.match(fromMainLocal.text, /^DATABASE_DEV_URL=postgres:\/\/mainlocal$/m)
assert.doesNotMatch(fromMainLocal.text, /NEON_BRANCH_ID|PORT=3000/)
assert.match(fromMainLocal.text, /^PORT=3001$/m)

const inherited = slotEnvLocal({ mainEnvLocal: main, mainEnv: 'DATABASE_DEV_URL=postgres://shared\n', laneEnvLocal: 'DATABASE_DEV_URL=postgres://shared\n' })
assert.equal(inherited.db, 'shared dev')

const emptyLane = slotEnvLocal({ mainEnvLocal: main, mainEnv: 'DATABASE_DEV_URL=postgres://shared\n', laneEnvLocal: 'DATABASE_DEV_URL=\n' })
assert.equal(emptyLane.db, 'shared dev')
assert.match(emptyLane.text, /^DATABASE_DEV_URL=postgres:\/\/shared$/m)

assert.throws(() => slotEnvLocal({ mainEnvLocal: main, mainEnv: 'DATABASE_URL=postgres://prod\n', laneEnvLocal: 'PORT=3010\n' }), /no DATABASE_DEV_URL/)

assert.equal(schemaChanged(['src/shared/db/schema/meetings.ts']), true)
assert.equal(schemaChanged(['src/shared/constants/enums/user.ts']), true)
assert.equal(schemaChanged(['src/app/page.tsx']), false)

assert.equal(dbUrlLine('PORT=3000\nDATABASE_DEV_URL="postgres://x"\n'), 'DATABASE_DEV_URL="postgres://x"')
assert.equal(dbUrlLine('DATABASE_DEV_URL=\n'), null)
assert.equal(dbUrlLine('DATABASE_DEV_URL=""\n'), null)
assert.equal(dbUrlLine('DATABASE_DEV_URL=\'\'  \n'), null)
assert.equal(dbUrlLine('PORT=3000\nDATABASE_URL=postgres://prod\n'), null)

console.log('✅ review-slot decisions verified')
