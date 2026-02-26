import { ResultAsync } from "neverthrow"
import { mkdir, writeFile } from "fs/promises"
import type { HistoryFile } from "./types.ts"
import type { AppError } from "../errors.ts"
import { HISTORY_DIR, HISTORY_PATH } from "./read-history.ts"

export function writeHistory(history: HistoryFile): ResultAsync<void, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      await mkdir(HISTORY_DIR, { recursive: true })
      await writeFile(HISTORY_PATH, JSON.stringify(history, null, 2), "utf-8")
    })(),
    (error): AppError => ({
      type: "NETWORK_ERROR",
      message: `Failed to write history file: ${error instanceof Error ? error.message : "Unknown error"}`,
    })
  )
}
