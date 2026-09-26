import type { Observation } from './types'

// Mirrors public.observation_flags() in supabase/migrations/003_triggers.sql.
// Keep both in sync: the database decides what triggers a notification,
// this copy lets the form warn the user before saving.
export type VitalFlag =
  | 'pain'
  | 'bp_high'
  | 'bp_low'
  | 'hr_high'
  | 'hr_low'
  | 'fever'
  | 'hypothermia'
  | 'spo2_low'
  | 'glucose_high'
  | 'glucose_low'
  | 'mood'

type VitalInput = Partial<
  Pick<Observation, 'pain_level' | 'systolic' | 'diastolic' | 'heart_rate' | 'temperature' | 'glucose' | 'oxygen_saturation' | 'mood'>
>

const has = (v: number | null | undefined): v is number => typeof v === 'number' && !Number.isNaN(v)

export function observationFlags(o: VitalInput): VitalFlag[] {
  const flags: VitalFlag[] = []
  if (has(o.pain_level) && o.pain_level >= 7) flags.push('pain')
  if ((has(o.systolic) && o.systolic >= 180) || (has(o.diastolic) && o.diastolic >= 110)) flags.push('bp_high')
  if (has(o.systolic) && o.systolic < 90) flags.push('bp_low')
  if (has(o.heart_rate) && o.heart_rate > 120) flags.push('hr_high')
  if (has(o.heart_rate) && o.heart_rate < 45) flags.push('hr_low')
  if (has(o.temperature) && o.temperature >= 38) flags.push('fever')
  if (has(o.temperature) && o.temperature < 35) flags.push('hypothermia')
  if (has(o.oxygen_saturation) && o.oxygen_saturation < 92) flags.push('spo2_low')
  if (has(o.glucose) && o.glucose > 250) flags.push('glucose_high')
  if (has(o.glucose) && o.glucose < 70) flags.push('glucose_low')
  if (o.mood === 'very_bad') flags.push('mood')
  return flags
}
