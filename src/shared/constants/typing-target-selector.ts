/**
 * Elements whose own keyboard interaction must win over page-level shortcut keys:
 * text entry plus the APG roles that consume arrows, Home/End and printable
 * characters (Radix Select = combobox + listbox, Menu = menu/menuitem, cmdk = combobox).
 */
export const TYPING_TARGET_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[role="combobox"]',
  '[role="listbox"]',
  '[role="option"]',
  '[role="textbox"]',
  '[role="searchbox"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[role="menu"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
].join(',')
