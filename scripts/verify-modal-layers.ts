import type { ModalDescriptor, ModalLayersState } from '@/shared/lib/modal-layers'
import assert from 'node:assert/strict'
import { MODAL_LAYER_CAP } from '@/shared/constants/modal-layers'
import { closeAllModalLayers, closeModalLayer, EMPTY_MODAL_LAYERS, pushModalLayer } from '@/shared/lib/modal-layers'

function descriptor(accessor: string): ModalDescriptor {
  return { accessor, Component: () => null, props: { accessor } }
}

function shape(state: ModalLayersState) {
  return state.layers.map(layer => `${layer.accessor}#${layer.id}${layer.isOpen ? '' : ' closed'}`)
}

{
  const one = pushModalLayer(EMPTY_MODAL_LAYERS, descriptor('Profile'))
  const two = pushModalLayer(one, descriptor('Profile'))
  assert.deepEqual(shape(two), ['Profile#1', 'Profile#2'], 'the same component pushes a second, distinct layer')
  assert.equal(two.layers[0], one.layers[0], 'a push keeps the layers below as the same objects')
}

{
  let s = pushModalLayer(EMPTY_MODAL_LAYERS, descriptor('A'))
  s = pushModalLayer(s, descriptor('B'))
  s = pushModalLayer(s, descriptor('C'))
  const closed = closeModalLayer(s, 2)
  assert.deepEqual(shape(closed), ['A#1', 'B#2 closed', 'C#3 closed'], 'closing a layer closes every layer above it')
  assert.equal(closed.layers[0], s.layers[0], 'layers below a close keep their objects')
}

{
  let s = pushModalLayer(EMPTY_MODAL_LAYERS, descriptor('A'))
  s = pushModalLayer(s, descriptor('B'))
  s = closeModalLayer(s, 2)
  assert.deepEqual(shape(s), ['A#1', 'B#2 closed'], 'a closed layer stays mounted for its exit animation')
  s = pushModalLayer(s, descriptor('C'))
  assert.deepEqual(shape(s), ['A#1', 'C#3'], 'the next push prunes closed layers; ids keep increasing')
}

{
  const s = pushModalLayer(EMPTY_MODAL_LAYERS, descriptor('A'))
  const once = closeModalLayer(s, 1)
  assert.equal(closeModalLayer(once, 1), once, 'closing a closed layer returns the same state')
  assert.equal(closeModalLayer(s, 99), s, 'closing an unknown id returns the same state')
  const pruned = pushModalLayer(once, descriptor('B'))
  assert.equal(closeModalLayer(pruned, 1), pruned, 'closing a pruned layer returns the same state')
}

{
  assert.equal(closeAllModalLayers(EMPTY_MODAL_LAYERS), EMPTY_MODAL_LAYERS, 'close-all with nothing open returns the same state')
  let s = pushModalLayer(EMPTY_MODAL_LAYERS, descriptor('A'))
  s = pushModalLayer(s, descriptor('B'))
  const all = closeAllModalLayers(s)
  assert.deepEqual(shape(all), ['A#1 closed', 'B#2 closed'])
  assert.equal(closeAllModalLayers(all), all, 'close-all with only closed layers returns the same state')
}

{
  const warnings: unknown[] = []
  const warn = console.warn
  console.warn = (...args: unknown[]) => warnings.push(args)
  try {
    let s = EMPTY_MODAL_LAYERS
    for (const accessor of ['A', 'B', 'C']) {
      s = pushModalLayer(s, descriptor(accessor))
    }
    assert.equal(MODAL_LAYER_CAP, 3)
    s = pushModalLayer(s, descriptor('D'))
    assert.deepEqual(shape(s), ['A#1', 'B#2', 'D#4'], 'past the cap, the new layer replaces the top one')
    assert.equal(warnings.length, 1, 'past the cap warns once in development')
  }
  finally {
    console.warn = warn
  }
}

console.log('verify-modal-layers: all checks passed')
