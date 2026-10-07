import { useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Alert, Card as AntCard, Flex, Form, Input as AntInput, Radio, Typography } from 'antd'
import { HeartHandshake, ShieldCheck, Stethoscope } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { LogoMark, Wordmark } from '../components/Logo'
import { Button } from '../components/ui'
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
        <div className="animate-rise mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <AntCard variant="outlined" style={{ borderRadius: 18 }} styles={{ body: { padding: 28 } }}>
            <Typography.Title level={3} style={{ margin: 0 }}>{title}</Typography.Title>
            <Typography.Paragraph type="secondary" style={{ margin: '8px 0 24px' }}>{subtitle}</Typography.Paragraph>
            {children}
          </AntCard>
        </div>
      </main>
    </div>
  )
}

export function LoginPage() {
  const { session } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (session) return <Navigate to="/" replace />

  const submit = async (values: { email: string; password: string }) => {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: values.email.trim(), password: values.password })
    setLoading(false)
    if (error) return setError(error.message === 'Invalid login credentials' ? t('auth.invalidCredentials') : error.message)
    navigate('/')
  }

  return (
    <AuthShell title={t('auth.loginTitle')} subtitle={t('auth.loginSubtitle')}>
      <Form layout="vertical" onFinish={(v) => void submit(v)} requiredMark={false}>
        <Form.Item label={t('auth.email')} name="email" rules={[{ required: true, type: 'email' }]}>
          <AntInput size="large" type="email" autoComplete="email" placeholder="nume@exemplu.ro" />
        </Form.Item>
        <Form.Item label={t('auth.password')} name="password" rules={[{ required: true }]} style={{ marginBottom: error ? 12 : 24 }}>
          <AntInput.Password size="large" autoComplete="current-password" placeholder="••••••••" />
        </Form.Item>
        {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16, borderRadius: 10 }} />}
        <Form.Item style={{ marginBottom: 0 }}>
          <Button type="submit" loading={loading} className="w-full" style={{ height: 46 }}>
            {t('auth.login')}
          </Button>
        </Form.Item>
      </Form>
      <p className="mt-6 text-center text-ink-soft">
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
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sentEmail, setSentEmail] = useState<string | null>(null)

  if (session) return <Navigate to="/" replace />

  const submit = async (values: { full_name: string; email: string; phone?: string; password: string; role: Exclude<Role, 'admin'> }) => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.auth.signUp({
      email: values.email.trim(),
      password: values.password,
      options: { data: { full_name: values.full_name.trim(), phone: values.phone?.trim() || null, role: values.role, language: lang } },
    })
    setLoading(false)
    if (error) return setError(error.message)
    if (!data.session) setSentEmail(values.email) // email confirmation is enabled in Supabase
  }

  if (sentEmail) {
    return (
      <AuthShell title={t('auth.checkEmailTitle')} subtitle={t('auth.checkEmail', { email: sentEmail })}>
        <Link to="/login" className="font-semibold text-brand-600 hover:underline">
          ← {t('auth.login')}
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell title={t('auth.registerTitle')} subtitle={t('auth.registerSubtitle')}>
      <Form layout="vertical" initialValues={{ role: 'family' }} onFinish={(v) => void submit(v)} requiredMark={false}>
        <Form.Item label={t('auth.iAm')} name="role" style={{ marginBottom: 16 }}>
          <Radio.Group buttonStyle="solid" style={{ width: '100%' }}>
            <Flex gap={8} style={{ width: '100%' }}>
              <Radio.Button value="family" style={{ flex: 1, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <HeartHandshake size={17} /> {t('role.family')}
              </Radio.Button>
              <Radio.Button value="caregiver" style={{ flex: 1, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Stethoscope size={17} /> {t('role.caregiver')}
              </Radio.Button>
            </Flex>
          </Radio.Group>
        </Form.Item>
        <Form.Item label={t('auth.fullName')} name="full_name" rules={[{ required: true }]}>
          <AntInput size="large" autoComplete="name" />
        </Form.Item>
        <Form.Item label={t('auth.email')} name="email" rules={[{ required: true, type: 'email' }]}>
          <AntInput size="large" type="email" autoComplete="email" />
        </Form.Item>
        <Form.Item label={`${t('auth.phone')} (${t('common.optional')})`} name="phone">
          <AntInput size="large" type="tel" autoComplete="tel" />
        </Form.Item>
        <Form.Item label={t('auth.password')} name="password" rules={[{ required: true, min: 8, message: t('auth.passwordMin') }]} extra={t('auth.passwordMin')}>
          <AntInput.Password size="large" autoComplete="new-password" />
        </Form.Item>
        {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16, borderRadius: 10 }} />}
        <Form.Item style={{ marginBottom: 8 }}>
          <Button type="submit" loading={loading} className="w-full" style={{ height: 46 }}>
            {t('auth.register')}
          </Button>
        </Form.Item>
        <Typography.Paragraph type="secondary" style={{ fontSize: 13, margin: 0 }}>{t('auth.accessNote')}</Typography.Paragraph>
      </Form>
      <p className="mt-6 text-center text-ink-soft">
        {t('auth.haveAccount')}{' '}
        <Link to="/login" className="font-semibold text-brand-600 underline-offset-4 hover:underline">
          {t('auth.login')}
        </Link>
      </p>
    </AuthShell>
  )
}
