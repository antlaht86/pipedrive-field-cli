import React from "react"
import { Box, Text } from "ink"

type Column = {
  key: string
  label: string
  width?: number
  color?: string
}

type Row = Record<string, string>

type Props = {
  columns: Column[]
  rows: Row[]
}

export function FieldTable({ columns, rows }: Props) {
  // Calculate column widths
  const colWidths = columns.map((col) => {
    const headerLen = col.label.length
    const maxDataLen = rows.reduce((max, row) => {
      const val = row[col.key] ?? ""
      return Math.max(max, val.length)
    }, 0)
    return col.width ?? Math.max(headerLen, maxDataLen) + 2
  })

  const separator = "─"
  const totalWidth = colWidths.reduce((sum, w) => sum + w + 3, 0) + 1

  return (
    <Box flexDirection="column">
      {/* Top border */}
      <Text color="gray">{"┌" + columns.map((_, i) => separator.repeat(colWidths[i]! + 2)).join("┬") + "┐"}</Text>

      {/* Header */}
      <Box>
        <Text color="gray">│</Text>
        {columns.map((col, i) => (
          <React.Fragment key={col.key}>
            <Text bold color="white"> {col.label.padEnd(colWidths[i]! + 1)}</Text>
            <Text color="gray">│</Text>
          </React.Fragment>
        ))}
      </Box>

      {/* Header separator */}
      <Text color="gray">{"├" + columns.map((_, i) => separator.repeat(colWidths[i]! + 2)).join("┼") + "┤"}</Text>

      {/* Rows */}
      {rows.map((row, rowIdx) => (
        <Box key={rowIdx}>
          <Text color="gray">│</Text>
          {columns.map((col, i) => {
            const value = row[col.key] ?? ""
            return (
              <React.Fragment key={col.key}>
                <Text color={col.color ?? "white"}> {value.padEnd(colWidths[i]! + 1)}</Text>
                <Text color="gray">│</Text>
              </React.Fragment>
            )
          })}
        </Box>
      ))}

      {/* Bottom border */}
      <Text color="gray">{"└" + columns.map((_, i) => separator.repeat(colWidths[i]! + 2)).join("┴") + "┘"}</Text>
    </Box>
  )
}
