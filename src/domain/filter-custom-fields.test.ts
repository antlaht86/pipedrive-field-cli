import { describe, expect, test } from "bun:test"
import { filterCustomFields } from "./filter-custom-fields.ts"
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
    isCustomField: false,
    source: mockSource,
    category: "deal",
    ...overrides,
  }
}

describe("filterCustomFields", () => {
  test("filters out system fields", () => {
    const fields = [
      makeField({ fieldName: "Title", isCustomField: false }),
      makeField({ fieldName: "Custom status", isCustomField: true }),
    ]
    const result = filterCustomFields(fields)
    expect(result).toHaveLength(1)
    expect(result[0]!.fieldName).toBe("Custom status")
  })

  test("keeps all custom fields", () => {
    const fields = [
      makeField({ fieldName: "Field A", isCustomField: true }),
      makeField({ fieldName: "Field B", isCustomField: true }),
    ]
    const result = filterCustomFields(fields)
    expect(result).toHaveLength(2)
  })

  test("returns empty array when no custom fields exist", () => {
    const fields = [
      makeField({ fieldName: "Title", isCustomField: false }),
      makeField({ fieldName: "Value", isCustomField: false }),
    ]
    const result = filterCustomFields(fields)
    expect(result).toEqual([])
  })

  test("returns empty array for empty input", () => {
    expect(filterCustomFields([])).toEqual([])
  })
})
