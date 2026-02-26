import { ResultAsync, ok, err } from "neverthrow"
import { homedir } from "os"
import { join } from "path"
import { readFile, mkdir } from "fs/promises"
import type { HistoryFile } from "./types.ts"
import type { AppError } from "../errors.ts"

const HISTORY_DIR = join(homedir(), ".pipedrive-field-cli")
const HISTORY_PATH = join(HISTORY_DIR, "history.json")

export { HISTORY_DIR, HISTORY_PATH }

export function readHistory(): ResultAsync<HistoryFile, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      try {
        const content = await readFile(HISTORY_PATH, "utf-8")
        const parsed = JSON.parse(content) as HistoryFile
        if (parsed.version !== 1 || !Array.isArray(parsed.sessions)) {
          throw new Error("Invalid history file format")
        }
        return parsed
      } catch (error) {
        if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
          return { version: 1 as const, sessions: [] }
        }
        throw error
      }
    })(),
    (error): AppError => ({
      type: "NETWORK_ERROR",
      message: `Failed to read history file: ${error instanceof Error ? error.message : "Unknown error"}`,
    })
  )
}
