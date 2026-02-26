import type { AppError } from "./errors.ts"

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
  options: Array<{ id: number; label: string }> | null
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
  targetApiToken: string | null
  dryRun: boolean
}

export type EnvEntry = {
  envName: string
  fieldCode: string
  fieldName: string
  category: FieldCategory
}

export type AppState =
  | { step: "verifying-tokens" }
  | { step: "loading-fields" }
  | { step: "select-field-type" }
  | { step: "select-fields"; fieldType: FieldCategory }
  | { step: "confirm-copy"; selected: SourceField[] }
  | { step: "copying"; selected: SourceField[] }
  | { step: "summary"; results: CopyResult[] }
