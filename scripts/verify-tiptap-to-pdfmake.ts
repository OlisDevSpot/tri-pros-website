/* eslint-disable no-console */
import assert from 'node:assert/strict'
import { tiptapToPdfmake } from '@/shared/services/pdf/tiptap-to-pdfmake'

// paragraph
{
  const out = tiptapToPdfmake({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world.' }] }],
  })
  assert.deepEqual(out, [{ text: 'Hello world.', margin: [0, 0, 0, 4] }])
}

// heading (h2)
{
  const out = tiptapToPdfmake({
    type: 'doc',
    content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Site Preparation' }] }],
  })
  assert.deepEqual(out, [{ text: 'Site Preparation', style: 'h2', margin: [0, 8, 0, 4] }])
}

// bulletList with listItem children
{
  const out = tiptapToPdfmake({
    type: 'doc',
    content: [{
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First bullet' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second bullet' }] }] },
      ],
    }],
  })
  assert.equal(out.length, 1)
  assert.ok('ul' in (out[0] as Record<string, unknown>), 'top-level is ul')
  assert.equal((out[0] as { ul: unknown[] }).ul.length, 2)
}

// orderedList
{
  const out = tiptapToPdfmake({
    type: 'doc',
    content: [{
      type: 'orderedList',
      content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'One' }] }] },
      ],
    }],
  })
  assert.ok('ol' in (out[0] as Record<string, unknown>))
}

// text with marks → bold
{
  const out = tiptapToPdfmake({
    type: 'doc',
    content: [{
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Plain ' },
        { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' plain.' },
      ],
    }],
  })
  const para = out[0] as { text: unknown }
  assert.ok(Array.isArray(para.text), 'mixed marks → text array')
  const runs = para.text as Array<{ text: string, bold?: boolean }>
  assert.equal(runs[1].text, 'bold')
  assert.equal(runs[1].bold, true)
}

// unknown node type falls through to children
{
  const out = tiptapToPdfmake({
    type: 'doc',
    content: [{
      type: 'customBlock',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'nested' }] }],
    }],
  })
  assert.equal(out.length, 1)
  assert.equal((out[0] as { text: string }).text, 'nested')
}

// empty doc
{
  const out = tiptapToPdfmake({ type: 'doc', content: [] })
  assert.deepEqual(out, [])
}

console.log('✅ tiptapToPdfmake verified')
