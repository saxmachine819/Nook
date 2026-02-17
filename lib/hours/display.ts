export function isValidTimeFormat(time: string): boolean {
  return parseHHMM(time) !== null
}

export function parseHHMM(time: string): { hour: number; minute: number } | null {
  const parts = time.split(":")
  if (parts.length !== 2) return null
  const hour = parseInt(parts[0], 10)
  const minute = parseInt(parts[1], 10)
  if (isNaN(hour) || isNaN(minute)) return null
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return { hour, minute }
}
