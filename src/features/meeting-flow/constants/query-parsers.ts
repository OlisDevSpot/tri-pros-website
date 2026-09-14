import { parseAsInteger, parseAsString } from 'nuqs'

export const stepParser = parseAsInteger.withDefault(1)

/** Notion trade id of the open trade sheet; the param is absent when the sheet is closed. */
export const tradeSheetParser = parseAsString
