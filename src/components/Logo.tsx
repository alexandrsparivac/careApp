/** Sun-arc mark + wordmark. The arc echoes the "day arc" on the dashboard. */
export function LogoMark({ size = 34, dark }: { size?: number; dark?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <rect width="40" height="40" rx="12" fill={dark ? 'var(--color-brand-800)' : 'var(--color-brand-700)'} />
      <path d="M9 26a11 11 0 0 1 22 0" fill="none" stroke="var(--color-brand-200)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="27.5" cy="17.5" r="3.6" fill="var(--color-sun-500)" />
      <path d="M13 30.5h14" stroke="#fff" strokeOpacity=".55" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

export function Wordmark({ light }: { light?: boolean }) {
  return (
    <span className={`font-display text-[1.05rem] font-bold tracking-tight ${light ? 'text-white' : 'text-ink'}`}>
      Care<span className={light ? 'text-sun-500' : 'text-brand-500'}>Bridge</span>
    </span>
  )
}
