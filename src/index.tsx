import React from "react"
import { render, Box, Text } from "ink"
import { parseArgs } from "./cli/parse-args.ts"
import { formatError } from "./errors.ts"
import { App } from "./ui/App.tsx"

const result = parseArgs(process.argv.slice(2))

if (result.isErr()) {
  render(
    <Box flexDirection="column" gap={1}>
      <Text color="red" bold>Error: {formatError(result.error)}</Text>
      <Text dimColor>
        Usage: pipedrive-field-cli --read-only-api-tokens="token1,token2" [--target-api-token="target"] [--dry-run]
      </Text>
    </Box>
  )
} else {
  render(<App args={result.value} />)
}
