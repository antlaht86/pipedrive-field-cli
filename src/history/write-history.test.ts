import { describe, expect, test } from "bun:test"
import { writeHistory } from "./write-history.ts"
import { readHistory } from "./read-history.ts"
import type { HistoryFile } from "./types.ts"

describe("writeHistory", () => {
  test("writeHistory returns a ResultAsync", async () => {
    // Read current history first to not destroy it
    const current = await readHistory()
    if (current.isOk()) {
      const result = await writeHistory(current.value)
      expect(result.isOk()).toBe(true)
    }
  })

  test("write then read roundtrip preserves data", async () => {
    const currentResult = await readHistory()
    expect(currentResult.isOk()).toBe(true)
    const current = currentResult._unsafeUnwrap()

    // Write it back
    const writeResult = await writeHistory(current)
    expect(writeResult.isOk()).toBe(true)

    // Read again
    const readBackResult = await readHistory()
    expect(readBackResult.isOk()).toBe(true)
    expect(readBackResult._unsafeUnwrap().version).toBe(1)
  })
})
