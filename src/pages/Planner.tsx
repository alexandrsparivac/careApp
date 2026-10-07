import { useMemo, useState } from 'react'
import { Card as AntCard, Flex, Space, Switch, Typography } from 'antd'
import { addDays, addWeeks, endOfWeek, isSameDay, isToday, startOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { fetchActivities, fetchElders, useQuery } from '../lib/api'
import type { CareActivity } from '../lib/types'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import { ActivityDetailModal, ActivityFormModal, CATEGORY_ICON, DAY_PART_BAR, dayPart, isOverdue } from '../components/activities'
import { Button, PageHeader, Ring, Select, Spinner, cn } from '../components/ui'

const CHIP: Record<string, string> = {
  done: 'bg-ok-50 text-ok-700 border-ok-600/20',
  missed: 'bg-bad-50 text-bad-700 border-bad-600/20',
  cancelled: 'bg-surface text-ink-faint border-line line-through',
  overdue: 'bg-warn-50 text-warn-700 border-warn-600/25',
  planned: 'bg-white text-ink border-line hover:border-brand-300',
}

export function PlannerPage() {
  const { t, fmt } = useI18n()
  const { profile, isStaff } = useAuth()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [elderId, setElderId] = useState('')
  const [onlyMine, setOnlyMine] = useState(false)
  const [selected, setSelected] = useState<CareActivity | null>(null)
  const [editing, setEditing] = useState<CareActivity | null>(null)
  const [createFor, setCreateFor] = useState<Date | null>(null)

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
  const elders = useQuery(fetchElders, [])
  const { data, loading, reload, setData } = useQuery(() => fetchActivities({ from: weekStart, to: addDays(weekStart, 7), elderId: elderId || undefined, assignedTo: onlyMine ? profile?.id : undefined }), [weekStart, elderId, onlyMine, profile?.id])

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const byDay = useMemo(() => days.map((d) => (data ?? []).filter((a) => isSameDay(new Date(a.scheduled_at), d))), [days, data])
  const replace = (a: CareActivity) => setData((all) => all?.map((x) => (x.id === a.id ? a : x)) ?? null)

  return (
    <>
      <PageHeader
        eyebrow={t('planner.eyebrow')}
        title={t('planner.title')}
        subtitle={t('planner.subtitle')}
        actions={
          isStaff && (
            <Button icon={<Plus size={18} />} onClick={() => setCreateFor(isToday(weekStart) || weekStart < new Date() ? new Date() : weekStart)}>
              {t('activity.add')}
            </Button>
          )
        }
      />

      <Space wrap size={12} style={{ marginBottom: 20 }}>
        <AntCard size="small" style={{ borderRadius: 12 }} styles={{ body: { padding: '4px 6px', display: 'flex', alignItems: 'center', gap: 4 } }}>
          <Button variant="ghost" size="sm" onClick={() => setWeekStart((w) => addWeeks(w, -1))} aria-label={t('common.prev')}>
            <ChevronLeft size={18} />
          </Button>
          <Typography.Text strong style={{ minWidth: 190, textAlign: 'center' }} className="tabular">
            {fmt(weekStart, 'd MMM')} – {fmt(weekEnd, 'd MMM yyyy')}
          </Typography.Text>
          <Button variant="ghost" size="sm" onClick={() => setWeekStart((w) => addWeeks(w, 1))} aria-label={t('common.next')}>
            <ChevronRight size={18} />
          </Button>
        </AntCard>
        <Button variant="secondary" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
          {t('planner.thisWeek')}
        </Button>
        <Select value={elderId} onChange={(e) => setElderId(e.target.value)} className="w-auto min-w-52" aria-label={t('planner.filterElder')}>
          <option value="">{t('planner.allElders')}</option>
          {(elders.data ?? []).map((e) => (
            <option key={e.id} value={e.id}>
              {e.full_name}
            </option>
          ))}
        </Select>
        {profile?.role !== 'family' && (
          <Flex align="center" gap={8}>
            <Switch size="small" checked={onlyMine} onChange={setOnlyMine} />
            <Typography.Text type="secondary" style={{ fontSize: 14 }}>{t('dashboard.onlyMine')}</Typography.Text>
          </Flex>
        )}
      </Space>

      {loading && !data ? (
        <Spinner />
      ) : (
        <div className="grid gap-3 md:grid-cols-7 md:gap-2">
          {days.map((d, i) => {
            const list = byDay[i]
            const active = list.filter((a) => a.status !== 'cancelled')
            const done = active.filter((a) => a.status === 'done').length
            const today = isToday(d)
            return (
              <AntCard
                key={d.toISOString()}
                size="small"
                style={{
                  minHeight: 160,
                  borderRadius: 16,
                  borderColor: today ? '#e9a23b' : undefined,
                  background: today ? '#fdf4e4' : undefined,
                }}
                styles={{ body: { padding: 8 } }}
              >
                <header className="mb-2 flex items-center justify-between gap-1 px-1 pt-0.5">
                  <div>
                    <p className={cn('eyebrow text-[0.65rem]', today ? 'text-sun-600' : 'text-ink-faint')}>{fmt(d, 'EEE')}</p>
                    <p className="font-display text-xl leading-tight font-bold">{fmt(d, 'd')}</p>
                  </div>
                  {active.length > 0 && (
                    <Ring value={done / active.length} size={30} stroke={3}>
                      <span className="tabular text-[0.6rem] font-bold text-ink-soft">{active.length}</span>
                    </Ring>
                  )}
                </header>
                <ul className="flex flex-1 flex-col gap-1.5">
                  {list.map((a) => {
                    const Icon = CATEGORY_ICON[a.category]
                    const state = isOverdue(a) ? 'overdue' : a.status
                    return (
                      <li key={a.id}>
                        <button type="button" onClick={() => setSelected(a)} className={cn('flex w-full gap-1.5 rounded-lg border p-1.5 text-left text-xs transition-colors', CHIP[state])}>
                          <span className={cn('w-0.5 shrink-0 self-stretch rounded-full', DAY_PART_BAR[dayPart(a.scheduled_at)])} aria-hidden />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1 font-semibold">
                              <span className="tabular">{fmt(a.scheduled_at, 'HH:mm')}</span>
                              <Icon size={11} className="shrink-0 opacity-70" aria-hidden />
                            </span>
                            <span className="line-clamp-2 leading-snug">{a.title}</span>
                            {!elderId && a.elder && <span className="mt-0.5 block truncate opacity-70">{a.elder.full_name}</span>}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
                {isStaff && (
                  <button type="button" onClick={() => setCreateFor(d)} className="mt-2 flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-medium text-ink-faint hover:bg-white hover:text-brand-600" aria-label={`${t('activity.add')} — ${fmt(d, 'EEEE d MMMM')}`}>
                    <Plus size={13} /> {t('common.add')}
                  </button>
                )}
              </AntCard>
            )
          })}
        </div>
      )}

      <ActivityDetailModal activity={selected} onClose={() => setSelected(null)} onChanged={replace} onDeleted={() => void reload()} onEdit={(a) => { setSelected(null); setEditing(a) }} />
      <ActivityFormModal open={Boolean(createFor)} onClose={() => setCreateFor(null)} onSaved={() => void reload()} elderId={elderId || undefined} defaultDate={createFor ?? undefined} />
      <ActivityFormModal open={Boolean(editing)} activity={editing} onClose={() => setEditing(null)} onSaved={() => void reload()} />
    </>
  )
}
