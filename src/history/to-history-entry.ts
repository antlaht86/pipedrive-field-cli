import type { CopyResult, VerifiedToken } from "../types.ts"
import type { HistoryEntry } from "./types.ts"
import { formatError } from "../errors.ts"

export function toHistoryEntry(
  result: CopyResult,
  target: VerifiedToken,
  dryRun: boolean
): HistoryEntry {
  const reason = result.status === "skipped"
    ? result.reason
    : result.status === "failed"
      ? formatError(result.error)
      : null

  return {
    timestamp: new Date().toISOString(),
    status: result.status,
    field: {
      fieldName: result.field.fieldName,
      fieldType: result.field.fieldType,
      category: result.field.category,
      options: result.field.options
        ? result.field.options.map((o) => o.label)
        : null,
    },
    source: {
      companyName: result.field.source.companyName,
      userName: result.field.source.userName,
    },
    target: {
      companyName: target.companyName,
      userName: target.userName,
    },
    dryRun,
    reason,
  }
}
