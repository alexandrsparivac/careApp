import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Check, CircleDot, Clock, Footprints, Pencil, Pill, RotateCcw, ShowerHead, Stethoscope, Trash2, Users, Utensils, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ACTIVITY_SELECT, errorMessage, fetchElders, fetchMembers, setActivityStatus } from '../lib/api'
import { buildOccurrences, MAX_OCCURRENCES, type Recurrence } from '../lib/recurrence'
import { ACTIVITY_CATEGORIES, type ActivityCategory, type ActivityStatus, type CareActivity, type Elder, type ElderMember } from '../lib/types'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Badge, Button, cn, ErrorNote, Field, Input, Modal, Select, Textarea, type Tone } from './ui'

export const CATEGORY_ICON: Record<ActivityCategory, typeof Pill> = {
  medication: Pill,
  hygiene: ShowerHead,
  nutrition: Utensils,
  mobility: Footprints,
  medical: Stethoscope,
  social: Users,
  other: CircleDot,
}

export function isOverdue(a: CareActivity, now = Date.now()) {
  if (a.status !== 'planned') return false
  const end = new Date(a.scheduled_at).getTime() + (a.duration_minutes ?? 30) * 60_000
  return end < now
}

const STATUS_TONE: Record<ActivityStatus, Tone> = { planned: 'plan', done: 'ok', missed: 'bad', cancelled: 'neutral' }

/** Morning / afternoon / evening — each has its own color throughout the app. */
export function dayPart(date: string | Date): 'dawn' | 'day' | 'dusk' {
  const h = new Date(date).getHours()
  return h < 12 ? 'dawn' : h < 18 ? 'day' : 'dusk'
}
export const DAY_PART_BAR = { dawn: 'bg-sun-500', day: 'bg-brand-500', dusk: 'bg-dusk-500' } as const

export function StatusBadge({ activity }: { activity: CareActivity }) {
  const { t } = useI18n()
  if (isOverdue(activity)) return <Badge tone="warn">{t('activity.overdue')}</Badge>
  return <Badge tone={STATUS_TONE[activity.status]}>{t(`status.${activity.status}`)}</Badge>
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------
export function ActivityRow({ activity, showElder, onOpen, onChanged }: { activity: CareActivity; showElder?: boolean; onOpen: (a: CareActivity) => void; onChanged: (a: CareActivity) => void }) {
  const { t, fmt } = useI18n()
  const { isStaff } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const Icon = CATEGORY_ICON[activity.category]
  const done = activity.status === 'done'

  const quickDone = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setBusy(true)
    try {
      onChanged(await setActivityStatus(activity.id, 'done'))
    } catch (err) {
      toast({ tone: 'error', title: t('common.error'), body: errorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpen(activity)}
        onKeyDown={(e) => e.key === 'Enter' && onOpen(activity)}
        className="flex w-full cursor-pointer items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-brand-50/60"
      >
        <span className="flex w-14 shrink-0 items-center gap-2">
          <span className={cn('h-7 w-1 rounded-full', DAY_PART_BAR[dayPart(activity.scheduled_at)])} aria-hidden />
          <span className="tabular font-semibold text-ink-soft">{fmt(activity.scheduled_at, 'HH:mm')}</span>
        </span>
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', done ? 'bg-ok-50 text-ok-600' : 'bg-brand-50 text-brand-600')}>
          <Icon size={18} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn('truncate font-medium', (done || activity.status === 'cancelled') && 'text-ink-soft line-through decoration-ink-faint/60')}>{activity.title}</p>
          <p className="truncate text-sm text-ink-faint">
            {[showElder && activity.elder?.full_name, t(`category.${activity.category}`), activity.assignee?.full_name].filter(Boolean).join(' · ')}
          </p>
        </div>
        <StatusBadge activity={activity} />
        {isStaff && activity.status === 'planned' && (
          <Button size="sm" variant="secondary" loading={busy} onClick={quickDone} icon={<Check size={16} />} aria-label={t('activity.markDone')} className="hidden sm:inline-flex">
            {t('activity.done')}
          </Button>
        )}
      </div>
    </li>
  )
}

// ---------------------------------------------------------------------------
// Detail modal: status changes, notes, edit, delete
// ---------------------------------------------------------------------------
export function ActivityDetailModal({ activity, onClose, onChanged, onDeleted, onEdit }: { activity: CareActivity | null; onClose: () => void; onChanged: (a: CareActivity) => void; onDeleted: () => void; onEdit: (a: CareActivity) => void }) {
  const { t, fmt, fmtWhen } = useI18n()
  const { isStaff, isAdmin, profile } = useAuth()
  const toast = useToast()
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => setNotes(activity?.completion_notes ?? ''), [activity])

  if (!activity) return null
  const Icon = CATEGORY_ICON[activity.category]
  const canDelete = isAdmin || activity.created_by === profile?.id

  const change = async (status: ActivityStatus) => {
    setBusy(status)
    try {
      const updated = await setActivityStatus(activity.id, status, status === 'planned' ? undefined : notes)
      onChanged(updated)
      toast({ tone: 'success', title: t('common.saved') })
      onClose()
    } catch (e) {
      toast({ tone: 'error', title: t('common.error'), body: errorMessage(e) })
    } finally {
      setBusy(null)
    }
  }

  const remove = async (series: boolean) => {
    if (!confirm(t(series ? 'activity.deleteSeriesConfirm' : 'common.confirmDelete'))) return
    setBusy(series ? 'series' : 'delete')
    let q = supabase.from('care_activities').delete()
    q = series && activity.series_id ? q.eq('series_id', activity.series_id).gte('scheduled_at', activity.scheduled_at).eq('status', 'planned') : q.eq('id', activity.id)
    const { error } = await q
    setBusy(null)
    if (error) return toast({ tone: 'error', title: t('common.error'), body: error.message })
    onDeleted()
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={activity.title}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand">
            <Icon size={13} aria-hidden /> {t(`category.${activity.category}`)}
          </Badge>
          <StatusBadge activity={activity} />
          {activity.series_id && <Badge>{t('activity.recurring')}</Badge>}
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-ink-faint">{t('activity.elder')}</dt>
          <dd className="font-medium">{activity.elder?.full_name}</dd>
          <dt className="text-ink-faint">{t('activity.when')}</dt>
          <dd className="tabular">
            {fmt(activity.scheduled_at, 'EEEE, d MMMM yyyy · HH:mm')}
            {activity.duration_minutes ? ` · ${activity.duration_minutes} ${t('common.minutes')}` : ''}
          </dd>
          <dt className="text-ink-faint">{t('activity.assignedTo')}</dt>
          <dd>{activity.assignee?.full_name ?? t('activity.unassigned')}</dd>
          {activity.status === 'done' && activity.completed_at && (
            <>
              <dt className="text-ink-faint">{t('activity.completed')}</dt>
              <dd>{t('activity.completedBy', { name: activity.completer?.full_name ?? t('common.unknownUser'), time: fmtWhen(activity.completed_at) })}</dd>
            </>
          )}
        </dl>

        {activity.description && <p className="rounded-md bg-surface p-3 text-sm whitespace-pre-line">{activity.description}</p>}

        {isStaff ? (
          <>
            {activity.status !== 'cancelled' && (
              <Field label={t('activity.completionNotes')} hint={t('activity.completionNotesHint')}>
                {(id) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />}
              </Field>
            )}
            <div className="flex flex-wrap gap-2">
              {activity.status === 'planned' ? (
                <>
                  <Button onClick={() => change('done')} loading={busy === 'done'} icon={<Check size={16} />}>
                    {t('activity.markDone')}
                  </Button>
                  <Button variant="secondary" onClick={() => change('missed')} loading={busy === 'missed'} icon={<Clock size={16} />}>
                    {t('activity.markMissed')}
                  </Button>
                  <Button variant="ghost" onClick={() => change('cancelled')} loading={busy === 'cancelled'} icon={<X size={16} />}>
                    {t('activity.markCancelled')}
                  </Button>
                </>
              ) : (
                <>
                  {activity.status === 'done' && notes !== (activity.completion_notes ?? '') && (
                    <Button onClick={() => change('done')} loading={busy === 'done'}>
                      {t('common.save')}
                    </Button>
                  )}
                  <Button variant="secondary" onClick={() => change('planned')} loading={busy === 'planned'} icon={<RotateCcw size={16} />}>
                    {t('activity.reopen')}
                  </Button>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <Button variant="ghost" size="sm" icon={<Pencil size={15} />} onClick={() => onEdit(activity)}>
                {t('common.edit')}
              </Button>
              {canDelete && (
                <Button variant="ghost" size="sm" icon={<Trash2 size={15} />} loading={busy === 'delete'} onClick={() => remove(false)} className="text-bad-600">
                  {t('common.delete')}
                </Button>
              )}
              {canDelete && activity.series_id && (
                <Button variant="ghost" size="sm" icon={<Trash2 size={15} />} loading={busy === 'series'} onClick={() => remove(true)} className="text-bad-600">
                  {t('activity.deleteSeries')}
                </Button>
              )}
            </div>
          </>
        ) : (
          activity.completion_notes && (
            <div>
              <p className="mb-1 text-sm text-ink-faint">{t('activity.completionNotes')}</p>
              <p className="text-sm whitespace-pre-line">{activity.completion_notes}</p>
            </div>
          )
        )}
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Create / edit form
// ---------------------------------------------------------------------------
interface FormState {
  elder_id: string
  title: string
  category: ActivityCategory
  date: string
  time: string
  duration: string
  assigned_to: string
  description: string
  recurrence: Recurrence
  until: string
  applyToSeries: boolean
}

function initialState(activity?: CareActivity | null, elderId?: string, date?: Date): FormState {
  const d = activity ? new Date(activity.scheduled_at) : (date ?? new Date())
  return {
    elder_id: activity?.elder_id ?? elderId ?? '',
    title: activity?.title ?? '',
    category: activity?.category ?? 'medication',
    date: format(d, 'yyyy-MM-dd'),
    time: activity ? format(d, 'HH:mm') : '09:00',
    duration: String(activity?.duration_minutes ?? 30),
    assigned_to: activity?.assigned_to ?? '',
    description: activity?.description ?? '',
    recurrence: 'none',
    until: '',
    applyToSeries: false,
  }
}

export function ActivityFormModal({ open, onClose, onSaved, elderId, activity, defaultDate }: { open: boolean; onClose: () => void; onSaved: () => void; elderId?: string; activity?: CareActivity | null; defaultDate?: Date }) {
  const { t } = useI18n()
  const { profile } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState<FormState>(() => initialState(activity, elderId, defaultDate))
  const [elders, setElders] = useState<Elder[]>([])
  const [members, setMembers] = useState<ElderMember[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const editing = Boolean(activity)

  useEffect(() => {
    if (!open) return
    setForm(initialState(activity, elderId, defaultDate))
    setError(null)
    if (!elderId && !activity) fetchElders().then(setElders).catch(() => setElders([]))
  }, [open, activity, elderId, defaultDate])

  useEffect(() => {
    if (!form.elder_id) return setMembers([])
    fetchMembers(form.elder_id).then(setMembers).catch(() => setMembers([]))
  }, [form.elder_id])

  // Default the assignee to the current caregiver when creating
  useEffect(() => {
    if (!editing && profile?.role === 'caregiver' && !form.assigned_to && members.some((m) => m.user_id === profile.id)) {
      setForm((f) => ({ ...f, assigned_to: profile.id }))
    }
  }, [members, editing, profile, form.assigned_to])

  const caregivers = members.filter((m) => m.profile && m.profile.role !== 'family')
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  const occurrences = useMemo(() => {
    if (editing || !form.date || !form.time) return []
    return buildOccurrences(new Date(`${form.date}T${form.time}`), form.recurrence, form.until ? new Date(`${form.until}T00:00`) : null)
  }, [editing, form.date, form.time, form.recurrence, form.until])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!form.elder_id) return setError(t('activity.errorElder'))
    if (form.recurrence !== 'none' && !form.until) return setError(t('activity.errorUntil'))

    const common = {
      title: form.title.trim(),
      category: form.category,
      duration_minutes: form.duration ? Number(form.duration) : null,
      assigned_to: form.assigned_to || null,
      description: form.description.trim() || null,
    }

    setSaving(true)
    try {
      if (activity) {
        const scheduled_at = new Date(`${form.date}T${form.time}`).toISOString()
        const { error } = await supabase.from('care_activities').update({ ...common, scheduled_at }).eq('id', activity.id)
        if (error) throw error
        if (form.applyToSeries && activity.series_id) {
          const { error: seriesError } = await supabase
            .from('care_activities')
            .update(common)
            .eq('series_id', activity.series_id)
            .eq('status', 'planned')
            .gt('scheduled_at', activity.scheduled_at)
          if (seriesError) throw seriesError
        }
      } else {
        const series_id = occurrences.length > 1 ? crypto.randomUUID() : null
        const rows = occurrences.map((d) => ({ ...common, elder_id: form.elder_id, series_id, scheduled_at: d.toISOString() }))
        const { error } = await supabase.from('care_activities').insert(rows).select(ACTIVITY_SELECT)
        if (error) throw error
        toast({ tone: 'success', title: t('activity.created', { n: rows.length }) })
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? t('activity.edit') : t('activity.add')}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="activity-form" loading={saving}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id="activity-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {!elderId && !editing && (
          <Field label={t('activity.elder')} className="sm:col-span-2">
            {(id) => (
              <Select id={id} required value={form.elder_id} onChange={(e) => set('elder_id', e.target.value)}>
                <option value="">{t('common.selectPlaceholder')}</option>
                {elders.map((el) => (
                  <option key={el.id} value={el.id}>
                    {el.full_name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Field label={t('activity.name')} className="sm:col-span-2">
          {(id) => <Input id={id} required maxLength={200} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder={t('activity.namePlaceholder')} />}
        </Field>
        <Field label={t('activity.category')}>
          {(id) => (
            <Select id={id} value={form.category} onChange={(e) => set('category', e.target.value as ActivityCategory)}>
              {ACTIVITY_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`category.${c}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t('activity.assignedTo')}>
          {(id) => (
            <Select id={id} value={form.assigned_to} onChange={(e) => set('assigned_to', e.target.value)}>
              <option value="">{t('activity.unassigned')}</option>
              {caregivers.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.profile?.full_name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="grid grid-cols-3 gap-3 sm:col-span-2">
          <Field label={t('common.date')}>{(id) => <Input id={id} type="date" required value={form.date} onChange={(e) => set('date', e.target.value)} />}</Field>
          <Field label={t('common.time')}>{(id) => <Input id={id} type="time" required value={form.time} onChange={(e) => set('time', e.target.value)} />}</Field>
          <Field label={t('activity.duration')}>{(id) => <Input id={id} type="number" min={1} max={1440} value={form.duration} onChange={(e) => set('duration', e.target.value)} />}</Field>
        </div>

        {!editing && (
          <div className="grid gap-3 rounded-md bg-surface p-3 sm:col-span-2 sm:grid-cols-2">
            <Field label={t('activity.recurrence')}>
              {(id) => (
                <Select id={id} value={form.recurrence} onChange={(e) => set('recurrence', e.target.value as Recurrence)}>
                  {(['none', 'daily', 'weekdays', 'weekly'] as const).map((r) => (
                    <option key={r} value={r}>
                      {t(`recurrence.${r}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {form.recurrence !== 'none' && (
              <Field label={t('activity.repeatUntil')}>
                {(id) => <Input id={id} type="date" min={form.date} value={form.until} onChange={(e) => set('until', e.target.value)} />}
              </Field>
            )}
            {form.recurrence !== 'none' && form.until && (
              <p className="text-sm text-ink-soft sm:col-span-2">
                {t('activity.occurrencesPreview', { n: occurrences.length })}
                {occurrences.length >= MAX_OCCURRENCES && ` ${t('activity.occurrencesMax', { n: MAX_OCCURRENCES })}`}
              </p>
            )}
          </div>
        )}

        <Field label={t('common.description')} className="sm:col-span-2">
          {(id) => <Textarea id={id} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder={t('activity.descriptionPlaceholder')} />}
        </Field>

        {editing && activity?.series_id && (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={form.applyToSeries} onChange={(e) => set('applyToSeries', e.target.checked)} className="h-4 w-4 accent-brand-600" />
            {t('activity.applyToSeries')}
          </label>
        )}

        {error && (
          <div className="sm:col-span-2">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}
      </form>
    </Modal>
  )
}
