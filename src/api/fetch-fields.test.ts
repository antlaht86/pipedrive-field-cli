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
    ) as unknown as typeof fetch

    const result = await fetchFields(mockToken, "deal")
    expect(result.isOk()).toBe(true)
    const fields = result._unsafeUnwrap()
    expect(fields).toHaveLength(2)
    expect(fields[0]).toEqual({
      fieldName: "Custom status",
      fieldCode: "abc123hash",
      fieldType: "enum",
      options: [{ id: 1, label: "Hot" }],
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
    ) as unknown as typeof fetch

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
    ) as unknown as typeof fetch

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
    ) as unknown as typeof fetch

    const result = await fetchFields(mockToken, "deal")
    expect(result.isOk()).toBe(true)
    const fields = result._unsafeUnwrap()
    expect(fields[0]!.options).toEqual([{ id: 1, label: "High" }, { id: 2, label: "Low" }])
  })
})
