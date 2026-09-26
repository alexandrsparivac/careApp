import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { format, formatDistanceToNow, isToday, isTomorrow, isYesterday, type Locale } from 'date-fns'
import { enGB, ro as roLocale, ru as ruLocale } from 'date-fns/locale'
import type { Lang } from '../lib/types'
import ro from './ro'
import en from './en'
import ru from './ru'

export type TKey = keyof typeof ro
export type Dictionary = Record<TKey, string>
type Vars = Record<string, string | number | null | undefined>

const DICTIONARIES: Record<Lang, Dictionary> = { ro, en, ru }
const DATE_LOCALES: Record<Lang, Locale> = { ro: roLocale, en: enGB, ru: ruLocale }

export const LANGUAGES: { code: Lang; label: string; short: string }[] = [
  { code: 'ro', label: 'Română', short: 'RO' },
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'ru', label: 'Русский', short: 'RU' },
]

const STORAGE_KEY = 'carebridge.lang'

export function interpolate(template: string, vars?: Vars) {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const v = vars[name]
    return v === undefined || v === null ? '' : String(v)
  })
}

function initialLang(): Lang {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'ro' || saved === 'en' || saved === 'ru') return saved
  const nav = navigator.language.slice(0, 2)
  return nav === 'en' || nav === 'ru' ? nav : 'ro'
}

interface I18nValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: TKey, vars?: Vars) => string
  /** date-fns pattern, e.g. 'PPP', 'HH:mm', 'EEEE d MMM' */
  fmt: (date: string | Date, pattern: string) => string
  /** "Today, 14:30" / "Tomorrow, 09:00" / "12 Oct, 10:15" */
  fmtWhen: (date: string | Date) => string
  fmtAgo: (date: string | number | Date) => string
  locale: Locale
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  const setLang = useCallback((next: Lang) => {
    localStorage.setItem(STORAGE_KEY, next)
    document.documentElement.lang = next
    setLangState(next)
  }, [])

  const value = useMemo<I18nValue>(() => {
    const dict = DICTIONARIES[lang]
    const locale = DATE_LOCALES[lang]
    const t = (key: TKey, vars?: Vars) => interpolate(dict[key] ?? ro[key] ?? key, vars)
    const fmt = (date: string | Date, pattern: string) => format(new Date(date), pattern, { locale })
    const fmtWhen = (date: string | Date) => {
      const d = new Date(date)
      const time = format(d, 'HH:mm', { locale })
      if (isToday(d)) return `${t('common.today')}, ${time}`
      if (isTomorrow(d)) return `${t('common.tomorrow')}, ${time}`
      if (isYesterday(d)) return `${t('common.yesterday')}, ${time}`
      return format(d, 'd MMM yyyy, HH:mm', { locale })
    }
    const fmtAgo = (date: string | number | Date) => formatDistanceToNow(new Date(date), { addSuffix: true, locale })
    return { lang, setLang, t, fmt, fmtWhen, fmtAgo, locale }
  }, [lang, setLang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider')
  return ctx
}
