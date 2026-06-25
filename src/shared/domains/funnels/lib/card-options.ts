import type { FunnelSlug } from '@/shared/domains/funnels/constants/slugs'
import type { CardOption } from '@/shared/domains/funnels/types'

/**
 * Terse, convention-driven authoring for card-select options. Replaces the
 * per-option boilerplate (`{ label, asset: { kind, src, alt } }` × N) with one
 * call per dimension:
 *
 *   options: cardOptions('kitchens', 'layout', [
 *     img('l-shape', 'L-shaped'),
 *     icon('open', 'Open-concept'),
 *     text('not-sure', 'Not sure'),
 *   ])
 *
 * `cardOptions` derives each image asset's path by convention
 * (`/funnels/{scope}/{dimension}/{id}.webp`), defaults image `alt` → `label` and
 * icon `name` → `id`, and preserves order (the returned array IS the render
 * order — there is no separate `optionIds`). Image, icon, and text entries mix
 * freely within one dimension.
 */

/** Image assets live under a funnel's own folder, or the shared `common` set. */
export type OptionScope = FunnelSlug | 'common'

interface BaseEntry { id: string, label: string, description?: string }
interface ImageEntry extends BaseEntry { kind: 'image', alt?: string }
interface IconEntry extends BaseEntry { kind: 'icon', name?: string }
interface TextEntry extends BaseEntry { kind: 'text' }
type OptionEntry = ImageEntry | IconEntry | TextEntry

/** Image-tile option at `/funnels/{scope}/{dimension}/{id}.webp`. `alt` defaults to `label`. */
export function img(id: string, label: string, opts?: { alt?: string, description?: string }): ImageEntry {
  return { kind: 'image', id, label, alt: opts?.alt, description: opts?.description }
}

/** Diagram-tile option resolved from `OPTION_ICONS`. `name` defaults to `id`. */
export function icon(id: string, label: string, opts?: { name?: string, description?: string }): IconEntry {
  return { kind: 'icon', id, label, name: opts?.name, description: opts?.description }
}

/** Text-only option (no tile art). */
export function text(id: string, label: string, opts?: { description?: string }): TextEntry {
  return { kind: 'text', id, label, description: opts?.description }
}

/** Resolve terse entries into ordered `CardOption`s, deriving paths/defaults by convention. */
export function cardOptions(scope: OptionScope, dimension: string, entries: OptionEntry[]): CardOption[] {
  return entries.map((e) => {
    const base: CardOption = e.description
      ? { id: e.id, label: e.label, description: e.description }
      : { id: e.id, label: e.label }
    if (e.kind === 'image') {
      return { ...base, asset: { kind: 'image', src: `/funnels/${scope}/${dimension}/${e.id}.webp`, alt: e.alt ?? e.label } }
    }
    if (e.kind === 'icon') {
      return { ...base, asset: { kind: 'icon', name: e.name ?? e.id } }
    }
    return base
  })
}
