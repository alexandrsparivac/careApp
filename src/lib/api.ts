import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { ActivityStatus, CareActivity, CareEvent, Elder, ElderMember, Observation } from './types'

export const ACTIVITY_SELECT =
  '*, elder:elders(id, full_name), assignee:profiles!care_activities_assigned_to_fkey(id, full_name), completer:profiles!care_activities_completed_by_fkey(id, full_name)'
export const OBSERVATION_SELECT = '*, author:profiles(full_name), elder:elders(id, full_name)'
export const EVENT_SELECT = '*, elder:elders(id, full_name), creator:profiles(full_name)'

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message)
  return data as T
}

/** Tiny async-state hook: runs `fn`, exposes data/loading/error and a reload. */
export function useQuery<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setData(await run())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [run])

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, loading, error, reload, setData }
}

// ------------------------------------------------------------------ elders
export async function fetchElders() {
  return unwrap<(Elder & { elder_members: { count: number }[] })[]>(
    await supabase.from('elders').select('*, elder_members(count)').order('full_name'),
  )
}

export async function fetchElder(id: string) {
  return unwrap<Elder>(await supabase.from('elders').select('*').eq('id', id).single())
}

export async function fetchMembers(elderId: string) {
  return unwrap<ElderMember[]>(await supabase.from('elder_members').select('*, profile:profiles(*)').eq('elder_id', elderId))
}

// ------------------------------------------------------------------ activities
export async function fetchActivities(opts: { from: Date; to: Date; elderId?: string; assignedTo?: string }) {
  let q = supabase
    .from('care_activities')
    .select(ACTIVITY_SELECT)
    .gte('scheduled_at', opts.from.toISOString())
    .lt('scheduled_at', opts.to.toISOString())
    .order('scheduled_at')
  if (opts.elderId) q = q.eq('elder_id', opts.elderId)
  if (opts.assignedTo) q = q.eq('assigned_to', opts.assignedTo)
  return unwrap<CareActivity[]>(await q)
}

export async function setActivityStatus(id: string, status: ActivityStatus, notes?: string) {
  const patch: Partial<CareActivity> = { status }
  if (notes !== undefined) patch.completion_notes = notes || null
  return unwrap<CareActivity>(await supabase.from('care_activities').update(patch).eq('id', id).select(ACTIVITY_SELECT).single())
}

// ------------------------------------------------------------------ observations
export async function fetchObservations(opts: { elderId?: string; limit?: number; since?: Date } = {}) {
  let q = supabase.from('observations').select(OBSERVATION_SELECT).order('observed_at', { ascending: false }).limit(opts.limit ?? 50)
  if (opts.elderId) q = q.eq('elder_id', opts.elderId)
  if (opts.since) q = q.gte('observed_at', opts.since.toISOString())
  return unwrap<Observation[]>(await q)
}

// ------------------------------------------------------------------ events
export async function fetchEvents(opts: { elderId?: string; from?: Date; to?: Date; ascending?: boolean; limit?: number } = {}) {
  let q = supabase
    .from('events')
    .select(EVENT_SELECT)
    .order('starts_at', { ascending: opts.ascending ?? true })
    .limit(opts.limit ?? 200)
  if (opts.elderId) q = q.eq('elder_id', opts.elderId)
  if (opts.from) q = q.gte('starts_at', opts.from.toISOString())
  if (opts.to) q = q.lt('starts_at', opts.to.toISOString())
  return unwrap<CareEvent[]>(await q)
}

export function errorMessage(e: unknown) {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return String(e)
}
