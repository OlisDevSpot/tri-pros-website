import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'

// passing only the 'properties' seciton of the page retrieved
type Props = PageObjectResponse['properties']

function must(props: Props, key: string) {
  const p = props[key]
  if (!p)
    throw new Error(`Missing property "${key}"`)
  return p
}

export function titleText(props: Props, key: string) {
  const p = must(props, key)
  if (p.type !== 'title')
    throw new Error(`"${key}" is not title`)
  return p.title.map(t => t.plain_text).join('')
}

export function richText(props: Props, key: string) {
  const p = must(props, key)
  if (p.type !== 'rich_text')
    throw new Error(`"${key}" is not rich_text`)
  return p.rich_text.map(t => t.plain_text).join('')
}

export function email(props: Props, key: string) {
  const p = must(props, key)
  if (p.type !== 'email')
    throw new Error(`"${key}" is not email`)
  return p.email ?? null
}

export function phone(props: Props, key: string) {
  const p = must(props, key)
  if (p.type !== 'phone_number')
    throw new Error(`"${key}" is not phone_number`)
  return p.phone_number ?? null
}

export function selectName<T>(props: Props, key: string) {
  const p = must(props, key)
  if (p.type !== 'select')
    throw new Error(`"${key}" is not select`)
  return p.select?.name as T ?? null
}

export function dateISO(props: Props, key: string) {
  const p = must(props, key)
  if (p.type !== 'date')
    throw new Error(`"${key}" is not date`)
  return p.date?.start ?? null
}

export function peopleIds(props: Props, key: string) {
  const p = must(props, key)
  if (p.type !== 'people')
    throw new Error(`"${key}" is not people`)
  return p.people.map(u => u.id)
}

export function relationIds(props: Props, key: string) {
  const p = must(props, key)
  if (p.type !== 'relation')
    throw new Error(`"${key}" is not relation`)

  return p.relation.map(r => r.id)
}
