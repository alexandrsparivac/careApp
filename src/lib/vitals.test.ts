import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { observationFlags, type VitalFlag } from './vitals'

describe('observationFlags', () => {
  it('returns nothing for normal values', () => {
    expect(observationFlags({ systolic: 125, diastolic: 80, heart_rate: 72, temperature: 36.6, oxygen_saturation: 97, glucose: 110, pain_level: 2, mood: 'good' })).toEqual([])
  })

  it('returns nothing when no values are given', () => {
    expect(observationFlags({})).toEqual([])
    expect(observationFlags({ systolic: null, temperature: null, mood: null })).toEqual([])
  })

  it.each<[string, Parameters<typeof observationFlags>[0], VitalFlag]>([
    ['pain at threshold', { pain_level: 7 }, 'pain'],
    ['high systolic', { systolic: 180 }, 'bp_high'],
    ['high diastolic alone', { diastolic: 110 }, 'bp_high'],
    ['low systolic', { systolic: 85 }, 'bp_low'],
    ['tachycardia', { heart_rate: 121 }, 'hr_high'],
    ['bradycardia', { heart_rate: 44 }, 'hr_low'],
    ['fever', { temperature: 38 }, 'fever'],
    ['hypothermia', { temperature: 34.9 }, 'hypothermia'],
    ['low SpO2', { oxygen_saturation: 91 }, 'spo2_low'],
    ['hyperglycaemia', { glucose: 251 }, 'glucose_high'],
    ['hypoglycaemia', { glucose: 69 }, 'glucose_low'],
    ['very bad mood', { mood: 'very_bad' }, 'mood'],
  ])('flags %s', (_, input, flag) => {
    expect(observationFlags(input)).toContain(flag)
  })

  it('does not flag values just inside the limits', () => {
    expect(observationFlags({ pain_level: 6, systolic: 179, diastolic: 109, heart_rate: 120, temperature: 37.9, oxygen_saturation: 92, glucose: 250 })).toEqual([])
    expect(observationFlags({ systolic: 90, heart_rate: 45, temperature: 35, glucose: 70 })).toEqual([])
  })

  it('reports several problems at once', () => {
    expect(observationFlags({ temperature: 39, heart_rate: 130, oxygen_saturation: 88 })).toEqual(['hr_high', 'fever', 'spo2_low'])
  })
})

describe('database mirror', () => {
  // The same thresholds live in public.observation_flags() — make sure every flag exists there.
  const sql = readFileSync(new URL('../../supabase/migrations/003_triggers.sql', import.meta.url), 'utf8')
  const flags: VitalFlag[] = ['pain', 'bp_high', 'bp_low', 'hr_high', 'hr_low', 'fever', 'hypothermia', 'spo2_low', 'glucose_high', 'glucose_low', 'mood']

  it.each(flags)('SQL defines flag %s', (flag) => {
    expect(sql).toContain(`'${flag}'`)
  })

  it.each([
    ['o.pain_level >= 7'],
    ['o.systolic >= 180 or o.diastolic >= 110'],
    ['o.systolic < 90'],
    ['o.heart_rate > 120'],
    ['o.heart_rate < 45'],
    ['o.temperature >= 38'],
    ['o.temperature < 35'],
    ['o.oxygen_saturation < 92'],
    ['o.glucose > 250'],
    ['o.glucose < 70'],
  ])('SQL uses the same threshold: %s', (expr) => {
    expect(sql).toContain(expr)
  })
})
