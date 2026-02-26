import React from "react"
import { Box, Text } from "ink"
import type { SourceField } from "../types.ts"
import { toEnvName } from "../domain/to-env-name.ts"

type Props = {
  fields: SourceField[]
}

export function EnvOutput({ fields }: Props) {
  if (fields.length === 0) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color="gray">No fields selected. Select fields from other tabs to see env variables here.</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text color="greenBright" bold>
        {"── Env variables "}{"─".repeat(40)}
      </Text>

      <Box flexDirection="column">
        {fields.map((field) => {
          const envName = toEnvName(field.category, field.fieldName)
          return (
            <Text key={field.fieldCode + field.source.apiToken}>
              <Text color="yellowBright">{envName}</Text>
              <Text color="white">=</Text>
              <Text color="greenBright">"{field.fieldCode}"</Text>
            </Text>
          )
        })}
      </Box>

      <Text color="gray">{fields.length} variable{fields.length !== 1 ? "s" : ""}</Text>
    </Box>
  )
}
