# Pipedrive Field CLI - Design Document

## Purpose

CLI tool for copying custom fields between Pipedrive instances. Users provide read-only API tokens (source accounts) and a target API token, browse and select custom fields, and copy them to the target instance.

## CLI Interface

```bash
pipedrive-field-cli \
  --read-only-api-tokens="token1,token2,token3" \
  --target-api-token="target_token" \
  --dry-run  # optional: preview without making changes
```

## Tech Stack

- **Runtime**: Bun
- **UI**: React + Ink + @inkjs/ui
- **Error handling**: neverthrow (ResultAsync, Result)
- **API client**: Generated SDK (@hey-api/openapi-ts) + pipedrive-fetch-until-complete
- **Testing**: Bun test
- **Distribution**: Bun single-file executable (`bun build --compile`)

## App Flow

```
1. PARSE ARGS
   └─ --read-only-api-tokens, --target-api-token, --dry-run

2. VERIFY TOKENS (parallel)
   ├─ GET /v1/users/me?api_token=tok1 → "Matti (Acme Oy)"
   ├─ GET /v1/users/me?api_token=tok2 → "Liisa (Beta Oy)"
   └─ GET /v1/users/me?api_token=tok3 → "Admin (Target Oy)"
   └─ Display: verified accounts, ask to continue

3. LOAD ALL FIELDS (parallel)
   ├─ Each token: dealFields, personFields, orgFields, productFields
   └─ Target fields loaded too (for duplicate checking)
   └─ Spinner: "Loading fields from N accounts..."

4. SELECT FIELD TYPE
   └─ Select: Deal / Person / Organization / Product

5. SELECT FIELDS (MultiSelect + text filter)
   └─ Only custom fields (is_custom_field: true)
   └─ Each shows source: "Custom status (from: Matti, Acme Oy)"

6. CONFIRM COPY
   └─ Summary of selected fields with types and options
   └─ [dry-run] banner if --dry-run active

7. EXECUTE COPY
   ├─ Skip: field already exists → warning
   ├─ OK: field created
   └─ Fail: field creation failed → error

8. SUMMARY
   └─ "Created: N | Skipped: N | Failed: N"
   └─ "Copy more fields? [Select type / Exit]"
```

## Architecture

```
src/
├── cli/
│   ├── parse-args.ts              # CLI argument parsing
│   └── parse-args.test.ts
├── api/
│   ├── verify-token.ts            # GET /v1/users/me - token validation
│   ├── verify-token.test.ts
│   ├── fetch-fields.ts            # Fetch all fields per token (fetchUntilV2)
│   ├── fetch-fields.test.ts
│   ├── create-field.ts            # Create field in target instance
│   ├── create-field.test.ts
│   ├── check-existing-field.ts    # Check if same-name field exists in target
│   └── check-existing-field.test.ts
├── domain/
│   ├── filter-custom-fields.ts    # Filter is_custom_field: true only
│   ├── filter-custom-fields.test.ts
│   ├── group-fields-by-type.ts    # Group into Deal/Person/Org/Product
│   ├── group-fields-by-type.test.ts
│   ├── build-copy-payload.ts      # Build add-field body from source field
│   └── build-copy-payload.test.ts
├── ui/
│   ├── App.tsx                    # Main React component, flow control
│   ├── Logo.tsx                   # Animated pipeline ASCII logo
│   ├── LoadingScreen.tsx          # Token verification + field loading
│   ├── FieldTypeSelect.tsx        # Select Deal/Person/Org/Product
│   ├── FieldMultiSelect.tsx       # MultiSelect + text filter
│   ├── CopyConfirmation.tsx       # Summary + confirm before copy
│   ├── CopyProgress.tsx           # Copy progress display
│   └── ResultSummary.tsx          # Final results: created, skipped, failed
└── index.tsx                      # Entry point: parseArgs → render(<App>)
```

## Types

```typescript
type FieldCategory = "deal" | "person" | "organization" | "product"

type VerifiedToken = {
  apiToken: string
  userName: string
  companyName: string
}

type SourceField = {
  fieldName: string
  fieldCode: string
  fieldType: string
  options: Array<{ label: string }> | null
  isCustomField: boolean
  source: VerifiedToken
  category: FieldCategory
}

type CopyResult =
  | { status: "created"; field: SourceField }
  | { status: "skipped"; field: SourceField; reason: string }
  | { status: "failed"; field: SourceField; error: AppError }

type AppState =
  | { step: "verifying-tokens" }
  | { step: "loading-fields" }
  | { step: "select-field-type" }
  | { step: "select-fields"; fieldType: FieldCategory }
  | { step: "confirm-copy"; selected: SourceField[] }
  | { step: "copying"; selected: SourceField[] }
  | { step: "summary"; results: CopyResult[] }
```

## Error Types

```typescript
type AppError =
  | { type: "INVALID_ARGS"; message: string }
  | { type: "TOKEN_VERIFICATION_FAILED"; token: string; message: string }
  | { type: "FIELD_FETCH_FAILED"; token: string; fieldType: FieldCategory; message: string }
  | { type: "FIELD_ALREADY_EXISTS"; fieldName: string; targetAccount: string }
  | { type: "FIELD_CREATION_FAILED"; fieldName: string; message: string }
  | { type: "NETWORK_ERROR"; message: string }
```

### Error Message Examples

```
INVALID_ARGS:
  "Missing required argument --target-api-token"
  "No read-only API tokens provided. Use --read-only-api-tokens=\"token1,token2\""
  "API token must be a non-empty string, got empty value at position 2"

TOKEN_VERIFICATION_FAILED:
  "Failed to verify API token ending in '...6262': Invalid API token or insufficient permissions (HTTP 401)"
  "Failed to verify API token ending in '...6262': Request timed out after 10 seconds"

FIELD_FETCH_FAILED:
  "Failed to fetch deal fields for account 'Matti (Acme Oy)': Unexpected API response (HTTP 500)"

FIELD_ALREADY_EXISTS:
  "Field 'Custom status' already exists in 'Target Oy' — skipping"

FIELD_CREATION_FAILED:
  "Failed to create field 'Priority level' in 'Target Oy': Field type 'set' requires at least one option"

NETWORK_ERROR:
  "Unable to reach Pipedrive API at api.pipedrive.com — check your internet connection"
```

All error messages mask API tokens, showing only the last 4 characters.

## Function Signatures

```typescript
// cli/
parseArgs(argv: string[]): Result<ParsedArgs, AppError>

// api/
verifyToken(apiToken: string): ResultAsync<VerifiedToken, AppError>
fetchFields(token: VerifiedToken, category: FieldCategory): ResultAsync<SourceField[], AppError>
checkExistingField(target: VerifiedToken, fieldName: string, category: FieldCategory): ResultAsync<boolean, AppError>
createField(target: VerifiedToken, field: SourceField, dryRun: boolean): ResultAsync<CopyResult, AppError>

// domain/
filterCustomFields(fields: SourceField[]): SourceField[]
groupFieldsByType(fields: SourceField[]): Record<FieldCategory, SourceField[]>
buildCopyPayload(field: SourceField): AddFieldBody
```

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Fields to copy | Custom fields only | System fields exist in all instances |
| Source display | Token owner name per field | Clear provenance |
| Field filter | Text search above MultiSelect | Fast lookup in large lists |
| Field grouping | Step-by-step: type → fields | Keeps lists manageable |
| Enum/set options | Copy all 1:1 | Partial copy is rare need |
| Duplicate handling | Skip + warning | Safe, no overwrites |
| Dry-run | `--dry-run` flag | Safety net for shared tool |
| Distribution | Bun single-file executable | No runtime deps needed |
| Logo | Animated pipeline ASCII-art | Pipedrive brand association |
| Error messages | Descriptive, English, token masked | Security + usability |

## API Details

- Token verification: `GET https://api.pipedrive.com/v1/users/me?api_token=XXX`
- Field fetching: Generated v2 SDK + `fetchUntilV2` for cursor pagination (limit: 500)
- Field creation: Generated v2 SDK `add*Field()` methods
- Auth: `x-api-token` header for v2 endpoints
- All API calls wrapped in `ResultAsync.fromPromise()`
- Parallel loading via `ResultAsync.combine()`

## Animated Logo

Pipeline-themed ASCII art with moving dots representing data flow:

```
  ╔═══════════════════════════════════╗
  ║  ◄●●●═══► FIELD CLI ◄═══●●●►    ║
  ╠═══════════════════════════════════╣
  ║   Copy fields between Pipedrive  ║
  ║        instances with ease        ║
  ╚═══════════════════════════════════╝
```

Dots animate left-to-right during loading, green color (Pipedrive brand).

## Testing Strategy

All tests use `bun test` with mocked fetch calls. No real API calls in tests.

### Domain tests (pure logic)
- filter-custom-fields: filters system fields, keeps custom, handles empty
- group-fields-by-type: correct grouping, empty input, multiple sources
- build-copy-payload: varchar, enum with options, set with options, excludes read-only props

### API tests (mocked fetch)
- parse-args: valid parsing, missing args, single/multiple tokens, whitespace, dry-run
- verify-token: success, 401, network failure, token masking
- fetch-fields: pagination, API failure, empty list
- create-field: success, failure, dry-run skip
- check-existing-field: exists, not found, case-insensitive
