import React, { useState, useMemo } from "react"
import { Box, Text, useInput } from "ink"
import type { SourceField, FieldCategory } from "../types.ts"

type Props = {
  fields: SourceField[]
  category: FieldCategory
}

const VISIBLE_COUNT = 12

export function FieldReadOnlyList({ fields, category }: Props) {
  const [filter, setFilter] = useState("")
  const [cursor, setCursor] = useState(0)

  const filteredFields = useMemo(() => {
    const lowerFilter = filter.toLowerCase()
    return fields.filter((f) => f.fieldName.toLowerCase().includes(lowerFilter))
  }, [fields, filter])

  const highlightedField = filteredFields[cursor] ?? null

  useInput((input, key) => {
    if (key.upArrow) {
      setCursor((prev) => Math.max(0, prev - 1))
      return
    }
    if (key.downArrow) {
      setCursor((prev) => Math.min(filteredFields.length - 1, prev + 1))
      return
    }
    if (key.escape) {
      setFilter("")
      setCursor(0)
      return
    }
    if (key.backspace || key.delete) {
      setFilter((prev) => {
        const next = prev.slice(0, -1)
        setCursor(0)
        return next
      })
      return
    }
    if (input && !key.ctrl && !key.meta && !key.return && !key.tab && input !== " ") {
      setFilter((prev) => prev + input)
      setCursor(0)
    }
  })

  const scrollOffset = Math.max(0, Math.min(cursor - Math.floor(VISIBLE_COUNT / 2), filteredFields.length - VISIBLE_COUNT))
  const visibleFields = filteredFields.slice(scrollOffset, scrollOffset + VISIBLE_COUNT)

  const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1)

  return (
    <Box flexDirection="row" gap={2} height={VISIBLE_COUNT + 6}>
      <Box flexDirection="column" width="60%">
        <Box>
          <Text bold color="cyanBright">{categoryLabel} fields </Text>
          <Text color="gray">({fields.length} total)</Text>
          <Text color="cyanBright"> — read only</Text>
        </Box>

        {filter.length > 0 && (
          <Box>
            <Text color="yellow">Filter: </Text>
            <Text color="yellowBright" bold>{filter}</Text>
            <Text color="gray"> ({filteredFields.length} matches) - ESC to clear</Text>
          </Box>
        )}

        {filter.length === 0 && (
          <Text color="gray">Type to filter │ ↑↓ navigate</Text>
        )}

        <Box flexDirection="column" marginTop={1}>
          {filteredFields.length === 0 ? (
            <Text color="yellow">No fields matching "{filter}"</Text>
          ) : (
            <>
              {scrollOffset > 0 && (
                <Text color="gray">  ↑ {scrollOffset} more above</Text>
              )}
              {visibleFields.map((field, idx) => {
                const realIdx = scrollOffset + idx
                const isHighlighted = realIdx === cursor

                return (
                  <Box key={field.fieldCode + "|" + field.source.apiToken}>
                    <Text color={isHighlighted ? "cyanBright" : "white"}>
                      {isHighlighted ? "❯ " : "  "}
                    </Text>
                    <Text color={field.isCustomField ? "greenBright" : "gray"}>
                      {field.isCustomField ? "★" : "·"}{" "}
                    </Text>
                    <Text
                      color={isHighlighted ? "white" : "gray"}
                      bold={isHighlighted}
                    >
                      {field.fieldName}
                    </Text>
                    <Text color="magenta"> {formatFieldType(field.fieldType)}</Text>
                  </Box>
                )
              })}
              {scrollOffset + VISIBLE_COUNT < filteredFields.length && (
                <Text color="gray">  ↓ {filteredFields.length - scrollOffset - VISIBLE_COUNT} more below</Text>
              )}
            </>
          )}
        </Box>
      </Box>

      <Box flexDirection="column" width="40%" borderStyle="single" borderColor="gray" paddingX={1}>
        {highlightedField ? (
          <FieldPreview field={highlightedField} />
        ) : (
          <Text color="gray" italic>No field selected</Text>
        )}
      </Box>
    </Box>
  )
}

function FieldPreview({ field }: { field: SourceField }) {
  return (
    <Box flexDirection="column" gap={0}>
      <Text bold color="cyanBright">Field Preview</Text>
      <Text color="gray">{"─".repeat(30)}</Text>

      <Box>
        <Text color="gray">Name:      </Text>
        <Text color="white" bold>{field.fieldName}</Text>
      </Box>
      <Box>
        <Text color="gray">Key:       </Text>
        <Text color="yellowBright">{field.fieldCode}</Text>
      </Box>
      <Box>
        <Text color="gray">Type:      </Text>
        <Text color="magenta">{field.fieldType}</Text>
        <Text color="gray"> {formatFieldType(field.fieldType)}</Text>
      </Box>
      <Box>
        <Text color="gray">Category:  </Text>
        <Text color="white">{field.category}</Text>
      </Box>
      <Box>
        <Text color="gray">Custom:    </Text>
        <Text color={field.isCustomField ? "greenBright" : "gray"}>
          {field.isCustomField ? "yes" : "no"}
        </Text>
      </Box>

      {field.options && field.options.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="gray">Options ({field.options.length}):</Text>
          {field.options.slice(0, 15).map((opt, i) => (
            <Box key={i}>
              <Text color="greenBright">  • </Text>
              <Text color="white">{opt.label}</Text>
              <Text color="gray">(id:{opt.id})</Text>
            </Box>
          ))}
          {field.options.length > 15 && (
            <Text color="gray">  ... and {field.options.length - 15} more</Text>
          )}
        </Box>
      )}

      {(!field.options || field.options.length === 0) && (
        <Box marginTop={1}>
          <Text color="gray" italic>No options</Text>
        </Box>
      )}
    </Box>
  )
}

function formatFieldType(type: string): string {
  const typeMap: Record<string, string> = {
    varchar: "[text]",
    text: "[long text]",
    double: "[number]",
    enum: "[single option]",
    set: "[multi option]",
    date: "[date]",
    daterange: "[date range]",
    time: "[time]",
    timerange: "[time range]",
    monetary: "[monetary]",
    address: "[address]",
    phone: "[phone]",
    user: "[user]",
    org: "[org]",
    people: "[person]",
    varchar_auto: "[autocomplete]",
  }
  return typeMap[type] ?? `[${type}]`
}
