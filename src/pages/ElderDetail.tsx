import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { addDays, endOfDay, isSameDay, isToday, startOfDay, subDays } from 'date-fns'
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  HeartPulse,
  MessagesSquare,
  NotebookPen,
  Pencil,
  Phone,
  Pill,
  Plus,
  ShieldAlert,
  TriangleAlert,
  UserPlus,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { errorMessage, fetchActivities, fetchElder, fetchEvents, fetchMembers, fetchObservations, useQuery } from '../lib/api'
import type { CareActivity, Elder, ElderMember, Observation, Profile } from '../lib/types'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useI18n, type TKey } from '../i18n'
import { ActivityDetailModal, ActivityFormModal, ActivityRow, CATEGORY_ICON } from '../components/activities'
import { ChatThread } from '../components/ChatThread'
import { ElderFormModal } from '../components/ElderForm'
import { EventFormModal, EventSection } from '../components/events'
import { ObservationCard, ObservationFormModal } from '../components/observations'
import { Sparkline } from '../components/Sparkline'
import { Avatar, Badge, Button, Card, CardHeader, cn, EmptyState, Field, Input, Modal, Ring, Select, Spinner, Tabs } from '../components/ui'
import { age } from './Elders'

type Tab = 'overview' | 'plan' | 'journal' | 'events' | 'messages'
const TABS: Tab[] = ['overview', 'plan', 'journal', 'events', 'messages']

export function ElderDetailPage() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const tab = (TABS.includes(params.get('tab') as Tab) ? params.get('tab') : 'overview') as Tab
  const { t } = useI18n()
  const { isAdmin, isStaff } = useAuth()
  const [editOpen, setEditOpen] = useState(false)

  const { data: elder, loading, error, reload } = useQuery(() => fetchElder(id), [id])
  const members = useQuery(() => fetchMembers(id), [id])
  const today = useQuery(() => fetchActivities({ elderId: id, from: startOfDay(new Date()), to: endOfDay(new Date()) }), [id])

  if (loading) return <Spinner />
  if (error || !elder) return <EmptyState icon={<TriangleAlert size={32} />} title={t('elders.notFound')} text={error ?? undefined} action={<Link to="/elders" className="font-semibold text-brand-600">← {t('nav.elders')}</Link>} />

  const years = age(elder.birth_date)
  const relevant = (today.data ?? []).filter((a) => a.status !== 'cancelled')
  const done = relevant.filter((a) => a.status === 'done').length

  const tabIcons: Record<Tab, React.ReactNode> = {
    overview: <HeartPulse size={17} />,
    plan: <ClipboardList size={17} />,
    journal: <NotebookPen size={17} />,
    events: <CalendarDays size={17} />,
    messages: <MessagesSquare size={17} />,
  }

  return (
    <>
      <Link to="/elders" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-faint hover:text-ink">
        <ArrowLeft size={16} /> {t('nav.elders')}
      </Link>

      <header className="animate-rise mb-7 flex flex-wrap items-center gap-5">
        <Ring value={relevant.length ? done / relevant.length : null} size={88} stroke={5}>
          <Avatar name={elder.full_name} size={70} />
        </Ring>
        <div className="min-w-0 flex-1">
          <h1 className="text-[1.9rem] leading-tight font-bold tracking-tight">{elder.full_name}</h1>
          <p className="mt-1 text-ink-soft">
            {[years !== null && t('elders.age', { n: years }), elder.gender && t(`gender.${elder.gender}`), elder.address].filter(Boolean).join(' · ')}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {relevant.length > 0 && <Badge tone="ok">{t('dashboard.elderProgress', { done, total: relevant.length })}</Badge>}
            {elder.allergies && (
              <Badge tone="bad">
                <ShieldAlert size={12} aria-hidden /> {t('elders.allergies')}: {elder.allergies}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {elder.emergency_contact_phone && (
            <a href={`tel:${elder.emergency_contact_phone}`}>
              <Button variant="secondary" icon={<Phone size={16} />}>
                {t('elders.callEmergency')}
              </Button>
            </a>
          )}
          {isStaff && (
            <Button variant="secondary" icon={<Pencil size={16} />} onClick={() => setEditOpen(true)}>
              {t('common.edit')}
            </Button>
          )}
        </div>
      </header>

      <Tabs tabs={TABS.map((id) => ({ id, label: t(`elders.tab.${id}`), icon: tabIcons[id] }))} value={tab} onChange={(next) => setParams({ tab: next }, { replace: true })} />

      <div className="animate-rise" key={tab}>
        {tab === 'overview' && <Overview elder={elder} members={members.data ?? []} reloadMembers={members.reload} isAdmin={isAdmin} />}
        {tab === 'plan' && <PlanTab elderId={elder.id} onChanged={today.reload} />}
        {tab === 'journal' && <JournalTab elderId={elder.id} />}
        {tab === 'events' && <EventsTab elderId={elder.id} />}
        {tab === 'messages' && (
          <Card>
            <CardHeader icon={<MessagesSquare size={17} />} title={t('msg.threadFor', { name: elder.full_name })} subtitle={t('msg.threadHint')} />
            <ChatThread elderId={elder.id} className="h-[min(65vh,640px)] border-t border-line" />
          </Card>
        )}
      </div>

      <ElderFormModal open={editOpen} elder={elder} onClose={() => setEditOpen(false)} onSaved={() => void reload()} />
    </>
  )
}

// ===========================================================================
// Overview
// ===========================================================================
const VITALS: { key: keyof Observation; label: TKey; unit: string; band: [number, number] }[] = [
  { key: 'systolic', label: 'obs.systolic', unit: 'mmHg', band: [90, 140] },
  { key: 'heart_rate', label: 'obs.heartRate', unit: 'bpm', band: [50, 100] },
  { key: 'temperature', label: 'obs.temperature', unit: '°C', band: [35.5, 37.5] },
  { key: 'oxygen_saturation', label: 'obs.spo2', unit: '%', band: [94, 100] },
  { key: 'glucose', label: 'obs.glucose', unit: 'mg/dL', band: [70, 180] },
]

function Overview({ elder, members, reloadMembers, isAdmin }: { elder: Elder; members: ElderMember[]; reloadMembers: () => Promise<void>; isAdmin: boolean }) {
  const { t, fmtAgo } = useI18n()
  const toast = useToast()
  const [addOpen, setAddOpen] = useState(false)
  const obs = useQuery(() => fetchObservations({ elderId: elder.id, since: subDays(new Date(), 14), limit: 200 }), [elder.id])

  const trends = useMemo(() => {
    const sorted = [...(obs.data ?? [])].reverse()
    return VITALS.map((v) => {
      const points = sorted.filter((o) => o[v.key] !== null).map((o) => ({ t: +new Date(o.observed_at), v: Number(o[v.key]) }))
      return { ...v, points, last: points[points.length - 1] }
    }).filter((v) => v.points.length > 0)
  }, [obs.data])

  const removeMember = async (m: ElderMember) => {
    if (!confirm(t('elders.removeMemberConfirm', { name: m.profile?.full_name ?? '' }))) return
    const { error } = await supabase.from('elder_members').delete().eq('elder_id', m.elder_id).eq('user_id', m.user_id)
    if (error) return toast({ tone: 'error', title: t('common.error'), body: error.message })
    void reloadMembers()
  }

  const facts: { label: TKey; value: string | null; icon: typeof Pill }[] = [
    { label: 'elders.medicalConditions', value: elder.medical_conditions, icon: HeartPulse },
    { label: 'elders.medications', value: elder.medications, icon: Pill },
    { label: 'elders.mobilityNotes', value: elder.mobility_notes, icon: ClipboardList },
  ]

  return (
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader icon={<HeartPulse size={17} />} title={t('elders.trends')} subtitle={t('elders.trendsHint')} />
          {obs.loading ? (
            <Spinner />
          ) : trends.length === 0 ? (
            <EmptyState title={t('elders.noVitals')} />
          ) : (
            <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
              {trends.map((v) => (
                <div key={v.key} className="rounded-xl bg-surface p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-ink-soft">{t(v.label)}</p>
                    <p className="text-xs text-ink-faint">{fmtAgo(v.last.t)}</p>
                  </div>
                  <p className={cn('font-display tabular mt-1 text-2xl font-bold', (v.last.v < v.band[0] || v.last.v > v.band[1]) && 'text-bad-600')}>
                    {v.last.v}
                    <span className="ml-1 font-sans text-sm font-medium text-ink-faint">{v.unit}</span>
                  </p>
                  <div className="mt-1">
                    <Sparkline points={v.points} band={v.band} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader icon={<ClipboardList size={17} />} title={t('elders.healthProfile')} />
          <dl className="grid gap-4 px-5 pb-5">
            {facts.map((f) => (
              <div key={f.label} className="flex gap-3">
                <f.icon size={18} className="mt-0.5 shrink-0 text-brand-500" aria-hidden />
                <div>
                  <dt className="text-sm font-medium text-ink-faint">{t(f.label)}</dt>
                  <dd className="mt-0.5 whitespace-pre-line">{f.value || '—'}</dd>
                </div>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader
            title={t('elders.careTeam')}
            subtitle={t('elders.teamCount', { n: members.length })}
            action={
              isAdmin && (
                <Button size="sm" variant="secondary" icon={<UserPlus size={15} />} onClick={() => setAddOpen(true)}>
                  {t('elders.addMember')}
                </Button>
              )
            }
          />
          {members.length === 0 ? (
            <EmptyState title={t('elders.noMembers')} />
          ) : (
            <ul className="flex flex-col px-3 pb-3">
              {members.map((m) => (
                <li key={m.user_id} className="flex items-center gap-3 rounded-xl p-2">
                  <Avatar name={m.profile?.full_name ?? '?'} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{m.profile?.full_name}</p>
                    <p className="truncate text-sm text-ink-faint">{[m.profile && t(`role.${m.profile.role}`), m.relationship].filter(Boolean).join(' · ')}</p>
                  </div>
                  {m.profile?.phone && (
                    <a href={`tel:${m.profile.phone}`} className="rounded-lg p-2 text-ink-faint hover:bg-surface hover:text-brand-600" aria-label={m.profile.phone} title={m.profile.phone}>
                      <Phone size={16} />
                    </a>
                  )}
                  {isAdmin && (
                    <button type="button" onClick={() => removeMember(m)} className="rounded-lg p-2 text-ink-faint hover:bg-bad-50 hover:text-bad-600" aria-label={t('elders.removeMember')}>
                      <X size={16} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <p className="eyebrow text-bad-600">{t('elders.emergencyContact')}</p>
          <p className="mt-2 text-lg font-semibold">{elder.emergency_contact_name || '—'}</p>
          {elder.emergency_contact_phone && (
            <a href={`tel:${elder.emergency_contact_phone}`} className="tabular mt-1 inline-flex items-center gap-2 font-medium text-brand-600 hover:underline">
              <Phone size={15} /> {elder.emergency_contact_phone}
            </a>
          )}
          {elder.allergies && (
            <div className="mt-4 rounded-xl bg-bad-50 p-3 text-sm text-bad-700">
              <p className="font-semibold">{t('elders.allergies')}</p>
              <p className="mt-0.5">{elder.allergies}</p>
            </div>
          )}
        </Card>
      </div>

      <AddMemberModal open={addOpen} onClose={() => setAddOpen(false)} elderId={elder.id} existing={members.map((m) => m.user_id)} onSaved={() => void reloadMembers()} />
    </div>
  )
}

function AddMemberModal({ open, onClose, elderId, existing, onSaved }: { open: boolean; onClose: () => void; elderId: string; existing: string[]; onSaved: () => void }) {
  const { t } = useI18n()
  const [users, setUsers] = useState<Profile[]>([])
  const [userId, setUserId] = useState('')
  const [relationship, setRelationship] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setUserId('')
    setRelationship('')
    setError(null)
    supabase
      .from('profiles')
      .select('*')
      .eq('is_active', true)
      .order('full_name')
      .then(({ data }) => setUsers(((data ?? []) as Profile[]).filter((u) => !existing.includes(u.id))))
  }, [open, existing])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('elder_members').insert({ elder_id: elderId, user_id: userId, relationship: relationship.trim() || null })
    setSaving(false)
    if (error) return setError(errorMessage(error))
    onSaved()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('elders.addMember')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="member-form" loading={saving} disabled={!userId}>
            {t('common.add')}
          </Button>
        </>
      }
    >
      <form id="member-form" onSubmit={submit} className="flex flex-col gap-4">
        <Field label={t('elders.member')} hint={users.length === 0 ? t('elders.noUsersToAdd') : undefined}>
          {(id) => (
            <Select id={id} required value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">{t('common.selectPlaceholder')}</option>
              {(['caregiver', 'family', 'admin'] as const).map((role) => {
                const group = users.filter((u) => u.role === role)
                return group.length ? (
                  <optgroup key={role} label={t(`role.${role}`)}>
                    {group.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({u.email})
                      </option>
                    ))}
                  </optgroup>
                ) : null
              })}
            </Select>
          )}
        </Field>
        <Field label={t('elders.relationship')} hint={t('elders.relationshipHint')}>
          {(id) => <Input id={id} value={relationship} onChange={(e) => setRelationship(e.target.value)} />}
        </Field>
        {error && <p className="text-sm text-bad-600">{error}</p>}
      </form>
    </Modal>
  )
}

// ===========================================================================
// Plan (one day at a time)
// ===========================================================================
function PlanTab({ elderId, onChanged }: { elderId: string; onChanged: () => void }) {
  const { t, fmt } = useI18n()
  const { isStaff } = useAuth()
  const [day, setDay] = useState(() => startOfDay(new Date()))
  const [selected, setSelected] = useState<CareActivity | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CareActivity | null>(null)
  const { data, loading, reload, setData } = useQuery(() => fetchActivities({ elderId, from: day, to: endOfDay(day) }), [elderId, day])

  const refresh = () => {
    void reload()
    onChanged()
  }

  const list = data ?? []
  const done = list.filter((a) => a.status === 'done').length

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setDay((d) => addDays(d, -1))} aria-label={t('common.prev')}>
            <ChevronLeft size={18} />
          </Button>
          <div className="min-w-44 text-center">
            <p className="font-semibold capitalize">{fmt(day, 'EEEE, d MMMM')}</p>
            <p className="tabular text-sm text-ink-faint">{list.length ? t('dashboard.elderProgress', { done, total: list.length }) : t('activity.noneForDay')}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setDay((d) => addDays(d, 1))} aria-label={t('common.next')}>
            <ChevronRight size={18} />
          </Button>
          {!isToday(day) && (
            <Button variant="secondary" size="sm" onClick={() => setDay(startOfDay(new Date()))}>
              {t('common.today')}
            </Button>
          )}
        </div>
        {isStaff ? (
          <Button icon={<Plus size={17} />} onClick={() => setFormOpen(true)}>
            {t('activity.add')}
          </Button>
        ) : (
          <Badge>{t('activity.readOnly')}</Badge>
        )}
      </div>
      {loading ? (
        <Spinner />
      ) : list.length === 0 ? (
        <EmptyState icon={<ClipboardList size={32} />} title={t('activity.noneForDay')} />
      ) : (
        <ul className="divide-y divide-line/70 border-t border-line/70 pb-2">
          {list.map((a) => (
            <ActivityRow key={a.id} activity={a} onOpen={setSelected} onChanged={(u) => { setData(list.map((x) => (x.id === u.id ? u : x))); onChanged() }} />
          ))}
        </ul>
      )}

      <ActivityDetailModal activity={selected} onClose={() => setSelected(null)} onChanged={(u) => { setData(list.map((x) => (x.id === u.id ? u : x))); onChanged() }} onDeleted={refresh} onEdit={(a) => { setSelected(null); setEditing(a) }} />
      <ActivityFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={refresh} elderId={elderId} defaultDate={day} />
      <ActivityFormModal open={Boolean(editing)} activity={editing} onClose={() => setEditing(null)} onSaved={refresh} elderId={elderId} />
    </Card>
  )
}

// ===========================================================================
// Journal: observations + completed / missed activities as one timeline
// ===========================================================================
type JournalFilter = 'all' | 'observations' | 'activities' | 'alerts'
type Entry = { kind: 'obs'; at: string; o: Observation } | { kind: 'act'; at: string; a: CareActivity }

function JournalTab({ elderId }: { elderId: string }) {
  const { t, fmt } = useI18n()
  const [filter, setFilter] = useState<JournalFilter>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [days, setDays] = useState(14)

  const load = useCallback(async () => {
    const since = subDays(startOfDay(new Date()), days)
    const [obs, acts] = await Promise.all([fetchObservations({ elderId, since, limit: 500 }), fetchActivities({ elderId, from: since, to: new Date() })])
    return { obs, acts: acts.filter((a) => a.status === 'done' || a.status === 'missed') }
  }, [elderId, days])
  const { data, loading, reload } = useQuery(load, [load])

  const groups = useMemo(() => {
    const entries: Entry[] = []
    if (filter !== 'activities') for (const o of data?.obs ?? []) if (filter !== 'alerts' || o.is_alert) entries.push({ kind: 'obs', at: o.observed_at, o })
    if (filter === 'all' || filter === 'activities') for (const a of data?.acts ?? []) entries.push({ kind: 'act', at: a.completed_at ?? a.scheduled_at, a })
    entries.sort((x, y) => +new Date(y.at) - +new Date(x.at))
    const out: { day: Date; items: Entry[] }[] = []
    for (const e of entries) {
      const d = startOfDay(new Date(e.at))
      const last = out[out.length - 1]
      if (last && isSameDay(last.day, d)) last.items.push(e)
      else out.push({ day: d, items: [e] })
    }
    return out
  }, [data, filter])

  const filters: JournalFilter[] = ['all', 'observations', 'activities', 'alerts']

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cn('rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors', filter === f ? 'border-brand-700 bg-brand-700 text-white' : 'border-line bg-white text-ink-soft hover:bg-surface')}
            >
              {t(`journal.filter.${f}`)}
            </button>
          ))}
        </div>
        <Button icon={<Plus size={17} />} onClick={() => setFormOpen(true)}>
          {t('obs.add')}
        </Button>
      </div>

      {loading ? (
        <Spinner />
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState icon={<NotebookPen size={32} />} title={t('journal.empty')} text={t('journal.emptyHint')} />
        </Card>
      ) : (
        <ol className="flex flex-col gap-8">
          {groups.map((g) => (
            <li key={g.day.toISOString()}>
              <h3 className="eyebrow mb-3 text-ink-faint">{isToday(g.day) ? t('common.today') : fmt(g.day, 'EEEE, d MMMM')}</h3>
              <ol className="relative flex flex-col gap-3 border-l-2 border-line pl-6">
                {g.items.map((e) => (
                  <li key={e.kind + (e.kind === 'obs' ? e.o.id : e.a.id)} className="relative">
                    <span
                      className={cn(
                        'absolute top-4 -left-[31px] h-3 w-3 rounded-full ring-4 ring-surface',
                        e.kind === 'obs' ? (e.o.is_alert ? 'bg-bad-600' : 'bg-brand-500') : e.a.status === 'done' ? 'bg-ok-600' : 'bg-warn-600',
                      )}
                      aria-hidden
                    />
                    {e.kind === 'obs' ? <ObservationCard o={e.o} /> : <JournalActivity a={e.a} />}
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      )}

      {!loading && (
        <div className="mt-6 text-center">
          <Button variant="ghost" onClick={() => setDays((d) => d + 30)}>
            {t('journal.loadMore')}
          </Button>
        </div>
      )}

      <ObservationFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={() => void reload()} elderId={elderId} />
    </>
  )
}

function JournalActivity({ a }: { a: CareActivity }) {
  const { t, fmt } = useI18n()
  const Icon = CATEGORY_ICON[a.category]
  const done = a.status === 'done'
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-line/70 bg-white px-4 py-3 shadow-card">
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', done ? 'bg-ok-50 text-ok-600' : 'bg-warn-50 text-warn-600')}>
        {done ? <Check size={18} aria-hidden /> : <Icon size={18} aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{a.title}</p>
        <p className="text-sm text-ink-faint">
          {done
            ? t('activity.completedBy', { name: a.completer?.full_name ?? t('common.unknownUser'), time: fmt(a.completed_at ?? a.scheduled_at, 'HH:mm') })
            : `${t('status.missed')} · ${t('activity.plannedAt', { time: fmt(a.scheduled_at, 'HH:mm') })}`}
        </p>
        {a.completion_notes && <p className="mt-1.5 text-[0.95rem] text-ink-soft">{a.completion_notes}</p>}
      </div>
      <Badge tone={done ? 'ok' : 'warn'}>{t(`category.${a.category}`)}</Badge>
    </div>
  )
}

// ===========================================================================
// Events
// ===========================================================================
function EventsTab({ elderId }: { elderId: string }) {
  const { t } = useI18n()
  const [formOpen, setFormOpen] = useState(false)
  const { data, loading, reload } = useQuery(() => fetchEvents({ elderId, ascending: false, limit: 100 }), [elderId])
  const now = new Date()
  const upcoming = (data ?? []).filter((e) => new Date(e.starts_at) >= now).reverse()
  const past = (data ?? []).filter((e) => new Date(e.starts_at) < now)

  return (
    <>
      <div className="mb-5 flex justify-end">
        <Button icon={<Plus size={17} />} onClick={() => setFormOpen(true)}>
          {t('event.add')}
        </Button>
      </div>
      {loading ? (
        <Spinner />
      ) : (data ?? []).length === 0 ? (
        <Card>
          <EmptyState icon={<CalendarDays size={32} />} title={t('event.empty')} />
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          <EventSection title={t('event.upcoming')} events={upcoming} onDeleted={reload} />
          <EventSection title={t('event.past')} events={past} onDeleted={reload} />
        </div>
      )}
      <EventFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={() => void reload()} elderId={elderId} />
    </>
  )
}
