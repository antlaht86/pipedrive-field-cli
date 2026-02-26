# Target Browse & Env Generation - Design Document

## Purpose

Two new features:
1. **Target field browsing** — Toggle between source and target fields. Target fields are read-only, letting users see what already exists in the target account.
2. **Env variable generation** — Select fields and generate `DEAL_FIELD_NAME="field_code"` format output for use in code.

## Feature 1: Source/Target Toggle

### UI

First tab in FieldBrowser acts as a toggle:

```
 Source ● | Deals (12) | Persons (5) | Orgs (3) | Products (0) | History (8)
```

Clicking it switches to:

```
 Target ● | Deals (8) | Persons (3) | Orgs (2) | Products (1) | History (8)
```

### Behavior

- **Source mode** (default): Shows source fields, MultiSelect enabled for copy/env operations
- **Target mode**: Shows ALL target fields (custom + built-in), read-only. No checkboxes, just a filterable list. Header color changes to `cyanBright` to distinguish.
- Tab counts update to reflect the active data source
- Filter works identically in both modes
- Switching source/target resets to first category tab

### Data Flow

`App.tsx` already fetches target fields but only uses them for duplicate checking. Pass `targetFields` to `FieldBrowser` as a new prop. Group them by type same as source fields.

## Feature 2: Mode Selection

### UI

After token verification and field loading, before FieldBrowser:

```
  ░▒▓ Field CLI ▓▒░

  ✓ Matti (Acme Oy)
  ◆ Target: Admin (Target Oy)

  What would you like to do?

  › Copy fields
    Generate env variables
```

### AppPhase

New phase `selecting-mode` between `loading-fields` and `browsing`:

```typescript
type AppMode = "copy" | "env"

type AppPhase =
  | { phase: "verifying-tokens" }
  | { phase: "loading-fields" }
  | { phase: "selecting-mode" }
  | { phase: "browsing"; mode: AppMode }
  | { phase: "copying"; selected: SourceField[] }
```

## Feature 3: Env Variable Generation

### Env Name Format

`toEnvName(category: FieldCategory, fieldName: string): string`

Rules:
- Category prefix: `DEAL_`, `PERSON_`, `ORG_`, `PRODUCT_`
- Transliterate: ä→a, ö→o, å→a, ü→u etc.
- Spaces → `_`
- Remove non-alphanumeric (except `_`)
- Uppercase everything
- Collapse multiple underscores

Examples:
- "Ähtärin pojat" (deal) → `DEAL_AHTARIN_POJAT`
- "Lead score!" (person) → `PERSON_LEAD_SCORE`
- "Crédit rating" (organization) → `ORG_CREDIT_RATING`

### Env Output Value

Uses `fieldCode` from Pipedrive API field data.

```
DEAL_AHTARIN_POJAT="abc123_ahtarin_pojat"
```

### Output Display

In env mode, History tab is replaced by Output tab:

```
 Source ● | Deals (12) | Persons (5) | Orgs (3) | Products (0) | Output (3)

 ── Generated env variables ──────────────────────────────────

 DEAL_AHTARIN_POJAT="abc123_ahtarin_pojat"
 DEAL_STATUS="def456_status"
 PERSON_REGION="ghi789_region"
```

- Each submission appends to the output list (cumulative)
- App doesn't exit, user can continue selecting and generating
- Submit button says "Generate env" instead of "Copy"

## Architecture

```
Modified files:
├── src/types.ts                    # AppMode type
├── src/ui/App.tsx                  # selecting-mode phase, targetFields passthrough
├── src/ui/FieldBrowser.tsx         # Source/Target toggle, mode-dependent behavior
├── src/ui/FieldMultiSelect.tsx     # Read-only support for target mode
├── src/ui/CopyHistory.tsx          # Unchanged (hidden in env mode)

New files:
├── src/domain/to-env-name.ts       # Transliteration + env name generation
├── src/domain/to-env-name.test.ts  # Tests: ääkköset, special chars, categories
├── src/ui/ModeSelect.tsx           # Copy/Env mode selection screen
├── src/ui/EnvOutput.tsx            # Env variable output display
```

## Types

```typescript
type AppMode = "copy" | "env"

// Env output entry
type EnvEntry = {
  envName: string    // DEAL_AHTARIN_POJAT
  fieldCode: string  // abc123_ahtarin_pojat
  fieldName: string  // Ähtärin pojat (for display)
  category: FieldCategory
}
```

## Function Signatures

```typescript
// Pure function, easy to test
toEnvName(category: FieldCategory, fieldName: string): string

// Category prefix mapping
categoryPrefix(category: FieldCategory): string
// "deal" → "DEAL", "person" → "PERSON", "organization" → "ORG", "product" → "PRODUCT"
```

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Mode selection | UI after loading, Select component | No CLI flag needed, discoverable |
| Source/Target toggle | First tab in FieldBrowser | Intuitive, no extra keybinding |
| Target fields | All fields (custom + built-in) | Purpose is to see what exists |
| Target mode | Read-only, no checkboxes | Can't copy to yourself |
| Env value | field_code | What developers need in code |
| Transliteration | ä→a, ö→o etc. | Clean env variable names |
| Env output | Output tab, cumulative | Matches History tab pattern |
| Org prefix | ORG_ not ORGANIZATION_ | Shorter, more practical |
