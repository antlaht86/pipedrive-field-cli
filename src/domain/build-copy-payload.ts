import type { SourceField } from "../types.ts"

export type CopyPayload = {
  field_name: string
  field_type: string
  options?: Array<{ label: string }>
}

export function buildCopyPayload(field: SourceField): CopyPayload {
  const payload: CopyPayload = {
    field_name: field.fieldName,
    field_type: field.fieldType,
  }

  if ((field.fieldType === "enum" || field.fieldType === "set") && field.options) {
    payload.options = field.options.map((opt) => ({ label: opt.label }))
  }

  return payload
}
