import { describe, expect, test } from "bun:test"
import { parseArgs } from "./parse-args.ts"
import { formatError } from "../errors.ts"

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

  test("returns null targetApiToken when --target-api-token is missing", () => {
    const result = parseArgs(["--read-only-api-tokens=token1"])
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual({
      readOnlyApiTokens: ["token1"],
      targetApiToken: null,
      dryRun: false,
    })
  })

  test("parses without target-api-token, returns null", () => {
    const result = parseArgs(["--read-only-api-tokens=token1,token2"])
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().targetApiToken).toBeNull()
  })

  test("returns error when --read-only-api-tokens is missing", () => {
    const result = parseArgs(["--target-api-token=target1"])
    expect(result.isErr()).toBe(true)
    const error = result._unsafeUnwrapErr()
    expect(formatError(error)).toBe(
      'No read-only API tokens provided. Use --read-only-api-tokens="token1,token2"'
    )
  })

  test("returns error when a token is empty string after split", () => {
    const result = parseArgs([
      "--read-only-api-tokens=token1,,token3",
      "--target-api-token=target1",
    ])
    expect(result.isErr()).toBe(true)
    const error = result._unsafeUnwrapErr()
    expect(formatError(error)).toBe(
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
