import React from "react"
import { Box, Text } from "ink"
import { FieldTable } from "./FieldTable.tsx"
import type { CopyResult } from "../types.ts"
import type { HistorySession, HistoryEntry } from "../history/types.ts"

type Props = {
  results: CopyResult[]
  dryRun: boolean
  pastSessions: HistorySession[]
  currentSessionId: string
}

function formatSessionDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function statusIcon(status: string): string {
  return status === "created" ? "✓" : status === "skipped" ? "⊘" : "✗"
}

function statusLabel(status: string): string {
  return status === "created" ? "Created" : status === "skipped" ? "Skipped" : "Failed"
}

const SESSION_COLUMNS = [
  { key: "icon", label: " ", width: 1, color: "white" },
  { key: "status", label: "Status", width: 8 },
  { key: "field", label: "Field", width: 25 },
  { key: "type", label: "Type", width: 12, color: "magenta" },
  { key: "category", label: "Cat", width: 8, color: "cyan" },
  { key: "route", label: "Source → Target", width: 30, color: "gray" },
]

function entryToRow(entry: HistoryEntry) {
  return {
    icon: statusIcon(entry.status),
    status: statusLabel(entry.status),
    field: entry.field.fieldName,
    type: entry.field.fieldType,
    category: entry.field.category,
    route: `${entry.source.userName} → ${entry.target.userName}`,
  }
}

function currentResultToRow(r: CopyResult) {
  return {
    icon: statusIcon(r.status),
    status: statusLabel(r.status),
    field: r.field.fieldName,
    type: r.field.fieldType,
    category: r.field.category,
    route: `${r.field.source.userName} → Target`,
  }
}

export function CopyHistory({ results, dryRun, pastSessions, currentSessionId }: Props) {
  const otherSessions = pastSessions
    .filter((s) => s.sessionId !== currentSessionId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))

  const hasCurrentResults = results.length > 0
  const hasPastSessions = otherSessions.length > 0

  if (!hasCurrentResults && !hasPastSessions) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color="gray">No fields copied yet. Select fields from other tabs and copy them.</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" gap={1}>
      {dryRun && (
        <Box borderStyle="round" borderColor="yellow" paddingX={1}>
          <Text color="yellow" bold>DRY RUN MODE — No actual changes were made</Text>
        </Box>
      )}

      {/* Current session */}
      {hasCurrentResults && (
        <Box flexDirection="column" gap={0}>
          <Text color="greenBright" bold>
            {"── This session "}{"─".repeat(50)}
          </Text>

          <Box gap={3}>
            <Text color="greenBright" bold>
              ✓ {results.filter((r) => r.status === "created").length}
            </Text>
            <Text color="yellow" bold>
              ⊘ {results.filter((r) => r.status === "skipped").length}
            </Text>
            <Text color="red" bold>
              ✗ {results.filter((r) => r.status === "failed").length}
            </Text>
          </Box>

          <FieldTable
            columns={SESSION_COLUMNS}
            rows={results.map(currentResultToRow)}
          />

          {results.filter((r) => r.status === "skipped").length > 0 && (
            <Box flexDirection="column">
              <Text color="yellow" bold>Skipped details:</Text>
              {results.filter((r) => r.status === "skipped").map((r) => (
                <Text key={r.field.fieldCode + r.field.source.apiToken} color="gray">
                  {"  "}{r.field.fieldName}: {r.status === "skipped" ? r.reason : ""}
                </Text>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* Past sessions */}
      {otherSessions.map((session) => (
        <Box key={session.sessionId} flexDirection="column" gap={0}>
          <Text color="gray" bold>
            {"── "}
            {formatSessionDate(session.startedAt)}
            {` (${session.entries.length} field${session.entries.length !== 1 ? "s" : ""}) `}
            {"─".repeat(30)}
          </Text>

          <FieldTable
            columns={SESSION_COLUMNS}
            rows={session.entries.map(entryToRow)}
          />
        </Box>
      ))}
    </Box>
  )
}
