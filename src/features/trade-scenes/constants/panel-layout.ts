// A column that scrolls inside the card. The bleed is the card's own padding (`--panel-padding`), so the scrollbar sits
// at the card's edge and the fields' focus rings keep room inside the scroller. The fades sit over the padding at rest,
// so nothing is dimmed until it scrolls under an edge; then the content thins out there instead of cutting off flat.
export const PANEL_SCROLL_CLASS = '-mx-(--panel-padding) min-h-0 overflow-y-auto scrollbar-gutter-stable px-(--panel-padding) pt-3 pb-4 [mask-image:linear-gradient(to_bottom,transparent,black_0.75rem,black_calc(100%_-_1rem),transparent)]'

// Flush to the text, so each underline is as wide as its label; the scene's accent marks the open tab.
export const UNDERLINE_TAB_TRIGGER_CLASS = 'min-h-11 gap-1.75 px-0 text-sm font-bold data-[state=active]:border-(--presentation-accent) [&_svg]:size-3.75'
