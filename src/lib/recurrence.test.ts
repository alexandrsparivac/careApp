import { describe, expect, it } from 'vitest'
import { buildOccurrences, MAX_OCCURRENCES } from './recurrence'

const d = (s: string) => new Date(`${s}T09:00`)
const days = (list: Date[]) => list.map((x) => x.toISOString().slice(0, 10))

describe('buildOccurrences', () => {
  it('returns only the start for a one-off activity', () => {
    expect(buildOccurrences(d('2026-10-01'), 'none', d('2026-10-10'))).toHaveLength(1)
  })

  it('returns only the start when no end date is given', () => {
    expect(buildOccurrences(d('2026-10-01'), 'daily', null)).toHaveLength(1)
  })

  it('creates one occurrence per day, end date inclusive', () => {
    const out = buildOccurrences(d('2026-10-01'), 'daily', new Date('2026-10-05T00:00'))
    expect(out).toHaveLength(5)
    expect(out.every((x) => x.getHours() === 9)).toBe(true)
  })

  it('skips weekends for weekdays recurrence', () => {
    // 2026-10-02 is a Friday
    const out = buildOccurrences(d('2026-10-02'), 'weekdays', new Date('2026-10-07T00:00'))
    const weekdays = out.map((x) => x.getDay())
    expect(weekdays).not.toContain(0)
    expect(weekdays).not.toContain(6)
    expect(out).toHaveLength(4) // Fri, Mon, Tue, Wed
  })

  it('keeps the first occurrence even if it falls on a weekend', () => {
    // 2026-10-03 is a Saturday
    const out = buildOccurrences(d('2026-10-03'), 'weekdays', new Date('2026-10-05T00:00'))
    expect(out[0].getDay()).toBe(6)
    expect(out).toHaveLength(2) // Sat (as entered) + Mon
  })

  it('steps a week at a time for weekly recurrence', () => {
    const out = buildOccurrences(d('2026-10-01'), 'weekly', new Date('2026-10-29T00:00'))
    expect(out).toHaveLength(5)
    expect(new Set(out.map((x) => x.getDay())).size).toBe(1)
  })

  it('caps the number of occurrences', () => {
    const out = buildOccurrences(d('2026-01-01'), 'daily', new Date('2027-12-31T00:00'))
    expect(out).toHaveLength(MAX_OCCURRENCES)
  })

  it('does not mutate the start date', () => {
    const start = d('2026-10-01')
    const before = start.getTime()
    buildOccurrences(start, 'daily', new Date('2026-10-05T00:00'))
    expect(start.getTime()).toBe(before)
    expect(days(buildOccurrences(start, 'daily', new Date('2026-10-02T00:00')))).toHaveLength(2)
  })
})
