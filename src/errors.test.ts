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
