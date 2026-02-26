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
    ) as unknown as typeof fetch

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
    }) as unknown as typeof fetch

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
    }) as unknown as typeof fetch

    await createField(mockTarget, makeField({ category: "person" }), false)
    expect(capturedUrl).toBe("https://api.pipedrive.com/api/v2/personFields")
  })

  test("returns error on API failure", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ success: false, error: "Bad request" }), { status: 400 })
      )
    ) as unknown as typeof fetch

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
    }) as unknown as typeof fetch

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
    }) as unknown as typeof fetch

    const field = makeField({
      fieldType: "enum",
      options: [{ id: 1, label: "Hot" }, { id: 2, label: "Cold" }],
    })
    await createField(mockTarget, field, false)
    expect(JSON.parse(capturedBody).options).toEqual([{ label: "Hot" }, { label: "Cold" }])
  })
})
