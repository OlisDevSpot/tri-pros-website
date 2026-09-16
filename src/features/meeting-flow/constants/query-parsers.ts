import { parseAsInteger, parseAsString } from 'nuqs'

export const stepParser = parseAsInteger.withDefault(1)

export const tradeStageParser = parseAsString
