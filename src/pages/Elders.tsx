import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Col, Flex, Input as AntInput, Row, Typography } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { differenceInYears, endOfDay, startOfDay } from 'date-fns'
import { HeartHandshake, Plus, TriangleAlert, Users } from 'lucide-react'
import { fetchActivities, fetchElders, useQuery } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import { ElderFormModal } from '../components/ElderForm'
import { Avatar, Button, Card, EmptyState, PageHeader, Ring, Spinner } from '../components/ui'

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
        <div className="mb-5 max-w-sm">
          <AntInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('common.search')} prefix={<SearchOutlined style={{ color: '#74868c' }} />} allowClear size="large" aria-label={t('common.search')} />
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
        <Row gutter={[16, 16]}>
          {elders.map((el, i) => {
            const s = progress.get(el.id)
            const years = age(el.birth_date)
            return (
              <Col key={el.id} xs={24} sm={12} xl={8} className="animate-rise" style={{ animationDelay: `${i * 40}ms` }}>
                <Link to={`/elders/${el.id}`} className="group block h-full">
                  <Card hoverable className="h-full transition-all group-hover:-translate-y-0.5">
                    <div className="p-5">
                      <Flex align="center" gap={16}>
                        <Ring value={s ? s.done / s.total : null} size={68} stroke={4}>
                          <Avatar name={el.full_name} size={54} />
                        </Ring>
                        <div className="min-w-0">
                          <Typography.Title level={4} style={{ margin: 0 }} className="truncate group-hover:!text-[#1c5e6b]">
                            {el.full_name}
                          </Typography.Title>
                          <Typography.Text type="secondary" style={{ fontSize: 14 }}>
                            {[years !== null && t('elders.age', { n: years }), el.gender && t(`gender.${el.gender}`)].filter(Boolean).join(' · ')}
                          </Typography.Text>
                        </div>
                      </Flex>
                      {el.medical_conditions && <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ margin: '16px 0 0', fontSize: 14 }}>{el.medical_conditions}</Typography.Paragraph>}
                      <Flex justify="space-between" align="center" style={{ marginTop: 16 }}>
                        <Typography.Text strong style={{ fontSize: 13, color: '#485a61' }} className="tabular">
                          {s ? t('dashboard.elderProgress', { done: s.done, total: s.total }) : t('dashboard.elderNoPlan')}
                        </Typography.Text>
                        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                          <Users size={14} aria-hidden style={{ verticalAlign: -2 }} /> {el.elder_members[0]?.count ?? 0}
                        </Typography.Text>
                      </Flex>
                    </div>
                  </Card>
                </Link>
              </Col>
            )
          })}
        </Row>
      )}

      <ElderFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={(id) => navigate(`/elders/${id}`)} />
    </>
  )
}
