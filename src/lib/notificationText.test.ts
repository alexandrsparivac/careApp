import { describe, expect, it } from 'vitest'
import ro from '../i18n/ro'
import en from '../i18n/en'
import { interpolate, type TKey } from '../i18n/index'
import { describeNotification } from './notificationText'
import type { AppNotification } from './types'

const tFor = (dict: Record<TKey, string>) => (key: TKey, vars?: Record<string, string | number | null | undefined>) => interpolate(dict[key], vars)
const when = () => 'Today, 14:00'

const n = (type: AppNotification['type'], payload: Record<string, unknown>): AppNotification => ({
  id: '1',
  user_id: 'u',
  type,
  payload,
  elder_id: 'e',
  link: null,
  is_read: false,
  created_at: new Date().toISOString(),
})

describe('describeNotification', () => {
  it('renders a health alert with translated flags', () => {
    const out = describeNotification(n('health_alert', { elder: 'Maria', author: 'Ana', flags: ['fever', 'spo2_low'] }), tFor(en), when)
    expect(out.title).toBe('Health alert — Maria')
    expect(out.body).toBe('fever, low oxygen saturation · recorded by Ana')
  })

  it('renders the same notification in Romanian', () => {
    const out = describeNotification(n('health_alert', { elder: 'Maria', author: 'Ana', flags: ['fever'] }), tFor(ro), when)
    expect(out.title).toBe('Alertă de sănătate — Maria')
    expect(out.body).toContain('febră')
  })

  it('appends the count for grouped messages', () => {
    const out = describeNotification(n('new_message', { elder: 'Maria', sender: 'Ion', preview: 'Salut', count: 3 }), tFor(en), when)
    expect(out.title).toBe('New message — Maria (3)')
    expect(out.body).toBe('Ion: Salut')
  })

  it('translates the event type and formats the date', () => {
    const out = describeNotification(n('important_event', { elder: 'Maria', title: 'Slip', event_type: 'fall', starts_at: '2026-10-01T14:00:00Z', author: 'Ana' }), tFor(en), when)
    expect(out.body).toBe('Fall: Slip · Today, 14:00 (added by Ana)')
  })

  it('falls back to a generic name when the sender is missing', () => {
    const out = describeNotification(n('new_message', { elder: 'Maria', preview: 'x' }), tFor(en), when)
    expect(out.body).toBe('User: x')
  })
})
