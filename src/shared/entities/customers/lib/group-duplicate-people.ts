import { normalizeEmail } from '@/shared/lib/email'
import { toNationalDigits } from '@/shared/lib/phone'

export interface PersonIdentityRow {
  id: string
  phone: string | null
  email: string | null
  createdAt: string
}

/** Earliest record first, ties by id, so a person's id and anchor are stable across reads. */
export function compareRecordAge(a: { id: string, createdAt: string }, b: { id: string, createdAt: string }): number {
  const byTime = Date.parse(a.createdAt) - Date.parse(b.createdAt)
  if (byTime !== 0) {
    return byTime
  }
  if (a.id === b.id) {
    return 0
  }
  return a.id < b.id ? -1 : 1
}

/**
 * One person = records sharing a normalized phone OR email, chained (a~b by
 * phone and b~c by email make one person), since there is no dedup at intake.
 * Returns customerId → personId, where personId is the group's earliest record.
 */
export function groupDuplicatePeople(rows: readonly PersonIdentityRow[]): Map<string, string> {
  const sorted = [...rows].sort(compareRecordAge)
  const age = new Map(sorted.map((row, index) => [row.id, index]))
  const parent = new Map(sorted.map(row => [row.id, row.id]))

  const find = (id: string): string => {
    let root = id
    while (parent.get(root) !== root) {
      root = parent.get(root)!
    }
    let node = id
    while (node !== root) {
      const next = parent.get(node)!
      parent.set(node, root)
      node = next
    }
    return root
  }

  const union = (a: string, b: string) => {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA === rootB) {
      return
    }
    // The older root always wins, so the root is the group's earliest record.
    if (age.get(rootA)! < age.get(rootB)!) {
      parent.set(rootB, rootA)
    }
    else {
      parent.set(rootA, rootB)
    }
  }

  const firstIdByKey = new Map<string, string>()
  for (const row of sorted) {
    const phone = toNationalDigits(row.phone)
    const email = normalizeEmail(row.email)
    const keys = [phone && `phone:${phone}`, email && `email:${email}`].filter((key): key is string => !!key)
    for (const key of keys) {
      const firstId = firstIdByKey.get(key)
      if (firstId) {
        union(firstId, row.id)
      }
      else {
        firstIdByKey.set(key, row.id)
      }
    }
  }

  return new Map(sorted.map(row => [row.id, find(row.id)]))
}
