import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Bell, CalendarDays, CalendarRange, HeartHandshake, LayoutDashboard, LogOut, Menu, MessagesSquare, ShieldCheck, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationsContext'
import { useI18n, type TKey } from '../i18n'
import { LanguageSwitcher } from './LanguageSwitcher'
import { LogoMark, Wordmark } from './Logo'
import { Avatar, cn } from './ui'

interface NavItem {
  to: string
  label: TKey
  icon: typeof Bell
  adminOnly?: boolean
  badge?: 'notifications' | 'messages'
}

const NAV: NavItem[] = [
  { to: '/', label: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/elders', label: 'nav.elders', icon: HeartHandshake },
  { to: '/planner', label: 'nav.planner', icon: CalendarRange },
  { to: '/events', label: 'nav.events', icon: CalendarDays },
  { to: '/messages', label: 'nav.messages', icon: MessagesSquare, badge: 'messages' },
  { to: '/notifications', label: 'nav.notifications', icon: Bell, badge: 'notifications' },
  { to: '/admin', label: 'nav.admin', icon: ShieldCheck, adminOnly: true },
]

export function Layout() {
  const { profile, signOut, isAdmin } = useAuth()
  const { unread, unreadMessages } = useNotifications()
  const { t } = useI18n()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => setMenuOpen(false), [location.pathname])

  if (!profile) return null
  const counts = { notifications: unread, messages: unreadMessages }

  const nav = (
    <nav className="flex flex-col gap-1" aria-label="Main">
      <p className="eyebrow mb-2 px-3 text-brand-300/70">{t('nav.section')}</p>
      {NAV.filter((n) => !n.adminOnly || isAdmin).map((item) => {
        const count = item.badge ? counts[item.badge] : 0
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition-colors',
                isActive ? 'bg-white text-brand-900 shadow-sm' : 'text-brand-100/85 hover:bg-white/8 hover:text-white',
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon size={19} aria-hidden className={isActive ? 'text-brand-600' : 'text-brand-300 group-hover:text-white'} />
                <span className="flex-1">{t(item.label)}</span>
                {count > 0 && (
                  <span className="tabular min-w-5 rounded-full bg-sun-500 px-1.5 text-center text-xs font-bold text-brand-950">{count > 99 ? '99+' : count}</span>
                )}
              </>
            )}
          </NavLink>
        )
      })}
    </nav>
  )

  const userBlock = (
    <div className="flex flex-col gap-3 border-t border-white/10 pt-4">
      <LanguageSwitcher userId={profile.id} dark />
      <div className="flex items-center gap-1">
        <NavLink to="/profile" className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 hover:bg-white/8">
          <Avatar name={profile.full_name} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-white">{profile.full_name || profile.email}</p>
            <p className="text-xs text-brand-300">{t(`role.${profile.role}`)}</p>
          </div>
        </NavLink>
        <button type="button" onClick={() => void signOut()} title={t('nav.logout')} aria-label={t('nav.logout')} className="rounded-lg p-2.5 text-brand-300 hover:bg-white/8 hover:text-white">
          <LogOut size={18} />
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-7 overflow-hidden bg-brand-900 p-4 lg:flex">
        <SidebarGlow />
        <div className="relative flex items-center gap-2.5 px-2 pt-1">
          <LogoMark dark />
          <Wordmark light />
        </div>
        <div className="relative flex-1 overflow-y-auto">{nav}</div>
        <div className="relative">{userBlock}</div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-brand-900 px-4 py-2.5 lg:hidden">
        <div className="flex items-center gap-2">
          <LogoMark size={30} dark />
          <Wordmark light />
        </div>
        <div className="flex items-center gap-1">
          <NavLink to="/notifications" className="relative rounded-lg p-2 text-brand-100 hover:bg-white/10" aria-label={t('nav.notifications')}>
            <Bell size={20} />
            {unread > 0 && <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-sun-500 ring-2 ring-brand-900" />}
          </NavLink>
          <button type="button" className="rounded-lg p-2 text-brand-100 hover:bg-white/10" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu" aria-expanded={menuOpen}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>
      {menuOpen && (
        <div className="fixed inset-x-0 top-[54px] bottom-0 z-20 flex flex-col gap-6 overflow-y-auto bg-brand-900 p-4 lg:hidden">
          {nav}
          {userBlock}
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <Outlet />
      </main>
    </div>
  )
}

/** Faint arc motif in the sidebar corner — the same arc as the logo and the dashboard. */
function SidebarGlow() {
  return (
    <svg className="pointer-events-none absolute -right-24 -bottom-10 opacity-[0.07]" width="320" height="220" viewBox="0 0 320 220" aria-hidden>
      <path d="M20 210a140 140 0 0 1 280 0" fill="none" stroke="#fff" strokeWidth="2" />
      <path d="M60 210a100 100 0 0 1 200 0" fill="none" stroke="#fff" strokeWidth="2" />
      <path d="M100 210a60 60 0 0 1 120 0" fill="none" stroke="#fff" strokeWidth="2" />
    </svg>
  )
}
