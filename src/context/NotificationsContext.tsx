import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { AppNotification } from '../lib/types'
import { describeNotification, URGENT_TYPES } from '../lib/notificationText'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'
import { useI18n } from '../i18n'

interface NotificationsValue {
  items: AppNotification[]
  unread: number
  unreadMessages: number
  loading: boolean
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  remove: (id: string) => Promise<void>
  open: (n: AppNotification) => void
  reload: () => Promise<void>
}

const NotificationsContext = createContext<NotificationsValue | null>(null)

const DUE_JOB_INTERVAL = 5 * 60 * 1000

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const { t, fmtWhen } = useI18n()
  const [items, setItems] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)

  // Latest translators kept in a ref so the realtime subscription is not
  // torn down and re-created every time the language changes.
  const textRef = useRef({ t, fmtWhen })
  textRef.current = { t, fmtWhen }
  const itemsRef = useRef(items)
  itemsRef.current = items

  const reload = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    setItems((data ?? []) as AppNotification[])
    setLoading(false)
  }, [profile])

  const markRead = useCallback(async (id: string) => {
    setItems((all) => all.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
  }, [])

  const markAllRead = useCallback(async () => {
    if (!profile) return
    setItems((all) => all.map((n) => ({ ...n, is_read: true })))
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile.id).eq('is_read', false)
  }, [profile])

  const remove = useCallback(async (id: string) => {
    setItems((all) => all.filter((n) => n.id !== id))
    await supabase.from('notifications').delete().eq('id', id)
  }, [])

  const open = useCallback(
    (n: AppNotification) => {
      if (!n.is_read) void markRead(n.id)
      if (n.link) navigate(n.link)
    },
    [markRead, navigate],
  )

  useEffect(() => {
    if (!profile) return
    void reload()

    const announce = (n: AppNotification) => {
      const { title, body } = describeNotification(n, textRef.current.t, textRef.current.fmtWhen)
      const urgent = URGENT_TYPES.includes(n.type)
      toast({ title, body, tone: urgent ? 'alert' : 'info', onClick: () => open(n) })
      if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        const bn = new Notification(title, { body, tag: n.id, icon: '/favicon.svg' })
        bn.onclick = () => {
          window.focus()
          open(n)
        }
      }
    }

    const channel = supabase
      .channel(`notifications:${profile.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        (change) => {
          if (change.eventType === 'INSERT') {
            const n = change.new as AppNotification
            setItems((all) => [n, ...all.filter((x) => x.id !== n.id)])
            announce(n)
          } else if (change.eventType === 'UPDATE') {
            const n = change.new as AppNotification
            // A grouped message notification gets its created_at bumped on each new message.
            const prev = itemsRef.current.find((x) => x.id === n.id)
            const bumped = !n.is_read && (!prev || prev.created_at !== n.created_at)
            setItems((all) => (bumped ? [n, ...all.filter((x) => x.id !== n.id)] : all.map((x) => (x.id === n.id ? n : x))))
            if (bumped) announce(n)
          } else if (change.eventType === 'DELETE') {
            const id = (change.old as { id: string }).id
            setItems((all) => all.filter((x) => x.id !== id))
          }
        },
      )
      .subscribe()

    // Fallback for projects without pg_cron: send reminders / mark missed activities.
    const runDueJob = () => void supabase.rpc('process_due_activities')
    runDueJob()
    const timer = setInterval(runDueJob, DUE_JOB_INTERVAL)

    return () => {
      clearInterval(timer)
      void supabase.removeChannel(channel)
    }
  }, [profile, reload, toast, open])

  const value = useMemo<NotificationsValue>(
    () => ({
      items,
      unread: items.filter((n) => !n.is_read).length,
      unreadMessages: items.filter((n) => !n.is_read && n.type === 'new_message').length,
      loading,
      markRead,
      markAllRead,
      remove,
      open,
      reload,
    }),
    [items, loading, markRead, markAllRead, remove, open, reload],
  )

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotifications must be used inside NotificationsProvider')
  return ctx
}
