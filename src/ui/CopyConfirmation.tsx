import React from "react"
import { Box, Text } from "ink"
import { Select } from "@inkjs/ui"
import type { SourceField, VerifiedToken } from "../types.ts"

type Props = {
  selected: SourceField[]
  target: VerifiedToken
  dryRun: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function CopyConfirmation({ selected, target, dryRun, onConfirm, onCancel }: Props) {
  return (
    <Box flexDirection="column" gap={1}>
      {dryRun && (
        <Box borderStyle="round" borderColor="yellow" paddingX={1}>
          <Text color="yellow" bold>DRY RUN — No changes will be made</Text>
        </Box>
      )}
      <Text bold>
        Copy {selected.length} field{selected.length !== 1 ? "s" : ""} to {target.companyName}?
      </Text>
      {selected.map((field) => (
        <Text key={field.fieldCode + field.source.apiToken}>
          {"  - "}{field.fieldName} <Text dimColor>[{field.fieldType}]</Text>
          {field.options && field.options.length > 0 && (
            <Text dimColor> ({field.options.map((o) => o.label).join(", ")})</Text>
          )}
        </Text>
      ))}
      <Select
        options={[
          { label: "Yes, copy fields", value: "confirm" },
          { label: "Cancel", value: "cancel" },
        ]}
        onChange={(value) => {
          if (value === "confirm") onConfirm()
          else onCancel()
        }}
      />
    </Box>
  )
}
