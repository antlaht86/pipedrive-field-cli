import { describe, expect, test } from "bun:test"
import { groupFieldsByType } from "./group-fields-by-type.ts"
import type { SourceField, VerifiedToken } from "../types.ts"

const mockSource: VerifiedToken = {
  apiToken: "test-token",
  userName: "Matti",
  companyName: "Acme Oy",
}

function makeField(category: SourceField["category"], fieldName: string): SourceField {
  return {
    fieldName,
    fieldCode: "abc123",
    fieldType: "varchar",
    options: null,
    isCustomField: true,
    source: mockSource,
    category,
  }
}

describe("groupFieldsByType", () => {
  test("groups fields into correct categories", () => {
    const fields = [
      makeField("deal", "Deal field"),
      makeField("person", "Person field"),
      makeField("organization", "Org field"),
      makeField("product", "Product field"),
    ]
    const result = groupFieldsByType(fields)
    expect(result.deal).toHaveLength(1)
    expect(result.person).toHaveLength(1)
    expect(result.organization).toHaveLength(1)
    expect(result.product).toHaveLength(1)
    expect(result.deal[0]!.fieldName).toBe("Deal field")
  })

  test("handles empty input with empty arrays for all categories", () => {
    const result = groupFieldsByType([])
    expect(result.deal).toEqual([])
    expect(result.person).toEqual([])
    expect(result.organization).toEqual([])
    expect(result.product).toEqual([])
  })

  test("handles multiple fields in same category", () => {
    const fields = [
      makeField("deal", "Field A"),
      makeField("deal", "Field B"),
      makeField("deal", "Field C"),
    ]
    const result = groupFieldsByType(fields)
    expect(result.deal).toHaveLength(3)
    expect(result.person).toEqual([])
  })

  test("handles fields from multiple sources", () => {
    const source2: VerifiedToken = { apiToken: "tok2", userName: "Liisa", companyName: "Beta Oy" }
    const fields: SourceField[] = [
      makeField("deal", "Field from Matti"),
      { ...makeField("deal", "Field from Liisa"), source: source2 },
    ]
    const result = groupFieldsByType(fields)
    expect(result.deal).toHaveLength(2)
    expect(result.deal[0]!.source.userName).toBe("Matti")
    expect(result.deal[1]!.source.userName).toBe("Liisa")
  })
})
