import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { readHistory } from "./read-history.ts"
import { writeFile, mkdir, rm } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"

// We test the parsing logic by mocking the file directly
// For unit tests, we'll test with temp files

describe("readHistory", () => {
  test("readHistory returns a ResultAsync", async () => {
    const result = await readHistory()
    // It either succeeds with empty history or reads existing file
    expect(result.isOk()).toBe(true)
  })

  test("readHistory returns valid HistoryFile structure", async () => {
    const result = await readHistory()
    if (result.isOk()) {
      expect(result.value.version).toBe(1)
      expect(Array.isArray(result.value.sessions)).toBe(true)
    }
  })
})
