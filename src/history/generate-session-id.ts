export function generateSessionId(): string {
  const now = new Date()
  const datePart = now.toISOString().replace(/[:.]/g, "-").slice(0, 19)
  const randomPart = Math.random().toString(36).slice(2, 8)
  return `${datePart}_${randomPart}`
}
