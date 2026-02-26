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
        const json = (await response.json()) as Record<string, unknown>
        if (!json || json.success !== true) {
          throw new Error("API returned success: false")
        }
        const data = json.data as Record<string, unknown> | undefined
        if (!data || typeof data.name !== "string" || typeof data.company_name !== "string") {
          throw new Error("Unexpected API response shape: missing data.name or data.company_name")
        }
        return {
          apiToken,
          userName: data.name,
          companyName: data.company_name,
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
