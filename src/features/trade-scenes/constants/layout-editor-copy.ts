// The two layers' names are the view switch's labels, read from SCENE_VIEW_LABELS where they show. Keep what is there is
// LOT_COPY's, as the yard card's build menus say it.
export const LAYOUT_EDITOR_COPY = {
  draw: {
    drawing: 'Drawing',
    done: 'Done',
    backToBase: 'Back to base',
    noFence: 'No fence',
    hintGround: 'Drag across the ground',
    hintFence: 'Drag along a line',
  },
  layout: {
    title: 'Layout',
    undo: 'Undo',
    reset: 'Reset to default',
    copyLink: 'Copy link',
    copied: 'Link copied',
    tooLong: 'This layout is too long for a link.',
  },
} as const
