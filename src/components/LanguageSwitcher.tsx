import { Languages } from 'lucide-react'
import { LANGUAGES, useI18n } from '../i18n'
import { supabase } from '../lib/supabase'
import type { Lang } from '../lib/types'
import { cn } from './ui'

/** Segmented RO / EN / RU switch. Persists to localStorage and, when signed in, to the profile. */
export function LanguageSwitcher({ userId, dark }: { userId?: string; dark?: boolean }) {
  const { lang, setLang, t } = useI18n()

  const choose = (code: Lang) => {
    setLang(code)
    if (userId) void supabase.from('profiles').update({ language: code }).eq('id', userId)
  }

  return (
    <div className="flex items-center gap-2" role="group" aria-label={t('lang.label')}>
      <Languages size={16} className={dark ? 'text-brand-300' : 'text-ink-faint'} aria-hidden />
      <div className={cn('inline-flex rounded-lg p-0.5', dark ? 'bg-white/8 ring-1 ring-white/10' : 'border border-line bg-white')}>
        {LANGUAGES.map((l) => (
          <button
            key={l.code}
            type="button"
            title={l.label}
            aria-pressed={lang === l.code}
            onClick={() => choose(l.code)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-semibold tracking-wide transition-colors',
              lang === l.code
                ? dark
                  ? 'bg-sun-500 text-brand-950'
                  : 'bg-brand-700 text-white'
                : dark
                  ? 'text-brand-200 hover:bg-white/10 hover:text-white'
                  : 'text-ink-soft hover:bg-surface-2',
            )}
          >
            {l.short}
          </button>
        ))}
      </div>
    </div>
  )
}
