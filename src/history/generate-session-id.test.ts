import { describe, expect, test } from "bun:test"
import { generateSessionId } from "./generate-session-id.ts"

describe("generateSessionId", () => {
  test("returns a string with date and random parts", () => {
    const id = generateSessionId()
    expect(id).toContain("_")
    const [datePart, randomPart] = id.split("_")
    expect(datePart!.length).toBeGreaterThan(10)
    expect(randomPart!.length).toBe(6)
  })

  test("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateSessionId()))
    expect(ids.size).toBe(100)
  })
})
