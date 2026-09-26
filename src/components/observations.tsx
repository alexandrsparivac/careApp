import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Angry, Droplet, Frown, HeartPulse, Laugh, Meh, Smile, Thermometer, TriangleAlert, Wind } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { errorMessage } from '../lib/api'
import { observationFlags, type VitalFlag } from '../lib/vitals'
import { MOODS, type Mood, type Observation } from '../lib/types'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Avatar, Badge, Button, cn, ErrorNote, Field, Input, Modal, Textarea } from './ui'

export const MOOD_ICON: Record<Mood, typeof Smile> = { very_good: Laugh, good: Smile, neutral: Meh, bad: Frown, very_bad: Angry }
const MOOD_TONE: Record<Mood, string> = {
  very_good: 'text-ok-600 bg-ok-50',
  good: 'text-ok-600 bg-ok-50',
  neutral: 'text-ink-soft bg-surface-2',
  bad: 'text-warn-600 bg-warn-50',
  very_bad: 'text-bad-600 bg-bad-50',
}

function painColor(n: number) {
  if (n <= 3) return 'var(--color-ok-600)'
  if (n <= 6) return 'var(--color-warn-600)'
  return 'var(--color-bad-600)'
}

// ---------------------------------------------------------------------------
// Card shown in journals
// ---------------------------------------------------------------------------
export function ObservationCard({ o, showElder }: { o: Observation; showElder?: boolean }) {
  const { t, fmtWhen } = useI18n()
  const flags = new Set(observationFlags(o))
  const MoodIcon = o.mood ? MOOD_ICON[o.mood] : null

  const vitals: { key: string; label: string; value: string; flagged: boolean }[] = []
  if (o.systolic || o.diastolic) vitals.push({ key: 'bp', label: t('obs.bloodPressure'), value: `${o.systolic ?? '–'}/${o.diastolic ?? '–'} mmHg`, flagged: flags.has('bp_high') || flags.has('bp_low') })
  if (o.heart_rate) vitals.push({ key: 'hr', label: t('obs.heartRate'), value: `${o.heart_rate} bpm`, flagged: flags.has('hr_high') || flags.has('hr_low') })
  if (o.temperature) vitals.push({ key: 't', label: t('obs.temperature'), value: `${o.temperature} °C`, flagged: flags.has('fever') || flags.has('hypothermia') })
  if (o.oxygen_saturation) vitals.push({ key: 'o2', label: 'SpO₂', value: `${o.oxygen_saturation}%`, flagged: flags.has('spo2_low') })
  if (o.glucose) vitals.push({ key: 'g', label: t('obs.glucose'), value: `${o.glucose} mg/dL`, flagged: flags.has('glucose_high') || flags.has('glucose_low') })
  if (o.pain_level !== null) vitals.push({ key: 'p', label: t('obs.pain'), value: `${o.pain_level}/10`, flagged: flags.has('pain') })

  return (
    <article className={cn('rounded-2xl border bg-white p-4 shadow-card', o.is_alert ? 'border-bad-600/35' : 'border-line/70')}>
      <header className="flex items-start gap-3">
        {MoodIcon && o.mood ? (
          <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', MOOD_TONE[o.mood])} title={t(`mood.${o.mood}`)}>
            <MoodIcon size={24} aria-hidden />
          </span>
        ) : (
          <Avatar name={o.author?.full_name ?? '?'} size={44} />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {showElder && o.elder ? `${o.elder.full_name} · ` : ''}
            {o.mood ? t(`mood.${o.mood}`) : t('obs.entry')}
          </p>
          <p className="text-sm text-ink-faint">
            {fmtWhen(o.observed_at)} · {t('obs.by', { name: o.author?.full_name ?? t('common.unknownUser') })}
          </p>
        </div>
        {o.is_alert && (
          <Badge tone="bad">
            <TriangleAlert size={12} aria-hidden /> {t('obs.alert')}
          </Badge>
        )}
      </header>

      {vitals.length > 0 && (
        <dl className="mt-3 flex flex-wrap gap-2">
          {vitals.map((v) => (
            <div key={v.key} className={cn('rounded-lg px-2.5 py-1.5', v.flagged ? 'bg-bad-50 text-bad-700' : 'bg-surface')}>
              <dt className="text-[0.7rem] font-medium tracking-wide uppercase opacity-75">{v.label}</dt>
              <dd className="tabular font-semibold">{v.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {(o.appetite || o.sleep_quality) && (
        <p className="mt-3 flex flex-wrap gap-2 text-sm">
          {o.appetite && <Badge>{`${t('obs.appetite')}: ${t(`appetite.${o.appetite}`)}`}</Badge>}
          {o.sleep_quality && <Badge>{`${t('obs.sleep')}: ${t(`sleep.${o.sleep_quality}`)}`}</Badge>}
        </p>
      )}

      {o.notes && <p className="mt-3 text-[0.95rem] leading-relaxed whitespace-pre-line text-ink-soft">{o.notes}</p>}
    </article>
  )
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------
type NumKey = 'systolic' | 'diastolic' | 'heart_rate' | 'temperature' | 'glucose' | 'oxygen_saturation'
interface ObsForm {
  observed_at: string
  mood: Mood | null
  pain_level: number | null
  values: Record<NumKey, string>
  appetite: Observation['appetite']
  sleep_quality: Observation['sleep_quality']
  notes: string
  is_alert: boolean
}

const emptyForm = (): ObsForm => ({
  observed_at: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  mood: null,
  pain_level: null,
  values: { systolic: '', diastolic: '', heart_rate: '', temperature: '', glucose: '', oxygen_saturation: '' },
  appetite: null,
  sleep_quality: null,
  notes: '',
  is_alert: false,
})

const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')))

export function ObservationFormModal({ open, onClose, onSaved, elderId }: { open: boolean; onClose: () => void; onSaved: () => void; elderId: string }) {
  const { t } = useI18n()
  const { profile } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState<ObsForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setForm(emptyForm())
      setError(null)
    }
  }, [open])

  const parsed = useMemo(
    () => ({
      systolic: num(form.values.systolic),
      diastolic: num(form.values.diastolic),
      heart_rate: num(form.values.heart_rate),
      temperature: num(form.values.temperature),
      glucose: num(form.values.glucose),
      oxygen_saturation: num(form.values.oxygen_saturation),
    }),
    [form.values],
  )
  const flags: VitalFlag[] = observationFlags({ ...parsed, pain_level: form.pain_level, mood: form.mood })

  const setValue = (k: NumKey, v: string) => setForm((f) => ({ ...f, values: { ...f.values, [k]: v } }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const hasContent = form.mood || form.pain_level !== null || Object.values(parsed).some((v) => v !== null) || form.notes.trim() || form.appetite || form.sleep_quality
    if (!hasContent) return setError(t('obs.errorEmpty'))
    setSaving(true)
    setError(null)
    const { error } = await supabase.from('observations').insert({
      elder_id: elderId,
      author_id: profile?.id,
      observed_at: new Date(form.observed_at).toISOString(),
      mood: form.mood,
      pain_level: form.pain_level,
      ...parsed,
      appetite: form.appetite,
      sleep_quality: form.sleep_quality,
      notes: form.notes.trim() || null,
      is_alert: form.is_alert,
    })
    setSaving(false)
    if (error) return setError(errorMessage(error))
    toast({ tone: flags.length || form.is_alert ? 'alert' : 'success', title: t('obs.saved'), body: flags.length || form.is_alert ? t('obs.teamNotified') : undefined })
    onSaved()
    onClose()
  }

  const vitalFields: { key: NumKey; label: string; unit: string; icon: typeof Droplet; step?: string }[] = [
    { key: 'systolic', label: t('obs.systolic'), unit: 'mmHg', icon: HeartPulse },
    { key: 'diastolic', label: t('obs.diastolic'), unit: 'mmHg', icon: HeartPulse },
    { key: 'heart_rate', label: t('obs.heartRate'), unit: 'bpm', icon: HeartPulse },
    { key: 'temperature', label: t('obs.temperature'), unit: '°C', icon: Thermometer, step: '0.1' },
    { key: 'oxygen_saturation', label: 'SpO₂', unit: '%', icon: Wind },
    { key: 'glucose', label: t('obs.glucose'), unit: 'mg/dL', icon: Droplet, step: '0.1' },
  ]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('obs.add')}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="obs-form" loading={saving}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id="obs-form" onSubmit={submit} className="flex flex-col gap-5">
        <Field label={t('obs.observedAt')} className="max-w-xs">
          {(id) => <Input id={id} type="datetime-local" required value={form.observed_at} onChange={(e) => setForm((f) => ({ ...f, observed_at: e.target.value }))} />}
        </Field>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink-soft">{t('obs.mood')}</legend>
          <div className="grid grid-cols-5 gap-2">
            {MOODS.map((m) => {
              const Icon = MOOD_ICON[m]
              const active = form.mood === m
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setForm((f) => ({ ...f, mood: active ? null : m }))}
                  className={cn('flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-xs font-medium transition-all', active ? cn('border-transparent ring-2 ring-brand-500', MOOD_TONE[m]) : 'border-line text-ink-soft hover:bg-surface')}
                >
                  <Icon size={26} aria-hidden />
                  <span className="text-center leading-tight">{t(`mood.${m}`)}</span>
                </button>
              )
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink-soft">
            {t('obs.pain')} <span className="font-normal text-ink-faint">— {t('obs.painHint')}</span>
          </legend>
          <div className="grid grid-cols-11 gap-1">
            {Array.from({ length: 11 }, (_, n) => {
              const active = form.pain_level === n
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setForm((f) => ({ ...f, pain_level: active ? null : n }))}
                  className={cn('tabular h-10 rounded-lg border text-sm font-semibold transition-all', active ? 'border-transparent text-white' : 'border-line bg-white text-ink-soft hover:bg-surface')}
                  style={active ? { background: painColor(n) } : { boxShadow: `inset 0 -3px 0 ${painColor(n)}` }}
                >
                  {n}
                </button>
              )
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink-soft">{t('obs.vitals')}</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {vitalFields.map((v) => (
              <label key={v.key} className="flex flex-col gap-1">
                <span className="flex items-center gap-1.5 text-xs font-medium text-ink-faint">
                  <v.icon size={13} aria-hidden /> {v.label}
                </span>
                <span className="relative">
                  <Input type="number" inputMode="decimal" step={v.step ?? '1'} value={form.values[v.key]} onChange={(e) => setValue(v.key, e.target.value)} className="tabular pr-14" />
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-ink-faint">{v.unit}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <ChipGroup label={t('obs.appetite')} value={form.appetite} options={(['good', 'reduced', 'none'] as const).map((v) => ({ v, label: t(`appetite.${v}`) }))} onChange={(v) => setForm((f) => ({ ...f, appetite: v }))} />
          <ChipGroup label={t('obs.sleep')} value={form.sleep_quality} options={(['good', 'fair', 'poor'] as const).map((v) => ({ v, label: t(`sleep.${v}`) }))} onChange={(v) => setForm((f) => ({ ...f, sleep_quality: v }))} />
        </div>

        <Field label={t('common.notes')}>
          {(id) => <Textarea id={id} rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder={t('obs.notesPlaceholder')} />}
        </Field>

        {flags.length > 0 ? (
          <div className="flex items-start gap-2 rounded-xl border border-bad-600/30 bg-bad-50 p-3 text-sm text-bad-700" role="alert">
            <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden />
            <p>{t('obs.alertWillTrigger', { flags: flags.map((f) => t(`flag.${f}`)).join(', ') })}</p>
          </div>
        ) : (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_alert} onChange={(e) => setForm((f) => ({ ...f, is_alert: e.target.checked }))} className="h-4 w-4 accent-bad-600" />
            {t('obs.markAlert')}
          </label>
        )}

        {error && <ErrorNote>{error}</ErrorNote>}
      </form>
    </Modal>
  )
}

function ChipGroup<V extends string>({ label, value, options, onChange }: { label: string; value: V | null; options: { v: V; label: string }[]; onChange: (v: V | null) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-ink-soft">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            aria-pressed={value === o.v}
            onClick={() => onChange(value === o.v ? null : o.v)}
            className={cn('rounded-full border px-3 py-1.5 text-sm font-medium transition-colors', value === o.v ? 'border-brand-700 bg-brand-700 text-white' : 'border-line text-ink-soft hover:bg-surface')}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
