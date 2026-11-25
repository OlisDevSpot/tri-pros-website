// While the proposal loads, every field box keeps its size and shows one bar where its value will be. The name
// input opts out with data-own-bar: it draws a fixed-width bar of its own.
export const EDIT_LOADING_FORM_CLASS = [
  '[&_input]:text-transparent [&_input]:placeholder:text-transparent',
  '[&_textarea]:text-transparent [&_textarea]:placeholder:text-transparent',
  '[&_[data-slot=select-value]]:text-transparent',
  '[&_input:not([data-own-bar])]:bg-[linear-gradient(var(--skeleton),var(--skeleton))] [&_input:not([data-own-bar])]:bg-no-repeat [&_input:not([data-own-bar])]:bg-[length:40%_.72em] [&_input:not([data-own-bar])]:bg-[position:12px_center]',
  '[&_textarea]:bg-[linear-gradient(var(--skeleton),var(--skeleton))] [&_textarea]:bg-no-repeat [&_textarea]:bg-[length:40%_.72em] [&_textarea]:bg-[position:12px_center]',
  '[&_[data-slot=select-trigger]]:bg-[linear-gradient(var(--skeleton),var(--skeleton))] [&_[data-slot=select-trigger]]:bg-no-repeat [&_[data-slot=select-trigger]]:bg-[length:40%_.72em] [&_[data-slot=select-trigger]]:bg-[position:12px_center]',
].join(' ')
