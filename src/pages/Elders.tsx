import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { differenceInYears, endOfDay, startOfDay } from 'date-fns'
import { HeartHandshake, Plus, Search, TriangleAlert, Users } from 'lucide-react'
import { fetchActivities, fetchElders, useQuery } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import { ElderFormModal } from '../components/ElderForm'
import { Avatar, Button, Card, EmptyState, Input, PageHeader, Ring, Spinner } from '../components/ui'

export function age(birth: string | null) {
  return birth ? differenceInYears(new Date(), new Date(birth)) : null
}

export function EldersPage() {
  const { isAdmin } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(params.get('new') === '1')

  const { data, loading, error } = useQuery(async () => {
    const now = new Date()
    const [elders, today] = await Promise.all([fetchElders(), fetchActivities({ from: startOfDay(now), to: endOfDay(now) })])
    return { elders, today }
  }, [])

  useEffect(() => {
    if (params.get('new') === '1') setParams({}, { replace: true })
  }, [params, setParams])

  const progress = useMemo(() => {
    const m = new Map<string, { done: number; total: number }>()
    for (const a of data?.today ?? []) {
      if (a.status === 'cancelled') continue
      const s = m.get(a.elder_id) ?? { done: 0, total: 0 }
      s.total++
      if (a.status === 'done') s.done++
      m.set(a.elder_id, s)
    }
    return m
  }, [data])

  const elders = (data?.elders ?? []).filter((e) => e.full_name.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <>
      <PageHeader
        eyebrow={t('elders.eyebrow')}
        title={t('elders.title')}
        subtitle={t('elders.subtitle')}
        actions={
          isAdmin && (
            <Button icon={<Plus size={18} />} onClick={() => setFormOpen(true)}>
              {t('elders.add')}
            </Button>
          )
        }
      />

      {(data?.elders.length ?? 0) > 4 && (
        <div className="relative mb-5 max-w-sm">
          <Search size={17} className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('common.search')} className="pl-9" aria-label={t('common.search')} />
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : error ? (
        <EmptyState icon={<TriangleAlert size={32} />} title={t('common.error')} text={error} />
      ) : elders.length === 0 ? (
        <Card>
          <EmptyState icon={<HeartHandshake size={40} />} title={t('elders.empty')} text={isAdmin ? t('dashboard.noEldersAdminText') : t('dashboard.noEldersText')} />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {elders.map((el, i) => {
            const s = progress.get(el.id)
            const years = age(el.birth_date)
            return (
              <li key={el.id} className="animate-rise" style={{ animationDelay: `${i * 40}ms` }}>
                <Link to={`/elders/${el.id}`} className="group flex h-full flex-col rounded-2xl border border-line/70 bg-white p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-float">
                  <div className="flex items-center gap-4">
                    <Ring value={s ? s.done / s.total : null} size={68} stroke={4}>
                      <Avatar name={el.full_name} size={54} />
                    </Ring>
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-semibold tracking-tight group-hover:text-brand-700">{el.full_name}</h2>
                      <p className="text-sm text-ink-faint">
                        {[years !== null && t('elders.age', { n: years }), el.gender && t(`gender.${el.gender}`)].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>
                  {el.medical_conditions && <p className="mt-4 line-clamp-2 text-sm text-ink-soft">{el.medical_conditions}</p>}
                  <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-sm">
                    <span className="tabular font-medium text-ink-soft">{s ? t('dashboard.elderProgress', { done: s.done, total: s.total }) : t('dashboard.elderNoPlan')}</span>
                    <span className="inline-flex items-center gap-1 text-ink-faint">
                      <Users size={14} aria-hidden /> {el.elder_members[0]?.count ?? 0}
                    </span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <ElderFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={(id) => navigate(`/elders/${id}`)} />
    </>
  )
}
