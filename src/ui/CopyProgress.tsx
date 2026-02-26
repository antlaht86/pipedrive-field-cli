import React from "react"
import { Box, Text } from "ink"
import { Spinner } from "@inkjs/ui"
import type { CopyResult } from "../types.ts"

type Props = {
  total: number
  results: CopyResult[]
}

export function CopyProgress({ total, results }: Props) {
  const completed = results.length
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

  // Progress bar
  const barWidth = 30
  const filled = Math.round((completed / total) * barWidth)
  const bar = "█".repeat(filled) + "░".repeat(barWidth - filled)

  return (
    <Box flexDirection="column" gap={1}>
      <Box>
        <Spinner label={`Copying fields... ${completed}/${total}`} />
      </Box>

      <Box>
        <Text color="greenBright">{bar}</Text>
        <Text color="white" bold> {pct}%</Text>
      </Box>

      {results.map((result) => {
        if (result.status === "created") {
          return (
            <Text key={result.field.fieldCode + result.field.source.apiToken} color="greenBright">
              {"  ✓ "}{result.field.fieldName}
              <Text color="gray"> — created</Text>
            </Text>
          )
        }
        if (result.status === "skipped") {
          return (
            <Text key={result.field.fieldCode + result.field.source.apiToken} color="yellow">
              {"  ⊘ "}{result.field.fieldName}
              <Text color="gray"> — {result.reason}</Text>
            </Text>
          )
        }
        return (
          <Text key={result.field.fieldCode + result.field.source.apiToken} color="red">
            {"  ✗ "}{result.field.fieldName}
            <Text color="gray"> — failed</Text>
          </Text>
        )
      })}
    </Box>
  )
}
