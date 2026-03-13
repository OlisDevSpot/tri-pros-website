import { parseAsInteger, parseAsStringLiteral } from 'nuqs'

export const stepParser = parseAsInteger.withDefault(1)
export const modeParser = parseAsStringLiteral(['intake', 'program'] as const).withDefault('intake')
