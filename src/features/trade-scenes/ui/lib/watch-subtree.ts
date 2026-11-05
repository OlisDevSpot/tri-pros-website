import type { Object3D } from 'three'

interface ChildEvent {
  child: Object3D
}

// Calls `onChange` whenever an object joins or leaves the tree under `root`, at any depth: three tells only the parent, so
// every node carries the listeners, and a branch that joins is watched as it arrives. Returns the unsubscribe.
export function watchSubtree(root: Object3D, onChange: () => void): () => void {
  const watched = new Set<Object3D>()

  const added = ({ child }: ChildEvent) => {
    watch(child)
    onChange()
  }
  const removed = ({ child }: ChildEvent) => {
    unwatch(child)
    onChange()
  }

  function watch(branch: Object3D) {
    branch.traverse((object) => {
      if (!watched.has(object)) {
        watched.add(object)
        object.addEventListener('childadded', added)
        object.addEventListener('childremoved', removed)
      }
    })
  }

  function unwatch(branch: Object3D) {
    branch.traverse((object) => {
      if (watched.delete(object)) {
        object.removeEventListener('childadded', added)
        object.removeEventListener('childremoved', removed)
      }
    })
  }

  watch(root)
  return () => {
    for (const object of watched) {
      object.removeEventListener('childadded', added)
      object.removeEventListener('childremoved', removed)
    }
    watched.clear()
  }
}
