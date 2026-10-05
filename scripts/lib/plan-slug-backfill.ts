/**
 * Pure planner for `scripts/backfill-trade-slugs.ts`. No I/O, so it is
 * testable with fixtures (`scripts/verify-slug-backfill-plan.ts`).
 *
 * A row is `write` when its stored slug is blank, `same` when stored equals
 * derived, and `conflict` when a stored slug differs — the backfill never
 * overwrites a slug a human typed. Duplicate and empty derived slugs are
 * reported separately; the caller refuses to write while either is non-empty,
 * because a blank or colliding slug would break URLs and registry keys.
 */
export interface SlugBackfillRow {
  pageId: string
  title: string
  disabled: boolean
  /** The stored `Slug` rich_text, trimmed; '' when blank. */
  current: string
  /** `slugifyTradeName(title)`. */
  derived: string
}

export type SlugBackfillAction = 'write' | 'same' | 'conflict'

export interface SlugBackfillPlan {
  rows: Array<SlugBackfillRow & { action: SlugBackfillAction }>
  /** Derived slugs shared by more than one row, disabled rows included. */
  duplicates: Array<{ slug: string, titles: string[] }>
  /** Titles whose derived slug is empty. */
  unslugifiable: string[]
  writes: number
  conflicts: number
}

export function planSlugBackfill(rows: SlugBackfillRow[]): SlugBackfillPlan {
  const titlesBySlug = new Map<string, string[]>()
  for (const row of rows) {
    if (row.derived !== '') {
      titlesBySlug.set(row.derived, [...(titlesBySlug.get(row.derived) ?? []), row.title])
    }
  }

  const planned = rows.map((row) => {
    const action: SlugBackfillAction = row.current === ''
      ? 'write'
      : row.current === row.derived ? 'same' : 'conflict'
    return { ...row, action }
  })

  return {
    rows: planned,
    duplicates: [...titlesBySlug.entries()]
      .filter(([, titles]) => titles.length > 1)
      .map(([slug, titles]) => ({ slug, titles })),
    unslugifiable: rows.filter(row => row.derived === '').map(row => row.title),
    writes: planned.filter(row => row.action === 'write').length,
    conflicts: planned.filter(row => row.action === 'conflict').length,
  }
}

/** `null` when the data source's `Slug` property is usable; otherwise the message to print before exiting. */
export function slugPropertyProblem(prop: { type: string } | undefined): string | null {
  if (!prop) {
    return 'no "Slug" property — create it in the Notion UI as type "Text"'
  }
  if (prop.type !== 'rich_text') {
    return `"Slug" is type "${prop.type}", not rich_text — recreate it as type "Text"`
  }
  return null
}
