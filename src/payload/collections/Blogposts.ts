import type { CollectionConfig } from 'payload'
import {
  BlocksFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

export const Blogposts: CollectionConfig = {
  slug: 'blogposts',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'updatedAt', 'createdAt'],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
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
