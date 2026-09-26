import { supabase } from './supabase'
import type { TKey } from '../i18n'
import type { ActivityCategory, ActivityStatus } from './types'

type T = (key: TKey) => string

const at = (dayOffset: number, h: number, m = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  d.setHours(h, m, 0, 0)
  return d
}

/**
 * Creates a sample elder with two weeks of activities (past ones done/missed),
 * a week of observations, events and a first message. The current (admin) user
 * is added to the care team so everything is visible immediately.
 */
export async function createDemoData(t: T, userId: string): Promise<string> {
  const { data: elder, error } = await supabase
    .from('elders')
    .insert({
      full_name: 'Maria Popescu',
      birth_date: '1941-03-14',
      gender: 'female',
      address: t('demo.address'),
      medical_conditions: t('demo.conditions'),
      allergies: t('demo.allergies'),
      medications: t('demo.medications'),
      mobility_notes: t('demo.mobility'),
      emergency_contact_name: 'Ion Popescu',
      emergency_contact_phone: '+373 600 00 000',
    })
    .select()
    .single()
  if (error) throw error
  const elderId = elder.id as string

  const { error: memberError } = await supabase.from('elder_members').insert({ elder_id: elderId, user_id: userId, relationship: t('demo.relationship') })
  if (memberError) throw memberError

  const template: { h: number; m: number; title: TKey; category: ActivityCategory; dur: number; desc?: TKey }[] = [
    { h: 8, m: 0, title: 'demo.act.morningMeds', category: 'medication', dur: 10, desc: 'demo.act.morningMedsDesc' },
    { h: 8, m: 30, title: 'demo.act.breakfast', category: 'nutrition', dur: 30 },
    { h: 10, m: 0, title: 'demo.act.hygiene', category: 'hygiene', dur: 40 },
    { h: 11, m: 30, title: 'demo.act.walk', category: 'mobility', dur: 30 },
    { h: 13, m: 0, title: 'demo.act.lunch', category: 'nutrition', dur: 45 },
    { h: 16, m: 0, title: 'demo.act.bp', category: 'medical', dur: 10 },
    { h: 17, m: 30, title: 'demo.act.call', category: 'social', dur: 20 },
    { h: 20, m: 0, title: 'demo.act.eveningMeds', category: 'medication', dur: 10 },
  ]

  const now = Date.now()
  const rows = template.flatMap((tpl, ti) => {
    const series_id = crypto.randomUUID()
    return Array.from({ length: 13 }, (_, i) => {
      const day = i - 6
      const when = at(day, tpl.h, tpl.m)
      const past = when.getTime() + tpl.dur * 60_000 < now
      // deterministic ~1 in 11 missed, so the stats look like real life
      const status: ActivityStatus = past ? ((ti * 13 + i) % 11 === 3 ? 'missed' : 'done') : 'planned'
      return {
        elder_id: elderId,
        series_id,
        title: t(tpl.title),
        description: tpl.desc ? t(tpl.desc) : null,
        category: tpl.category,
        scheduled_at: when.toISOString(),
        duration_minutes: tpl.dur,
        assigned_to: userId,
        status,
        completed_at: status === 'done' ? new Date(when.getTime() + 5 * 60_000).toISOString() : null,
        completed_by: status === 'done' ? userId : null,
        reminder_sent: past,
      }
    })
  })
  const { error: actError } = await supabase.from('care_activities').insert(rows)
  if (actError) throw actError

  const vitals = [
    { systolic: 132, diastolic: 84, heart_rate: 72, temperature: 36.6, mood: 'good', pain_level: 2, oxygen_saturation: 96, appetite: 'good', sleep_quality: 'good', notes: 'demo.obs.1' },
    { systolic: 128, diastolic: 80, heart_rate: 70, temperature: 36.5, mood: 'very_good', pain_level: 1, oxygen_saturation: 97, appetite: 'good', sleep_quality: 'good', notes: 'demo.obs.2' },
    { systolic: 141, diastolic: 88, heart_rate: 78, temperature: 36.8, mood: 'neutral', pain_level: 4, oxygen_saturation: 95, appetite: 'reduced', sleep_quality: 'fair', notes: 'demo.obs.3' },
    { systolic: 150, diastolic: 92, heart_rate: 88, temperature: 38.2, mood: 'bad', pain_level: 5, oxygen_saturation: 94, appetite: 'reduced', sleep_quality: 'poor', notes: 'demo.obs.4' },
    { systolic: 136, diastolic: 85, heart_rate: 76, temperature: 37.2, mood: 'neutral', pain_level: 3, oxygen_saturation: 96, appetite: 'reduced', sleep_quality: 'fair', notes: 'demo.obs.5' },
    { systolic: 130, diastolic: 82, heart_rate: 71, temperature: 36.7, mood: 'good', pain_level: 2, oxygen_saturation: 97, appetite: 'good', sleep_quality: 'good', notes: 'demo.obs.6' },
  ] as const
  const observations = vitals
    .map((v, i) => ({ ...v, notes: t(v.notes), elder_id: elderId, author_id: userId, observed_at: at(i - 6, 18, 15).toISOString() }))
    .filter((o) => new Date(o.observed_at).getTime() < now)
  const { error: obsError } = await supabase.from('observations').insert(observations)
  if (obsError) throw obsError

  const { error: evError } = await supabase.from('events').insert([
    { elder_id: elderId, type: 'fall', importance: 'high', title: t('demo.event.fall'), description: t('demo.event.fallDesc'), starts_at: at(-3, 7, 40).toISOString(), created_by: userId },
    { elder_id: elderId, type: 'appointment', importance: 'normal', title: t('demo.event.doctor'), location: t('demo.event.doctorLocation'), starts_at: at(2, 10, 30).toISOString(), ends_at: at(2, 11, 15).toISOString(), created_by: userId },
    { elder_id: elderId, type: 'visit', importance: 'low', title: t('demo.event.visit'), starts_at: at(5, 15, 0).toISOString(), created_by: userId },
    { elder_id: elderId, type: 'medication_change', importance: 'normal', title: t('demo.event.meds'), description: t('demo.event.medsDesc'), starts_at: at(-1, 12, 0).toISOString(), created_by: userId },
  ])
  if (evError) throw evError

  await supabase.from('messages').insert({ elder_id: elderId, sender_id: userId, content: t('demo.message') })
  return elderId
}
