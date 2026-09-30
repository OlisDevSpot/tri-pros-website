// The Skeleton primitive's own tone (bg-muted/60) all but vanishes: about 1.06:1 on a light card, 1.10:1 on a dark one.
// A thin bar reads as a line of text only near 1.3:1, and dark needs less foreground to get there, hence the per-theme strength.
export const SKELETON_TONE_CLASS = 'bg-foreground/15 dark:bg-foreground/10'

// Chips and avatars cover several times a text bar's area, so at the bars' tone they outweigh the lines; a step softer (about 1.2:1) keeps the lines leading.
export const SKELETON_BLOCK_TONE_CLASS = 'bg-foreground/10 dark:bg-foreground/6'

// A placeholder frame has no content to balance it: the dark border token (2.2:1 on a card) outweighs the bars inside, so it drops to their weight.
export const SKELETON_FRAME_TONE_CLASS = 'dark:border-border/40'
