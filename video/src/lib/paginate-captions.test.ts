import assert from 'node:assert/strict'
import { test } from 'node:test'
import { paginateCaptions } from './paginate-captions'

function w(text: string, startMs: number, endMs: number) {
  return { text, startMs, endMs }
}

test('groups at most 3 words per page', () => {
  const pages = paginateCaptions([
    w('see', 0, 100), w(' if', 100, 200), w(' your', 200, 300),
    w(' home', 300, 400), w(' fits', 400, 500),
  ])
  assert.equal(pages.length, 2)
  assert.deepEqual(pages[0]!.tokens.map(t => t.text), ['see', 'if', 'your'])
  assert.deepEqual(pages[1]!.tokens.map(t => t.text), ['home', 'fits'])
})

test('char budget (16) breaks a page before 3 words', () => {
  // "AAA-grade materials," = 9 + 1 + 10 = 20 chars joined → must split
  const pages = paginateCaptions([
    w('AAA-grade', 0, 500), w(' materials,', 500, 1000), w(' built', 1000, 1200),
  ])
  assert.deepEqual(pages[0]!.tokens.map(t => t.text), ['AAA-grade'])
})

test('sentence punctuation ends the page', () => {
  const pages = paginateCaptions([
    w('remodel!', 0, 400), w(' AAA-grade', 400, 900), w(' work', 900, 1100),
  ])
  assert.deepEqual(pages[0]!.tokens.map(t => t.text), ['remodel!'])
  assert.deepEqual(pages[1]!.tokens.map(t => t.text), ['AAA-grade', 'work'])
})

test('pages are gapless: each page ends exactly when the next starts', () => {
  const pages = paginateCaptions([
    w('one', 0, 200), w(' two', 200, 400), w(' three', 400, 600),
    // 500ms VO pause here
    w(' four', 1100, 1300), w(' five', 1300, 1500),
  ])
  for (let i = 0; i < pages.length - 1; i++)
    assert.equal(pages[i]!.endMs, pages[i + 1]!.startMs)
})

test('a page after a VO pause appears when the previous page finishes (snap-back)', () => {
  const pages = paginateCaptions([
    w('one', 0, 200), w(' two', 200, 400), w(' three', 400, 600),
    w(' four', 1100, 1300),
  ])
  assert.equal(pages.length, 2)
  // NOT 1100 — the v4 lag bug. Appears at 600, highlight waits for 1100.
  assert.equal(pages[1]!.startMs, 600)
})

test('trims token whitespace and drops empty words', () => {
  const pages = paginateCaptions([w(' hello', 0, 100), w('  ', 100, 150), w(' there', 150, 250)])
  assert.deepEqual(pages[0]!.tokens.map(t => t.text), ['hello', 'there'])
})

test('last page lingers 300ms past its final word', () => {
  const pages = paginateCaptions([w('done.', 0, 500)])
  assert.equal(pages[0]!.endMs, 800)
})

test('empty input yields no pages', () => {
  assert.deepEqual(paginateCaptions([]), [])
})

test('emphasis flag rides through to tokens', () => {
  const pages = paginateCaptions([
    { text: 'a', startMs: 0, endMs: 100 },
    { text: ' spa', startMs: 100, endMs: 300, emphasis: true },
    { text: ' feeling', startMs: 300, endMs: 600, emphasis: true },
  ])
  assert.deepEqual(pages[0]!.tokens.map(t => t.emphasis ?? false), [false, true, true])
})
