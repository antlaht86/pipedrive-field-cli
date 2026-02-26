import React from "react"
import { Box, Text } from "ink"
import { Select } from "@inkjs/ui"
import type { FieldCategory } from "../types.ts"

type Props = {
  onSelect: (category: FieldCategory) => void
  fieldCounts: Record<FieldCategory, number>
}

export function FieldTypeSelect({ onSelect, fieldCounts }: Props) {
  const options = [
    { label: `Deal fields (${fieldCounts.deal} custom)`, value: "deal" },
    { label: `Person fields (${fieldCounts.person} custom)`, value: "person" },
    { label: `Organization fields (${fieldCounts.organization} custom)`, value: "organization" },
    { label: `Product fields (${fieldCounts.product} custom)`, value: "product" },
  ].filter((opt) => fieldCounts[opt.value as FieldCategory] > 0)

  if (options.length === 0) {
    return <Text color="yellow">No custom fields found in any source account.</Text>
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Select field type to copy:</Text>
      <Select options={options} onChange={(value) => onSelect(value as FieldCategory)} />
    </Box>
  )
}
