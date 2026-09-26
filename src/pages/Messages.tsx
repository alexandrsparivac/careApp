import { useEffect, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MessagesSquare } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { fetchElders, useQuery } from '../lib/api'
import type { Message } from '../lib/types'
import { useNotifications } from '../context/NotificationsContext'
import { useI18n } from '../i18n'
import { ChatThread } from '../components/ChatThread'
import { Avatar, Card, cn, EmptyState, PageHeader, Spinner } from '../components/ui'

export function MessagesPage() {
  const { elderId } = useParams()
  const navigate = useNavigate()
  const { t, fmtAgo } = useI18n()
  const { items } = useNotifications()

  const { data, loading } = useQuery(async () => {
    const elders = await fetchElders()
    // Last message per thread, for the preview list
    const { data: last } = await supabase.from('messages').select('elder_id, content, created_at, sender:profiles(full_name)').order('created_at', { ascending: false }).limit(300)
    const lastBy = new Map<string, Pick<Message, 'content' | 'created_at'> & { sender: { full_name: string } | null }>()
    for (const m of (last ?? []) as unknown as (Message & { sender: { full_name: string } | null })[]) if (!lastBy.has(m.elder_id)) lastBy.set(m.elder_id, m)
    return elders
      .map((e) => ({ elder: e, last: lastBy.get(e.id) ?? null }))
      .sort((a, b) => +new Date(b.last?.created_at ?? 0) - +new Date(a.last?.created_at ?? 0))
  }, [items.filter((n) => n.type === 'new_message').length])

  const unreadBy = useMemo(() => {
    const m = new Map<string, number>()
    for (const n of items) if (n.type === 'new_message' && !n.is_read && n.elder_id) m.set(n.elder_id, Number(n.payload.count ?? 1))
    return m
  }, [items])

  // On desktop open the most recent thread automatically
  useEffect(() => {
    if (!elderId && data?.length && window.matchMedia('(min-width: 1024px)').matches) navigate(`/messages/${data[0].elder.id}`, { replace: true })
  }, [elderId, data, navigate])

  const current = data?.find((x) => x.elder.id === elderId)

  return (
    <>
      <PageHeader eyebrow={t('msg.eyebrow')} title={t('msg.title')} subtitle={t('msg.subtitle')} />
      {loading && !data ? (
        <Spinner />
      ) : !data?.length ? (
        <Card>
          <EmptyState icon={<MessagesSquare size={36} />} title={t('msg.noThreads')} text={t('dashboard.noEldersText')} />
        </Card>
      ) : (
        <Card className="grid h-[min(74vh,760px)] lg:grid-cols-[20rem_1fr]">
          <ul className={cn('overflow-y-auto border-line p-2 lg:border-r', elderId && 'hidden lg:block')}>
            {data.map(({ elder, last }) => {
              const unread = unreadBy.get(elder.id) ?? 0
              return (
                <li key={elder.id}>
                  <Link to={`/messages/${elder.id}`} className={cn('flex items-center gap-3 rounded-xl p-2.5 transition-colors', elder.id === elderId ? 'bg-brand-50' : 'hover:bg-surface')}>
                    <Avatar name={elder.full_name} size={42} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className={cn('truncate', unread ? 'font-bold' : 'font-semibold')}>{elder.full_name}</p>
                        {last && <span className="shrink-0 text-xs text-ink-faint">{fmtAgo(last.created_at)}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <p className={cn('flex-1 truncate text-sm', unread ? 'text-ink' : 'text-ink-faint')}>{last ? `${last.sender?.full_name?.split(' ')[0] ?? ''}: ${last.content}` : t('msg.noMessagesYet')}</p>
                        {unread > 0 && <span className="tabular min-w-5 rounded-full bg-sun-500 px-1.5 text-center text-xs font-bold text-brand-950">{unread}</span>}
                      </div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
          <div className={cn('flex min-h-0 flex-col', !elderId && 'hidden lg:flex')}>
            {current ? (
              <>
                <div className="flex items-center gap-3 border-b border-line px-4 py-3">
                  <Link to="/messages" className="rounded-lg p-1.5 text-ink-faint hover:bg-surface lg:hidden" aria-label={t('common.back')}>
                    <ArrowLeft size={18} />
                  </Link>
                  <Avatar name={current.elder.full_name} size={36} />
                  <div className="min-w-0">
                    <Link to={`/elders/${current.elder.id}`} className="font-semibold hover:underline">
                      {t('msg.threadFor', { name: current.elder.full_name })}
                    </Link>
                    <p className="text-xs text-ink-faint">{t('msg.threadHint')}</p>
                  </div>
                </div>
                <ChatThread key={current.elder.id} elderId={current.elder.id} className="min-h-0 flex-1" />
              </>
            ) : (
              <EmptyState icon={<MessagesSquare size={36} />} title={t('msg.selectThread')} />
            )}
          </div>
        </Card>
      )}
    </>
  )
}
