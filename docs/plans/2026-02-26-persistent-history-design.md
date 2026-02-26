# Persistent Copy History - Design Document

## Purpose

Save copy history to disk so users can see past operations across CLI sessions. History persists in `~/.pipedrive-field-cli/history.json` and is displayed in the History tab grouped by session.

## Storage

**File:** `~/.pipedrive-field-cli/history.json`

**Format:**

```json
{
  "version": 1,
  "sessions": [
    {
      "sessionId": "2026-02-26T14:30:00_a1b2c3",
      "startedAt": "2026-02-26T14:30:00Z",
      "entries": [
        {
          "timestamp": "2026-02-26T14:30:15Z",
          "status": "created",
          "field": {
            "fieldName": "Custom status",
            "fieldType": "enum",
            "category": "deal",
            "options": ["Hot", "Warm", "Cold"]
          },
          "source": {
            "companyName": "Acme Oy",
            "userName": "Matti"
          },
          "target": {
            "companyName": "Target Oy",
            "userName": "Admin"
          },
          "dryRun": false,
          "reason": null
        }
      ]
    }
  ]
}
```

**Security:** No API tokens stored in history file. Only company/user names.

## Behavior

- On startup: generate session ID, read existing history from disk
- After each copy operation: append entry to current session, write to disk immediately
- If file doesn't exist: create it with empty sessions array
- If file is corrupted: warn user, start with empty history, don't overwrite corrupt file
- `version: 1` enables future format migrations

## Architecture

```
src/history/
├── types.ts                    # HistoryFile, HistorySession, HistoryEntry types
├── generate-session-id.ts      # Unique session ID generator
├── generate-session-id.test.ts
├── read-history.ts             # Read ~/.pipedrive-field-cli/history.json
├── read-history.test.ts
├── write-history.ts            # Append entry and write session to history
├── write-history.test.ts
```

## Types

```typescript
type HistoryEntry = {
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

type HistorySession = {
  sessionId: string
  startedAt: string
  entries: HistoryEntry[]
}

type HistoryFile = {
  version: 1
  sessions: HistorySession[]
}
```

## Function Signatures

```typescript
// All use neverthrow
generateSessionId(): string
readHistory(): ResultAsync<HistoryFile, AppError>
writeHistory(history: HistoryFile): ResultAsync<void, AppError>
appendEntry(sessionId: string, entry: HistoryEntry): ResultAsync<void, AppError>
```

## History Tab Display

Current session at top (green), past sessions below (gray), newest first:

```
 ── This session ──────────────────────────────────────────────
┌───┬──────────┬─────────────────┬──────────┬──────┬───────────────────────┐
│   │ Status   │ Field           │ Type     │ Cat  │ Acme Oy → Target Oy   │
├───┼──────────┼─────────────────┼──────────┼──────┼───────────────────────┤
│ ✓ │ Created  │ Custom status   │ enum     │ deal │ Matti → Admin         │
│ ⊘ │ Skipped  │ Score           │ double   │ deal │ Matti → Admin         │
└───┴──────────┴─────────────────┴──────────┴──────┴───────────────────────┘

 ── 2026-01-15 14:30 (5 fields) ──────────────────────────────
┌───┬──────────┬─────────────────┬──────────┬────────┬─────────────────────┐
│ ✓ │ Created  │ Region          │ enum     │ person │ Liisa → Admin       │
└───┴──────────┴─────────────────┴──────────┴────────┴─────────────────────┘
```

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Storage location | ~/.pipedrive-field-cli/history.json | Always same path, easy to find |
| Grouping | Session ID | Matches user mental model |
| Security | No API tokens | Safe if file leaks |
| Write timing | After each copy | No data loss on crash |
| Format versioning | version: 1 | Future migration support |
| Current vs past | Green header vs gray | Clear visual distinction |
