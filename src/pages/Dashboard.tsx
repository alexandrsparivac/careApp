import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { addDays, endOfDay, startOfDay, subDays } from 'date-fns'
import { ArrowRight, CalendarDays, CheckCheck, Clock, HeartHandshake, NotebookPen, Sparkles, TriangleAlert } from 'lucide-react'
import { fetchActivities, fetchElders, fetchEvents, fetchObservations, errorMessage } from '../lib/api'
import { supabase } from '../lib/supabase'
import { createDemoData } from '../lib/demo'
import type { CareActivity, CareEvent, Elder, Observation } from '../lib/types'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useI18n } from '../i18n'
import { ActivityDetailModal, ActivityFormModal, ActivityRow, CATEGORY_ICON, isOverdue } from '../components/activities'
import { DayArc, DayArcLegend } from '../components/DayArc'
import { EVENT_ICON, IMPORTANCE_TONE } from '../components/events'
import { ObservationCard } from '../components/observations'
import { Avatar, Badge, Button, Card, CardHeader, cn, EmptyState, Ring, Spinner } from '../components/ui'

type ElderWithCount = Elder & { elder_members: { count: number }[] }

interface DashboardData {
  elders: ElderWithCount[]
  today: CareActivity[]
  week: CareActivity[]
  observations: Observation[]
  events: CareEvent[]
}

export function DashboardPage() {
  const { profile, isStaff, isAdmin } = useAuth()
  const { t, fmt } = useI18n()
  const toast = useToast()
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [onlyMine, setOnlyMine] = useState(profile?.role === 'caregiver')
  const [selected, setSelected] = useState<CareActivity | null>(null)
  const [editing, setEditing] = useState<CareActivity | null>(null)
  const [demoBusy, setDemoBusy] = useState(false)

  const load = async () => {
    try {
      const now = new Date()
      const [elders, today, week, observations, events] = await Promise.all([
        fetchElders(),
        fetchActivities({ from: startOfDay(now), to: endOfDay(now) }),
        fetchActivities({ from: startOfDay(subDays(now, 6)), to: now }),
        fetchObservations({ limit: 40, since: subDays(now, 7) }),
        fetchEvents({ from: now, to: addDays(now, 14), limit: 6 }),
      ])
      setData({ elders, today, week, observations, events })
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  useEffect(() => {
    void load()
    // Live updates: when anyone changes an activity, refresh the plan.
    let timer: ReturnType<typeof setTimeout>
    const channel = supabase
      .channel('dashboard-activities')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'care_activities' }, () => {
        clearTimeout(timer)
        timer = setTimeout(() => void load(), 400)
      })
      .subscribe()
    return () => {
      clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [])

  const today = useMemo(() => (data?.today ?? []).filter((a) => !onlyMine || a.assigned_to === profile?.id), [data, onlyMine, profile])

  const stats = useMemo(() => {
    if (!data) return null
    const relevant = today.filter((a) => a.status !== 'cancelled')
    const done = relevant.filter((a) => a.status === 'done').length
    const weekDue = data.week.filter((a) => a.status !== 'cancelled' && (a.status !== 'planned' || isOverdue(a)))
    const weekDone = weekDue.filter((a) => a.status === 'done').length
    return {
      done,
      total: relevant.length,
      overdue: data.today.filter((a) => isOverdue(a)).length,
      completion: weekDue.length ? Math.round((weekDone / weekDue.length) * 100) : null,
      alerts: data.observations.filter((o) => o.is_alert).length,
      upcoming: data.events.length,
      next: relevant.find((a) => a.status === 'planned' && !isOverdue(a)),
    }
  }, [data, today])

  const perElderToday = useMemo(() => {
    const map = new Map<string, { done: number; total: number }>()
    for (const a of data?.today ?? []) {
      if (a.status === 'cancelled') continue
      const s = map.get(a.elder_id) ?? { done: 0, total: 0 }
      s.total++
      if (a.status === 'done') s.done++
      map.set(a.elder_id, s)
    }
    return map
  }, [data])

  const replaceActivity = (a: CareActivity) => setData((d) => d && { ...d, today: d.today.map((x) => (x.id === a.id ? a : x)) })

  const seedDemo = async () => {
    if (!profile) return
    setDemoBusy(true)
    try {
      await createDemoData(t, profile.id)
      toast({ tone: 'success', title: t('admin.demoDone') })
      await load()
    } catch (e) {
      toast({ tone: 'error', title: t('common.error'), body: errorMessage(e) })
    } finally {
      setDemoBusy(false)
    }
  }

  if (error) return <EmptyState icon={<TriangleAlert size={32} />} title={t('common.error')} text={error} action={<Button onClick={() => void load()}>{t('common.retry')}</Button>} />
  if (!data || !stats || !profile) return <Spinner />

  const hour = new Date().getHours()
  const greeting = hour < 12 ? t('dashboard.greetingMorning') : hour < 18 ? t('dashboard.greetingDay') : t('dashboard.greetingEvening')
  const firstName = profile.full_name.split(' ')[0] || profile.full_name

  if (data.elders.length === 0) {
    return (
      <div className="animate-rise">
        <p className="eyebrow text-brand-500">{fmt(new Date(), 'EEEE, d MMMM')}</p>
        <h1 className="mt-1.5 text-[1.9rem] font-bold tracking-tight">{`${greeting}, ${firstName}`}</h1>
        <Card className="mt-8">
          <EmptyState
            icon={<HeartHandshake size={40} />}
            title={isAdmin ? t('dashboard.noEldersAdmin') : t('dashboard.noElders')}
            text={isAdmin ? t('dashboard.noEldersAdminText') : t('dashboard.noEldersText')}
            action={
              isAdmin && (
                <div className="flex flex-wrap justify-center gap-2">
                  <Link to="/elders?new=1">
                    <Button>{t('elders.add')}</Button>
                  </Link>
                  <Button variant="secondary" icon={<Sparkles size={16} />} loading={demoBusy} onClick={seedDemo}>
                    {t('admin.demo')}
                  </Button>
                </div>
              )
            }
          />
        </Card>
      </div>
    )
  }

  const NextIcon = stats.next ? CATEGORY_ICON[stats.next.category] : null

  return (
    <div className="flex flex-col gap-6">
      {/* ---------------------------------------------------------------- Hero: the day */}
      <section className="animate-rise relative overflow-hidden rounded-3xl bg-brand-900 text-white shadow-float">
        <div className="grid gap-4 p-6 sm:p-8 lg:grid-cols-[1fr_1.25fr] lg:items-center">
          <div className="flex flex-col gap-5">
            <div>
              <p className="eyebrow text-sun-500">{fmt(new Date(), 'EEEE, d MMMM')}</p>
              <h1 className="mt-2 text-[2rem] leading-tight font-bold tracking-tight">{`${greeting}, ${firstName}`}</h1>
              <p className="mt-2 max-w-[42ch] text-brand-100/80">
                {stats.total === 0
                  ? t('dashboard.summaryEmpty')
                  : t('dashboard.summary', { total: stats.total, done: stats.done, left: stats.total - stats.done })}
              </p>
            </div>

            {stats.next && NextIcon && (
              <button type="button" onClick={() => setSelected(stats.next!)} className="flex items-center gap-3 rounded-2xl bg-white/8 p-3 text-left ring-1 ring-white/10 transition-colors hover:bg-white/12">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sun-500 text-brand-950">
                  <NextIcon size={20} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="eyebrow block text-[0.65rem] text-brand-300">{t('dashboard.nextUp')}</span>
                  <span className="block truncate font-semibold">
                    <span className="tabular">{fmt(stats.next.scheduled_at, 'HH:mm')}</span> · {stats.next.title}
                  </span>
                  <span className="block truncate text-sm text-brand-200/80">{stats.next.elder?.full_name}</span>
                </span>
                <ArrowRight size={18} className="text-brand-300" aria-hidden />
              </button>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <DayArcLegend labels={{ done: t('status.done'), planned: t('status.planned'), overdue: t('activity.overdue'), missed: t('status.missed'), now: t('dashboard.now') }} />
            </div>
            {profile.role !== 'family' && (
              <label className="flex w-fit cursor-pointer items-center gap-2.5 text-sm text-brand-100">
                <span className={cn('relative h-6 w-10 rounded-full transition-colors', onlyMine ? 'bg-sun-500' : 'bg-white/15')}>
                  <input type="checkbox" className="peer sr-only" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
                  <span className={cn('absolute top-1 h-4 w-4 rounded-full bg-white transition-all', onlyMine ? 'left-5' : 'left-1')} />
                </span>
                {t('dashboard.onlyMine')}
              </label>
            )}
          </div>

          <DayArc
            activities={today}
            onSelect={setSelected}
            ariaLabel={t('dashboard.arcLabel', { done: stats.done, total: stats.total })}
            center={
              <>
                <p className="font-display text-5xl leading-none font-bold tracking-tight sm:text-6xl">
                  {stats.done}
                  <span className="text-brand-300">/{stats.total}</span>
                </p>
                <p className="mt-2 text-sm text-brand-200">{t('dashboard.doneToday')}</p>
              </>
            }
          />
        </div>
      </section>

      {/* ---------------------------------------------------------------- KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={<CheckCheck size={18} />} label={t('dashboard.statCompletion')} value={stats.completion === null ? '—' : `${stats.completion}%`} hint={t('dashboard.last7days')} tone="ok" />
        <Kpi icon={<Clock size={18} />} label={t('dashboard.statOverdue')} value={stats.overdue} hint={t('dashboard.rightNow')} tone={stats.overdue ? 'warn' : 'neutral'} />
        <Kpi icon={<TriangleAlert size={18} />} label={t('dashboard.statAlerts')} value={stats.alerts} hint={t('dashboard.last7days')} tone={stats.alerts ? 'bad' : 'neutral'} />
        <Kpi icon={<CalendarDays size={18} />} label={t('dashboard.statUpcoming')} value={stats.upcoming} hint={t('dashboard.next14days')} tone="plan" />
      </div>

      {/* ---------------------------------------------------------------- Plan + side column */}
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader
            title={t('dashboard.todayPlan')}
            subtitle={fmt(new Date(), 'EEEE, d MMMM')}
            action={
              isStaff && (
                <Link to="/planner" className="text-sm font-semibold text-brand-600 hover:underline">
                  {t('nav.planner')} →
                </Link>
              )
            }
          />
          {today.length === 0 ? (
            <EmptyState title={t('dashboard.noActivitiesToday')} />
          ) : (
            <ul className="divide-y divide-line/70 pb-2">
              {today.map((a) => (
                <ActivityRow key={a.id} activity={a} showElder onOpen={setSelected} onChanged={replaceActivity} />
              ))}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title={t('nav.elders')} action={<Link to="/elders" className="text-sm font-semibold text-brand-600 hover:underline">{t('common.viewAll')}</Link>} />
            <ul className="flex flex-col px-3 pb-3">
              {data.elders.slice(0, 5).map((el) => {
                const s = perElderToday.get(el.id)
                return (
                  <li key={el.id}>
                    <Link to={`/elders/${el.id}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-surface">
                      <Ring value={s ? s.done / s.total : null} size={48} stroke={3.5}>
                        <Avatar name={el.full_name} size={38} />
                      </Ring>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{el.full_name}</p>
                        <p className="tabular text-sm text-ink-faint">{s ? t('dashboard.elderProgress', { done: s.done, total: s.total }) : t('dashboard.elderNoPlan')}</p>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader title={t('dashboard.upcomingEvents')} action={<Link to="/events" className="text-sm font-semibold text-brand-600 hover:underline">{t('common.viewAll')}</Link>} />
            {data.events.length === 0 ? (
              <EmptyState title={t('dashboard.noEvents')} />
            ) : (
              <ul className="flex flex-col gap-1 px-3 pb-3">
                {data.events.map((ev) => {
                  const Icon = EVENT_ICON[ev.type]
                  return (
                    <li key={ev.id}>
                      <Link to={`/events?focus=${ev.id}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-surface">
                        <span className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-brand-50 py-1 text-brand-700">
                          <span className="text-[0.6rem] font-semibold uppercase">{fmt(ev.starts_at, 'MMM')}</span>
                          <span className="font-display text-lg leading-none font-bold">{fmt(ev.starts_at, 'd')}</span>
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{ev.title}</p>
                          <p className="flex items-center gap-1.5 truncate text-sm text-ink-faint">
                            <Icon size={13} aria-hidden /> {fmt(ev.starts_at, 'HH:mm')} · {ev.elder?.full_name}
                          </p>
                        </div>
                        {ev.importance !== 'normal' && ev.importance !== 'low' && <Badge tone={IMPORTANCE_TONE[ev.importance]}>{t(`importance.${ev.importance}`)}</Badge>}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* ---------------------------------------------------------------- Observations */}
      <section>
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <NotebookPen size={17} aria-hidden />
          </span>
          <h2 className="text-lg font-semibold tracking-tight">{t('dashboard.recentObservations')}</h2>
        </div>
        {data.observations.length === 0 ? (
          <Card>
            <EmptyState title={t('dashboard.noObservations')} />
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {data.observations.slice(0, 4).map((o) => (
              <ObservationCard key={o.id} o={o} showElder />
            ))}
          </div>
        )}
      </section>

      <ActivityDetailModal activity={selected} onClose={() => setSelected(null)} onChanged={replaceActivity} onDeleted={() => void load()} onEdit={(a) => { setSelected(null); setEditing(a) }} />
      <ActivityFormModal open={Boolean(editing)} activity={editing} onClose={() => setEditing(null)} onSaved={() => void load()} />
    </div>
  )
}

function Kpi({ icon, label, value, hint, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; hint: string; tone: 'ok' | 'warn' | 'bad' | 'plan' | 'neutral' }) {
  const toneCls = { ok: 'bg-ok-50 text-ok-600', warn: 'bg-warn-50 text-warn-600', bad: 'bg-bad-50 text-bad-600', plan: 'bg-plan-50 text-plan-600', neutral: 'bg-surface-2 text-ink-faint' }[tone]
  return (
    <Card className="animate-rise p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink-soft">{label}</p>
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', toneCls)}>{icon}</span>
      </div>
      <p className="font-display tabular mt-3 text-3xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-ink-faint">{hint}</p>
    </Card>
  )
}
