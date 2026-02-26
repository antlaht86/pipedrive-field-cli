import React, { useState, useEffect, useRef } from "react"
import { Box, Text, useApp, useInput } from "ink"
import { ResultAsync } from "neverthrow"
import type {
  FieldCategory,
  ParsedArgs,
  SourceField,
  VerifiedToken,
  CopyResult,
} from "../types.ts"
import { formatError, type AppError } from "../errors.ts"
import { verifyToken } from "../api/verify-token.ts"
import { fetchFields } from "../api/fetch-fields.ts"
import { createField } from "../api/create-field.ts"
import { checkExistingField } from "../api/check-existing-field.ts"
import { filterCustomFields } from "../domain/filter-custom-fields.ts"
import { groupFieldsByType } from "../domain/group-fields-by-type.ts"
import { FIELD_CATEGORIES } from "../types.ts"
import { Logo } from "./Logo.tsx"
import { LoadingScreen } from "./LoadingScreen.tsx"
import { FieldBrowser } from "./FieldBrowser.tsx"
import { CopyProgress } from "./CopyProgress.tsx"
import { readHistory } from "../history/read-history.ts"
import { writeHistory } from "../history/write-history.ts"
import { generateSessionId } from "../history/generate-session-id.ts"
import { toHistoryEntry } from "../history/to-history-entry.ts"
import type { HistoryFile, HistorySession } from "../history/types.ts"

type AppPhase =
  | { phase: "verifying-tokens" }
  | { phase: "loading-fields" }
  | { phase: "browsing" }
  | { phase: "copying"; selected: SourceField[] }

type Props = {
  args: ParsedArgs
}

export function App({ args }: Props) {
  const { exit } = useApp()
  const [phase, setPhase] = useState<AppPhase>({ phase: "verifying-tokens" })
  const [error, setError] = useState<AppError | null>(null)
  const [readOnlyTokens, setReadOnlyTokens] = useState<VerifiedToken[]>([])
  const [targetToken, setTargetToken] = useState<VerifiedToken | null>(null)
  const [sourceFields, setSourceFields] = useState<SourceField[]>([])
  const [targetFields, setTargetFields] = useState<SourceField[]>([])
  const [copyResults, setCopyResults] = useState<CopyResult[]>([])
  const [copyProgress, setCopyProgress] = useState<CopyResult[]>([])
  const [pastSessions, setPastSessions] = useState<HistorySession[]>([])
  const sessionIdRef = useRef(generateSessionId())
  const historyFileRef = useRef<HistoryFile>({ version: 1, sessions: [] })

  // Exit on 'q' during browsing
  useInput((input) => {
    if (input === "q" && phase.phase === "browsing") {
      exit()
    }
  })

  // Step 1: Verify all tokens in parallel + load history
  useEffect(() => {
    if (phase.phase !== "verifying-tokens") return

    const allTokens = args.targetApiToken
      ? [...args.readOnlyApiTokens, args.targetApiToken]
      : [...args.readOnlyApiTokens]
    const verifications = allTokens.map((t) => verifyToken(t))

    // Load history in parallel with token verification
    readHistory().then((historyResult) => {
      if (historyResult.isOk()) {
        historyFileRef.current = historyResult.value
        setPastSessions(historyResult.value.sessions)
      }
    })

    ResultAsync.combine(verifications).then((result) => {
      if (result.isErr()) {
        setError(result.error)
        return
      }
      const verified = result.value
      if (args.targetApiToken) {
        const target = verified[verified.length - 1]!
        const readOnly = verified.slice(0, -1)
        setReadOnlyTokens(readOnly)
        setTargetToken(target)
      } else {
        setReadOnlyTokens(verified)
        setTargetToken(null)
      }
      setPhase({ phase: "loading-fields" })
    })
  }, [phase.phase])

  // Step 2: Load all fields in parallel
  useEffect(() => {
    if (phase.phase !== "loading-fields") return

    const allTokens = targetToken
      ? [...readOnlyTokens, targetToken]
      : [...readOnlyTokens]
    const fetches = allTokens.flatMap((token) =>
      FIELD_CATEGORIES.map((category) => fetchFields(token, category))
    )

    ResultAsync.combine(fetches).then((result) => {
      if (result.isErr()) {
        setError(result.error)
        return
      }
      const allFields = result.value.flat()
      if (targetToken) {
        const source = allFields.filter(
          (f) => f.source.apiToken !== targetToken.apiToken
        )
        const target = allFields.filter(
          (f) => f.source.apiToken === targetToken.apiToken
        )
        setSourceFields(filterCustomFields(source))
        setTargetFields(target)
      } else {
        setSourceFields(filterCustomFields(allFields))
        setTargetFields([])
      }
      setPhase({ phase: "browsing" })
    })
  }, [phase.phase, targetToken])

  // Step 3: Copy fields sequentially
  useEffect(() => {
    if (phase.phase !== "copying") return
    if (!targetToken) return

    const selected = phase.selected
    setCopyProgress([])

    const copyNext = async (index: number, results: CopyResult[]) => {
      if (index >= selected.length) {
        setCopyResults((prev) => [...prev, ...results])
        setCopyProgress([])

        // Persist history entries
        if (targetToken) {
          const entries = results.map((r) => toHistoryEntry(r, targetToken, args.dryRun))
          const sessionId = sessionIdRef.current
          const existingSessionIdx = historyFileRef.current.sessions.findIndex(
            (s) => s.sessionId === sessionId
          )
          if (existingSessionIdx >= 0) {
            historyFileRef.current.sessions[existingSessionIdx]!.entries.push(...entries)
          } else {
            historyFileRef.current.sessions.push({
              sessionId,
              startedAt: new Date().toISOString(),
              entries,
            })
          }
          writeHistory(historyFileRef.current)
        }

        setPhase({ phase: "browsing" })
        return
      }

      const field = selected[index]!
      const exists = checkExistingField(field.fieldName, targetFields)

      if (exists) {
        const result: CopyResult = {
          status: "skipped",
          field,
          reason: `Already exists in '${targetToken.companyName}'`,
        }
        const newResults = [...results, result]
        setCopyProgress(newResults)
        copyNext(index + 1, newResults)
        return
      }

      const createResult = await createField(targetToken, field, args.dryRun)
      const result: CopyResult = createResult.match(
        (ok) => ok,
        (err): CopyResult => ({ status: "failed", field, error: err })
      )
      const newResults = [...results, result]
      setCopyProgress(newResults)
      copyNext(index + 1, newResults)
    }

    copyNext(0, [])
  }, [phase.phase])

  if (error) {
    return (
      <Box flexDirection="column">
        <Logo />
        <Text color="red" bold>Error: {formatError(error)}</Text>
      </Box>
    )
  }

  const grouped = groupFieldsByType(sourceFields)
  const fieldCounts: Record<FieldCategory, number> = {
    deal: grouped.deal.length,
    person: grouped.person.length,
    organization: grouped.organization.length,
    product: grouped.product.length,
  }

  return (
    <Box flexDirection="column">
      <Logo />

      {phase.phase === "verifying-tokens" && (
        <LoadingScreen
          phase="verifying-tokens"
          totalTokens={args.readOnlyApiTokens.length + (args.targetApiToken ? 1 : 0)}
        />
      )}

      {phase.phase === "loading-fields" && (
        <Box flexDirection="column" gap={1}>
          {readOnlyTokens.map((t) => (
            <Text key={t.apiToken} color="greenBright">
              ✓ {t.userName} ({t.companyName})
            </Text>
          ))}
          {targetToken && (
            <Text color="cyanBright">
              ✓ Target: {targetToken.userName} ({targetToken.companyName})
            </Text>
          )}
          <LoadingScreen
            phase="loading-fields"
            totalTokens={readOnlyTokens.length + (targetToken ? 1 : 0)}
          />
        </Box>
      )}

      {phase.phase === "browsing" && (
        <FieldBrowser
          grouped={grouped}
          fieldCounts={fieldCounts}
          targetToken={targetToken}
          readOnlyTokens={readOnlyTokens}
          dryRun={args.dryRun}
          copyResults={copyResults}
          pastSessions={pastSessions}
          currentSessionId={sessionIdRef.current}
          targetFields={targetFields}
          onConfirmCopy={(selected) => {
            setPhase({ phase: "copying", selected })
          }}
          onExit={() => exit()}
        />
      )}

      {phase.phase === "copying" && (
        <CopyProgress total={phase.selected.length} results={copyProgress} />
      )}
    </Box>
  )
}
