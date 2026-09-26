import { useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { HeartHandshake, ShieldCheck, Stethoscope } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { LogoMark, Wordmark } from '../components/Logo'
import { Button, cn, ErrorNote, Field, Input } from '../components/ui'
import type { Role } from '../lib/types'

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const { t } = useI18n()
  const roles = [
    { icon: ShieldCheck, title: t('role.admin'), text: t('auth.roleAdminText') },
    { icon: Stethoscope, title: t('role.caregiver'), text: t('auth.roleCaregiverText') },
    { icon: HeartHandshake, title: t('role.family'), text: t('auth.roleFamilyText') },
  ]
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-brand-900 p-12 text-white lg:flex lg:flex-col">
        <div className="flex items-center gap-2.5">
          <LogoMark dark size={38} />
          <Wordmark light />
        </div>

        <div className="relative z-10 mt-auto max-w-lg">
          <p className="eyebrow text-sun-500">{t('auth.heroEyebrow')}</p>
          <h1 className="font-display mt-4 text-[2.6rem] leading-[1.1] font-bold tracking-tight">{t('auth.heroTitle')}</h1>
          <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-brand-100/80">{t('auth.heroText')}</p>
          <ul className="mt-10 grid gap-4">
            {roles.map((r) => (
              <li key={r.title} className="flex items-start gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/8 text-sun-500 ring-1 ring-white/10">
                  <r.icon size={19} aria-hidden />
                </span>
                <div>
                  <p className="font-semibold">{r.title}</p>
                  <p className="text-sm text-brand-100/70">{r.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* The day arc motif, oversized */}
        <svg className="pointer-events-none absolute -top-24 -right-40 opacity-90" width="620" height="440" viewBox="0 0 620 440" aria-hidden>
          <path d="M40 420a270 270 0 0 1 540 0" fill="none" stroke="var(--color-brand-100)" strokeOpacity=".12" strokeWidth="18" strokeLinecap="round" />
          <path d="M40 420a270 270 0 0 1 390 -242" fill="none" stroke="var(--color-sun-500)" strokeOpacity=".55" strokeWidth="18" strokeLinecap="round" />
          <circle cx="430" cy="178" r="20" fill="var(--color-sun-500)" stroke="var(--color-brand-900)" strokeWidth="6" />
          {[
            [96, 255],
            [168, 190],
            [262, 154],
            [356, 154],
          ].map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r="9" fill="var(--color-ok-600)" stroke="#fff" strokeWidth="3" />
          ))}
          {[
            [508, 236],
            [552, 300],
          ].map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r="9" fill="var(--color-brand-900)" stroke="var(--color-brand-100)" strokeWidth="3" />
          ))}
        </svg>
      </aside>

      <main className="flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 lg:invisible">
            <LogoMark size={32} />
            <Wordmark />
          </div>
          <LanguageSwitcher />
        </div>
        <div className="animate-rise mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h2 className="text-[1.9rem] leading-tight font-bold tracking-tight">{title}</h2>
          <p className="mt-2 mb-8 text-ink-soft">{subtitle}</p>
          {children}
        </div>
      </main>
    </div>
  )
}

export function LoginPage() {
  const { session } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (session) return <Navigate to="/" replace />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)
    if (error) return setError(error.message === 'Invalid login credentials' ? t('auth.invalidCredentials') : error.message)
    navigate('/')
  }

  return (
    <AuthShell title={t('auth.loginTitle')} subtitle={t('auth.loginSubtitle')}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label={t('auth.email')}>{(id) => <Input id={id} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
        <Field label={t('auth.password')}>{(id) => <Input id={id} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
        {error && <ErrorNote>{error}</ErrorNote>}
        <Button type="submit" loading={loading} className="mt-2 w-full">
          {t('auth.login')}
        </Button>
      </form>
      <p className="mt-8 text-center text-ink-soft">
        {t('auth.noAccount')}{' '}
        <Link to="/register" className="font-semibold text-brand-600 underline-offset-4 hover:underline">
          {t('auth.register')}
        </Link>
      </p>
    </AuthShell>
  )
}

export function RegisterPage() {
  const { session } = useAuth()
  const { t, lang } = useI18n()
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '', role: 'family' as Exclude<Role, 'admin'> })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  if (session) return <Navigate to="/" replace />

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password.length < 8) return setError(t('auth.passwordMin'))
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: { data: { full_name: form.full_name.trim(), phone: form.phone.trim() || null, role: form.role, language: lang } },
    })
    setLoading(false)
    if (error) return setError(error.message)
    if (!data.session) setSent(true) // email confirmation is enabled in Supabase
  }

  if (sent) {
    return (
      <AuthShell title={t('auth.checkEmailTitle')} subtitle={t('auth.checkEmail', { email: form.email })}>
        <Link to="/login" className="font-semibold text-brand-600 hover:underline">
          ← {t('auth.login')}
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell title={t('auth.registerTitle')} subtitle={t('auth.registerSubtitle')}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink-soft">{t('auth.iAm')}</legend>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { role: 'family', icon: HeartHandshake },
                { role: 'caregiver', icon: Stethoscope },
              ] as const
            ).map(({ role, icon: Icon }) => (
              <button
                key={role}
                type="button"
                aria-pressed={form.role === role}
                onClick={() => set('role', role)}
                className={cn('flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all', form.role === role ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-500' : 'border-line bg-white hover:bg-surface')}
              >
                <Icon size={20} className={form.role === role ? 'text-brand-600' : 'text-ink-faint'} aria-hidden />
                <span className="font-semibold">{t(`role.${role}`)}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <Field label={t('auth.fullName')}>{(id) => <Input id={id} required autoComplete="name" value={form.full_name} onChange={(e) => set('full_name', e.target.value)} />}</Field>
        <Field label={t('auth.email')}>{(id) => <Input id={id} type="email" required autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} />}</Field>
        <Field label={`${t('auth.phone')} (${t('common.optional')})`}>{(id) => <Input id={id} type="tel" autoComplete="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />}</Field>
        <Field label={t('auth.password')} hint={t('auth.passwordMin')}>
          {(id) => <Input id={id} type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={(e) => set('password', e.target.value)} />}
        </Field>
        {error && <ErrorNote>{error}</ErrorNote>}
        <Button type="submit" loading={loading} className="mt-2 w-full">
          {t('auth.register')}
        </Button>
        <p className="text-sm text-ink-faint">{t('auth.accessNote')}</p>
      </form>
      <p className="mt-8 text-center text-ink-soft">
        {t('auth.haveAccount')}{' '}
        <Link to="/login" className="font-semibold text-brand-600 underline-offset-4 hover:underline">
          {t('auth.login')}
        </Link>
      </p>
    </AuthShell>
  )
}
