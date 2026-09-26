import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Ban, Database } from 'lucide-react'
import { isSupabaseConfigured } from './lib/supabase'
import { AuthProvider, useAuth } from './context/AuthContext'
import { NotificationsProvider } from './context/NotificationsContext'
import { ToastProvider } from './context/ToastContext'
import { I18nProvider, useI18n } from './i18n'
import { Layout } from './components/Layout'
import { LanguageSwitcher } from './components/LanguageSwitcher'
import { Button, Spinner } from './components/ui'
import { LoginPage, RegisterPage } from './pages/AuthPages'
import { DashboardPage } from './pages/Dashboard'
import { EldersPage } from './pages/Elders'
import { ElderDetailPage } from './pages/ElderDetail'
import { PlannerPage } from './pages/Planner'
import { EventsPage } from './pages/Events'
import { MessagesPage } from './pages/Messages'
import { NotificationsPage } from './pages/Notifications'
import { AdminPage } from './pages/Admin'
import { ProfilePage } from './pages/Profile'

function FullScreenNote({ icon, title, text, action }: { icon: React.ReactNode; title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-900 text-sun-500">{icon}</span>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="max-w-[56ch] whitespace-pre-line text-ink-soft">{text}</p>
      {action}
    </div>
  )
}

function Protected() {
  const { session, profile, loading, signOut, isAdmin } = useAuth()
  const { t } = useI18n()

  if (loading) return <Spinner />
  if (!session) return <Navigate to="/login" replace />
  if (!profile) {
    // Signed in but no profile row: the SQL migrations have not been applied yet.
    return <FullScreenNote icon={<Database size={30} />} title={t('setup.noProfileTitle')} text={t('setup.noProfileText')} action={<Button variant="secondary" onClick={() => void signOut()}>{t('nav.logout')}</Button>} />
  }
  if (!profile.is_active) {
    return <FullScreenNote icon={<Ban size={30} />} title={t('setup.inactiveTitle')} text={t('setup.inactiveText')} action={<Button variant="secondary" onClick={() => void signOut()}>{t('nav.logout')}</Button>} />
  }

  return (
    <NotificationsProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="elders" element={<EldersPage />} />
          <Route path="elders/:id" element={<ElderDetailPage />} />
          <Route path="planner" element={<PlannerPage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="messages/:elderId" element={<MessagesPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="admin" element={isAdmin ? <AdminPage /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </NotificationsProvider>
  )
}

function SetupNeeded() {
  const { t } = useI18n()
  return <FullScreenNote icon={<Database size={30} />} title={t('setup.title')} text={t('setup.text')} />
}

export default function App() {
  return (
    <I18nProvider>
      {!isSupabaseConfigured ? (
        <SetupNeeded />
      ) : (
        <BrowserRouter>
          <ToastProvider>
            <AuthProvider>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/*" element={<Protected />} />
              </Routes>
            </AuthProvider>
          </ToastProvider>
        </BrowserRouter>
      )}
    </I18nProvider>
  )
}
