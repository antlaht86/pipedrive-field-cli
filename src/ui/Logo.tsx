import React from "react"
import { Box, Text } from "ink"

export function Logo() {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color="greenBright" bold>
        {`  _____ _      _     _    ___ _    ___ `}
      </Text>
      <Text color="green" bold>
        {` |  ___(_) ___| | __| |  / __| |  |_ _|`}
      </Text>
      <Text color="green" bold>
        {` | |_  | |/ _ \\ |/ _\` | | |  | |   | | `}
      </Text>
      <Text color="greenBright" bold>
        {` |  _| | |  __/ | (_| | | |__| |__ | | `}
      </Text>
      <Text color="green" bold>
        {` |_|   |_|\\___|_|\\__,_|  \\___|____|___|`}
      </Text>
      <Text> </Text>
      <Box>
        <Text color="greenBright"> ░▒▓</Text>
        <Text color="white" bold> Pipedrive Field Copy Tool </Text>
        <Text color="greenBright">▓▒░</Text>
      </Box>
      <Text color="gray">{"  ─────────────────────────────────────"}</Text>
    </Box>
  )
}
