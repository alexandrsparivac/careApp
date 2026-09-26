import { useState } from 'react'
import { KeyRound, UserRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useI18n } from '../i18n'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { Avatar, Badge, Button, Card, CardHeader, ErrorNote, Field, Input, PageHeader } from '../components/ui'

export function ProfilePage() {
  const { profile, refreshProfile } = useAuth()
  const { t, fmt } = useI18n()
  const toast = useToast()
  const [name, setName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [saving, setSaving] = useState(false)
  const [pw, setPw] = useState({ next: '', confirm: '' })
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSaving, setPwSaving] = useState(false)

  if (!profile) return null

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('profiles').update({ full_name: name.trim(), phone: phone.trim() || null }).eq('id', profile.id)
    setSaving(false)
    if (error) return toast({ tone: 'error', title: t('common.error'), body: error.message })
    await refreshProfile()
    toast({ tone: 'success', title: t('common.saved') })
  }

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwError(null)
    if (pw.next.length < 8) return setPwError(t('auth.passwordMin'))
    if (pw.next !== pw.confirm) return setPwError(t('profile.passwordsMismatch'))
    setPwSaving(true)
    const { error } = await supabase.auth.updateUser({ password: pw.next })
    setPwSaving(false)
    if (error) return setPwError(error.message)
    setPw({ next: '', confirm: '' })
    toast({ tone: 'success', title: t('profile.passwordChanged') })
  }

  return (
    <>
      <PageHeader eyebrow={t('profile.eyebrow')} title={t('profile.title')} />
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <div className="flex items-center gap-4 px-5 pt-5">
            <Avatar name={profile.full_name} size={64} />
            <div>
              <p className="text-xl font-semibold">{profile.full_name}</p>
              <p className="text-ink-faint">{profile.email}</p>
              <div className="mt-1 flex gap-2">
                <Badge tone="brand">{t(`role.${profile.role}`)}</Badge>
                <Badge>{t('profile.memberSince', { date: fmt(profile.created_at, 'MMMM yyyy') })}</Badge>
              </div>
            </div>
          </div>
          <form onSubmit={save} className="flex flex-col gap-4 p-5">
            <Field label={t('auth.fullName')}>{(id) => <Input id={id} required value={name} onChange={(e) => setName(e.target.value)} />}</Field>
            <Field label={t('auth.phone')}>{(id) => <Input id={id} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />}</Field>
            <div>
              <p className="mb-2 text-sm font-medium text-ink-soft">{t('lang.label')}</p>
              <LanguageSwitcher userId={profile.id} />
            </div>
            <Button type="submit" loading={saving} icon={<UserRound size={16} />} className="self-start">
              {t('common.save')}
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader icon={<KeyRound size={17} />} title={t('profile.changePassword')} />
          <form onSubmit={changePassword} className="flex flex-col gap-4 px-5 pb-5">
            <Field label={t('profile.newPassword')} hint={t('auth.passwordMin')}>
              {(id) => <Input id={id} type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} />}
            </Field>
            <Field label={t('profile.confirmPassword')}>
              {(id) => <Input id={id} type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} />}
            </Field>
            {pwError && <ErrorNote>{pwError}</ErrorNote>}
            <Button type="submit" variant="secondary" loading={pwSaving} className="self-start">
              {t('profile.changePassword')}
            </Button>
          </form>
        </Card>
      </div>
    </>
  )
}
