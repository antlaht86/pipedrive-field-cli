import { ok, err, type Result } from "neverthrow"
import type { ParsedArgs } from "../types.ts"
import type { AppError } from "../errors.ts"

export function parseArgs(argv: string[]): Result<ParsedArgs, AppError> {
  const args = new Map<string, string>()
  const flags = new Set<string>()

  for (const arg of argv) {
    if (arg.startsWith("--")) {
      const eqIndex = arg.indexOf("=")
      if (eqIndex !== -1) {
        args.set(arg.slice(2, eqIndex), arg.slice(eqIndex + 1))
      } else {
        flags.add(arg.slice(2))
      }
    }
  }

  const readOnlyRaw = args.get("read-only-api-tokens")
  if (!readOnlyRaw) {
    return err({
      type: "INVALID_ARGS",
      message: 'No read-only API tokens provided. Use --read-only-api-tokens="token1,token2"',
    })
  }

  const targetRaw = args.get("target-api-token")

  const readOnlyTokens = readOnlyRaw.split(",").map((t) => t.trim())
  for (let i = 0; i < readOnlyTokens.length; i++) {
    if (readOnlyTokens[i] === "") {
      return err({
        type: "INVALID_ARGS",
        message: `API token must be a non-empty string, got empty value at position ${i + 1}`,
      })
    }
  }

  const targetApiToken = targetRaw ? targetRaw.trim() || null : null

  return ok({
    readOnlyApiTokens: readOnlyTokens,
    targetApiToken,
    dryRun: flags.has("dry-run"),
  })
}
