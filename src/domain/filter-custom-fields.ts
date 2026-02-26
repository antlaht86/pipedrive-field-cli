import type { SourceField } from "../types.ts"

export function filterCustomFields(fields: SourceField[]): SourceField[] {
  return fields.filter((field) => field.isCustomField)
}
