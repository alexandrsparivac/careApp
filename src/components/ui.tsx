import { useEffect, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Loader2, X } from 'lucide-react'

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

// ---------------------------------------------------------------- Button
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-700 text-white shadow-sm hover:bg-brand-800 active:translate-y-px disabled:bg-brand-700/50',
  secondary: 'border border-line bg-white text-ink shadow-sm hover:border-brand-200 hover:bg-brand-50 active:translate-y-px disabled:text-ink-faint',
  ghost: 'text-ink-soft hover:bg-surface-2 hover:text-ink',
  danger: 'bg-bad-600 text-white hover:bg-bad-700 disabled:bg-bad-600/50',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; loading?: boolean; icon?: ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-all disabled:cursor-not-allowed',
        size === 'sm' ? 'h-8 px-3 text-sm' : 'h-11 px-4',
        VARIANTS[variant],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
      {children}
    </button>
  )
}

// ---------------------------------------------------------------- Card
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn('overflow-hidden rounded-2xl border border-line/70 bg-white shadow-card', className)}>{children}</section>
}

export function CardHeader({ title, action, subtitle, icon }: { title: ReactNode; action?: ReactNode; subtitle?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">{icon}</span>}
        <div className="min-w-0">
          <h2 className="font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="text-sm text-ink-faint">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="animate-rise mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1.5 text-brand-500">{eyebrow}</p>}
        <h1 className="text-[1.9rem] leading-tight font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-[65ch] text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

// ---------------------------------------------------------------- Form fields
export function Field({ label, hint, error, children, className }: { label: ReactNode; hint?: ReactNode; error?: ReactNode; children: (id: string) => ReactNode; className?: string }) {
  const id = useId()
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink-soft">
        {label}
      </label>
      {children(id)}
      {hint && !error && <p className="text-sm text-ink-faint">{hint}</p>}
      {error && <p className="text-sm text-bad-600">{error}</p>}
    </div>
  )
}

const control = 'w-full rounded-lg border border-line bg-white px-3 text-ink placeholder:text-ink-faint focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:bg-surface'

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, 'h-11', className)} {...rest} />
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, 'min-h-20 py-2', className)} {...rest} />
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(control, 'h-11 pr-8', className)} {...rest}>
      {children}
    </select>
  )
}

// ---------------------------------------------------------------- Badge
export type Tone = 'neutral' | 'brand' | 'ok' | 'warn' | 'bad' | 'plan'
const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-ink-soft',
  brand: 'bg-brand-50 text-brand-700',
  ok: 'bg-ok-50 text-ok-700',
  warn: 'bg-warn-50 text-warn-700',
  bad: 'bg-bad-50 text-bad-700',
  plan: 'bg-plan-50 text-plan-600',
}

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap', TONES[tone], className)}>{children}</span>
}

// ---------------------------------------------------------------- Modal
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-brand-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" className={cn('animate-rise flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-float sm:rounded-2xl', wide ? 'sm:max-w-2xl' : 'sm:max-w-lg')}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1.5 text-ink-faint hover:bg-surface-2 hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Misc
export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-ink-faint" role="status">
      <Loader2 className="animate-spin" size={20} />
      {label && <span>{label}</span>}
    </div>
  )
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: ReactNode; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      {icon && <div className="mb-1 text-ink-faint">{icon}</div>}
      <p className="font-medium">{title}</p>
      {text && <p className="max-w-[48ch] text-sm text-ink-faint">{text}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-bad-600/30 bg-bad-50 px-3 py-2 text-sm text-bad-700">{children}</p>
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode; icon?: ReactNode }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div className="mb-6 overflow-x-auto" role="tablist">
      <div className="inline-flex gap-1 rounded-xl border border-line/70 bg-white p-1 shadow-card">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === value}
            onClick={() => onChange(tab.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 font-medium whitespace-nowrap transition-colors',
              tab.id === value ? 'bg-brand-700 text-white' : 'text-ink-soft hover:bg-surface hover:text-ink',
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Circular progress ring around content — used for "today's care completed". */
export function Ring({ value, size = 56, stroke = 4, children, tone = 'ok' }: { value: number | null; size?: number; stroke?: number; children?: ReactNode; tone?: 'ok' | 'sun' }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = value === null ? 0 : Math.max(0, Math.min(1, value))
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth={stroke} />
        {value !== null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={tone === 'ok' ? 'var(--color-ok-600)' : 'var(--color-sun-500)'}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
            style={{ transition: 'stroke-dashoffset .6s ease' }}
          />
        )}
      </svg>
      {children}
    </span>
  )
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold tracking-tight text-brand-800"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials || '?'}
    </span>
  )
}
