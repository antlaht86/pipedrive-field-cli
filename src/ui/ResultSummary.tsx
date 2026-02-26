import React from "react"
import { Box, Text } from "ink"
import { Select } from "@inkjs/ui"
import type { CopyResult } from "../types.ts"
import { formatError } from "../errors.ts"

type Props = {
  results: CopyResult[]
  dryRun: boolean
  onCopyMore: () => void
  onExit: () => void
}

export function ResultSummary({ results, dryRun, onCopyMore, onExit }: Props) {
  const created = results.filter((r) => r.status === "created").length
  const skipped = results.filter((r) => r.status === "skipped").length
  const failed = results.filter((r) => r.status === "failed").length

  return (
    <Box flexDirection="column" gap={1}>
      {dryRun && (
        <Text color="yellow" bold>[DRY RUN] No actual changes were made</Text>
      )}
      <Box gap={2}>
        <Text color="green" bold>Created: {created}</Text>
        <Text color="yellow" bold>Skipped: {skipped}</Text>
        <Text color="red" bold>Failed: {failed}</Text>
      </Box>

      {results.filter((r) => r.status === "skipped").map((r) => (
        <Text key={r.field.fieldCode} color="yellow">
          {"  ⊘ "}{r.field.fieldName}: {r.status === "skipped" ? r.reason : ""}
        </Text>
      ))}

      {results.filter((r) => r.status === "failed").map((r) => (
        <Text key={r.field.fieldCode} color="red">
          {"  ✗ "}{r.field.fieldName}: {r.status === "failed" ? formatError(r.error) : ""}
        </Text>
      ))}

      <Text bold>What would you like to do?</Text>
      <Select
        options={[
          { label: "Copy more fields", value: "more" },
          { label: "Exit", value: "exit" },
        ]}
        onChange={(value) => {
          if (value === "more") onCopyMore()
          else onExit()
        }}
      />
    </Box>
  )
}
