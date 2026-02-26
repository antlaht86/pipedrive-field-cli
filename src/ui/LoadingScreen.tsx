import React from "react"
import { Box, Text } from "ink"
import { Spinner } from "@inkjs/ui"
import type { VerifiedToken } from "../types.ts"

type Props = {
  phase: "verifying-tokens" | "loading-fields"
  verifiedTokens?: VerifiedToken[]
  totalTokens?: number
}

export function LoadingScreen({ phase, verifiedTokens = [], totalTokens = 0 }: Props) {
  if (phase === "verifying-tokens") {
    return (
      <Box flexDirection="column" gap={1}>
        <Box>
          <Spinner label={`Verifying ${totalTokens} API tokens...`} />
        </Box>
        {verifiedTokens.map((token) => (
          <Text key={token.apiToken} color="green">
            {"  ✓ "}{token.userName} ({token.companyName})
          </Text>
        ))}
      </Box>
    )
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Box>
        <Spinner label={`Loading fields from ${totalTokens} accounts...`} />
      </Box>
    </Box>
  )
}
