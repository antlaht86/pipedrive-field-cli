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
