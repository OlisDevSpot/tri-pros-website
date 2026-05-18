import type { PropertyFilter } from '../types'

export function buildPropertyFilter(
  propertyName: string,
  notionType: string,
  query: string,
): PropertyFilter {
  switch (notionType) {
    case 'title':
      return { property: propertyName, title: { contains: query } }
    case 'rich_text':
      return { property: propertyName, rich_text: { contains: query } }
    case 'phone_number':
      return { property: propertyName, phone_number: { contains: query } }
    case 'select':
      return { property: propertyName, select: { equals: query } } // or contains? select uses equals
    case 'date':
      return { property: propertyName, date: { on_or_after: query } } // you probably want real date parsing
    case 'people':
      return { property: propertyName, people: { contains: query } } // check Notion docs: people filter shape differs
    case 'relation':
      return { property: propertyName, relation: { contains: query } } // likewise: relation filter differs
    default:
      // If your schema includes other types, either add cases or throw.
      throw new Error(`Unsupported filter type: ${notionType}`)
  }
}
