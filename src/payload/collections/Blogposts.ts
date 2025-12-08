import type { CollectionConfig, Field, FieldHook } from 'payload'
import {
  BlocksFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

function format(value: string) {
  return value
    .toLowerCase()
    .replace(/ /g, '-')
    .replace(/[^\w-]+/g, '')
}

function formatSlug(fallback: string): FieldHook {
  return ({ value, originalDoc, data }) => {
    if (typeof value === 'string') {
      return format(value)
    }

    const fallbackData = data?.[fallback] || originalDoc?.[fallback]

    if (fallbackData && typeof fallbackData === 'string') {
      return format(fallbackData)
    }

    return value
  }
}

export const TitleField: Field = {
  name: 'title',
  type: 'text',
  required: true,
}

export const SlugField: Field = {
  name: 'slug',
  type: 'text',
  required: true,
  unique: true,
  hooks: {
    beforeValidate: [
      formatSlug('title'),
    ],
  },
}

export const Blogposts: CollectionConfig = {
  slug: 'blogposts',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'updatedAt', 'createdAt'],
  },
  fields: [
    TitleField,
    SlugField,
    {
      name: 'body',
      type: 'richText',
      required: true,
      editor: lexicalEditor({
        features: ({ rootFeatures }) => {
          return [
            ...rootFeatures,
            HorizontalRuleFeature(),
            BlocksFeature({ blocks: [] }),
            InlineToolbarFeature(),
            HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
          ]
        },
      }),
    },
  ],
}
