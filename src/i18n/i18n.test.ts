import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import ro from './ro'
import en from './en'
import ru from './ru'
import { interpolate, type TKey } from './index'

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('interpolate', () => {
  it('replaces named placeholders', () => {
    expect(interpolate('{a} of {b}', { a: 3, b: 8 })).toBe('3 of 8')
  })
  it('replaces missing values with an empty string', () => {
    expect(interpolate('Hi {name}!', {})).toBe('Hi !')
  })
  it('leaves text without placeholders unchanged', () => {
    expect(interpolate('plain')).toBe('plain')
  })
})

describe.each([
  ['en', en],
  ['ru', ru],
])('dictionary %s', (_, dict) => {
  const keys = Object.keys(ro) as TKey[]

  it('has exactly the same keys as ro', () => {
    expect(Object.keys(dict).sort()).toEqual([...keys].sort())
  })

  it('has no empty translations', () => {
    expect(keys.filter((k) => !dict[k]?.trim())).toEqual([])
  })

  it('uses the same placeholders as ro for every key', () => {
    const mismatched = keys.filter((k) => placeholders(dict[k]).join() !== placeholders(ro[k]).join())
    expect(mismatched).toEqual([])
  })
})

describe('source code', () => {
  // Every literal t('...') key used in src/ must exist in the dictionary.
  const files: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.tsx?$/.test(name) && !name.endsWith('.test.ts')) files.push(p)
    }
  }
  walk(fileURLToPath(new URL('..', import.meta.url)))

  it('only references keys that exist', () => {
    const used = new Set<string>()
    for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(/\bt\('([\w.]+)'/g)) used.add(m[1])
    expect([...used].filter((k) => !(k in ro))).toEqual([])
    expect(used.size).toBeGreaterThan(100)
  })
})
