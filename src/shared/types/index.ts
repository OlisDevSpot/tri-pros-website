export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {}

// get keys of object union eg: { a: string } | { b: string } | { c: number }
export type KeysOfUnion<T> = T extends T ? keyof T : never

export function isTruthy<T>(value: T): value is NonNullable<T> {
  return Boolean(value);
}

export function getTypedKeys<T extends Record<string, any>>(obj: T): Array<keyof T> {
  return Object.keys(obj) as Array<keyof T>
}

export type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>
}
