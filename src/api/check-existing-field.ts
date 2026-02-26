import type { SourceField } from "../types.ts"

export function checkExistingField(fieldName: string, targetFields: SourceField[]): boolean {
  const normalizedName = fieldName.toLowerCase()
  return targetFields.some((f) => f.fieldName.toLowerCase() === normalizedName)
}
