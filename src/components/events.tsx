import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ArrowDownToLine, CalendarDays, Hospital, MapPin, Pill, Stethoscope, Trash2, TriangleAlert, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { errorMessage, fetchElders } from '../lib/api'
import { EVENT_TYPES, IMPORTANCE_LEVELS, type CareEvent, type Elder, type EventType, type Importance } from '../lib/types'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Badge, Button, cn, ErrorNote, Field, Input, Modal, Select, Textarea, type Tone } from './ui'

export const EVENT_ICON: Record<EventType, typeof Pill> = {
  appointment: Stethoscope,
  visit: Users,
  incident: TriangleAlert,
  fall: ArrowDownToLine,
  hospitalization: Hospital,
  medication_change: Pill,
  other: CalendarDays,
}

export const IMPORTANCE_TONE: Record<Importance, Tone> = { low: 'neutral', normal: 'plan', high: 'warn', critical: 'bad' }

export function EventCard({ event, showElder, onDeleted, highlight }: { event: CareEvent; showElder?: boolean; onDeleted?: () => void; highlight?: boolean }) {
  const { t, fmt } = useI18n()
  const { profile, isAdmin } = useAuth()
  const toast = useToast()
  const Icon = EVENT_ICON[event.type]
  const past = new Date(event.ends_at ?? event.starts_at) < new Date()
  const canDelete = isAdmin || event.created_by === profile?.id

  const remove = async () => {
    if (!confirm(t('common.confirmDelete'))) return
    const { error } = await supabase.from('events').delete().eq('id', event.id)
    if (error) return toast({ tone: 'error', title: t('common.error'), body: error.message })
    onDeleted?.()
  }

  return (
    <article id={`event-${event.id}`} className={cn('flex gap-4 rounded-2xl border bg-white p-4 shadow-card transition-shadow', highlight ? 'border-sun-500 ring-4 ring-sun-200/60' : 'border-line/70', past && 'opacity-75')}>
      <div className={cn('flex w-16 shrink-0 flex-col items-center justify-center rounded-xl py-2', event.importance === 'critical' ? 'bg-bad-50 text-bad-700' : 'bg-brand-50 text-brand-700')}>
        <span className="eyebrow text-[0.65rem]">{fmt(event.starts_at, 'MMM')}</span>
        <span className="font-display text-2xl leading-none font-bold">{fmt(event.starts_at, 'd')}</span>
        <span className="tabular mt-1 text-xs font-medium">{fmt(event.starts_at, 'HH:mm')}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="brand">
            <Icon size={12} aria-hidden /> {t(`eventType.${event.type}`)}
          </Badge>
          {event.importance !== 'normal' && <Badge tone={IMPORTANCE_TONE[event.importance]}>{t(`importance.${event.importance}`)}</Badge>}
          {showElder && event.elder && <span className="text-sm text-ink-faint">· {event.elder.full_name}</span>}
        </div>
        <h3 className="mt-1.5 font-semibold">{event.title}</h3>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-ink-faint">
          <span className="tabular">
            {fmt(event.starts_at, 'EEEE, HH:mm')}
            {event.ends_at && ` – ${fmt(event.ends_at, 'HH:mm')}`}
          </span>
          {event.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={13} aria-hidden /> {event.location}
            </span>
          )}
        </p>
        {event.description && <p className="mt-2 text-[0.95rem] whitespace-pre-line text-ink-soft">{event.description}</p>}
        <p className="mt-2 text-xs text-ink-faint">{t('event.createdBy', { name: event.creator?.full_name ?? t('common.unknownUser') })}</p>
      </div>
      {canDelete && onDeleted && (
        <button type="button" onClick={remove} className="self-start rounded-lg p-2 text-ink-faint hover:bg-bad-50 hover:text-bad-600" aria-label={t('common.delete')}>
          <Trash2 size={16} />
        </button>
      )}
    </article>
  )
}

export function EventSection({ title, events, onDeleted, showElder, focus }: { title: string; events: CareEvent[]; onDeleted: () => void; showElder?: boolean; focus?: string | null }) {
  if (events.length === 0) return null
  return (
    <section>
      <h2 className="eyebrow mb-3 text-ink-faint">{title}</h2>
      <div className="flex flex-col gap-3">
        {events.map((e) => (
          <EventCard key={e.id} event={e} showElder={showElder} onDeleted={onDeleted} highlight={focus === e.id} />
        ))}
      </div>
    </section>
  )
}

interface EventForm {
  elder_id: string
  type: EventType
  title: string
  starts_at: string
  ends_at: string
  location: string
  importance: Importance
  description: string
}

export function EventFormModal({ open, onClose, onSaved, elderId }: { open: boolean; onClose: () => void; onSaved: () => void; elderId?: string }) {
  const { t } = useI18n()
  const { profile } = useAuth()
  const [elders, setElders] = useState<Elder[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const blank = (): EventForm => ({
    elder_id: elderId ?? '',
    type: 'appointment',
    title: '',
    starts_at: format(new Date(Date.now() + 86_400_000), "yyyy-MM-dd'T'10:00"),
    ends_at: '',
    location: '',
    importance: 'normal',
    description: '',
  })
  const [form, setForm] = useState<EventForm>(blank)

  useEffect(() => {
    if (!open) return
    setForm(blank())
    setError(null)
    if (!elderId) fetchElders().then(setElders).catch(() => setElders([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, elderId])

  const set = <K extends keyof EventForm>(k: K, v: EventForm[K]) => setForm((f) => ({ ...f, [k]: v }))

  // Incidents default to high importance — the user can still lower it.
  const setType = (type: EventType) =>
    setForm((f) => ({ ...f, type, importance: ['incident', 'fall', 'hospitalization'].includes(type) && f.importance === 'normal' ? 'high' : f.importance }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.elder_id) return setError(t('activity.errorElder'))
    if (form.ends_at && form.ends_at < form.starts_at) return setError(t('event.errorEnd'))
    setSaving(true)
    setError(null)
    const { error } = await supabase.from('events').insert({
      elder_id: form.elder_id,
      type: form.type,
      title: form.title.trim(),
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      location: form.location.trim() || null,
      importance: form.importance,
      description: form.description.trim() || null,
      created_by: profile?.id,
    })
    setSaving(false)
    if (error) return setError(errorMessage(error))
    onSaved()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('event.add')}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="event-form" loading={saving}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id="event-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {!elderId && (
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

        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-medium text-ink-soft">{t('event.type')}</legend>
          <div className="flex flex-wrap gap-1.5">
            {EVENT_TYPES.map((type) => {
              const Icon = EVENT_ICON[type]
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={form.type === type}
                  onClick={() => setType(type)}
                  className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors', form.type === type ? 'border-brand-700 bg-brand-700 text-white' : 'border-line text-ink-soft hover:bg-surface')}
                >
                  <Icon size={14} aria-hidden /> {t(`eventType.${type}`)}
                </button>
              )
            })}
          </div>
        </fieldset>

        <Field label={t('event.name')} className="sm:col-span-2">
          {(id) => <Input id={id} required maxLength={200} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder={t('event.namePlaceholder')} />}
        </Field>
        <Field label={t('event.startsAt')}>{(id) => <Input id={id} type="datetime-local" required value={form.starts_at} onChange={(e) => set('starts_at', e.target.value)} />}</Field>
        <Field label={`${t('event.endsAt')} (${t('common.optional')})`}>{(id) => <Input id={id} type="datetime-local" min={form.starts_at} value={form.ends_at} onChange={(e) => set('ends_at', e.target.value)} />}</Field>
        <Field label={t('event.location')}>{(id) => <Input id={id} value={form.location} onChange={(e) => set('location', e.target.value)} />}</Field>
        <Field label={t('event.importance')}>
          {(id) => (
            <Select id={id} value={form.importance} onChange={(e) => set('importance', e.target.value as Importance)}>
              {IMPORTANCE_LEVELS.map((i) => (
                <option key={i} value={i}>
                  {t(`importance.${i}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t('common.description')} className="sm:col-span-2">
          {(id) => <Textarea id={id} value={form.description} onChange={(e) => set('description', e.target.value)} />}
        </Field>
        {(form.importance === 'high' || form.importance === 'critical') && <p className="text-sm text-warn-700 sm:col-span-2">{t('event.notifyHint')}</p>}
        {error && (
          <div className="sm:col-span-2">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}
      </form>
    </Modal>
  )
}
