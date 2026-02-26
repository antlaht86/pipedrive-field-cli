import { describe, expect, test, mock, afterEach } from "bun:test"
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
    ) as unknown as typeof fetch

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
    }) as unknown as typeof fetch

    await verifyToken("my-token-abcd")
    expect(calledUrl).toBe("https://api.pipedrive.com/v1/users/me?api_token=my-token-abcd")
  })

  test("returns error on HTTP 401", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({ success: false }), { status: 401 }))
    ) as unknown as typeof fetch

    const result = await verifyToken("bad-token-5678")
    expect(result.isErr()).toBe(true)
    const error = result._unsafeUnwrapErr()
    expect(error.type).toBe("TOKEN_VERIFICATION_FAILED")
    if (error.type === "TOKEN_VERIFICATION_FAILED") {
      expect(error.message).toContain("401")
    }
  })

  test("returns error on network failure", async () => {
    globalThis.fetch = mock(() => Promise.reject(new Error("fetch failed"))) as unknown as typeof fetch

    const result = await verifyToken("token-9999")
    expect(result.isErr()).toBe(true)
    const error = result._unsafeUnwrapErr()
    expect(error.type).toBe("NETWORK_ERROR")
  })

  test("masks token in error messages", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response("", { status: 401 }))
    ) as unknown as typeof fetch

    const result = await verifyToken("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f06262")
    expect(result.isErr()).toBe(true)
    const error = result._unsafeUnwrapErr()
    if (error.type === "TOKEN_VERIFICATION_FAILED") {
      expect(error.token).toBe("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f06262")
    }
  })
})
