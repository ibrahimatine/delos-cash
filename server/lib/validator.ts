// Validators for JSON values the route schemas cannot describe with OBJ/ARR
// (drafts, snapshots): typed for the client and checked at runtime.
type DefJson<T> = {
  type: 'object'
  properties: Record<string, never>
  report: (
    value: unknown,
  ) => { path: string[]; type: 'object'; value: unknown }[]
  optional?: boolean
  description?: string
  assert: (value: unknown) => T
}

/** `check` throws on an invalid value: the router answers 400 */
export const JSON_OF = <T>(
  description: string,
  check: (value: unknown) => T = (value) => value as T,
): DefJson<T> => {
  const report = (value: unknown) => {
    try {
      check(value)
      return []
    } catch (err) {
      return [
        {
          path: [err instanceof Error ? err.message : String(err)],
          type: 'object' as const,
          value,
        },
      ]
    }
  }
  return { type: 'object', properties: {}, description, report, assert: check }
}

/** a plain object, or a 400 */
export const object = (value: unknown, what: string) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw Error(`${what} doit être un objet`)
  }
  return value as Record<string, unknown>
}
