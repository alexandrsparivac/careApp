import { useState } from 'react'
import { isToday, isYesterday } from 'date-fns'
import { Bell, BellRing, CalendarDays, CheckCheck, ClipboardCheck, ClipboardX, Clock, MessagesSquare, Trash2, TriangleAlert, UserCheck } from 'lucide-react'
import { useNotifications } from '../context/NotificationsContext'
import { describeNotification, URGENT_TYPES } from '../lib/notificationText'
import type { AppNotification, NotificationType } from '../lib/types'
import { useI18n } from '../i18n'
import { Button, Card, cn, EmptyState, PageHeader, Spinner } from '../components/ui'

const ICON: Record<NotificationType, typeof Bell> = {
  new_message: MessagesSquare,
  new_event: CalendarDays,
  important_event: TriangleAlert,
  health_alert: TriangleAlert,
  activity_assigned: UserCheck,
  activity_done: ClipboardCheck,
  activity_missed: ClipboardX,
  activity_reminder: Clock,
}

export function NotificationsPage() {
  const { items, unread, loading, markAllRead, open, remove } = useNotifications()
  const { t, fmt, fmtWhen, fmtAgo } = useI18n()
  const [onlyUnread, setOnlyUnread] = useState(false)
  const [permission, setPermission] = useState(() => ('Notification' in window ? Notification.permission : 'denied'))

  const list = onlyUnread ? items.filter((n) => !n.is_read) : items
  const groups: { label: string; items: AppNotification[] }[] = []
  for (const n of list) {
    const d = new Date(n.created_at)
    const label = isToday(d) ? t('common.today') : isYesterday(d) ? t('common.yesterday') : fmt(d, 'EEEE, d MMMM')
    const last = groups[groups.length - 1]
    if (last?.label === label) last.items.push(n)
    else groups.push({ label, items: [n] })
  }

  return (
    <>
      <PageHeader
        eyebrow={t('notif.eyebrow')}
        title={t('notif.title')}
        subtitle={unread ? t('notif.unreadCount', { n: unread }) : t('notif.allRead')}
        actions={
          <>
            {permission === 'default' && (
              <Button variant="secondary" icon={<BellRing size={16} />} onClick={() => Notification.requestPermission().then(setPermission)}>
                {t('notif.enableBrowser')}
              </Button>
            )}
            <Button variant="secondary" icon={<CheckCheck size={16} />} onClick={() => void markAllRead()} disabled={!unread}>
              {t('notif.markAllRead')}
            </Button>
          </>
        }
      />

      <label className="mb-5 flex w-fit items-center gap-2 text-sm font-medium text-ink-soft">
        <input type="checkbox" checked={onlyUnread} onChange={(e) => setOnlyUnread(e.target.checked)} className="h-4 w-4 accent-brand-600" />
        {t('notif.onlyUnread')}
      </label>

      {loading ? (
        <Spinner />
      ) : list.length === 0 ? (
        <Card>
          <EmptyState icon={<Bell size={36} />} title={t('notif.empty')} text={t('notif.emptyHint')} />
        </Card>
      ) : (
        <div className="flex flex-col gap-7">
          {groups.map((g) => (
            <section key={g.label}>
              <h2 className="eyebrow mb-3 text-ink-faint">{g.label}</h2>
              <Card>
                <ul className="divide-y divide-line/70">
                  {g.items.map((n) => {
                    const { title, body } = describeNotification(n, t, fmtWhen)
                    const Icon = ICON[n.type] ?? Bell
                    const urgent = URGENT_TYPES.includes(n.type)
                    return (
                      <li key={n.id} className={cn('group flex items-start gap-3 px-4 py-3.5 transition-colors', !n.is_read && 'bg-sun-50/50')}>
                        <span className={cn('mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', urgent ? 'bg-bad-50 text-bad-600' : 'bg-brand-50 text-brand-600')}>
                          <Icon size={18} aria-hidden />
                        </span>
                        <button type="button" onClick={() => open(n)} className="min-w-0 flex-1 text-left">
                          <p className={cn('flex items-center gap-2', n.is_read ? 'font-medium' : 'font-bold')}>
                            {!n.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-sun-500" aria-label={t('notif.unread')} />}
                            {title}
                          </p>
                          {body && <p className="mt-0.5 line-clamp-2 text-ink-soft">{body}</p>}
                          <p className="mt-1 text-xs text-ink-faint">{fmtAgo(n.created_at)}</p>
                        </button>
                        <button type="button" onClick={() => void remove(n.id)} className="rounded-lg p-2 text-ink-faint opacity-0 group-hover:opacity-100 hover:bg-bad-50 hover:text-bad-600 focus:opacity-100" aria-label={t('common.delete')}>
                          <Trash2 size={16} />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}
    </>
  )
}
