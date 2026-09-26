import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { HeartHandshake, Search, ShieldCheck, Sparkles, Stethoscope, Trash2, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { errorMessage, fetchElders, useQuery } from '../lib/api'
import { createDemoData } from '../lib/demo'
import type { Profile, Role } from '../lib/types'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useI18n } from '../i18n'
import { Avatar, Badge, Button, Card, CardHeader, cn, Input, PageHeader, Select, Spinner } from '../components/ui'

interface UserRow extends Profile {
  elder_members: { elder: { id: string; full_name: string } | null }[]
}

export function AdminPage() {
  const { profile } = useAuth()
  const { t, fmt } = useI18n()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<Role | ''>('')
  const [demoBusy, setDemoBusy] = useState(false)

  const users = useQuery(async () => {
    const { data, error } = await supabase.from('profiles').select('*, elder_members(elder:elders(id, full_name))').order('created_at')
    if (error) throw error
    return data as UserRow[]
  }, [])
  const elders = useQuery(fetchElders, [])

  const counts = useMemo(() => {
    const c = { admin: 0, caregiver: 0, family: 0 }
    for (const u of users.data ?? []) c[u.role]++
    return c
  }, [users.data])

  const list = (users.data ?? []).filter((u) => (!roleFilter || u.role === roleFilter) && `${u.full_name} ${u.email}`.toLowerCase().includes(query.trim().toLowerCase()))

  const update = async (u: UserRow, patch: Partial<Profile>) => {
    const { error } = await supabase.from('profiles').update(patch).eq('id', u.id)
    if (error) return toast({ tone: 'error', title: t('common.error'), body: error.message })
    users.setData((all) => all?.map((x) => (x.id === u.id ? { ...x, ...patch } : x)) ?? null)
    toast({ tone: 'success', title: t('common.saved') })
  }

  const deleteElder = async (id: string, name: string) => {
    if (!confirm(t('admin.deleteElderConfirm', { name }))) return
    const { error } = await supabase.from('elders').delete().eq('id', id)
    if (error) return toast({ tone: 'error', title: t('common.error'), body: error.message })
    void elders.reload()
    void users.reload()
  }

  const seedDemo = async () => {
    if (!profile) return
    setDemoBusy(true)
    try {
      await createDemoData(t, profile.id)
      toast({ tone: 'success', title: t('admin.demoDone') })
      void elders.reload()
      void users.reload()
    } catch (e) {
      toast({ tone: 'error', title: t('common.error'), body: errorMessage(e) })
    } finally {
      setDemoBusy(false)
    }
  }

  const roleCards = [
    { role: 'admin' as const, icon: ShieldCheck, tone: 'bg-brand-50 text-brand-600' },
    { role: 'caregiver' as const, icon: Stethoscope, tone: 'bg-plan-50 text-plan-600' },
    { role: 'family' as const, icon: HeartHandshake, tone: 'bg-sun-50 text-sun-600' },
  ]

  return (
    <>
      <PageHeader
        eyebrow={t('admin.eyebrow')}
        title={t('admin.title')}
        subtitle={t('admin.subtitle')}
        actions={
          <Button variant="secondary" icon={<Sparkles size={16} />} loading={demoBusy} onClick={seedDemo}>
            {t('admin.demo')}
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-3 gap-3">
        {roleCards.map((r) => (
          <button key={r.role} type="button" onClick={() => setRoleFilter((f) => (f === r.role ? '' : r.role))} className={cn('rounded-2xl border bg-white p-4 text-left shadow-card transition-all', roleFilter === r.role ? 'border-brand-500 ring-2 ring-brand-100' : 'border-line/70 hover:border-brand-200')}>
            <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', r.tone)}>
              <r.icon size={18} aria-hidden />
            </span>
            <p className="font-display tabular mt-3 text-3xl font-bold">{counts[r.role]}</p>
            <p className="text-sm text-ink-soft">{t(`admin.count.${r.role}`)}</p>
          </button>
        ))}
      </div>

      <Card className="mb-6">
        <CardHeader
          icon={<Users size={17} />}
          title={t('admin.users')}
          subtitle={t('admin.usersHint')}
          action={
            <div className="relative w-56">
              <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint" aria-hidden />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('common.search')} className="h-9 pl-9 text-sm" aria-label={t('common.search')} />
            </div>
          }
        />
        {users.loading ? (
          <Spinner />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="border-y border-line bg-surface text-xs font-semibold tracking-wide text-ink-faint uppercase">
                <tr>
                  <th className="px-5 py-2.5">{t('admin.name')}</th>
                  <th className="px-3 py-2.5">{t('admin.role')}</th>
                  <th className="px-3 py-2.5">{t('admin.assignments')}</th>
                  <th className="px-3 py-2.5">{t('admin.joined')}</th>
                  <th className="px-5 py-2.5 text-right">{t('admin.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {list.map((u) => {
                  const self = u.id === profile?.id
                  return (
                    <tr key={u.id} className={cn(!u.is_active && 'opacity-55')}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.full_name} size={36} />
                          <div className="min-w-0">
                            <p className="font-medium">
                              {u.full_name} {self && <Badge tone="brand">{t('admin.you')}</Badge>}
                            </p>
                            <p className="text-sm text-ink-faint">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Select value={u.role} disabled={self} title={self ? t('admin.cannotChangeSelf') : undefined} onChange={(e) => void update(u, { role: e.target.value as Role })} className="h-9 w-40 text-sm">
                          {(['admin', 'caregiver', 'family'] as const).map((r) => (
                            <option key={r} value={r}>
                              {t(`role.${r}`)}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex max-w-xs flex-wrap gap-1">
                          {u.elder_members.length === 0 ? (
                            <span className="text-sm text-warn-700">{t('admin.noAssignments')}</span>
                          ) : (
                            u.elder_members.map((m) =>
                              m.elder ? (
                                <Link key={m.elder.id} to={`/elders/${m.elder.id}`}>
                                  <Badge tone="brand">{m.elder.full_name}</Badge>
                                </Link>
                              ) : null,
                            )
                          )}
                        </div>
                      </td>
                      <td className="tabular px-3 py-3 text-sm text-ink-soft">{fmt(u.created_at, 'd MMM yyyy')}</td>
                      <td className="px-5 py-3 text-right">
                        <Button size="sm" variant={u.is_active ? 'secondary' : 'primary'} disabled={self} onClick={() => void update(u, { is_active: !u.is_active })}>
                          {u.is_active ? t('admin.deactivate') : t('admin.activate')}
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-line px-5 py-3 text-sm text-ink-faint">{t('admin.assignHint')}</p>
      </Card>

      <Card>
        <CardHeader icon={<HeartHandshake size={17} />} title={t('admin.elders')} subtitle={t('admin.eldersHint')} />
        <ul className="divide-y divide-line/70 border-t border-line/70">
          {(elders.data ?? []).map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-5 py-3">
              <Avatar name={e.full_name} size={34} />
              <Link to={`/elders/${e.id}`} className="flex-1 font-medium hover:underline">
                {e.full_name}
              </Link>
              <span className="text-sm text-ink-faint">{t('elders.teamCount', { n: e.elder_members[0]?.count ?? 0 })}</span>
              <button type="button" onClick={() => deleteElder(e.id, e.full_name)} className="rounded-lg p-2 text-ink-faint hover:bg-bad-50 hover:text-bad-600" aria-label={t('common.delete')}>
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </>
  )
}
