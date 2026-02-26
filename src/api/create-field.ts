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
      const json = (await response.json()) as Record<string, unknown>
      if (!json || json.success !== true) {
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
