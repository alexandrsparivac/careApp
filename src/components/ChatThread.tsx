import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { isSameDay } from 'date-fns'
import { MessagesSquare, SendHorizontal } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Message } from '../lib/types'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationsContext'
import { useToast } from '../context/ToastContext'
import { useI18n } from '../i18n'
import { Avatar, cn, EmptyState, Spinner } from './ui'

const SELECT = '*, sender:profiles(full_name, role)'

export function ChatThread({ elderId, className }: { elderId: string; className?: string }) {
  const { profile } = useAuth()
  const { items, markRead } = useNotifications()
  const toast = useToast()
  const { t, fmt } = useI18n()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    supabase
      .from('messages')
      .select(SELECT)
      .eq('elder_id', elderId)
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (!alive) return
        setMessages(((data ?? []) as Message[]).reverse())
        setLoading(false)
      })

    const channel = supabase
      .channel(`messages:${elderId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `elder_id=eq.${elderId}` }, async (change) => {
        const row = change.new as Message
        // Realtime payloads carry no joins — fetch the sender once.
        const { data } = await supabase.from('messages').select(SELECT).eq('id', row.id).single()
        setMessages((all) => (all.some((m) => m.id === row.id) ? all : [...all, (data ?? row) as Message]))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `elder_id=eq.${elderId}` }, (change) => {
        setMessages((all) => all.filter((m) => m.id !== (change.old as { id: string }).id))
      })
      .subscribe()

    return () => {
      alive = false
      void supabase.removeChannel(channel)
    }
  }, [elderId])

  // Mark as read whenever the thread is open and new messages arrive
  useEffect(() => {
    if (!profile || loading) return
    void supabase.from('message_reads').upsert({ elder_id: elderId, user_id: profile.id, last_read_at: new Date().toISOString() })
  }, [messages.length, loading, elderId, profile])

  useEffect(() => {
    items.filter((n) => n.type === 'new_message' && n.elder_id === elderId && !n.is_read).forEach((n) => void markRead(n.id))
  }, [items, elderId, markRead])

  useLayoutEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight })
  }, [messages.length, loading])

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const content = text.trim()
    if (!content || !profile) return
    setSending(true)
    const { data, error } = await supabase.from('messages').insert({ elder_id: elderId, sender_id: profile.id, content }).select(SELECT).single()
    setSending(false)
    if (error) return toast({ tone: 'error', title: t('common.error'), body: error.message })
    setText('')
    setMessages((all) => (all.some((m) => m.id === data.id) ? all : [...all, data as Message]))
  }

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {loading ? (
          <Spinner />
        ) : messages.length === 0 ? (
          <EmptyState icon={<MessagesSquare size={32} />} title={t('msg.empty')} text={t('msg.emptyHint')} />
        ) : (
          <ol className="flex flex-col gap-1.5">
            {messages.map((m, i) => {
              const mine = m.sender_id === profile?.id
              const prev = messages[i - 1]
              const newDay = !prev || !isSameDay(new Date(prev.created_at), new Date(m.created_at))
              const grouped = !newDay && prev?.sender_id === m.sender_id && +new Date(m.created_at) - +new Date(prev.created_at) < 5 * 60_000
              return (
                <li key={m.id}>
                  {newDay && (
                    <div className="my-4 flex items-center gap-3 text-xs font-medium text-ink-faint">
                      <span className="h-px flex-1 bg-line" />
                      {fmt(m.created_at, 'EEEE, d MMMM')}
                      <span className="h-px flex-1 bg-line" />
                    </div>
                  )}
                  <div className={cn('flex items-end gap-2', mine && 'flex-row-reverse', !grouped && 'mt-2')}>
                    <span className="w-8 shrink-0">{!mine && !grouped && <Avatar name={m.sender?.full_name ?? '?'} size={32} />}</span>
                    <div className={cn('flex max-w-[78%] flex-col', mine ? 'items-end' : 'items-start')}>
                      {!mine && !grouped && (
                        <p className="mb-1 px-1 text-xs text-ink-faint">
                          <span className="font-semibold text-ink-soft">{m.sender?.full_name ?? t('common.unknownUser')}</span>
                          {m.sender?.role && ` · ${t(`role.${m.sender.role}`)}`}
                        </p>
                      )}
                      <div
                        className={cn(
                          'rounded-2xl px-3.5 py-2 leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]',
                          mine ? 'rounded-br-md bg-brand-700 text-white' : m.sender?.role === 'family' ? 'rounded-bl-md bg-sun-50 text-ink ring-1 ring-sun-200' : 'rounded-bl-md bg-white text-ink ring-1 ring-line',
                        )}
                      >
                        {m.content}
                        <span className={cn('tabular ml-2 inline-block translate-y-0.5 text-[0.7rem]', mine ? 'text-brand-200' : 'text-ink-faint')}>{fmt(m.created_at, 'HH:mm')}</span>
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>
      <form onSubmit={send} className="flex items-end gap-2 border-t border-line bg-white p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send()
            }
          }}
          rows={1}
          maxLength={4000}
          placeholder={t('msg.placeholder')}
          aria-label={t('msg.placeholder')}
          className="max-h-40 min-h-11 flex-1 resize-none rounded-xl border border-line bg-surface px-3.5 py-2.5 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100 focus:outline-none"
        />
        <button type="submit" disabled={!text.trim() || sending} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white transition-colors hover:bg-brand-800 disabled:bg-brand-700/40" aria-label={t('msg.send')}>
          <SendHorizontal size={19} />
        </button>
      </form>
    </div>
  )
}
