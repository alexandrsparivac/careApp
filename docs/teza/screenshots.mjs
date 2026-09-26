// Capturi de ecran pentru teză → docs/teza/img/ui_*.png
//
// Paginile publice (autentificare, înregistrare) se capturează mereu.
// Pentru paginile din aplicație sunt necesare datele unui cont (de preferat
// administrator, după generarea datelor demonstrative):
//
//   TEZA_EMAIL=adresa@exemplu.md TEZA_PASSWORD='parola' node docs/teza/screenshots.mjs
//
// Opțional: TEZA_URL=http://localhost:5173 (implicit: aplicația publicată).
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const OUT = fileURLToPath(new URL('./img/', import.meta.url))
mkdirSync(OUT, { recursive: true })
const BASE = (process.env.TEZA_URL ?? 'https://carebridge-navy.vercel.app').replace(/\/$/, '')
const EMAIL = process.env.TEZA_EMAIL
const PASSWORD = process.env.TEZA_PASSWORD

const browser = await chromium.launch()
const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'ro-RO' })
await desktop.addInitScript(() => localStorage.setItem('carebridge.lang', 'ro'))
const page = await desktop.newPage()

async function shot(name, opts = {}) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(opts.wait ?? 1200)
  await page.screenshot({ path: `${OUT}${name}.png`, fullPage: opts.fullPage ?? false })
  console.log('✓', name)
}

await page.goto(`${BASE}/login`)
await shot('ui_login')
await page.goto(`${BASE}/register`)
await shot('ui_register')

if (!EMAIL || !PASSWORD) {
  console.log('\nTEZA_EMAIL / TEZA_PASSWORD lipsesc — s-au capturat doar paginile publice.')
  await browser.close()
  process.exit(0)
}

await page.goto(`${BASE}/login`)
await page.fill('input[type=email]', EMAIL)
await page.fill('input[type=password]', PASSWORD)
await page.click('button[type=submit]')
await page.waitForURL(`${BASE}/`, { timeout: 20000 })
await page.evaluate(() => localStorage.setItem('carebridge.lang', 'ro'))

await shot('ui_dashboard', { wait: 2500 })
await shot('ui_dashboard_full', { fullPage: true })

await page.goto(`${BASE}/elders`)
await shot('ui_elders')
const href = await page.locator('a[href^="/elders/"]').first().getAttribute('href')

if (href) {
  await page.goto(`${BASE}${href}?tab=overview`)
  await shot('ui_elder_overview', { wait: 2000 })
  await page.goto(`${BASE}${href}?tab=plan`)
  await shot('ui_elder_plan')
  await page.locator('ul li [role=button]').first().click().catch(() => {})
  await shot('ui_activity_detail', { wait: 800 })
  await page.keyboard.press('Escape')
  await page.goto(`${BASE}${href}?tab=journal`)
  await shot('ui_elder_journal')
  await page.getByRole('button', { name: /Adaugă observație/ }).first().click()
  await page.fill('input[type=number] >> nth=3', '38.4').catch(() => {})
  await shot('ui_observation_form', { wait: 800 })
  await page.keyboard.press('Escape')
  await page.goto(`${BASE}${href}?tab=messages`)
  await shot('ui_elder_messages')
}

await page.goto(`${BASE}/planner`)
await shot('ui_planner')
await page.getByRole('button', { name: /Planifică activitate/ }).first().click().catch(() => {})
await shot('ui_activity_form', { wait: 800 })
await page.keyboard.press('Escape')

await page.goto(`${BASE}/events`)
await shot('ui_events')
await page.goto(`${BASE}/messages`)
await shot('ui_messages', { wait: 2000 })
await page.goto(`${BASE}/notifications`)
await shot('ui_notifications')
await page.goto(`${BASE}/admin`)
await shot('ui_admin')

// Vedere mobilă
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, locale: 'ro-RO', storageState: await desktop.storageState() })
const m = await mobile.newPage()
await m.goto(`${BASE}/`)
await m.waitForLoadState('networkidle').catch(() => {})
await m.waitForTimeout(2500)
await m.screenshot({ path: `${OUT}ui_mobile_dashboard.png` })
console.log('✓ ui_mobile_dashboard')

await browser.close()
