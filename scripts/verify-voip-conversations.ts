import assert from 'node:assert/strict'

import { subject } from '@casl/ability'
import { PgDialect } from 'drizzle-orm/pg-core'

import { filterFor } from '@/shared/dal/server/lib/permissions/core'
import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'
import { voipMessageServerSpec } from '@/shared/entities/voip-messages/lib/server-spec'

const dispatcher = defineAbilitiesFor({ id: 'user-dispatcher', role: 'dispatcher' })
const agent = defineAbilitiesFor({ id: 'user-agent', role: 'agent' })
const superAdmin = defineAbilitiesFor({ id: 'user-admin', role: 'super-admin' })

const mainLine = { id: 'did-main', isMainLine: true, assignedUserId: null }
const agentLine = { id: 'did-agent', isMainLine: false, assignedUserId: 'user-agent' }
const otherLine = { id: 'did-other', isMainLine: false, assignedUserId: 'user-someone-else' }
const line = (row: { id: string, isMainLine: boolean, assignedUserId: string | null }) => subject('VoipDid', { ...row })

// Lines: the main line for dispatchers, an agent's own line for that agent, every line for a super-admin.
assert.equal(dispatcher.can('read', line(mainLine)), true)
assert.equal(dispatcher.can('read', line(agentLine)), false)
assert.equal(agent.can('read', line(agentLine)), true)
assert.equal(agent.can('read', line(otherLine)), false)
assert.equal(agent.can('read', line(mainLine)), false)
assert.equal(superAdmin.can('read', line(otherLine)), true)

// Texts follow their line: the compiled read walks to voip_dids.
const dialect = new PgDialect()
const dispatcherTexts = dialect.sqlToQuery(filterFor(dispatcher, 'read', voipMessageServerSpec, undefined))
assert.ok(dispatcherTexts.sql.includes('"is_main_line"'), dispatcherTexts.sql)
const agentTexts = dialect.sqlToQuery(filterFor(agent, 'read', voipMessageServerSpec, undefined))
assert.ok(agentTexts.sql.includes('"assigned_user_id"'), agentTexts.sql)
assert.ok(agentTexts.params.includes('user-agent'), JSON.stringify(agentTexts.params))

console.log('✅ voip rules verified')
