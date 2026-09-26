import type { TKey } from '../i18n'
import type { AppNotification, EventType, NotificationType } from './types'

type T = (key: TKey, vars?: Record<string, string | number | null | undefined>) => string

const TITLE: Record<NotificationType, TKey> = {
  new_message: 'notif.title.new_message',
  new_event: 'notif.title.new_event',
  important_event: 'notif.title.important_event',
  health_alert: 'notif.title.health_alert',
  activity_assigned: 'notif.title.activity_assigned',
  activity_done: 'notif.title.activity_done',
  activity_missed: 'notif.title.activity_missed',
  activity_reminder: 'notif.title.activity_reminder',
}

const BODY: Record<NotificationType, TKey> = {
  new_message: 'notif.body.new_message',
  new_event: 'notif.body.new_event',
  important_event: 'notif.body.important_event',
  health_alert: 'notif.body.health_alert',
  activity_assigned: 'notif.body.activity_assigned',
  activity_done: 'notif.body.activity_done',
  activity_missed: 'notif.body.activity_missed',
  activity_reminder: 'notif.body.activity_reminder',
}

export const URGENT_TYPES: NotificationType[] = ['important_event', 'health_alert', 'activity_missed']

/** Builds the localized title/body for a notification from its type + payload. */
export function describeNotification(n: AppNotification, t: T, fmtWhen: (d: string) => string) {
  const p = n.payload as Record<string, unknown>
  const str = (k: string) => (typeof p[k] === 'string' ? (p[k] as string) : '')
  const when = str('scheduled_at') || str('starts_at')
  const flags = Array.isArray(p.flags) ? (p.flags as string[]) : []
  const count = typeof p.count === 'number' ? p.count : 1

  const vars = {
    elder: str('elder'),
    sender: str('sender') || t('common.unknownUser'),
    author: str('author') || t('common.unknownUser'),
    by: str('by') || t('common.unknownUser'),
    preview: str('preview'),
    title: str('title'),
    when: when ? fmtWhen(when) : '',
    type: str('event_type') ? t(`eventType.${str('event_type') as EventType}`) : '',
    flags: flags.map((f) => t(`flag.${f}` as TKey)).join(', ') || str('notes'),
    count,
  }

  const known = n.type in TITLE
  let title = known ? t(TITLE[n.type], vars) : n.type
  const body = known ? t(BODY[n.type], vars) : ''
  if (count > 1) title += ` (${count})`
  return { title, body }
}
