// Lint holds type to Tailwind's steps with text-xs (12 px) as the floor, and weights to font-bold: no arbitrary sizes, no
// heavier weights.
export const CONTROLS_CLASSES = {
  // A button in the bottom group, 44 px tall on every shape; portrait lets an icon-only button narrow to 40.
  barItem: {
    base: 'relative inline-flex h-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:size-4 [&_svg]:shrink-0',
    wide: 'min-w-11 px-3',
    portrait: 'min-w-10 px-2.5',
  },
  // The 34 px chip reaches 42 px past its edge, so a wrapped row keeps its targets without growing its rhythm.
  chip: 'relative inline-flex h-8.5 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-input-background px-2.75 text-sm font-bold whitespace-nowrap text-foreground outline-none has-[>svg]:px-2.75 after:absolute after:inset-x-0 after:-inset-y-1 hover:border-border-strong hover:bg-input-background pressed:bg-press focus-visible:ring-[3px] focus-visible:ring-ring/50',
  chipOn: 'border-border-strong bg-muted hover:bg-muted',
  chipAdd: 'border-dashed bg-transparent text-muted-foreground hover:bg-transparent hover:text-foreground',
  chipMiss: 'border-status-attention-dot/60',
  // Radix marks a chip whose menu is open; the chip's own `open` sets the same mark.
  chipOpen: 'data-[state=open]:border-primary data-[state=open]:ring-1 data-[state=open]:ring-primary data-[state=open]:ring-inset',
  // The stage's controls read at 14 px; a popover would take the page's 16.
  menu: 'z-40 grid max-w-80 min-w-52.5 gap-px rounded-xl border border-border-strong bg-popover p-1.5 text-sm text-popover-foreground shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1 duration-140 ease-out motion-reduce:animate-none',
  // A chip on the Systems rail: 40 px, quiet until pressed, when it takes the raised fill and a primary ring.
  railChip: 'inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.75 rounded-full px-3.5 text-sm font-bold whitespace-nowrap text-muted-foreground outline-none hover:text-foreground not-aria-pressed:hover:bg-hover pressed:bg-press focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-muted aria-pressed:text-foreground aria-pressed:inset-ring aria-pressed:inset-ring-primary [&_svg]:size-4 [&_svg]:shrink-0',
  menuHeader: 'px-2.5 pt-1.5 pb-1 text-xs font-bold tracking-[.14em] text-muted-foreground uppercase',
  menuItem: 'relative flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 text-left font-bold',
  // A transparent radio over the drawn row, as the wear dots are drawn: the row keeps its check and label as plain elements.
  menuRadio: 'absolute inset-0 aspect-auto size-auto cursor-pointer rounded-lg border-0 bg-transparent shadow-none hover:bg-hover pressed:bg-press *:data-[slot=radio-group-indicator]:hidden',
  menuSeparator: 'mx-0.5 my-1 h-px bg-border-strong',
  menuRow: 'flex flex-wrap items-center gap-2 px-2.5 py-1.5',
  // A wrapped pill's rows stand 8 apart, so each option's 42 px reach stays its own.
  pill: 'inline-flex flex-wrap gap-x-0.5 gap-y-2 self-start justify-self-start rounded-full border border-border bg-(--card) p-0.75',
  // The 34 px option reaches 42 px past its edge, as the chip does.
  pillItem: 'relative h-auto min-h-8.5 min-w-0 flex-none rounded-full px-3.25 py-1.5 text-sm font-bold text-muted-foreground after:absolute after:inset-x-0 after:-inset-y-1 first:rounded-full last:rounded-full data-[state=off]:hover:text-foreground data-[state=on]:bg-muted data-[state=on]:text-foreground data-[state=on]:ring-1 data-[state=on]:ring-border-strong data-[state=on]:ring-inset',
  // A fact still to come: a dashed tile, its title over a hint.
  soonTile: 'grid gap-0.5 rounded-[10px] border border-dashed border-border-strong px-3 py-2.5',
  tile: 'grid size-10.5 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground [&_svg]:size-4',
  closeButton: 'ml-auto grid size-10.5 shrink-0 cursor-pointer place-items-center rounded-xl bg-muted text-muted-foreground outline-none hover:text-foreground pressed:bg-press focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:size-4',
  // A section's body scrolls inside the window; the fades sit over its padding at rest, as the card's scroll column does.
  body: 'min-h-0 flex-1 overflow-y-auto overscroll-contain px-(--panel-padding) pt-1 pb-4 [mask-image:linear-gradient(to_bottom,transparent,black_0.75rem,black_calc(100%_-_1rem),transparent)]',
  capsLabel: 'text-xs font-bold tracking-[.12em] text-muted-foreground uppercase',
  tag: 'rounded-full border border-border px-2 py-0.5 text-xs font-bold tracking-[.08em] whitespace-nowrap text-muted-foreground uppercase',
  tagProposed: 'border-primary bg-primary text-primary-foreground',
  // Laid over the shared InputGroup: its own focus classes are restated so the merge replaces them rather than both
  // applying, and its input sits 12 px past the icon.
  field: 'h-11 rounded-xl shadow-none has-[[data-slot=input-group-control]:focus-visible]:border-border-strong has-[[data-slot=input-group-control]:focus-visible]:ring-primary/18 has-[>[data-align=inline-start]]:[&>input]:pl-3',
  groupTitle: 'pb-2 text-xs font-bold tracking-[.14em] text-muted-foreground uppercase',
  // A value a result row can set; reaches 42 px past its 34 px edge, as the chip does.
  option: 'relative inline-flex h-8.5 cursor-pointer items-center gap-1.25 rounded-lg border border-border bg-input-background px-2.75 text-sm font-bold whitespace-nowrap text-muted-foreground outline-none has-[>svg]:px-2.75 after:absolute after:inset-x-0 after:-inset-y-1 hover:border-border-strong hover:bg-input-background hover:text-foreground pressed:bg-press focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:size-3.25 [&_svg]:text-primary',
  optionCurrent: 'border-border-strong bg-muted text-foreground hover:bg-muted',
  // The value Enter would set.
  optionHit: 'border-primary text-foreground ring-1 ring-primary ring-inset',
  link: 'h-auto min-h-10 shrink-0 cursor-pointer rounded-md px-1 text-xs font-bold whitespace-nowrap text-primary outline-none hover:text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50',
} as const
