export type HistoryEntry = {
  timestamp: string
  status: "created" | "skipped" | "failed"
  field: {
    fieldName: string
    fieldType: string
    category: string
    options: string[] | null
  }
  source: {
    companyName: string
    userName: string
  }
  target: {
    companyName: string
    userName: string
  }
  dryRun: boolean
  reason: string | null
}

export type HistorySession = {
  sessionId: string
  startedAt: string
  entries: HistoryEntry[]
}

export type HistoryFile = {
  version: 1
  sessions: HistorySession[]
}
