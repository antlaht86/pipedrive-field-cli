# Pipedrive Field CLI - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Bun CLI tool that copies custom fields between Pipedrive instances using an interactive React/Ink UI.

**Architecture:** Modular `src/` with three layers: `cli/` (arg parsing), `api/` (Pipedrive API calls wrapped in neverthrow ResultAsync), `domain/` (pure logic with neverthrow Result), and `ui/` (React/Ink components). Entry point parses args then renders the React app.

**Tech Stack:** Bun runtime, React 19, Ink 6, @inkjs/ui, neverthrow 8, @hey-api/openapi-ts generated SDK, pipedrive-fetch-until-complete, bun:test

---

## Task 1: Project setup and shared types

**Files:**
- Modify: `package.json`
- Create: `src/types.ts`
- Create: `src/errors.ts`

**Step 1: Install missing dependencies**

Run:
```bash
bun add @inkjs/ui pipedrive-fetch-until-complete
```

**Step 2: Add scripts to package.json**

Add to `scripts`:
```json
{
  "start": "bun run src/index.tsx",
  "test": "bun test",
  "build": "bun build src/index.tsx --compile --outfile pipedrive-field-cli"
}
```

**Step 3: Create `src/types.ts`**

```typescript
export type FieldCategory = "deal" | "person" | "organization" | "product"

export const FIELD_CATEGORIES: FieldCategory[] = ["deal", "person", "organization", "product"]

export type VerifiedToken = {
  apiToken: string
  userName: string
  companyName: string
}

export type SourceField = {
  fieldName: string
  fieldCode: string
  fieldType: string
  options: Array<{ label: string }> | null
  isCustomField: boolean
  source: VerifiedToken
  category: FieldCategory
}

export type CopyResult =
  | { status: "created"; field: SourceField }
  | { status: "skipped"; field: SourceField; reason: string }
  | { status: "failed"; field: SourceField; error: AppError }

export type ParsedArgs = {
  readOnlyApiTokens: string[]
  targetApiToken: string
  dryRun: boolean
}

export type AppState =
  | { step: "verifying-tokens" }
  | { step: "loading-fields" }
  | { step: "select-field-type" }
  | { step: "select-fields"; fieldType: FieldCategory }
  | { step: "confirm-copy"; selected: SourceField[] }
  | { step: "copying"; selected: SourceField[] }
  | { step: "summary"; results: CopyResult[] }
```

**Step 4: Create `src/errors.ts`**

```typescript
export type AppError =
  | { type: "INVALID_ARGS"; message: string }
  | { type: "TOKEN_VERIFICATION_FAILED"; token: string; message: string }
  | { type: "FIELD_FETCH_FAILED"; token: string; fieldType: string; message: string }
  | { type: "FIELD_ALREADY_EXISTS"; fieldName: string; targetAccount: string }
  | { type: "FIELD_CREATION_FAILED"; fieldName: string; message: string }
  | { type: "NETWORK_ERROR"; message: string }

export function maskToken(token: string): string {
  if (token.length <= 4) return "****"
  return `...${token.slice(-4)}`
}

export function formatError(error: AppError): string {
  switch (error.type) {
    case "INVALID_ARGS":
      return error.message
    case "TOKEN_VERIFICATION_FAILED":
      return `Failed to verify API token ending in '${maskToken(error.token)}': ${error.message}`
    case "FIELD_FETCH_FAILED":
      return `Failed to fetch ${error.fieldType} fields for token ending in '${maskToken(error.token)}': ${error.message}`
    case "FIELD_ALREADY_EXISTS":
      return `Field '${error.fieldName}' already exists in '${error.targetAccount}' — skipping`
    case "FIELD_CREATION_FAILED":
      return `Failed to create field '${error.fieldName}': ${error.message}`
    case "NETWORK_ERROR":
      return `Unable to reach Pipedrive API at api.pipedrive.com — ${error.message}`
  }
}
```

**Step 5: Commit**

```bash
git add src/types.ts src/errors.ts package.json bun.lock
git commit -m "feat: project setup with shared types and error definitions"
```

---

## Task 2: Error helpers tests

**Files:**
- Create: `src/errors.test.ts`

**Step 1: Write the tests**

```typescript
import { describe, expect, test } from "bun:test"
import { maskToken, formatError, type AppError } from "./errors.ts"

describe("maskToken", () => {
  test("masks token showing only last 4 characters", () => {
    expect(maskToken("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f06262")).toBe("...6262")
  })

  test("masks short token with asterisks", () => {
    expect(maskToken("abc")).toBe("****")
  })

  test("masks exactly 4 char token with asterisks", () => {
    expect(maskToken("abcd")).toBe("****")
  })

  test("masks 5 char token showing last 4", () => {
    expect(maskToken("abcde")).toBe("...bcde")
  })
})

describe("formatError", () => {
  test("formats INVALID_ARGS error", () => {
    const error: AppError = { type: "INVALID_ARGS", message: "Missing required argument --target-api-token" }
    expect(formatError(error)).toBe("Missing required argument --target-api-token")
  })

  test("formats TOKEN_VERIFICATION_FAILED with masked token", () => {
    const error: AppError = {
      type: "TOKEN_VERIFICATION_FAILED",
      token: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f06262",
      message: "Invalid API token or insufficient permissions (HTTP 401)",
    }
    expect(formatError(error)).toBe(
      "Failed to verify API token ending in '...6262': Invalid API token or insufficient permissions (HTTP 401)"
    )
  })

  test("formats FIELD_FETCH_FAILED error", () => {
    const error: AppError = {
      type: "FIELD_FETCH_FAILED",
      token: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f06262",
      fieldType: "deal",
      message: "Unexpected API response (HTTP 500)",
    }
    expect(formatError(error)).toBe(
      "Failed to fetch deal fields for token ending in '...6262': Unexpected API response (HTTP 500)"
    )
  })

  test("formats FIELD_ALREADY_EXISTS error", () => {
    const error: AppError = {
      type: "FIELD_ALREADY_EXISTS",
      fieldName: "Custom status",
      targetAccount: "Target Oy",
    }
    expect(formatError(error)).toBe("Field 'Custom status' already exists in 'Target Oy' — skipping")
  })

  test("formats FIELD_CREATION_FAILED error", () => {
    const error: AppError = {
      type: "FIELD_CREATION_FAILED",
      fieldName: "Priority level",
      message: "Field type 'set' requires at least one option",
    }
    expect(formatError(error)).toBe(
      "Failed to create field 'Priority level': Field type 'set' requires at least one option"
    )
  })

  test("formats NETWORK_ERROR error", () => {
    const error: AppError = { type: "NETWORK_ERROR", message: "check your internet connection" }
    expect(formatError(error)).toBe(
      "Unable to reach Pipedrive API at api.pipedrive.com — check your internet connection"
    )
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `bun test src/errors.test.ts`
Expected: PASS (implementation already written in Task 1)

**Step 3: Commit**

```bash
git add src/errors.test.ts
git commit -m "test: add error helpers tests"
```

---

## Task 3: CLI argument parsing

**Files:**
- Create: `src/cli/parse-args.ts`
- Create: `src/cli/parse-args.test.ts`

**Step 1: Write the failing tests**

```typescript
import { describe, expect, test } from "bun:test"
import { parseArgs } from "./parse-args.ts"

describe("parseArgs", () => {
  test("parses valid arguments with multiple read-only tokens", () => {
    const result = parseArgs([
      "--read-only-api-tokens=token1,token2,token3",
      "--target-api-token=target1",
    ])
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual({
      readOnlyApiTokens: ["token1", "token2", "token3"],
      targetApiToken: "target1",
      dryRun: false,
    })
  })

  test("parses single read-only token", () => {
    const result = parseArgs([
      "--read-only-api-tokens=token1",
      "--target-api-token=target1",
    ])
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().readOnlyApiTokens).toEqual(["token1"])
  })

  test("parses --dry-run flag", () => {
    const result = parseArgs([
      "--read-only-api-tokens=token1",
      "--target-api-token=target1",
      "--dry-run",
    ])
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().dryRun).toBe(true)
  })

  test("returns error when --target-api-token is missing", () => {
    const result = parseArgs(["--read-only-api-tokens=token1"])
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toBe(
      'Missing required argument --target-api-token'
    )
  })

  test("returns error when --read-only-api-tokens is missing", () => {
    const result = parseArgs(["--target-api-token=target1"])
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toBe(
      'No read-only API tokens provided. Use --read-only-api-tokens="token1,token2"'
    )
  })

  test("returns error when a token is empty string after split", () => {
    const result = parseArgs([
      "--read-only-api-tokens=token1,,token3",
      "--target-api-token=target1",
    ])
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toBe(
      "API token must be a non-empty string, got empty value at position 2"
    )
  })

  test("trims whitespace from tokens", () => {
    const result = parseArgs([
      "--read-only-api-tokens= token1 , token2 ",
      "--target-api-token= target1 ",
    ])
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual({
      readOnlyApiTokens: ["token1", "token2"],
      targetApiToken: "target1",
      dryRun: false,
    })
  })

  test("returns error when no arguments provided", () => {
    const result = parseArgs([])
    expect(result.isErr()).toBe(true)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `bun test src/cli/parse-args.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
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
  if (!targetRaw) {
    return err({
      type: "INVALID_ARGS",
      message: "Missing required argument --target-api-token",
    })
  }

  const readOnlyTokens = readOnlyRaw.split(",").map((t) => t.trim())
  for (let i = 0; i < readOnlyTokens.length; i++) {
    if (readOnlyTokens[i] === "") {
      return err({
        type: "INVALID_ARGS",
        message: `API token must be a non-empty string, got empty value at position ${i + 1}`,
      })
    }
  }

  const targetApiToken = targetRaw.trim()
  if (targetApiToken === "") {
    return err({
      type: "INVALID_ARGS",
      message: "API token must be a non-empty string, got empty value for --target-api-token",
    })
  }

  return ok({
    readOnlyApiTokens: readOnlyTokens,
    targetApiToken,
    dryRun: flags.has("dry-run"),
  })
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test src/cli/parse-args.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/cli/parse-args.ts src/cli/parse-args.test.ts
git commit -m "feat: CLI argument parsing with validation"
```

---

## Task 4: Domain - filter custom fields

**Files:**
- Create: `src/domain/filter-custom-fields.ts`
- Create: `src/domain/filter-custom-fields.test.ts`

**Step 1: Write the failing tests**

```typescript
import { describe, expect, test } from "bun:test"
import { filterCustomFields } from "./filter-custom-fields.ts"
import type { SourceField, VerifiedToken } from "../types.ts"

const mockSource: VerifiedToken = {
  apiToken: "test-token",
  userName: "Matti",
  companyName: "Acme Oy",
}

function makeField(overrides: Partial<SourceField> = {}): SourceField {
  return {
    fieldName: "Test field",
    fieldCode: "abc123",
    fieldType: "varchar",
    options: null,
    isCustomField: false,
    source: mockSource,
    category: "deal",
    ...overrides,
  }
}

describe("filterCustomFields", () => {
  test("filters out system fields", () => {
    const fields = [
      makeField({ fieldName: "Title", isCustomField: false }),
      makeField({ fieldName: "Custom status", isCustomField: true }),
    ]
    const result = filterCustomFields(fields)
    expect(result).toHaveLength(1)
    expect(result[0]!.fieldName).toBe("Custom status")
  })

  test("keeps all custom fields", () => {
    const fields = [
      makeField({ fieldName: "Field A", isCustomField: true }),
      makeField({ fieldName: "Field B", isCustomField: true }),
    ]
    const result = filterCustomFields(fields)
    expect(result).toHaveLength(2)
  })

  test("returns empty array when no custom fields exist", () => {
    const fields = [
      makeField({ fieldName: "Title", isCustomField: false }),
      makeField({ fieldName: "Value", isCustomField: false }),
    ]
    const result = filterCustomFields(fields)
    expect(result).toEqual([])
  })

  test("returns empty array for empty input", () => {
    expect(filterCustomFields([])).toEqual([])
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `bun test src/domain/filter-custom-fields.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
import type { SourceField } from "../types.ts"

export function filterCustomFields(fields: SourceField[]): SourceField[] {
  return fields.filter((field) => field.isCustomField)
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test src/domain/filter-custom-fields.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/domain/filter-custom-fields.ts src/domain/filter-custom-fields.test.ts
git commit -m "feat: filter custom fields from field list"
```

---

## Task 5: Domain - group fields by type

**Files:**
- Create: `src/domain/group-fields-by-type.ts`
- Create: `src/domain/group-fields-by-type.test.ts`

**Step 1: Write the failing tests**

```typescript
import { describe, expect, test } from "bun:test"
import { groupFieldsByType } from "./group-fields-by-type.ts"
import type { SourceField, VerifiedToken } from "../types.ts"

const mockSource: VerifiedToken = {
  apiToken: "test-token",
  userName: "Matti",
  companyName: "Acme Oy",
}

function makeField(category: SourceField["category"], fieldName: string): SourceField {
  return {
    fieldName,
    fieldCode: "abc123",
    fieldType: "varchar",
    options: null,
    isCustomField: true,
    source: mockSource,
    category,
  }
}

describe("groupFieldsByType", () => {
  test("groups fields into correct categories", () => {
    const fields = [
      makeField("deal", "Deal field"),
      makeField("person", "Person field"),
      makeField("organization", "Org field"),
      makeField("product", "Product field"),
    ]
    const result = groupFieldsByType(fields)
    expect(result.deal).toHaveLength(1)
    expect(result.person).toHaveLength(1)
    expect(result.organization).toHaveLength(1)
    expect(result.product).toHaveLength(1)
    expect(result.deal[0]!.fieldName).toBe("Deal field")
  })

  test("handles empty input with empty arrays for all categories", () => {
    const result = groupFieldsByType([])
    expect(result.deal).toEqual([])
    expect(result.person).toEqual([])
    expect(result.organization).toEqual([])
    expect(result.product).toEqual([])
  })

  test("handles multiple fields in same category", () => {
    const fields = [
      makeField("deal", "Field A"),
      makeField("deal", "Field B"),
      makeField("deal", "Field C"),
    ]
    const result = groupFieldsByType(fields)
    expect(result.deal).toHaveLength(3)
    expect(result.person).toEqual([])
  })

  test("handles fields from multiple sources", () => {
    const source2: VerifiedToken = { apiToken: "tok2", userName: "Liisa", companyName: "Beta Oy" }
    const fields: SourceField[] = [
      makeField("deal", "Field from Matti"),
      { ...makeField("deal", "Field from Liisa"), source: source2 },
    ]
    const result = groupFieldsByType(fields)
    expect(result.deal).toHaveLength(2)
    expect(result.deal[0]!.source.userName).toBe("Matti")
    expect(result.deal[1]!.source.userName).toBe("Liisa")
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `bun test src/domain/group-fields-by-type.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
import type { FieldCategory, SourceField } from "../types.ts"

export function groupFieldsByType(fields: SourceField[]): Record<FieldCategory, SourceField[]> {
  const groups: Record<FieldCategory, SourceField[]> = {
    deal: [],
    person: [],
    organization: [],
    product: [],
  }

  for (const field of fields) {
    groups[field.category].push(field)
  }

  return groups
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test src/domain/group-fields-by-type.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/domain/group-fields-by-type.ts src/domain/group-fields-by-type.test.ts
git commit -m "feat: group fields by category type"
```

---

## Task 6: Domain - build copy payload

**Files:**
- Create: `src/domain/build-copy-payload.ts`
- Create: `src/domain/build-copy-payload.test.ts`

**Step 1: Write the failing tests**

```typescript
import { describe, expect, test } from "bun:test"
import { buildCopyPayload } from "./build-copy-payload.ts"
import type { SourceField, VerifiedToken } from "../types.ts"

const mockSource: VerifiedToken = {
  apiToken: "test-token",
  userName: "Matti",
  companyName: "Acme Oy",
}

function makeField(overrides: Partial<SourceField> = {}): SourceField {
  return {
    fieldName: "Test field",
    fieldCode: "abc123",
    fieldType: "varchar",
    options: null,
    isCustomField: true,
    source: mockSource,
    category: "deal",
    ...overrides,
  }
}

describe("buildCopyPayload", () => {
  test("builds correct payload for varchar field", () => {
    const field = makeField({ fieldName: "Custom text", fieldType: "varchar" })
    const payload = buildCopyPayload(field)
    expect(payload).toEqual({
      field_name: "Custom text",
      field_type: "varchar",
    })
  })

  test("builds correct payload for enum field with options", () => {
    const field = makeField({
      fieldName: "Status",
      fieldType: "enum",
      options: [{ label: "Hot" }, { label: "Warm" }, { label: "Cold" }],
    })
    const payload = buildCopyPayload(field)
    expect(payload).toEqual({
      field_name: "Status",
      field_type: "enum",
      options: [{ label: "Hot" }, { label: "Warm" }, { label: "Cold" }],
    })
  })

  test("builds correct payload for set field with options", () => {
    const field = makeField({
      fieldName: "Tags",
      fieldType: "set",
      options: [{ label: "VIP" }, { label: "Partner" }],
    })
    const payload = buildCopyPayload(field)
    expect(payload).toEqual({
      field_name: "Tags",
      field_type: "set",
      options: [{ label: "VIP" }, { label: "Partner" }],
    })
  })

  test("does not include options for non-enum/set field types", () => {
    const field = makeField({ fieldType: "double", options: null })
    const payload = buildCopyPayload(field)
    expect(payload).toEqual({
      field_name: "Test field",
      field_type: "double",
    })
    expect("options" in payload).toBe(false)
  })

  test("does not include read-only properties like fieldCode or source", () => {
    const field = makeField()
    const payload = buildCopyPayload(field)
    expect("fieldCode" in payload).toBe(false)
    expect("field_code" in payload).toBe(false)
    expect("source" in payload).toBe(false)
    expect("isCustomField" in payload).toBe(false)
    expect("category" in payload).toBe(false)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `bun test src/domain/build-copy-payload.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
import type { SourceField } from "../types.ts"

export type CopyPayload = {
  field_name: string
  field_type: string
  options?: Array<{ label: string }>
}

export function buildCopyPayload(field: SourceField): CopyPayload {
  const payload: CopyPayload = {
    field_name: field.fieldName,
    field_type: field.fieldType,
  }

  if ((field.fieldType === "enum" || field.fieldType === "set") && field.options) {
    payload.options = field.options.map((opt) => ({ label: opt.label }))
  }

  return payload
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test src/domain/build-copy-payload.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/domain/build-copy-payload.ts src/domain/build-copy-payload.test.ts
git commit -m "feat: build copy payload from source field"
```

---

## Task 7: API - verify token

**Files:**
- Create: `src/api/verify-token.ts`
- Create: `src/api/verify-token.test.ts`

**Step 1: Write the failing tests**

```typescript
import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test"
import { verifyToken } from "./verify-token.ts"

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe("verifyToken", () => {
  test("returns verified token on success", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              name: "Matti Meikalainen",
              company_name: "Acme Oy",
            },
          }),
          { status: 200 }
        )
      )
    ) as typeof fetch

    const result = await verifyToken("test-api-token-1234")
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual({
      apiToken: "test-api-token-1234",
      userName: "Matti Meikalainen",
      companyName: "Acme Oy",
    })
  })

  test("calls correct URL with api_token parameter", async () => {
    let calledUrl = ""
    globalThis.fetch = mock((url: string | URL | Request) => {
      calledUrl = url.toString()
      return Promise.resolve(
        new Response(
          JSON.stringify({ success: true, data: { name: "Test", company_name: "Test Co" } }),
          { status: 200 }
        )
      )
    }) as typeof fetch

    await verifyToken("my-token-abcd")
    expect(calledUrl).toBe("https://api.pipedrive.com/v1/users/me?api_token=my-token-abcd")
  })

  test("returns error on HTTP 401", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({ success: false }), { status: 401 }))
    ) as typeof fetch

    const result = await verifyToken("bad-token-5678")
    expect(result.isErr()).toBe(true)
    const error = result._unsafeUnwrapErr()
    expect(error.type).toBe("TOKEN_VERIFICATION_FAILED")
    expect(error.message).toContain("401")
  })

  test("returns error on network failure", async () => {
    globalThis.fetch = mock(() => Promise.reject(new Error("fetch failed"))) as typeof fetch

    const result = await verifyToken("token-9999")
    expect(result.isErr()).toBe(true)
    const error = result._unsafeUnwrapErr()
    expect(error.type).toBe("NETWORK_ERROR")
  })

  test("masks token in error messages", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response("", { status: 401 }))
    ) as typeof fetch

    const result = await verifyToken("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f06262")
    expect(result.isErr()).toBe(true)
    const error = result._unsafeUnwrapErr()
    if (error.type === "TOKEN_VERIFICATION_FAILED") {
      expect(error.token).toBe("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f06262")
    }
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `bun test src/api/verify-token.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
import { ResultAsync } from "neverthrow"
import type { VerifiedToken } from "../types.ts"
import type { AppError } from "../errors.ts"

type UsersMe = {
  success: boolean
  data: {
    name: string
    company_name: string
  }
}

export function verifyToken(apiToken: string): ResultAsync<VerifiedToken, AppError> {
  return ResultAsync.fromPromise(
    fetch(`https://api.pipedrive.com/v1/users/me?api_token=${apiToken}`).then(
      async (response) => {
        if (!response.ok) {
          throw new Error(
            `Invalid API token or insufficient permissions (HTTP ${response.status})`
          )
        }
        const json = (await response.json()) as UsersMe
        if (!json.success) {
          throw new Error("API returned success: false")
        }
        return {
          apiToken,
          userName: json.data.name,
          companyName: json.data.company_name,
        }
      }
    ),
    (error): AppError => {
      if (error instanceof Error && error.message.includes("HTTP")) {
        return {
          type: "TOKEN_VERIFICATION_FAILED",
          token: apiToken,
          message: error.message,
        }
      }
      return {
        type: "NETWORK_ERROR",
        message: error instanceof Error ? error.message : "Unknown network error",
      }
    }
  )
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test src/api/verify-token.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/api/verify-token.ts src/api/verify-token.test.ts
git commit -m "feat: verify Pipedrive API token via users/me endpoint"
```

---

## Task 8: API - fetch fields

**Files:**
- Create: `src/api/fetch-fields.ts`
- Create: `src/api/fetch-fields.test.ts`

**Step 1: Write the failing tests**

```typescript
import { describe, expect, test, mock, afterEach } from "bun:test"
import { fetchFields } from "./fetch-fields.ts"
import type { VerifiedToken } from "../types.ts"

const mockToken: VerifiedToken = {
  apiToken: "test-token-1234",
  userName: "Matti",
  companyName: "Acme Oy",
}

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe("fetchFields", () => {
  test("fetches all deal fields and maps to SourceField", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                field_name: "Custom status",
                field_code: "abc123hash",
                field_type: "enum",
                options: [{ id: 1, label: "Hot", color: null, update_time: null, add_time: null }],
                subfields: null,
                is_custom_field: true,
                is_optional_response_field: false,
              },
              {
                field_name: "Title",
                field_code: "title",
                field_type: "varchar",
                options: null,
                subfields: null,
                is_custom_field: false,
                is_optional_response_field: false,
              },
            ],
            additional_data: { next_cursor: null },
          }),
          { status: 200 }
        )
      )
    ) as typeof fetch

    const result = await fetchFields(mockToken, "deal")
    expect(result.isOk()).toBe(true)
    const fields = result._unsafeUnwrap()
    expect(fields).toHaveLength(2)
    expect(fields[0]).toEqual({
      fieldName: "Custom status",
      fieldCode: "abc123hash",
      fieldType: "enum",
      options: [{ label: "Hot" }],
      isCustomField: true,
      source: mockToken,
      category: "deal",
    })
    expect(fields[1]!.isCustomField).toBe(false)
  })

  test("returns error on API failure", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ success: false }), { status: 500 })
      )
    ) as typeof fetch

    const result = await fetchFields(mockToken, "deal")
    expect(result.isErr()).toBe(true)
    const error = result._unsafeUnwrapErr()
    expect(error.type).toBe("FIELD_FETCH_FAILED")
  })

  test("handles empty field list", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            data: [],
            additional_data: { next_cursor: null },
          }),
          { status: 200 }
        )
      )
    ) as typeof fetch

    const result = await fetchFields(mockToken, "person")
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual([])
  })

  test("maps options to only include labels", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                field_name: "Priority",
                field_code: "xyz",
                field_type: "set",
                options: [
                  { id: 1, label: "High", color: "#ff0000", update_time: "2024-01-01", add_time: "2024-01-01" },
                  { id: 2, label: "Low", color: null, update_time: null, add_time: null },
                ],
                subfields: null,
                is_custom_field: true,
                is_optional_response_field: false,
              },
            ],
            additional_data: { next_cursor: null },
          }),
          { status: 200 }
        )
      )
    ) as typeof fetch

    const result = await fetchFields(mockToken, "deal")
    expect(result.isOk()).toBe(true)
    const fields = result._unsafeUnwrap()
    expect(fields[0]!.options).toEqual([{ label: "High" }, { label: "Low" }])
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `bun test src/api/fetch-fields.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

This function uses the generated SDK classes and `fetchUntilV2` for pagination. It maps the raw API response to `SourceField[]`.

```typescript
import { ResultAsync } from "neverthrow"
import type { FieldCategory, SourceField, VerifiedToken } from "../types.ts"
import type { AppError } from "../errors.ts"

const FIELD_ENDPOINTS: Record<FieldCategory, string> = {
  deal: "dealFields",
  person: "personFields",
  organization: "organizationFields",
  product: "productFields",
}

type RawField = {
  field_name: string
  field_code: string
  field_type: string
  options?: Array<{ id: number; label: string; color: string | null; update_time: string | null; add_time: string | null }> | null
  subfields?: Array<{ field_code: string; field_name: string; field_type: string }> | null
  is_custom_field: boolean
  is_optional_response_field: boolean
}

type FieldsResponse = {
  success: boolean
  data: RawField[]
  additional_data: { next_cursor: string | null }
}

function mapRawField(raw: RawField, source: VerifiedToken, category: FieldCategory): SourceField {
  return {
    fieldName: raw.field_name,
    fieldCode: raw.field_code,
    fieldType: raw.field_type,
    options: raw.options ? raw.options.map((opt) => ({ label: opt.label })) : null,
    isCustomField: raw.is_custom_field,
    source,
    category,
  }
}

export function fetchFields(
  token: VerifiedToken,
  category: FieldCategory
): ResultAsync<SourceField[], AppError> {
  const endpoint = FIELD_ENDPOINTS[category]

  return ResultAsync.fromPromise(
    (async () => {
      const allFields: RawField[] = []
      let cursor: string | undefined = undefined

      while (true) {
        const url = new URL(`https://api.pipedrive.com/api/v2/${endpoint}`)
        url.searchParams.set("limit", "500")
        if (cursor) url.searchParams.set("cursor", cursor)

        const response = await fetch(url.toString(), {
          headers: { "x-api-token": token.apiToken },
        })

        if (!response.ok) {
          throw new Error(`Unexpected API response (HTTP ${response.status})`)
        }

        const json = (await response.json()) as FieldsResponse
        if (!json.success) {
          throw new Error("API returned success: false")
        }

        allFields.push(...json.data)

        if (!json.additional_data.next_cursor) break
        cursor = json.additional_data.next_cursor
      }

      return allFields.map((raw) => mapRawField(raw, token, category))
    })(),
    (error): AppError => ({
      type: "FIELD_FETCH_FAILED",
      token: token.apiToken,
      fieldType: category,
      message: error instanceof Error ? error.message : "Unknown error",
    })
  )
}
```

> **Note:** This implementation does manual pagination instead of using `fetchUntilV2` directly, because `fetchUntilV2` expects the generated SDK client format. If you prefer to use `fetchUntilV2` with the generated SDK, the implementation can be adjusted during review. The test interface stays the same either way.

**Step 4: Run tests to verify they pass**

Run: `bun test src/api/fetch-fields.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/api/fetch-fields.ts src/api/fetch-fields.test.ts
git commit -m "feat: fetch all fields with pagination for any category"
```

---

## Task 9: API - check existing field

**Files:**
- Create: `src/api/check-existing-field.ts`
- Create: `src/api/check-existing-field.test.ts`

**Step 1: Write the failing tests**

```typescript
import { describe, expect, test } from "bun:test"
import { checkExistingField } from "./check-existing-field.ts"
import type { SourceField, VerifiedToken } from "../types.ts"

const mockTarget: VerifiedToken = {
  apiToken: "target-token",
  userName: "Admin",
  companyName: "Target Oy",
}

const mockSource: VerifiedToken = {
  apiToken: "source-token",
  userName: "Matti",
  companyName: "Acme Oy",
}

function makeField(fieldName: string): SourceField {
  return {
    fieldName,
    fieldCode: "abc",
    fieldType: "varchar",
    options: null,
    isCustomField: true,
    source: mockSource,
    category: "deal",
  }
}

describe("checkExistingField", () => {
  test("returns true when field name exists in target fields", () => {
    const targetFields = [makeField("Custom status"), makeField("Priority")]
    const result = checkExistingField("Custom status", targetFields)
    expect(result).toBe(true)
  })

  test("returns false when field name does not exist", () => {
    const targetFields = [makeField("Custom status"), makeField("Priority")]
    const result = checkExistingField("New field", targetFields)
    expect(result).toBe(false)
  })

  test("comparison is case-insensitive", () => {
    const targetFields = [makeField("Custom Status")]
    expect(checkExistingField("custom status", targetFields)).toBe(true)
    expect(checkExistingField("CUSTOM STATUS", targetFields)).toBe(true)
  })

  test("returns false for empty target fields", () => {
    expect(checkExistingField("Anything", [])).toBe(false)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `bun test src/api/check-existing-field.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
import type { SourceField } from "../types.ts"

export function checkExistingField(fieldName: string, targetFields: SourceField[]): boolean {
  const normalizedName = fieldName.toLowerCase()
  return targetFields.some((f) => f.fieldName.toLowerCase() === normalizedName)
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test src/api/check-existing-field.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/api/check-existing-field.ts src/api/check-existing-field.test.ts
git commit -m "feat: check if field already exists in target (case-insensitive)"
```

---

## Task 10: API - create field

**Files:**
- Create: `src/api/create-field.ts`
- Create: `src/api/create-field.test.ts`

**Step 1: Write the failing tests**

```typescript
import { describe, expect, test, mock, afterEach } from "bun:test"
import { createField } from "./create-field.ts"
import type { SourceField, VerifiedToken } from "../types.ts"

const mockTarget: VerifiedToken = {
  apiToken: "target-token-1234",
  userName: "Admin",
  companyName: "Target Oy",
}

const mockSource: VerifiedToken = {
  apiToken: "source-token",
  userName: "Matti",
  companyName: "Acme Oy",
}

function makeField(overrides: Partial<SourceField> = {}): SourceField {
  return {
    fieldName: "Custom status",
    fieldCode: "abc123",
    fieldType: "varchar",
    options: null,
    isCustomField: true,
    source: mockSource,
    category: "deal",
    ...overrides,
  }
}

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe("createField", () => {
  test("creates field successfully and returns created result", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ success: true, data: { field_name: "Custom status", field_code: "new123" } }),
          { status: 200 }
        )
      )
    ) as typeof fetch

    const result = await createField(mockTarget, makeField(), false)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().status).toBe("created")
  })

  test("sends correct payload to correct endpoint for deal fields", async () => {
    let capturedUrl = ""
    let capturedBody = ""
    globalThis.fetch = mock((url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = url.toString()
      capturedBody = init?.body as string
      return Promise.resolve(
        new Response(JSON.stringify({ success: true, data: {} }), { status: 200 })
      )
    }) as typeof fetch

    await createField(mockTarget, makeField({ fieldName: "Test", fieldType: "varchar", category: "deal" }), false)
    expect(capturedUrl).toBe("https://api.pipedrive.com/api/v2/dealFields")
    expect(JSON.parse(capturedBody)).toEqual({ field_name: "Test", field_type: "varchar" })
  })

  test("sends correct endpoint for person fields", async () => {
    let capturedUrl = ""
    globalThis.fetch = mock((url: string | URL | Request) => {
      capturedUrl = url.toString()
      return Promise.resolve(
        new Response(JSON.stringify({ success: true, data: {} }), { status: 200 })
      )
    }) as typeof fetch

    await createField(mockTarget, makeField({ category: "person" }), false)
    expect(capturedUrl).toBe("https://api.pipedrive.com/api/v2/personFields")
  })

  test("returns error on API failure", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ success: false, error: "Bad request" }), { status: 400 })
      )
    ) as typeof fetch

    const result = await createField(mockTarget, makeField(), false)
    expect(result.isErr()).toBe(true)
    const error = result._unsafeUnwrapErr()
    expect(error.type).toBe("FIELD_CREATION_FAILED")
  })

  test("skips API call in dry-run mode and returns created result", async () => {
    let fetchCalled = false
    globalThis.fetch = mock(() => {
      fetchCalled = true
      return Promise.resolve(new Response("", { status: 200 }))
    }) as typeof fetch

    const result = await createField(mockTarget, makeField(), true)
    expect(fetchCalled).toBe(false)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().status).toBe("created")
  })

  test("includes options in payload for enum fields", async () => {
    let capturedBody = ""
    globalThis.fetch = mock((_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = init?.body as string
      return Promise.resolve(
        new Response(JSON.stringify({ success: true, data: {} }), { status: 200 })
      )
    }) as typeof fetch

    const field = makeField({
      fieldType: "enum",
      options: [{ label: "Hot" }, { label: "Cold" }],
    })
    await createField(mockTarget, field, false)
    expect(JSON.parse(capturedBody).options).toEqual([{ label: "Hot" }, { label: "Cold" }])
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `bun test src/api/create-field.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
import { ResultAsync, okAsync } from "neverthrow"
import type { FieldCategory, SourceField, VerifiedToken, CopyResult } from "../types.ts"
import type { AppError } from "../errors.ts"
import { buildCopyPayload } from "../domain/build-copy-payload.ts"

const FIELD_ENDPOINTS: Record<FieldCategory, string> = {
  deal: "dealFields",
  person: "personFields",
  organization: "organizationFields",
  product: "productFields",
}

export function createField(
  target: VerifiedToken,
  field: SourceField,
  dryRun: boolean
): ResultAsync<CopyResult, AppError> {
  if (dryRun) {
    return okAsync({ status: "created" as const, field })
  }

  const endpoint = FIELD_ENDPOINTS[field.category]
  const payload = buildCopyPayload(field)

  return ResultAsync.fromPromise(
    fetch(`https://api.pipedrive.com/api/v2/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-token": target.apiToken,
      },
      body: JSON.stringify(payload),
    }).then(async (response) => {
      if (!response.ok) {
        const text = await response.text().catch(() => "")
        throw new Error(`API returned HTTP ${response.status}: ${text}`)
      }
      const json = (await response.json()) as { success: boolean }
      if (!json.success) {
        throw new Error("API returned success: false")
      }
      return { status: "created" as const, field }
    }),
    (error): AppError => ({
      type: "FIELD_CREATION_FAILED",
      fieldName: field.fieldName,
      message: error instanceof Error ? error.message : "Unknown error",
    })
  )
}
```

**Step 4: Run tests to verify they pass**

Run: `bun test src/api/create-field.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/api/create-field.ts src/api/create-field.test.ts
git commit -m "feat: create field in target instance with dry-run support"
```

---

## Task 11: UI - Animated Logo component

**Files:**
- Create: `src/ui/Logo.tsx`

**Step 1: Write the Logo component**

```tsx
import React, { useState, useEffect } from "react"
import { Box, Text } from "ink"

const FRAMES = [
  "●●●═══",
  "═●●●══",
  "══●●●═",
  "═══●●●",
  "══●●●═",
  "═●●●══",
]

export function Logo() {
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % FRAMES.length)
    }, 150)
    return () => clearInterval(timer)
  }, [])

  const leftPipe = FRAMES[frame]!
  const rightPipe = FRAMES[(frame + 3) % FRAMES.length]!

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color="green">{"  ╔═══════════════════════════════════════╗"}</Text>
      <Text color="green">{`  ║  ${leftPipe}► `}<Text bold color="greenBright">FIELD CLI</Text>{` ◄${rightPipe}  ║`}</Text>
      <Text color="green">{"  ╠═══════════════════════════════════════╣"}</Text>
      <Text color="green">{"  ║    Copy fields between Pipedrive     ║"}</Text>
      <Text color="green">{"  ║         instances with ease           ║"}</Text>
      <Text color="green">{"  ╚═══════════════════════════════════════╝"}</Text>
    </Box>
  )
}
```

**Step 2: Commit**

```bash
git add src/ui/Logo.tsx
git commit -m "feat: animated pipeline logo component"
```

---

## Task 12: UI - LoadingScreen component

**Files:**
- Create: `src/ui/LoadingScreen.tsx`

**Step 1: Write the LoadingScreen component**

This component handles both token verification and field loading phases.

```tsx
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
```

**Step 2: Commit**

```bash
git add src/ui/LoadingScreen.tsx
git commit -m "feat: loading screen with spinner for token verification and field loading"
```

---

## Task 13: UI - FieldTypeSelect component

**Files:**
- Create: `src/ui/FieldTypeSelect.tsx`

**Step 1: Write the component**

```tsx
import React from "react"
import { Box, Text } from "ink"
import { Select } from "@inkjs/ui"
import type { FieldCategory } from "../types.ts"

type Props = {
  onSelect: (category: FieldCategory) => void
  fieldCounts: Record<FieldCategory, number>
}

export function FieldTypeSelect({ onSelect, fieldCounts }: Props) {
  const options = [
    { label: `Deal fields (${fieldCounts.deal} custom)`, value: "deal" },
    { label: `Person fields (${fieldCounts.person} custom)`, value: "person" },
    { label: `Organization fields (${fieldCounts.organization} custom)`, value: "organization" },
    { label: `Product fields (${fieldCounts.product} custom)`, value: "product" },
  ].filter((opt) => fieldCounts[opt.value as FieldCategory] > 0)

  if (options.length === 0) {
    return <Text color="yellow">No custom fields found in any source account.</Text>
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Select field type to copy:</Text>
      <Select options={options} onChange={(value) => onSelect(value as FieldCategory)} />
    </Box>
  )
}
```

**Step 2: Commit**

```bash
git add src/ui/FieldTypeSelect.tsx
git commit -m "feat: field type selection component with custom field counts"
```

---

## Task 14: UI - FieldMultiSelect component with text filter

**Files:**
- Create: `src/ui/FieldMultiSelect.tsx`

**Step 1: Write the component**

```tsx
import React, { useState, useMemo } from "react"
import { Box, Text } from "ink"
import { MultiSelect, TextInput } from "@inkjs/ui"
import type { SourceField, FieldCategory } from "../types.ts"

type Props = {
  fields: SourceField[]
  category: FieldCategory
  onSubmit: (selected: SourceField[]) => void
}

export function FieldMultiSelect({ fields, category, onSubmit }: Props) {
  const [filter, setFilter] = useState("")
  const [isFiltering, setIsFiltering] = useState(true)

  const filteredOptions = useMemo(() => {
    const lowerFilter = filter.toLowerCase()
    return fields
      .filter((f) => f.fieldName.toLowerCase().includes(lowerFilter))
      .map((f) => ({
        label: `${f.fieldName} [${f.fieldType}] (from: ${f.source.userName}, ${f.source.companyName})`,
        value: f.fieldCode + "|" + f.source.apiToken,
      }))
  }, [fields, filter])

  const handleSubmit = (selectedValues: string[]) => {
    const selectedFields = fields.filter(
      (f) => selectedValues.includes(f.fieldCode + "|" + f.source.apiToken)
    )
    onSubmit(selectedFields)
  }

  const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1)

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>Select {categoryLabel} fields to copy ({fields.length} available):</Text>
      <Box>
        <Text>Filter: </Text>
        <TextInput
          placeholder="Type to filter fields..."
          onChange={setFilter}
          onSubmit={() => setIsFiltering(false)}
        />
      </Box>
      <Text dimColor>Press Enter to confirm filter, then select fields with Space, Enter to submit</Text>
      {!isFiltering && (
        <MultiSelect
          options={filteredOptions}
          onSubmit={handleSubmit}
        />
      )}
    </Box>
  )
}
```

**Step 2: Commit**

```bash
git add src/ui/FieldMultiSelect.tsx
git commit -m "feat: multi-select component with text filter for field selection"
```

---

## Task 15: UI - CopyConfirmation component

**Files:**
- Create: `src/ui/CopyConfirmation.tsx`

**Step 1: Write the component**

```tsx
import React from "react"
import { Box, Text } from "ink"
import { Select } from "@inkjs/ui"
import type { SourceField, VerifiedToken } from "../types.ts"

type Props = {
  selected: SourceField[]
  target: VerifiedToken
  dryRun: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function CopyConfirmation({ selected, target, dryRun, onConfirm, onCancel }: Props) {
  return (
    <Box flexDirection="column" gap={1}>
      {dryRun && (
        <Box borderStyle="round" borderColor="yellow" paddingX={1}>
          <Text color="yellow" bold>DRY RUN — No changes will be made</Text>
        </Box>
      )}
      <Text bold>
        Copy {selected.length} field{selected.length !== 1 ? "s" : ""} to {target.companyName}?
      </Text>
      {selected.map((field) => (
        <Text key={field.fieldCode + field.source.apiToken}>
          {"  - "}{field.fieldName} <Text dimColor>[{field.fieldType}]</Text>
          {field.options && field.options.length > 0 && (
            <Text dimColor> ({field.options.map((o) => o.label).join(", ")})</Text>
          )}
        </Text>
      ))}
      <Select
        options={[
          { label: "Yes, copy fields", value: "confirm" },
          { label: "Cancel", value: "cancel" },
        ]}
        onChange={(value) => {
          if (value === "confirm") onConfirm()
          else onCancel()
        }}
      />
    </Box>
  )
}
```

**Step 2: Commit**

```bash
git add src/ui/CopyConfirmation.tsx
git commit -m "feat: copy confirmation component with dry-run banner"
```

---

## Task 16: UI - CopyProgress component

**Files:**
- Create: `src/ui/CopyProgress.tsx`

**Step 1: Write the component**

```tsx
import React from "react"
import { Box, Text } from "ink"
import { Spinner } from "@inkjs/ui"
import type { CopyResult } from "../types.ts"

type Props = {
  total: number
  results: CopyResult[]
}

export function CopyProgress({ total, results }: Props) {
  const completed = results.length

  return (
    <Box flexDirection="column" gap={1}>
      <Box>
        <Spinner label={`Copying fields... (${completed}/${total})`} />
      </Box>
      {results.map((result) => {
        if (result.status === "created") {
          return (
            <Text key={result.field.fieldCode} color="green">
              {"  ✓ "}{result.field.fieldName} — created
            </Text>
          )
        }
        if (result.status === "skipped") {
          return (
            <Text key={result.field.fieldCode} color="yellow">
              {"  ⊘ "}{result.field.fieldName} — {result.reason}
            </Text>
          )
        }
        return (
          <Text key={result.field.fieldCode} color="red">
            {"  ✗ "}{result.field.fieldName} — failed
          </Text>
        )
      })}
    </Box>
  )
}
```

**Step 2: Commit**

```bash
git add src/ui/CopyProgress.tsx
git commit -m "feat: copy progress component with real-time results"
```

---

## Task 17: UI - ResultSummary component

**Files:**
- Create: `src/ui/ResultSummary.tsx`

**Step 1: Write the component**

```tsx
import React from "react"
import { Box, Text } from "ink"
import { Select } from "@inkjs/ui"
import type { CopyResult } from "../types.ts"
import { formatError } from "../errors.ts"

type Props = {
  results: CopyResult[]
  dryRun: boolean
  onCopyMore: () => void
  onExit: () => void
}

export function ResultSummary({ results, dryRun, onCopyMore, onExit }: Props) {
  const created = results.filter((r) => r.status === "created").length
  const skipped = results.filter((r) => r.status === "skipped").length
  const failed = results.filter((r) => r.status === "failed").length

  return (
    <Box flexDirection="column" gap={1}>
      {dryRun && (
        <Text color="yellow" bold>[DRY RUN] No actual changes were made</Text>
      )}
      <Box gap={2}>
        <Text color="green" bold>Created: {created}</Text>
        <Text color="yellow" bold>Skipped: {skipped}</Text>
        <Text color="red" bold>Failed: {failed}</Text>
      </Box>

      {results.filter((r) => r.status === "skipped").map((r) => (
        <Text key={r.field.fieldCode} color="yellow">
          {"  ⊘ "}{r.field.fieldName}: {r.status === "skipped" ? r.reason : ""}
        </Text>
      ))}

      {results.filter((r) => r.status === "failed").map((r) => (
        <Text key={r.field.fieldCode} color="red">
          {"  ✗ "}{r.field.fieldName}: {r.status === "failed" ? formatError(r.error) : ""}
        </Text>
      ))}

      <Text bold>What would you like to do?</Text>
      <Select
        options={[
          { label: "Copy more fields", value: "more" },
          { label: "Exit", value: "exit" },
        ]}
        onChange={(value) => {
          if (value === "more") onCopyMore()
          else onExit()
        }}
      />
    </Box>
  )
}
```

**Step 2: Commit**

```bash
git add src/ui/ResultSummary.tsx
git commit -m "feat: result summary component with copy-more option"
```

---

## Task 18: UI - App.tsx main flow controller

**Files:**
- Create: `src/ui/App.tsx`

**Step 1: Write the main App component**

This is the central component that manages all state transitions.

```tsx
import React, { useState, useEffect } from "react"
import { Box, Text, useApp } from "ink"
import { ResultAsync } from "neverthrow"
import type {
  AppState,
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
import { FieldTypeSelect } from "./FieldTypeSelect.tsx"
import { FieldMultiSelect } from "./FieldMultiSelect.tsx"
import { CopyConfirmation } from "./CopyConfirmation.tsx"
import { CopyProgress } from "./CopyProgress.tsx"
import { ResultSummary } from "./ResultSummary.tsx"

type Props = {
  args: ParsedArgs
}

export function App({ args }: Props) {
  const { exit } = useApp()
  const [state, setState] = useState<AppState>({ step: "verifying-tokens" })
  const [error, setError] = useState<AppError | null>(null)
  const [readOnlyTokens, setReadOnlyTokens] = useState<VerifiedToken[]>([])
  const [targetToken, setTargetToken] = useState<VerifiedToken | null>(null)
  const [sourceFields, setSourceFields] = useState<SourceField[]>([])
  const [targetFields, setTargetFields] = useState<SourceField[]>([])
  const [copyResults, setCopyResults] = useState<CopyResult[]>([])

  // Step 1: Verify all tokens in parallel
  useEffect(() => {
    if (state.step !== "verifying-tokens") return

    const allTokens = [...args.readOnlyApiTokens, args.targetApiToken]
    const verifications = allTokens.map((t) => verifyToken(t))

    ResultAsync.combine(verifications).then((result) => {
      if (result.isErr()) {
        setError(result.error)
        return
      }
      const verified = result.value
      const target = verified[verified.length - 1]!
      const readOnly = verified.slice(0, -1)
      setReadOnlyTokens(readOnly)
      setTargetToken(target)
      setState({ step: "loading-fields" })
    })
  }, [state.step])

  // Step 2: Load all fields in parallel
  useEffect(() => {
    if (state.step !== "loading-fields") return
    if (!targetToken) return

    const allTokens = [...readOnlyTokens, targetToken]
    const fetches = allTokens.flatMap((token) =>
      FIELD_CATEGORIES.map((category) => fetchFields(token, category))
    )

    ResultAsync.combine(fetches).then((result) => {
      if (result.isErr()) {
        setError(result.error)
        return
      }
      const allFields = result.value.flat()
      const source = allFields.filter(
        (f) => f.source.apiToken !== targetToken.apiToken
      )
      const target = allFields.filter(
        (f) => f.source.apiToken === targetToken.apiToken
      )
      setSourceFields(filterCustomFields(source))
      setTargetFields(target)
      setState({ step: "select-field-type" })
    })
  }, [state.step, targetToken])

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

      {state.step === "verifying-tokens" && (
        <LoadingScreen
          phase="verifying-tokens"
          totalTokens={args.readOnlyApiTokens.length + 1}
        />
      )}

      {state.step === "loading-fields" && (
        <Box flexDirection="column" gap={1}>
          {readOnlyTokens.map((t) => (
            <Text key={t.apiToken} color="green">
              ✓ Read-only: {t.userName} ({t.companyName})
            </Text>
          ))}
          {targetToken && (
            <Text color="cyan">
              ✓ Target: {targetToken.userName} ({targetToken.companyName})
            </Text>
          )}
          <LoadingScreen
            phase="loading-fields"
            totalTokens={readOnlyTokens.length + 1}
          />
        </Box>
      )}

      {state.step === "select-field-type" && (
        <Box flexDirection="column" gap={1}>
          {readOnlyTokens.map((t) => (
            <Text key={t.apiToken} color="green">
              ✓ Read-only: {t.userName} ({t.companyName})
            </Text>
          ))}
          {targetToken && (
            <Text color="cyan">
              ✓ Target: {targetToken.userName} ({targetToken.companyName})
            </Text>
          )}
          <FieldTypeSelect
            onSelect={(category) => setState({ step: "select-fields", fieldType: category })}
            fieldCounts={fieldCounts}
          />
        </Box>
      )}

      {state.step === "select-fields" && (
        <FieldMultiSelect
          fields={grouped[state.fieldType]}
          category={state.fieldType}
          onSubmit={(selected) => {
            if (selected.length === 0) {
              setState({ step: "select-field-type" })
            } else {
              setState({ step: "confirm-copy", selected })
            }
          }}
        />
      )}

      {state.step === "confirm-copy" && targetToken && (
        <CopyConfirmation
          selected={state.selected}
          target={targetToken}
          dryRun={args.dryRun}
          onConfirm={() => {
            setState({ step: "copying", selected: state.selected })
            // Execute copy sequentially
            const selected = state.selected
            setCopyResults([])

            const copyNext = async (index: number, results: CopyResult[]) => {
              if (index >= selected.length) {
                setCopyResults(results)
                setState({ step: "summary", results })
                return
              }

              const field = selected[index]!
              const exists = checkExistingField(field.fieldName, targetFields)

              if (exists) {
                const result: CopyResult = {
                  status: "skipped",
                  field,
                  reason: `Field '${field.fieldName}' already exists in '${targetToken.companyName}' — skipping`,
                }
                const newResults = [...results, result]
                setCopyResults(newResults)
                copyNext(index + 1, newResults)
                return
              }

              const createResult = await createField(targetToken, field, args.dryRun)
              const result: CopyResult = createResult.match(
                (ok) => ok,
                (error): CopyResult => ({ status: "failed", field, error })
              )
              const newResults = [...results, result]
              setCopyResults(newResults)
              copyNext(index + 1, newResults)
            }

            copyNext(0, [])
          }}
          onCancel={() => setState({ step: "select-field-type" })}
        />
      )}

      {state.step === "copying" && (
        <CopyProgress total={state.selected.length} results={copyResults} />
      )}

      {state.step === "summary" && (
        <ResultSummary
          results={state.results}
          dryRun={args.dryRun}
          onCopyMore={() => setState({ step: "select-field-type" })}
          onExit={() => exit()}
        />
      )}
    </Box>
  )
}
```

**Step 2: Commit**

```bash
git add src/ui/App.tsx
git commit -m "feat: main App component with full flow state management"
```

---

## Task 19: Entry point

**Files:**
- Create: `src/index.tsx`
- Modify: `package.json` (update module field)

**Step 1: Write the entry point**

```tsx
import React from "react"
import { render, Box, Text } from "ink"
import { parseArgs } from "./cli/parse-args.ts"
import { formatError } from "./errors.ts"
import { App } from "./ui/App.tsx"

const result = parseArgs(process.argv.slice(2))

if (result.isErr()) {
  render(
    <Box flexDirection="column" gap={1}>
      <Text color="red" bold>Error: {formatError(result.error)}</Text>
      <Text dimColor>
        Usage: pipedrive-field-cli --read-only-api-tokens="token1,token2" --target-api-token="target" [--dry-run]
      </Text>
    </Box>
  )
} else {
  render(<App args={result.value} />)
}
```

**Step 2: Update `package.json` module field**

Change `"module": "index.ts"` to `"module": "src/index.tsx"` and update scripts:

```json
{
  "module": "src/index.tsx",
  "scripts": {
    "start": "bun run src/index.tsx",
    "test": "bun test",
    "build": "bun build src/index.tsx --compile --outfile pipedrive-field-cli",
    "openapi-ts": "npx tsx openapi-ts.ts"
  }
}
```

**Step 3: Run the app to verify it starts**

Run: `bun run src/index.tsx`
Expected: Shows error message about missing arguments (this is correct — no args provided)

**Step 4: Run all tests**

Run: `bun test`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/index.tsx package.json
git commit -m "feat: entry point with arg parsing and React render"
```

---

## Task 20: Build and verify executable

**Step 1: Build the single-file executable**

Run: `bun build src/index.tsx --compile --outfile pipedrive-field-cli`

**Step 2: Test the executable**

Run: `./pipedrive-field-cli`
Expected: Shows usage error

Run: `./pipedrive-field-cli --read-only-api-tokens=fake --target-api-token=fake --dry-run`
Expected: Shows token verification error (expected — fake tokens)

**Step 3: Add executable to `.gitignore`**

Add `pipedrive-field-cli` to `.gitignore`.

**Step 4: Run full test suite one last time**

Run: `bun test`
Expected: All PASS

**Step 5: Commit**

```bash
git add .gitignore
git commit -m "chore: add compiled executable to gitignore"
```

---

## Summary

| Task | Component | Tests |
|------|-----------|-------|
| 1 | Types + Errors | — |
| 2 | Error helpers tests | 10 tests |
| 3 | CLI arg parsing | 8 tests |
| 4 | Filter custom fields | 4 tests |
| 5 | Group fields by type | 4 tests |
| 6 | Build copy payload | 5 tests |
| 7 | Verify token | 4 tests |
| 8 | Fetch fields | 4 tests |
| 9 | Check existing field | 4 tests |
| 10 | Create field | 5 tests |
| 11 | Animated Logo | — |
| 12 | LoadingScreen | — |
| 13 | FieldTypeSelect | — |
| 14 | FieldMultiSelect | — |
| 15 | CopyConfirmation | — |
| 16 | CopyProgress | — |
| 17 | ResultSummary | — |
| 18 | App.tsx main flow | — |
| 19 | Entry point | — |
| 20 | Build + verify | — |

**Total: 20 tasks, ~48 tests, 20 commits**
