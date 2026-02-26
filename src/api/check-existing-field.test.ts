import { describe, expect, test } from "bun:test"
import { checkExistingField } from "./check-existing-field.ts"
import type { SourceField, VerifiedToken } from "../types.ts"

const mockSource: VerifiedToken = {
  apiToken: "source-token",
  userName: "Matti",
  companyName: "Acme Oy",
}

function makeField(fieldName: string): SourceField {
  return {
    fieldName,
    fieldCode: "abc",
    fieldType: "varchar",
    options: null,
    isCustomField: true,
    source: mockSource,
    category: "deal",
  }
}

describe("checkExistingField", () => {
  test("returns true when field name exists in target fields", () => {
    const targetFields = [makeField("Custom status"), makeField("Priority")]
    const result = checkExistingField("Custom status", targetFields)
    expect(result).toBe(true)
  })

  test("returns false when field name does not exist", () => {
    const targetFields = [makeField("Custom status"), makeField("Priority")]
    const result = checkExistingField("New field", targetFields)
    expect(result).toBe(false)
  })

  test("comparison is case-insensitive", () => {
    const targetFields = [makeField("Custom Status")]
    expect(checkExistingField("custom status", targetFields)).toBe(true)
    expect(checkExistingField("CUSTOM STATUS", targetFields)).toBe(true)
  })

  test("returns false for empty target fields", () => {
    expect(checkExistingField("Anything", [])).toBe(false)
  })
})
