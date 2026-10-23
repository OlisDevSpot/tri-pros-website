import type { FormPartId } from '@/features/proposal-flow/constants/form-parts'
import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { FORM_PART_FIELD_PREFIXES, FORM_PART_IDS } from '@/features/proposal-flow/constants/form-parts'
import { formatAsDollars } from '@/shared/lib/formatters'
import { computeFinalTcp } from '@/shared/modules/proposals/core/lib/financials'
import { formatProjectType } from './format-project-type'

const FIELD_PART_IDS = Object.keys(FORM_PART_FIELD_PREFIXES) as (keyof typeof FORM_PART_FIELD_PREFIXES)[]

export function partOfFieldPath(path: string): FormPartId | null {
  for (const id of FIELD_PART_IDS) {
    if (FORM_PART_FIELD_PREFIXES[id].some(prefix => path === prefix || path.startsWith(`${prefix}.`))) {
      return id
    }
  }
  return null
}

function collectPaths(node: unknown, isLeaf: (node: object) => boolean, path: string, out: string[]) {
  if (node === null || typeof node !== 'object') {
    return
  }
  if (!Array.isArray(node) && isLeaf(node)) {
    out.push(path)
    return
  }
  for (const [key, child] of Object.entries(node)) {
    collectPaths(child, isLeaf, path ? `${path}.${key}` : key, out)
  }
}

export function dirtyParts(dirtyFields: unknown): Set<FormPartId> {
  const parts = new Set<FormPartId>()
  walkDirty(dirtyFields, '', parts)
  return parts
}

function walkDirty(node: unknown, path: string, parts: Set<FormPartId>) {
  if (node === true) {
    const part = partOfFieldPath(path)
    if (part) {
      parts.add(part)
    }
    return
  }
  if (node === null || typeof node !== 'object') {
    return
  }
  for (const [key, child] of Object.entries(node)) {
    walkDirty(child, path ? `${path}.${key}` : key, parts)
  }
}

function errorPaths(errors: unknown): string[] {
  const paths: string[] = []
  collectPaths(errors, node => typeof (node as { message?: unknown }).message === 'string' || typeof (node as { type?: unknown }).type === 'string', '', paths)
  return paths
}

export function firstErrorPath(errors: unknown): string | null {
  return errorPaths(errors)[0] ?? null
}

export function firstErrorPart(errors: unknown): FormPartId | null {
  const paths = errorPaths(errors)
  const found = new Set<FormPartId>()
  for (const path of paths) {
    const part = partOfFieldPath(path)
    if (part) {
      found.add(part)
    }
  }
  return FORM_PART_IDS.find(id => found.has(id)) ?? null
}

export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

export function summarizeParts(
  values: ProposalFormSchema,
  fileCount: number | undefined,
): Record<FormPartId, { rail: string, list: string }> {
  const { type, timeAllocated, sow } = values.project.data
  const typeLabel = formatProjectType(type)
  const sections = plural(sow.length, 'section')
  const funding = formatAsDollars(computeFinalTcp({ funding: values.funding, sow }))
  const files = fileCount === undefined ? '' : plural(fileCount, 'file')

  return {
    general: { rail: timeAllocated || typeLabel, list: [typeLabel, timeAllocated].filter(Boolean).join(' · ') },
    sow: { rail: sections, list: sections },
    funding: { rail: funding, list: funding },
    files: { rail: files, list: files },
  }
}
