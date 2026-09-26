import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarDays, Plus } from 'lucide-react'
import { fetchElders, fetchEvents, useQuery } from '../lib/api'
import { EVENT_TYPES, IMPORTANCE_LEVELS, type EventType, type Importance } from '../lib/types'
import { useI18n } from '../i18n'
import { EventFormModal, EventSection } from '../components/events'
import { Button, Card, EmptyState, PageHeader, Select, Spinner } from '../components/ui'

export function EventsPage() {
  const { t } = useI18n()
  const [params] = useSearchParams()
  const focus = params.get('focus')
  const [elderId, setElderId] = useState('')
  const [type, setType] = useState<EventType | ''>('')
  const [importance, setImportance] = useState<Importance | ''>('')
  const [formOpen, setFormOpen] = useState(false)

  const elders = useQuery(fetchElders, [])
  const { data, loading, reload } = useQuery(() => fetchEvents({ elderId: elderId || undefined, ascending: false, limit: 300 }), [elderId])

  useEffect(() => {
    if (focus && data) document.getElementById(`event-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focus, data])

  const filtered = (data ?? []).filter((e) => (!type || e.type === type) && (!importance || e.importance === importance))
  const now = new Date()
  const upcoming = filtered.filter((e) => new Date(e.starts_at) >= now).reverse()
  const past = filtered.filter((e) => new Date(e.starts_at) < now)

  return (
    <>
      <PageHeader
        eyebrow={t('event.eyebrow')}
        title={t('event.title')}
        subtitle={t('event.subtitle')}
        actions={
          <Button icon={<Plus size={18} />} onClick={() => setFormOpen(true)}>
            {t('event.add')}
          </Button>
        }
      />
      <div className="mb-6 flex flex-wrap gap-3">
        <Select value={elderId} onChange={(e) => setElderId(e.target.value)} className="w-auto min-w-52" aria-label={t('planner.filterElder')}>
          <option value="">{t('planner.allElders')}</option>
          {(elders.data ?? []).map((e) => (
            <option key={e.id} value={e.id}>
              {e.full_name}
            </option>
          ))}
        </Select>
        <Select value={type} onChange={(e) => setType(e.target.value as EventType | '')} className="w-auto" aria-label={t('event.type')}>
          <option value="">{t('event.allTypes')}</option>
          {EVENT_TYPES.map((x) => (
            <option key={x} value={x}>
              {t(`eventType.${x}`)}
            </option>
          ))}
        </Select>
        <Select value={importance} onChange={(e) => setImportance(e.target.value as Importance | '')} className="w-auto" aria-label={t('event.importance')}>
          <option value="">{t('event.anyImportance')}</option>
          {IMPORTANCE_LEVELS.map((x) => (
            <option key={x} value={x}>
              {t(`importance.${x}`)}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState icon={<CalendarDays size={36} />} title={t('event.empty')} />
        </Card>
      ) : (
        <div className="flex flex-col gap-10">
          <EventSection title={t('event.upcoming')} events={upcoming} onDeleted={() => void reload()} showElder focus={focus} />
          <EventSection title={t('event.past')} events={past} onDeleted={() => void reload()} showElder focus={focus} />
        </div>
      )}

      <EventFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={() => void reload()} elderId={elderId || undefined} />
    </>
  )
}
