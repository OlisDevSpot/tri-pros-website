import type { CardOption } from '../types'

interface BaseEntry { id: string, label: string, description?: string }
interface IconEntry extends BaseEntry { assetKind: 'icon', name: string }
interface ImageEntry extends BaseEntry { assetKind: 'image', alt: string }
interface TextEntry extends BaseEntry { assetKind: 'text' }
type OptionEntry = IconEntry | ImageEntry | TextEntry

/** Icon-backed option. `name` defaults to `id`. */
export function icon(
  id: string,
  label: string,
  opts?: { name?: string, description?: string },
): IconEntry {
  return { assetKind: 'icon', id, label, name: opts?.name ?? id, description: opts?.description }
}

/** Image-backed option. `alt` defaults to `label`; `src` is resolved by `cardOptions`. */
export function img(
  id: string,
  label: string,
  opts?: { alt?: string, description?: string },
): ImageEntry {
  return { assetKind: 'image', id, label, alt: opts?.alt ?? label, description: opts?.description }
}

/** Text-only option (no asset). */
export function text(
  id: string,
  label: string,
  opts?: { description?: string },
): TextEntry {
  return { assetKind: 'text', id, label, description: opts?.description }
}

/**
 * Build render-ordered CardOptions. Image `src` is supplied by the consumer's
 * resolver (e.g. funnels pass `(id) => `/funnels/${scope}/${dimension}/${id}.webp``);
 * the framework holds no asset-path convention of its own.
 */
export function cardOptions(
  entries: OptionEntry[],
  resolveImageSrc?: (id: string) => string,
): CardOption[] {
  return entries.map((e) => {
    if (e.assetKind === 'icon') {
      return { id: e.id, label: e.label, description: e.description, asset: { kind: 'icon', name: e.name } }
    }
    if (e.assetKind === 'image') {
      if (!resolveImageSrc) {
        throw new Error(`cardOptions: image option "${e.id}" needs a resolveImageSrc resolver`)
      }
      return {
        id: e.id,
        label: e.label,
        description: e.description,
        asset: { kind: 'image', src: resolveImageSrc(e.id), alt: e.alt },
      }
    }
    return { id: e.id, label: e.label, description: e.description }
  })
}
