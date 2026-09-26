export type Recurrence = 'none' | 'daily' | 'weekdays' | 'weekly'

export const MAX_OCCURRENCES = 120

/**
 * Expands a start date into the list of occurrence dates for a recurring activity.
 * `until` is inclusive (compared by calendar day). The first occurrence is always
 * `start`, even for 'weekdays' starting on a weekend, so the user sees what they entered.
 */
export function buildOccurrences(start: Date, recurrence: Recurrence, until?: Date | null, max = MAX_OCCURRENCES): Date[] {
  if (recurrence === 'none' || !until) return [new Date(start)]

  const last = endOfDay(until)
  const out: Date[] = []
  const cursor = new Date(start)

  while (cursor <= last && out.length < max) {
    if (out.length === 0 || recurrence !== 'weekdays' || isWeekday(cursor)) {
      out.push(new Date(cursor))
    }
    cursor.setDate(cursor.getDate() + (recurrence === 'weekly' ? 7 : 1))
  }
  return out
}

function isWeekday(d: Date) {
  const day = d.getDay()
  return day !== 0 && day !== 6
}

function endOfDay(d: Date) {
  const e = new Date(d)
  e.setHours(23, 59, 59, 999)
  return e
}
