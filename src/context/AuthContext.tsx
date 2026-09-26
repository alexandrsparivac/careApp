import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'
import { useI18n } from '../i18n'

interface AuthValue {
  session: Session | null
  profile: Profile | null
  loading: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
  isAdmin: boolean
  isStaff: boolean
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { setLang } = useI18n()
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  const loadProfile = useCallback(
    async (userId: string) => {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
      setProfile(data as Profile | null)
      setLoadedFor(userId)
      if (data?.language) setLang(data.language)
    },
    [setLang],
  )

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return
      setSession(data.session)
      if (data.session) await loadProfile(data.session.user.id)
      setInitializing(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (!next) {
        setProfile(null)
      } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        // Supabase warns against awaiting client calls inside this callback.
        setTimeout(() => loadProfile(next.user.id), 0)
      }
    })
    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const refreshProfile = useCallback(async () => {
    if (session) await loadProfile(session.user.id)
  }, [session, loadProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const value: AuthValue = {
    session,
    profile,
    // Also "loading" while a freshly signed-in user's profile is being fetched
    loading: initializing || (session !== null && loadedFor !== session.user.id),
    refreshProfile,
    signOut,
    isAdmin: profile?.role === 'admin',
    isStaff: profile?.role === 'admin' || profile?.role === 'caregiver',
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
