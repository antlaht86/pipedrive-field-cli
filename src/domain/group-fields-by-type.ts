import type { FieldCategory, SourceField } from "../types.ts"

export function groupFieldsByType(fields: SourceField[]): Record<FieldCategory, SourceField[]> {
  const groups: Record<FieldCategory, SourceField[]> = {
    deal: [],
    person: [],
    organization: [],
    product: [],
  }

  for (const field of fields) {
    groups[field.category].push(field)
  }

  return groups
}
