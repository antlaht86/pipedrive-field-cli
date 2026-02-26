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
    options: raw.options ? raw.options.map((opt) => ({ id: opt.id, label: opt.label })) : null,
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

        const json = (await response.json()) as Record<string, unknown>
        if (!json || json.success !== true) {
          throw new Error("API returned success: false")
        }
        if (!Array.isArray(json.data)) {
          throw new Error("Unexpected API response shape: missing data array")
        }
        const additionalData = json.additional_data as Record<string, unknown> | undefined
        if (!additionalData || typeof additionalData !== "object") {
          throw new Error("Unexpected API response shape: missing additional_data")
        }

        allFields.push(...(json.data as RawField[]))

        const nextCursor = additionalData.next_cursor as string | null | undefined
        if (!nextCursor) break
        cursor = nextCursor
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
