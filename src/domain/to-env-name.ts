import type { FieldCategory } from "../types.ts"

const CATEGORY_PREFIX: Record<FieldCategory, string> = {
  deal: "DEAL",
  person: "PERSON",
  organization: "ORG",
  product: "PRODUCT",
}

const TRANSLITERATIONS: Record<string, string> = {
  ä: "a", Ä: "A", ö: "o", Ö: "O", å: "a", Å: "A",
  ü: "u", Ü: "U",
  é: "e", è: "e", ê: "e", ë: "e", É: "E", È: "E", Ê: "E", Ë: "E",
  á: "a", à: "a", â: "a", ã: "a", Á: "A", À: "A", Â: "A", Ã: "A",
  í: "i", ì: "i", î: "i", ï: "i", Í: "I", Ì: "I", Î: "I", Ï: "I",
  ó: "o", ò: "o", ô: "o", õ: "o", Ó: "O", Ò: "O", Ô: "O", Õ: "O",
  ú: "u", ù: "u", û: "u", Ú: "U", Ù: "U", Û: "U",
  ñ: "n", Ñ: "N",
  ç: "c", Ç: "C",
  ß: "ss",
}

function transliterate(str: string): string {
  return str
    .split("")
    .map((char) => TRANSLITERATIONS[char] ?? char)
    .join("")
}

export function toEnvName(category: FieldCategory, fieldName: string): string {
  const prefix = CATEGORY_PREFIX[category]
  const transliterated = transliterate(fieldName)
  const cleaned = transliterated
    .replace(/[^a-zA-Z0-9\s_-]/g, "")
    .replace(/[\s\-]+/g, "_")
    .replace(/_+/g, "_")
    .toUpperCase()
  return `${prefix}_${cleaned}`
}
