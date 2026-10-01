/* eslint-disable no-console */
import assert from 'node:assert/strict'
import { createElement, useState } from 'react'
import { renderToString } from 'react-dom/server'
import { useStableCallbacks } from '@/shared/hooks/use-stable-callbacks'

// A render-phase state update makes React render the component again in the same pass,
// which is how the server renderer can exercise a second render.
function useRenderTwice() {
  const [pass, setPass] = useState(0)
  if (pass < 1) {
    setPass(pass + 1)
  }
  return pass
}

function FreshValueEveryRender() {
  useRenderTwice()
  useStableCallbacks({ items: [] as string[] })
  return null
}

assert.doesNotThrow(() => renderToString(createElement(FreshValueEveryRender)), 'a value new on every render does not loop')

const seen: object[] = []
const items: string[] = []
function NewClosureEveryRender() {
  const pass = useRenderTwice()
  seen.push(useStableCallbacks({ items, onClick: () => pass }))
  return null
}

renderToString(createElement(NewClosureEveryRender))
assert.ok(seen.length >= 2, 'the component rendered more than once')
assert.ok(seen.every(stable => stable === seen[0]), 'a new closure alone keeps the identity')

const changed: object[] = []
function ValueChangesBetweenRenders() {
  const pass = useRenderTwice()
  changed.push(useStableCallbacks({ pass }))
  return null
}

renderToString(createElement(ValueChangesBetweenRenders))
assert.notEqual(changed.at(-1), changed[0], 'a changed value gets a new identity')

console.log('✅ useStableCallbacks verified')
