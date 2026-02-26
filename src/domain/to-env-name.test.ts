import { describe, it, expect } from "bun:test"
import { toEnvName } from "./to-env-name.ts"

describe("toEnvName", () => {
  it("generates basic env name from deal field", () => {
    expect(toEnvName("deal", "Status")).toBe("DEAL_STATUS")
  })

  it("handles spaces", () => {
    expect(toEnvName("deal", "Lead score")).toBe("DEAL_LEAD_SCORE")
  })

  it("transliterates Finnish characters", () => {
    expect(toEnvName("deal", "Ähtärin pojat")).toBe("DEAL_AHTARIN_POJAT")
  })

  it("transliterates ö and å", () => {
    expect(toEnvName("person", "Östersund ålänning")).toBe("PERSON_OSTERSUND_ALANNING")
  })

  it("transliterates accented Latin characters", () => {
    expect(toEnvName("organization", "Crédit rating")).toBe("ORG_CREDIT_RATING")
  })

  it("removes special characters", () => {
    expect(toEnvName("person", "Lead score!")).toBe("PERSON_LEAD_SCORE")
  })

  it("collapses multiple underscores", () => {
    expect(toEnvName("deal", "My   field---here")).toBe("DEAL_MY_FIELD_HERE")
  })

  it("uses ORG prefix for organization", () => {
    expect(toEnvName("organization", "Region")).toBe("ORG_REGION")
  })

  it("uses PRODUCT prefix for product", () => {
    expect(toEnvName("product", "Weight")).toBe("PRODUCT_WEIGHT")
  })

  it("handles field name with only special characters", () => {
    expect(toEnvName("deal", "!!!")).toBe("DEAL_")
  })

  it("transliterates ü and ñ", () => {
    expect(toEnvName("deal", "München señor")).toBe("DEAL_MUNCHEN_SENOR")
  })
})
