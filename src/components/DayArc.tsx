import { useEffect, useState } from 'react'
import type { CareActivity } from '../lib/types'
import { isOverdue } from './activities'

const START_HOUR = 6
const END_HOUR = 22
const W = 600
const H = 318
const CX = W / 2
const CY = 292
const R = 250

function hourOf(d: Date) {
  return d.getHours() + d.getMinutes() / 60
}

/** Position on the arc for a fractional hour; hours outside 06–22 clamp to the ends. */
function point(hour: number, radius = R) {
  const t = Math.min(1, Math.max(0, (hour - START_HOUR) / (END_HOUR - START_HOUR)))
  const theta = Math.PI * (1 - t)
  return { x: CX + radius * Math.cos(theta), y: CY - radius * Math.sin(theta) }
}

function arcPath(fromHour: number, toHour: number, radius = R) {
  const a = point(fromHour, radius)
  const b = point(toHour, radius)
  return `M ${a.x} ${a.y} A ${radius} ${radius} 0 0 1 ${b.x} ${b.y}`
}

function dotColor(a: CareActivity) {
  if (a.status === 'done') return { fill: 'var(--color-ok-600)', stroke: '#fff' }
  if (a.status === 'missed') return { fill: 'var(--color-bad-600)', stroke: '#fff' }
  if (a.status === 'cancelled') return { fill: 'var(--color-brand-700)', stroke: 'var(--color-brand-300)' }
  if (isOverdue(a)) return { fill: 'var(--color-brand-900)', stroke: 'var(--color-sun-500)' }
  return { fill: 'var(--color-brand-900)', stroke: 'var(--color-brand-100)' }
}

/**
 * Today drawn as the path of the sun from 06:00 to 22:00. Each activity is a dot
 * placed at its scheduled time and colored by status; the sun marks "now".
 * Activities close in time are pushed inward so they don't overlap.
 */
export function DayArc({ activities, onSelect, center, ariaLabel }: { activities: CareActivity[]; onSelect?: (a: CareActivity) => void; center: React.ReactNode; ariaLabel: string }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const nowHour = hourOf(now)
  const sun = point(nowHour)
  const dayOver = nowHour >= END_HOUR
  const beforeDawn = nowHour < START_HOUR

  // Stack dots that fall within 25 minutes of each other onto inner lanes.
  const placed: { a: CareActivity; x: number; y: number }[] = []
  const sorted = [...activities].sort((x, y) => +new Date(x.scheduled_at) - +new Date(y.scheduled_at))
  let lastHour = -Infinity
  let lane = 0
  for (const a of sorted) {
    const h = hourOf(new Date(a.scheduled_at))
    lane = h - lastHour < 25 / 60 ? lane + 1 : 0
    lastHour = h
    const p = point(h, R - (lane % 4) * 20)
    placed.push({ a, ...p })
  }

  const ticks = [6, 9, 12, 15, 18, 21]

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={ariaLabel}>
        <defs>
          <linearGradient id="elapsed" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="var(--color-sun-500)" stopOpacity="0.15" />
            <stop offset="1" stopColor="var(--color-sun-500)" stopOpacity="0.9" />
          </linearGradient>
        </defs>

        {/* horizon */}
        <line x1={CX - R - 26} x2={CX + R + 26} y1={CY} y2={CY} stroke="var(--color-brand-100)" strokeOpacity="0.18" strokeDasharray="2 6" />

        {/* track + elapsed part of the day */}
        <path d={arcPath(START_HOUR, END_HOUR)} fill="none" stroke="var(--color-brand-100)" strokeOpacity="0.16" strokeWidth="14" strokeLinecap="round" />
        {!beforeDawn && <path d={arcPath(START_HOUR, Math.min(nowHour, END_HOUR))} fill="none" stroke="url(#elapsed)" strokeWidth="14" strokeLinecap="round" />}

        {/* hour ticks */}
        {ticks.map((h) => {
          const outer = point(h, R + 16)
          const label = point(h, R + 34)
          return (
            <g key={h}>
              <circle cx={outer.x} cy={outer.y} r="1.8" fill="var(--color-brand-200)" fillOpacity="0.6" />
              <text x={label.x} y={label.y + 4} textAnchor="middle" fontSize="13" fill="var(--color-brand-200)" fillOpacity="0.75" className="tabular">
                {String(h).padStart(2, '0')}
              </text>
            </g>
          )
        })}

        {/* activities */}
        {placed.map(({ a, x, y }) => {
          const c = dotColor(a)
          const time = new Date(a.scheduled_at).toTimeString().slice(0, 5)
          return (
            <g key={a.id} className={onSelect ? 'cursor-pointer' : undefined} onClick={() => onSelect?.(a)}>
              <title>{`${time} · ${a.title}${a.elder ? ` — ${a.elder.full_name}` : ''}`}</title>
              <circle cx={x} cy={y} r="14" fill="transparent" />
              <circle cx={x} cy={y} r="7.5" fill={c.fill} stroke={c.stroke} strokeWidth="2.5" />
            </g>
          )
        })}

        {/* the sun = now */}
        {!beforeDawn && !dayOver && (
          <g>
            <circle cx={sun.x} cy={sun.y} r="7" fill="none" stroke="var(--color-sun-500)" strokeWidth="2" className="sun-pulse" />
            <circle cx={sun.x} cy={sun.y} r="10" fill="var(--color-sun-500)" stroke="var(--color-brand-900)" strokeWidth="3" />
          </g>
        )}
      </svg>
      <div className="pointer-events-none absolute inset-x-0 bottom-[6%] flex flex-col items-center text-center">{center}</div>
    </div>
  )
}

export function DayArcLegend({ labels }: { labels: { done: string; planned: string; overdue: string; missed: string; now: string } }) {
  const items = [
    { color: 'var(--color-ok-600)', ring: '#fff', label: labels.done },
    { color: 'var(--color-brand-900)', ring: 'var(--color-brand-100)', label: labels.planned },
    { color: 'var(--color-brand-900)', ring: 'var(--color-sun-500)', label: labels.overdue },
    { color: 'var(--color-bad-600)', ring: '#fff', label: labels.missed },
  ]
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-brand-100/80">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: i.color, boxShadow: `0 0 0 2px ${i.ring}` }} />
          {i.label}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-3.5 w-3.5 rounded-full bg-sun-500 ring-2 ring-brand-900" />
        {labels.now}
      </li>
    </ul>
  )
}
