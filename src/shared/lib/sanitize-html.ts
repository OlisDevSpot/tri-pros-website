// sanitize.ts
import sanitizeHtml from 'sanitize-html'

export function sanitizeUserHtml(dirty: string) {
  return sanitizeHtml(dirty, {
    // Keep this tight. Add tags only when you truly need them.
    allowedTags: [
      'p',
      'br',
      'strong',
      'em',
      'b',
      'i',
      'u',
      'ul',
      'ol',
      'li',
      'h1',
      'h2',
      'h3',
      'h4',
      'blockquote',
      'a',
      'code',
      'pre',
      'span',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
    ],
    allowedAttributes: {
      'a': ['href', 'title', 'target', 'rel'],
      '*': ['class'], // optional; remove if you don't need styling hooks
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    // Prevent tabnabbing + keep links sane
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href || ''
        const isExternal = /^https?:\/\//i.test(href)
        return {
          tagName,
          attribs: {
            ...attribs,
            target: isExternal ? '_blank' : attribs.target,
            rel: isExternal ? 'noopener noreferrer' : attribs.rel,
          },
        }
      },
    },
    // Drop *everything* you didn't allow
    disallowedTagsMode: 'discard',
  })
}
