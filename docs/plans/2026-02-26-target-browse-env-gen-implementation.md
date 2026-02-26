# Target Browse & Env Generation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add source/target field toggle and env variable generation mode to the CLI.

**Architecture:** New `selecting-mode` phase in App.tsx between loading and browsing. FieldBrowser gets a Source/Target toggle as first tab, and mode-dependent behavior (copy vs env). Pure `toEnvName()` function handles transliteration. New `ModeSelect.tsx` and `EnvOutput.tsx` components.

**Tech Stack:** React + Ink, neverthrow, bun:test

---

### Task 1: Add AppMode type and EnvEntry type

**Files:**
- Modify: `src/types.ts`

**Step 1: Add types to src/types.ts**

Add after the `ParsedArgs` type (line 32):

```typescript
export type AppMode = "copy" | "env"

export type EnvEntry = {
  envName: string
  fieldCode: string
  fieldName: string
  category: FieldCategory
}
```

**Step 2: Run tests to verify nothing breaks**

Run: `bun test`
Expected: All 63 tests pass

**Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add AppMode and EnvEntry types"
```

---

### Task 2: Create toEnvName with TDD

**Files:**
- Create: `src/domain/to-env-name.ts`
- Create: `src/domain/to-env-name.test.ts`

**Step 1: Write the failing tests**

Create `src/domain/to-env-name.test.ts`:

```typescript
import { describe, it, expect } from "bun:test"
import { toEnvName } from "./to-env-name.ts"

describe("toEnvName", () => {
  it("generates basic env name from deal field", () => {
    expect(toEnvName("deal", "Status")).toBe("DEAL_STATUS")
  })

  it("handles spaces", () => {
    expect(toEnvName("deal", "Lead score")).toBe("DEAL_LEAD_SCORE")
  })

  it("transliterates Finnish characters", () => {
    expect(toEnvName("deal", "Ähtärin pojat")).toBe("DEAL_AHTARIN_POJAT")
  })

  it("transliterates ö and å", () => {
    expect(toEnvName("person", "Östersund ålänning")).toBe("PERSON_OSTERSUND_ALANNING")
  })

  it("transliterates accented Latin characters", () => {
    expect(toEnvName("organization", "Crédit rating")).toBe("ORG_CREDIT_RATING")
  })

  it("removes special characters", () => {
    expect(toEnvName("person", "Lead score!")).toBe("PERSON_LEAD_SCORE")
  })

  it("collapses multiple underscores", () => {
    expect(toEnvName("deal", "My   field---here")).toBe("DEAL_MY_FIELD_HERE")
  })

  it("uses ORG prefix for organization", () => {
    expect(toEnvName("organization", "Region")).toBe("ORG_REGION")
  })

  it("uses PRODUCT prefix for product", () => {
    expect(toEnvName("product", "Weight")).toBe("PRODUCT_WEIGHT")
  })

  it("handles field name with only special characters", () => {
    expect(toEnvName("deal", "!!!")).toBe("DEAL_")
  })

  it("transliterates ü and ñ", () => {
    expect(toEnvName("deal", "München señor")).toBe("DEAL_MUNCHEN_SENOR")
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test src/domain/to-env-name.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write the implementation**

Create `src/domain/to-env-name.ts`:

```typescript
import type { FieldCategory } from "../types.ts"

const CATEGORY_PREFIX: Record<FieldCategory, string> = {
  deal: "DEAL",
  person: "PERSON",
  organization: "ORG",
  product: "PRODUCT",
}

const TRANSLITERATIONS: Record<string, string> = {
  ä: "a", Ä: "A", ö: "o", Ö: "O", å: "a", Å: "A",
  ü: "u", Ü: "U",
  é: "e", è: "e", ê: "e", ë: "e", É: "E", È: "E", Ê: "E", Ë: "E",
  á: "a", à: "a", â: "a", ã: "a", Á: "A", À: "A", Â: "A", Ã: "A",
  í: "i", ì: "i", î: "i", ï: "i", Í: "I", Ì: "I", Î: "I", Ï: "I",
  ó: "o", ò: "o", ô: "o", õ: "o", Ó: "O", Ò: "O", Ô: "O", Õ: "O",
  ú: "u", ù: "u", û: "u", Ú: "U", Ù: "U", Û: "U",
  ñ: "n", Ñ: "N",
  ç: "c", Ç: "C",
  ß: "ss",
}

function transliterate(str: string): string {
  return str
    .split("")
    .map((char) => TRANSLITERATIONS[char] ?? char)
    .join("")
}

export function toEnvName(category: FieldCategory, fieldName: string): string {
  const prefix = CATEGORY_PREFIX[category]
  const transliterated = transliterate(fieldName)
  const cleaned = transliterated
    .replace(/[^a-zA-Z0-9\s_-]/g, "")
    .replace(/[\s\-]+/g, "_")
    .replace(/_+/g, "_")
    .toUpperCase()
  return `${prefix}_${cleaned}`
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test src/domain/to-env-name.test.ts`
Expected: All 11 tests pass

**Step 5: Run all tests**

Run: `bun test`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/domain/to-env-name.ts src/domain/to-env-name.test.ts
git commit -m "feat: toEnvName with transliteration and tests"
```

---

### Task 3: Create ModeSelect component

**Files:**
- Create: `src/ui/ModeSelect.tsx`

**Step 1: Create the component**

Create `src/ui/ModeSelect.tsx`:

```typescript
import React from "react"
import { Box, Text } from "ink"
import { Select } from "@inkjs/ui"
import type { AppMode, VerifiedToken } from "../types.ts"

type Props = {
  readOnlyTokens: VerifiedToken[]
  targetToken: VerifiedToken
  onSelect: (mode: AppMode) => void
}

export function ModeSelect({ readOnlyTokens, targetToken, onSelect }: Props) {
  return (
    <Box flexDirection="column" gap={1}>
      {/* Account info */}
      <Box flexDirection="column">
        {readOnlyTokens.map((t) => (
          <Text key={t.apiToken} color="greenBright">
            ✓ {t.userName} ({t.companyName})
          </Text>
        ))}
        <Text color="cyanBright">
          ✓ Target: {targetToken.userName} ({targetToken.companyName})
        </Text>
      </Box>

      <Text bold color="white">What would you like to do?</Text>

      <Select
        options={[
          { label: "Copy fields", value: "copy" },
          { label: "Generate env variables", value: "env" },
        ]}
        onChange={(value) => onSelect(value as AppMode)}
      />
    </Box>
  )
}
```

**Step 2: Run all tests to verify nothing breaks**

Run: `bun test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/ui/ModeSelect.tsx
git commit -m "feat: ModeSelect component for copy/env mode"
```

---

### Task 4: Create EnvOutput component

**Files:**
- Create: `src/ui/EnvOutput.tsx`

**Step 1: Create the component**

Create `src/ui/EnvOutput.tsx`:

```typescript
import React from "react"
import { Box, Text } from "ink"
import type { EnvEntry } from "../types.ts"

type Props = {
  entries: EnvEntry[]
}

export function EnvOutput({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <Box flexDirection="column" gap={1}>
        <Text color="gray">No env variables generated yet. Select fields from other tabs and submit.</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text color="greenBright" bold>
        {"── Generated env variables "}{"─".repeat(40)}
      </Text>

      <Box flexDirection="column">
        {entries.map((entry) => (
          <Text key={entry.envName + entry.fieldCode}>
            <Text color="yellowBright">{entry.envName}</Text>
            <Text color="white">=</Text>
            <Text color="greenBright">"{entry.fieldCode}"</Text>
          </Text>
        ))}
      </Box>

      <Text color="gray">{entries.length} variable{entries.length !== 1 ? "s" : ""} generated</Text>
    </Box>
  )
}
```

**Step 2: Run all tests**

Run: `bun test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/ui/EnvOutput.tsx
git commit -m "feat: EnvOutput component for env variable display"
```

---

### Task 5: Add selecting-mode phase to App.tsx

**Files:**
- Modify: `src/ui/App.tsx`

**Step 1: Update AppPhase type and add imports**

In `src/ui/App.tsx`, update the `AppPhase` type (lines 29-33) to:

```typescript
type AppPhase =
  | { phase: "verifying-tokens" }
  | { phase: "loading-fields" }
  | { phase: "selecting-mode" }
  | { phase: "browsing"; mode: AppMode }
  | { phase: "copying"; selected: SourceField[] }
```

Add import for `AppMode`:

```typescript
import type {
  FieldCategory,
  ParsedArgs,
  SourceField,
  VerifiedToken,
  CopyResult,
  AppMode,
} from "../types.ts"
```

Add import for `ModeSelect`:

```typescript
import { ModeSelect } from "./ModeSelect.tsx"
```

**Step 2: Change loading-fields transition**

In the `loading-fields` useEffect (line 113), change:

```typescript
setPhase({ phase: "browsing" })
```

to:

```typescript
setPhase({ phase: "selecting-mode" })
```

**Step 3: Update 'q' exit handler**

Change the `useInput` handler (line 55) condition:

```typescript
if (input === "q" && (phase.phase === "browsing" || phase.phase === "selecting-mode")) {
```

**Step 4: Update browsing phase to include mode**

Change the copying phase transition back to browsing (line 149):

```typescript
setPhase({ phase: "browsing", mode: "copy" })
```

Note: The mode needs to be tracked. Add a state for it:

```typescript
const [appMode, setAppMode] = useState<AppMode>("copy")
```

Then use this in transitions. When copy finishes:

```typescript
setPhase({ phase: "browsing", mode: appMode })
```

**Step 5: Add selecting-mode render**

In the JSX, add between `loading-fields` and `browsing` blocks:

```tsx
{phase.phase === "selecting-mode" && targetToken && (
  <ModeSelect
    readOnlyTokens={readOnlyTokens}
    targetToken={targetToken}
    onSelect={(mode) => {
      setAppMode(mode)
      setPhase({ phase: "browsing", mode })
    }}
  />
)}
```

**Step 6: Pass mode to FieldBrowser**

Add `mode` prop to the FieldBrowser render:

```tsx
{phase.phase === "browsing" && targetToken && (
  <FieldBrowser
    grouped={grouped}
    fieldCounts={fieldCounts}
    targetToken={targetToken}
    readOnlyTokens={readOnlyTokens}
    dryRun={args.dryRun}
    copyResults={copyResults}
    pastSessions={pastSessions}
    currentSessionId={sessionIdRef.current}
    mode={phase.mode}
    targetFields={targetFields}
    onConfirmCopy={(selected) => {
      setPhase({ phase: "copying", selected })
    }}
    onExit={() => exit()}
  />
)}
```

**Step 7: Run all tests**

Run: `bun test`
Expected: All tests pass

**Step 8: Commit**

```bash
git add src/ui/App.tsx
git commit -m "feat: add selecting-mode phase and pass mode/targetFields to FieldBrowser"
```

---

### Task 6: Update FieldBrowser with source/target toggle and mode support

**Files:**
- Modify: `src/ui/FieldBrowser.tsx`

This is the largest task. It involves:
1. Adding Source/Target toggle as first tab
2. Mode-dependent behavior (copy vs env)
3. Passing target fields through

**Step 1: Update Props and imports**

```typescript
import React, { useState } from "react"
import { Box, Text } from "ink"
import { Tabs, Tab } from "ink-tab"
import { Select } from "@inkjs/ui"
import type { FieldCategory, SourceField, VerifiedToken, CopyResult, AppMode, EnvEntry } from "../types.ts"
import type { HistorySession } from "../history/types.ts"
import { FieldMultiSelect } from "./FieldMultiSelect.tsx"
import { FieldReadOnlyList } from "./FieldReadOnlyList.tsx"
import { CopyHistory } from "./CopyHistory.tsx"
import { EnvOutput } from "./EnvOutput.tsx"
import { toEnvName } from "../domain/to-env-name.ts"
import { groupFieldsByType } from "../domain/group-fields-by-type.ts"

type Props = {
  grouped: Record<FieldCategory, SourceField[]>
  fieldCounts: Record<FieldCategory, number>
  targetToken: VerifiedToken
  readOnlyTokens: VerifiedToken[]
  dryRun: boolean
  copyResults: CopyResult[]
  pastSessions: HistorySession[]
  currentSessionId: string
  mode: AppMode
  targetFields: SourceField[]
  onConfirmCopy: (selected: SourceField[]) => void
  onExit: () => void
}
```

**Step 2: Add state for source/target toggle and env entries**

```typescript
const [viewSource, setViewSource] = useState(true) // true = source, false = target
const [envEntries, setEnvEntries] = useState<EnvEntry[]>([])
```

**Step 3: Compute target field groups and counts**

```typescript
const targetGrouped = groupFieldsByType(targetFields)
const targetFieldCounts: Record<FieldCategory, number> = {
  deal: targetGrouped.deal.length,
  person: targetGrouped.person.length,
  organization: targetGrouped.organization.length,
  product: targetGrouped.product.length,
}

const activeGrouped = viewSource ? grouped : targetGrouped
const activeCounts = viewSource ? fieldCounts : targetFieldCounts
```

**Step 4: Update handleTabChange for source/target toggle**

When user clicks the first tab ("source"/"target"), toggle viewSource instead of changing activeTab:

```typescript
const handleTabChange = (name: string) => {
  if (name === "toggle") {
    setViewSource((prev) => !prev)
    setActiveTab("deal")
    setPendingSelected(null)
    return
  }
  setActiveTab(name)
  setPendingSelected(null)
}
```

**Step 5: Add env submit handler**

```typescript
const handleEnvSubmit = (selected: SourceField[]) => {
  if (selected.length === 0) return
  const newEntries = selected.map((field) => ({
    envName: toEnvName(field.category, field.fieldName),
    fieldCode: field.fieldCode,
    fieldName: field.fieldName,
    category: field.category,
  }))
  setEnvEntries((prev) => [...prev, ...newEntries])
  setPendingSelected(null)
}
```

**Step 6: Update confirmation UI for env mode**

In the `pendingSelected` confirmation section, change the text and options based on mode:

For copy mode (existing):
```tsx
<Text bold color="cyan">
  Copy {pendingSelected.length} field{pendingSelected.length !== 1 ? "s" : ""} to{" "}
  <Text color="cyanBright">{targetToken.companyName}</Text>?
</Text>
```

For env mode:
```tsx
<Text bold color="cyan">
  Generate env for {pendingSelected.length} field{pendingSelected.length !== 1 ? "s" : ""}?
</Text>
```

Select options for env mode:
```tsx
{ label: "✓ Yes, generate env", value: "confirm" }
```

And on confirm for env mode, call `handleEnvSubmit(pendingSelected)` instead of `onConfirmCopy(pendingSelected)`.

**Step 7: Update tabs rendering**

```tsx
<Tabs
  onChange={handleTabChange}
  defaultValue="deal"
  showIndex={false}
  colors={{
    activeTab: {
      color: viewSource ? "greenBright" : "cyanBright",
    },
  }}
>
  <Tab name="toggle">{viewSource ? "Source ●" : "Target ●"}</Tab>
  <Tab name="deal">{`Deals (${activeCounts.deal})`}</Tab>
  <Tab name="person">{`Persons (${activeCounts.person})`}</Tab>
  <Tab name="organization">{`Orgs (${activeCounts.organization})`}</Tab>
  <Tab name="product">{`Products (${activeCounts.product})`}</Tab>
  {mode === "copy" ? (
    <Tab name="history">{`History (${historyCount})`}</Tab>
  ) : (
    <Tab name="output">{`Output (${envEntries.length})`}</Tab>
  )}
</Tabs>
```

**Step 8: Update tab content rendering**

```tsx
{/* Tab content */}
{activeTab === "history" && mode === "copy" ? (
  <CopyHistory
    results={copyResults}
    dryRun={dryRun}
    pastSessions={pastSessions}
    currentSessionId={currentSessionId}
  />
) : activeTab === "output" && mode === "env" ? (
  <EnvOutput entries={envEntries} />
) : !viewSource ? (
  /* Target mode: read-only list */
  <Box flexDirection="column">
    {activeCounts[activeTab as FieldCategory] === 0 ? (
      <Text color="gray">No fields found for this type.</Text>
    ) : (
      <FieldReadOnlyList
        key={activeTab + "-target"}
        fields={activeGrouped[activeTab as FieldCategory]}
        category={activeTab as FieldCategory}
      />
    )}
  </Box>
) : pendingSelected ? (
  /* Confirmation dialog — varies by mode */
  <Box flexDirection="column" gap={1}>
    <Text bold color="cyan">
      {mode === "copy" ? (
        <>Copy {pendingSelected.length} field{pendingSelected.length !== 1 ? "s" : ""} to{" "}
          <Text color="cyanBright">{targetToken.companyName}</Text>?</>
      ) : (
        <>Generate env for {pendingSelected.length} field{pendingSelected.length !== 1 ? "s" : ""}?</>
      )}
    </Text>
    {pendingSelected.map((field) => (
      <Box key={field.fieldCode + field.source.apiToken}>
        <Text color="white">  ▸ {field.fieldName} </Text>
        <Text color="magenta">[{field.fieldType}]</Text>
        {mode === "env" && (
          <Text color="yellowBright"> → {toEnvName(field.category, field.fieldName)}</Text>
        )}
        {mode === "copy" && field.options && field.options.length > 0 && (
          <Text color="gray"> ({field.options.map((o) => o.label).join(", ")})</Text>
        )}
      </Box>
    ))}
    <Select
      options={[
        { label: mode === "copy" ? "✓ Yes, copy fields" : "✓ Yes, generate env", value: "confirm" },
        { label: "✗ Cancel", value: "cancel" },
      ]}
      onChange={(value) => {
        if (value === "confirm") {
          if (mode === "env") handleEnvSubmit(pendingSelected)
          else handleConfirm()
        } else {
          setPendingSelected(null)
        }
      }}
    />
  </Box>
) : (
  /* Source mode: selectable field list */
  <Box flexDirection="column">
    {activeCounts[activeTab as FieldCategory] === 0 ? (
      <Text color="gray">No custom fields found for this type.</Text>
    ) : (
      <FieldMultiSelect
        key={activeTab}
        fields={activeGrouped[activeTab as FieldCategory]}
        category={activeTab as FieldCategory}
        onSubmit={handleFieldSubmit}
      />
    )}
  </Box>
)}
```

**Step 9: Update header to show active view color**

Change the header section to highlight which view is active:

```tsx
{/* Account info */}
<Box flexDirection="column">
  {readOnlyTokens.map((t) => (
    <Box key={t.apiToken}>
      <Text color={viewSource ? "greenBright" : "gray"}> {viewSource ? "●" : "○"} </Text>
      <Text color={viewSource ? "white" : "gray"}>{t.userName}</Text>
      <Text color="gray"> ({t.companyName})</Text>
    </Box>
  ))}
  <Box>
    <Text color={!viewSource ? "cyanBright" : "gray"}> {!viewSource ? "◆" : "◇"} </Text>
    <Text color={!viewSource ? "white" : "gray"} bold={!viewSource}>Target: {targetToken.userName}</Text>
    <Text color="gray"> ({targetToken.companyName})</Text>
  </Box>
</Box>
```

**Step 10: Run all tests**

Run: `bun test`
Expected: All tests pass

**Step 11: Commit**

```bash
git add src/ui/FieldBrowser.tsx
git commit -m "feat: source/target toggle and copy/env mode in FieldBrowser"
```

---

### Task 7: Create FieldReadOnlyList component

**Files:**
- Create: `src/ui/FieldReadOnlyList.tsx`

This is a simplified version of FieldMultiSelect without checkboxes — just a scrollable, filterable list.

**Step 1: Create the component**

Create `src/ui/FieldReadOnlyList.tsx`:

```typescript
import React, { useState, useMemo } from "react"
import { Box, Text, useInput } from "ink"
import type { SourceField, FieldCategory } from "../types.ts"

type Props = {
  fields: SourceField[]
  category: FieldCategory
}

const VISIBLE_COUNT = 12

export function FieldReadOnlyList({ fields, category }: Props) {
  const [filter, setFilter] = useState("")
  const [cursor, setCursor] = useState(0)

  const filteredFields = useMemo(() => {
    const lowerFilter = filter.toLowerCase()
    return fields.filter((f) => f.fieldName.toLowerCase().includes(lowerFilter))
  }, [fields, filter])

  const highlightedField = filteredFields[cursor] ?? null

  useInput((input, key) => {
    if (key.upArrow) {
      setCursor((prev) => Math.max(0, prev - 1))
      return
    }
    if (key.downArrow) {
      setCursor((prev) => Math.min(filteredFields.length - 1, prev + 1))
      return
    }
    if (key.escape) {
      setFilter("")
      setCursor(0)
      return
    }
    if (key.backspace || key.delete) {
      setFilter((prev) => {
        const next = prev.slice(0, -1)
        setCursor(0)
        return next
      })
      return
    }
    if (input && !key.ctrl && !key.meta && !key.return && !key.tab && input !== " ") {
      setFilter((prev) => prev + input)
      setCursor(0)
    }
  })

  const scrollOffset = Math.max(0, Math.min(cursor - Math.floor(VISIBLE_COUNT / 2), filteredFields.length - VISIBLE_COUNT))
  const visibleFields = filteredFields.slice(scrollOffset, scrollOffset + VISIBLE_COUNT)

  const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1)

  return (
    <Box flexDirection="row" gap={2}>
      {/* Left panel: field list */}
      <Box flexDirection="column" width="60%">
        <Box>
          <Text bold color="cyanBright">{categoryLabel} fields </Text>
          <Text color="gray">({fields.length} total)</Text>
          <Text color="cyanBright"> — read only</Text>
        </Box>

        {filter.length > 0 && (
          <Box>
            <Text color="yellow">Filter: </Text>
            <Text color="yellowBright" bold>{filter}</Text>
            <Text color="gray"> ({filteredFields.length} matches) - ESC to clear</Text>
          </Box>
        )}

        {filter.length === 0 && (
          <Text color="gray">Type to filter │ ↑↓ navigate</Text>
        )}

        <Box flexDirection="column" marginTop={1}>
          {filteredFields.length === 0 ? (
            <Text color="yellow">No fields matching "{filter}"</Text>
          ) : (
            <>
              {scrollOffset > 0 && (
                <Text color="gray">  ↑ {scrollOffset} more above</Text>
              )}
              {visibleFields.map((field, idx) => {
                const realIdx = scrollOffset + idx
                const isHighlighted = realIdx === cursor

                return (
                  <Box key={field.fieldCode + "|" + field.source.apiToken}>
                    <Text color={isHighlighted ? "cyanBright" : "white"}>
                      {isHighlighted ? "❯ " : "  "}
                    </Text>
                    <Text color={field.isCustomField ? "greenBright" : "gray"}>
                      {field.isCustomField ? "★" : "·"}{" "}
                    </Text>
                    <Text
                      color={isHighlighted ? "white" : "gray"}
                      bold={isHighlighted}
                    >
                      {field.fieldName}
                    </Text>
                    <Text color="magenta"> {formatFieldType(field.fieldType)}</Text>
                  </Box>
                )
              })}
              {scrollOffset + VISIBLE_COUNT < filteredFields.length && (
                <Text color="gray">  ↓ {filteredFields.length - scrollOffset - VISIBLE_COUNT} more below</Text>
              )}
            </>
          )}
        </Box>
      </Box>

      {/* Right panel: field preview */}
      <Box flexDirection="column" width="40%" borderStyle="single" borderColor="gray" paddingX={1}>
        {highlightedField ? (
          <FieldPreview field={highlightedField} />
        ) : (
          <Text color="gray" italic>No field selected</Text>
        )}
      </Box>
    </Box>
  )
}

function FieldPreview({ field }: { field: SourceField }) {
  return (
    <Box flexDirection="column" gap={0}>
      <Text bold color="cyanBright">Field Preview</Text>
      <Text color="gray">{"─".repeat(30)}</Text>

      <Box>
        <Text color="gray">Name:      </Text>
        <Text color="white" bold>{field.fieldName}</Text>
      </Box>
      <Box>
        <Text color="gray">Key:       </Text>
        <Text color="yellowBright">{field.fieldCode}</Text>
      </Box>
      <Box>
        <Text color="gray">Type:      </Text>
        <Text color="magenta">{field.fieldType}</Text>
        <Text color="gray"> {formatFieldType(field.fieldType)}</Text>
      </Box>
      <Box>
        <Text color="gray">Category:  </Text>
        <Text color="white">{field.category}</Text>
      </Box>
      <Box>
        <Text color="gray">Custom:    </Text>
        <Text color={field.isCustomField ? "greenBright" : "gray"}>
          {field.isCustomField ? "yes" : "no"}
        </Text>
      </Box>

      {field.options && field.options.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="gray">Options ({field.options.length}):</Text>
          {field.options.slice(0, 15).map((opt, i) => (
            <Box key={i}>
              <Text color="greenBright">  • </Text>
              <Text color="white">{opt.label}</Text>
            </Box>
          ))}
          {field.options.length > 15 && (
            <Text color="gray">  ... and {field.options.length - 15} more</Text>
          )}
        </Box>
      )}

      {(!field.options || field.options.length === 0) && (
        <Box marginTop={1}>
          <Text color="gray" italic>No options</Text>
        </Box>
      )}
    </Box>
  )
}

function formatFieldType(type: string): string {
  const typeMap: Record<string, string> = {
    varchar: "[text]",
    text: "[long text]",
    double: "[number]",
    enum: "[single option]",
    set: "[multi option]",
    date: "[date]",
    daterange: "[date range]",
    time: "[time]",
    timerange: "[time range]",
    monetary: "[monetary]",
    address: "[address]",
    phone: "[phone]",
    user: "[user]",
    org: "[org]",
    people: "[person]",
    varchar_auto: "[autocomplete]",
  }
  return typeMap[type] ?? `[${type}]`
}
```

Note: The `formatFieldType` and `FieldPreview` are duplicated from `FieldMultiSelect.tsx`. This is acceptable since they are small, view-layer helpers tightly coupled to each component. Extracting them would be premature abstraction at this point.

**Step 2: Run all tests**

Run: `bun test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/ui/FieldReadOnlyList.tsx
git commit -m "feat: FieldReadOnlyList for target field browsing"
```

---

### Task 8: Verify full integration

**Files:**
- No changes, just verification

**Step 1: Run all tests**

Run: `bun test`
Expected: All tests pass

**Step 2: TypeScript check**

Run: `bunx tsc --noEmit`
Expected: No errors

**Step 3: Commit (if any fixes needed)**

Only commit if there were fixes. Otherwise this task produces no commit.

---
