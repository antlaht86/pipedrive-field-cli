import { describe, expect, test } from "bun:test"
import { toHistoryEntry } from "./to-history-entry.ts"
import type { CopyResult, VerifiedToken, SourceField } from "../types.ts"
import type { AppError } from "../errors.ts"

const mockSource: VerifiedToken = {
  apiToken: "source-token",
  userName: "Matti",
  companyName: "Acme Oy",
}

const mockTarget: VerifiedToken = {
  apiToken: "target-token",
  userName: "Admin",
  companyName: "Target Oy",
}

function makeField(overrides: Partial<SourceField> = {}): SourceField {
  return {
    fieldName: "Custom status",
    fieldCode: "abc123",
    fieldType: "enum",
    options: [{ id: 1, label: "Hot" }, { id: 2, label: "Cold" }],
    isCustomField: true,
    source: mockSource,
    category: "deal",
    ...overrides,
  }
}

describe("toHistoryEntry", () => {
  test("converts created result", () => {
    const result: CopyResult = { status: "created", field: makeField() }
    const entry = toHistoryEntry(result, mockTarget, false)

    expect(entry.status).toBe("created")
    expect(entry.field.fieldName).toBe("Custom status")
    expect(entry.field.fieldType).toBe("enum")
    expect(entry.field.category).toBe("deal")
    expect(entry.field.options).toEqual(["Hot", "Cold"])
    expect(entry.source.companyName).toBe("Acme Oy")
    expect(entry.source.userName).toBe("Matti")
    expect(entry.target.companyName).toBe("Target Oy")
    expect(entry.target.userName).toBe("Admin")
    expect(entry.dryRun).toBe(false)
    expect(entry.reason).toBeNull()
    expect(entry.timestamp).toBeTruthy()
  })

  test("converts skipped result with reason", () => {
    const result: CopyResult = {
      status: "skipped",
      field: makeField(),
      reason: "Already exists in 'Target Oy'",
    }
    const entry = toHistoryEntry(result, mockTarget, false)

    expect(entry.status).toBe("skipped")
    expect(entry.reason).toBe("Already exists in 'Target Oy'")
  })

  test("converts failed result with error", () => {
    const error: AppError = {
      type: "FIELD_CREATION_FAILED",
      fieldName: "Custom status",
      message: "HTTP 500",
    }
    const result: CopyResult = { status: "failed", field: makeField(), error }
    const entry = toHistoryEntry(result, mockTarget, false)

    expect(entry.status).toBe("failed")
    expect(entry.reason).toContain("Custom status")
  })

  test("maps options to string array", () => {
    const field = makeField({ options: [{ id: 1, label: "A" }, { id: 2, label: "B" }, { id: 3, label: "C" }] })
    const result: CopyResult = { status: "created", field }
    const entry = toHistoryEntry(result, mockTarget, false)

    expect(entry.field.options).toEqual(["A", "B", "C"])
  })

  test("handles null options", () => {
    const field = makeField({ options: null, fieldType: "varchar" })
    const result: CopyResult = { status: "created", field }
    const entry = toHistoryEntry(result, mockTarget, false)

    expect(entry.field.options).toBeNull()
  })

  test("sets dryRun flag", () => {
    const result: CopyResult = { status: "created", field: makeField() }
    const entry = toHistoryEntry(result, mockTarget, true)

    expect(entry.dryRun).toBe(true)
  })

  test("does not include API tokens", () => {
    const result: CopyResult = { status: "created", field: makeField() }
    const entry = toHistoryEntry(result, mockTarget, false)

    const json = JSON.stringify(entry)
    expect(json).not.toContain("source-token")
    expect(json).not.toContain("target-token")
  })
})
