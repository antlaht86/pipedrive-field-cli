import { describe, expect, test } from "bun:test"
import { buildCopyPayload } from "./build-copy-payload.ts"
import type { SourceField, VerifiedToken } from "../types.ts"

const mockSource: VerifiedToken = {
  apiToken: "test-token",
  userName: "Matti",
  companyName: "Acme Oy",
}

function makeField(overrides: Partial<SourceField> = {}): SourceField {
  return {
    fieldName: "Test field",
    fieldCode: "abc123",
    fieldType: "varchar",
    options: null,
    isCustomField: true,
    source: mockSource,
    category: "deal",
    ...overrides,
  }
}

describe("buildCopyPayload", () => {
  test("builds correct payload for varchar field", () => {
    const field = makeField({ fieldName: "Custom text", fieldType: "varchar" })
    const payload = buildCopyPayload(field)
    expect(payload).toEqual({
      field_name: "Custom text",
      field_type: "varchar",
    })
  })

  test("builds correct payload for enum field with options", () => {
    const field = makeField({
      fieldName: "Status",
      fieldType: "enum",
      options: [{ id: 1, label: "Hot" }, { id: 2, label: "Warm" }, { id: 3, label: "Cold" }],
    })
    const payload = buildCopyPayload(field)
    expect(payload).toEqual({
      field_name: "Status",
      field_type: "enum",
      options: [{ label: "Hot" }, { label: "Warm" }, { label: "Cold" }],
    })
  })

  test("builds correct payload for set field with options", () => {
    const field = makeField({
      fieldName: "Tags",
      fieldType: "set",
      options: [{ id: 1, label: "VIP" }, { id: 2, label: "Partner" }],
    })
    const payload = buildCopyPayload(field)
    expect(payload).toEqual({
      field_name: "Tags",
      field_type: "set",
      options: [{ label: "VIP" }, { label: "Partner" }],
    })
  })

  test("does not include options for non-enum/set field types", () => {
    const field = makeField({ fieldType: "double", options: null })
    const payload = buildCopyPayload(field)
    expect(payload).toEqual({
      field_name: "Test field",
      field_type: "double",
    })
    expect("options" in payload).toBe(false)
  })

  test("does not include read-only properties like fieldCode or source", () => {
    const field = makeField()
    const payload = buildCopyPayload(field)
    expect("fieldCode" in payload).toBe(false)
    expect("field_code" in payload).toBe(false)
    expect("source" in payload).toBe(false)
    expect("isCustomField" in payload).toBe(false)
    expect("category" in payload).toBe(false)
  })
})
