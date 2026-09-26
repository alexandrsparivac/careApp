// Generează figurile tezei (SVG → PNG) în docs/teza/img/.
// Rulare: node docs/teza/diagrams.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const OUT = fileURLToPath(new URL('./img/', import.meta.url))
mkdirSync(OUT, { recursive: true })

const FONT = 'Times New Roman'
const C = {
  ink: '#1a1a1a',
  gray: '#5f6b6e',
  line: '#9aa5a8',
  soft: '#eef3f4',
  soft2: '#f6f8f8',
  head: '#1c5e6b',
  headSoft: '#d2e5e8',
  accent: '#e9a23b',
  ok: '#3a8a4b',
  bad: '#c23b2c',
  plan: '#4a4e94',
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function svg(w, h, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs>
  <marker id="arr" viewBox="0 0 10 10" refX="9.5" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.ink}"/></marker>
  <marker id="arrOpen" viewBox="0 0 10 10" refX="9.5" refY="5" markerWidth="10" markerHeight="10" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10" fill="none" stroke="${C.ink}" stroke-width="1.4"/></marker>
  <marker id="tri" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="14" markerHeight="14" orient="auto"><path d="M0,0 L12,6 L0,12 z" fill="#fff" stroke="${C.ink}" stroke-width="1.2"/></marker>
</defs>
<rect width="100%" height="100%" fill="#fff"/>
<g font-family="${FONT}" font-size="22" fill="${C.ink}">${body}</g></svg>`
}

function text(x, y, s, o = {}) {
  const { size = 22, anchor = 'middle', weight = 'normal', fill = C.ink, style = 'normal' } = o
  return `<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}" font-weight="${weight}" font-style="${style}" fill="${fill}">${esc(s)}</text>`
}

function lines(x, y, arr, o = {}) {
  const lh = o.lh ?? (o.size ?? 22) * 1.25
  return arr.map((s, i) => text(x, y + i * lh, s, o)).join('')
}

function box(x, y, w, h, o = {}) {
  const { title, body = [], fill = '#fff', head = null, r = 10, size = 20, titleSize = 22, dash = false, align = 'middle', stroke = C.ink } = o
  let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1.6" ${dash ? 'stroke-dasharray="8 6"' : ''}/>`
  let ty = y + 32
  if (title && head) {
    out += `<path d="M${x},${y + r} a${r},${r} 0 0 1 ${r},-${r} h${w - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${36 - r} h-${w} z" fill="${head}" stroke="${stroke}" stroke-width="1.6"/>`
    out += text(x + w / 2, y + 26, title, { size: titleSize, weight: 'bold', fill: head === C.head ? '#fff' : C.ink })
    ty = y + 36 + 28
  } else if (title) {
    out += text(align === 'start' ? x + 14 : x + w / 2, ty, title, { size: titleSize, weight: 'bold', anchor: align })
    ty += 28
  }
  if (body.length) out += lines(align === 'start' ? x + 14 : x + w / 2, ty, body, { size, anchor: align, fill: C.ink })
  return out
}

function arrow(x1, y1, x2, y2, o = {}) {
  const { label, dash = false, both = false, open = false, lx, ly, size = 18, color = C.ink, width = 1.6, anchor = 'middle' } = o
  const m = open ? 'arrOpen' : 'arr'
  let out = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" ${dash ? 'stroke-dasharray="8 6"' : ''} marker-end="url(#${m})" ${both ? `marker-start="url(#${m})"` : ''}/>`
  if (label) {
    const X = lx ?? (x1 + x2) / 2
    const Y = ly ?? (y1 + y2) / 2 - 8
    out += `<g>${String(label)
      .split('\n')
      .map((l, i) => text(X, Y + i * (size + 3), l, { size, anchor, fill: C.gray, style: 'italic' }))
      .join('')}</g>`
  }
  return out
}

function path(d, o = {}) {
  const { dash = false, arrowEnd = true, color = C.ink } = o
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.6" ${dash ? 'stroke-dasharray="8 6"' : ''} ${arrowEnd ? 'marker-end="url(#arr)"' : ''}/>`
}

function plainLine(x1, y1, x2, y2, o = {}) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${o.color ?? C.ink}" stroke-width="${o.width ?? 1.5}" ${o.dash ? 'stroke-dasharray="8 6"' : ''}/>`
}

function actor(cx, top, label) {
  const hy = top + 22
  return `<g stroke="${C.ink}" stroke-width="2.2" fill="none">
    <circle cx="${cx}" cy="${hy}" r="20" fill="#fff"/>
    <line x1="${cx}" y1="${hy + 20}" x2="${cx}" y2="${hy + 80}"/>
    <line x1="${cx - 36}" y1="${hy + 42}" x2="${cx + 36}" y2="${hy + 42}"/>
    <line x1="${cx}" y1="${hy + 80}" x2="${cx - 28}" y2="${hy + 125}"/>
    <line x1="${cx}" y1="${hy + 80}" x2="${cx + 28}" y2="${hy + 125}"/>
  </g>${text(cx, hy + 160, label, { size: 22, weight: 'bold' })}`
}

async function save(name, markup, width) {
  writeFileSync(`${OUT}${name}.svg`, markup)
  await sharp(Buffer.from(markup), { density: 200 }).resize({ width }).png().toFile(`${OUT}${name}.png`)
  console.log('✓', name)
}

// ---------------------------------------------------------------------------
// 1.1 Îmbătrânirea populației (OMS)
// ---------------------------------------------------------------------------
async function ageing() {
  const W = 1400, H = 720
  const x0 = 170, y0 = 610, top = 70, maxV = 2.5
  const Y = (v) => y0 - (v / maxV) * (y0 - top)
  const data = [
    { year: '2020', v: 1.0 },
    { year: '2030', v: 1.4 },
    { year: '2050', v: 2.1 },
  ]
  let b = ''
  for (let v = 0; v <= maxV + 1e-9; v += 0.5) {
    b += plainLine(x0, Y(v), W - 80, Y(v), { color: '#d9dfe0', width: 1.2 })
    b += text(x0 - 16, Y(v) + 7, v.toFixed(1).replace('.', ','), { size: 22, anchor: 'end', fill: C.gray })
  }
  const bw = 230, gap = (W - 80 - x0 - bw * 3) / 4
  data.forEach((d, i) => {
    const x = x0 + gap * (i + 1) + bw * i
    b += `<rect x="${x}" y="${Y(d.v)}" width="${bw}" height="${y0 - Y(d.v)}" fill="${i === 2 ? C.head : '#7fa9b1'}"/>`
    b += text(x + bw / 2, Y(d.v) - 16, `${d.v.toFixed(1).replace('.', ',')} mld.`, { size: 28, weight: 'bold' })
    b += text(x + bw / 2, y0 + 40, d.year, { size: 26 })
  })
  b += plainLine(x0, y0, W - 80, y0, { width: 2 })
  b += `<text transform="translate(60 ${(top + y0) / 2}) rotate(-90)" text-anchor="middle" font-size="24" fill="${C.gray}">Persoane cu vârsta de 60+ ani, miliarde</text>`
  b += text(x0 + (W - 80 - x0) / 2, H - 20, 'Anul', { size: 24, fill: C.gray })
  await save('fig_1_1_ageing', svg(W, H, b), 1600)
}

// ---------------------------------------------------------------------------
// 2.1 Diagrama cazurilor de utilizare
// ---------------------------------------------------------------------------
async function usecases() {
  const W = 1700, H = 1180
  const cases = [
    { t: 'Autentificare și gestionarea profilului', a: 'ACF' },
    { t: 'Gestionarea utilizatorilor și a rolurilor', a: 'A' },
    { t: 'Gestionarea persoanelor asistate', a: 'A' },
    { t: 'Formarea echipelor de îngrijire', a: 'A' },
    { t: 'Planificarea activităților de îngrijire', a: 'AC' },
    { t: 'Evidența realizării activităților', a: 'C' },
    { t: 'Consemnarea observațiilor de sănătate', a: 'CF' },
    { t: 'Vizualizarea planului, jurnalului și tendințelor', a: 'CF' },
    { t: 'Gestionarea evenimentelor', a: 'ACF' },
    { t: 'Comunicarea prin mesaje', a: 'CF' },
    { t: 'Primirea notificărilor', a: 'ACF' },
    { t: 'Procesarea activităților scadente', a: 'S' },
  ]
  const cx = 850, rw = 300, rh = 34, y1 = 120, step = 86
  let b = `<rect x="470" y="40" width="760" height="${H - 70}" fill="${C.soft2}" stroke="${C.ink}" stroke-width="1.6"/>`
  b += text(850, 78, 'Platforma CareBridge', { size: 26, weight: 'bold' })
  const A = { x: 150, y: 150 }, Cg = { x: 150, y: 700 }, F = { x: 1550, y: 420 }
  b += actor(A.x, A.y, 'Administrator')
  b += actor(Cg.x, Cg.y, 'Îngrijitor')
  b += actor(F.x, F.y, 'Membru al familiei')
  // actor sistem
  b += box(1400, 1010, 280, 90, { title: '«sistem»', body: ['Planificator (pg_cron)'], size: 20, titleSize: 18 })
  cases.forEach((c, i) => {
    const y = y1 + i * step
    b += `<ellipse cx="${cx}" cy="${y}" rx="${rw}" ry="${rh}" fill="#fff" stroke="${C.ink}" stroke-width="1.6"/>`
    b += text(cx, y + 7, c.t, { size: 21 })
    if (c.a.includes('A')) b += plainLine(A.x + 40, A.y + 70, cx - rw, y, { color: C.head })
    if (c.a.includes('C')) b += plainLine(Cg.x + 40, Cg.y + 70, cx - rw, y, { color: C.gray })
    if (c.a.includes('F')) b += plainLine(F.x - 40, F.y + 70, cx + rw, y, { color: C.ink })
    if (c.a.includes('S')) b += plainLine(1400, 1055, cx + rw, y)
  })
  await save('fig_2_1_usecase', svg(W, H, b), 1600)
}

// ---------------------------------------------------------------------------
// 3.1 Arhitectura generală
// ---------------------------------------------------------------------------
async function architecture() {
  const W = 1700, H = 1110
  let b = ''
  // Client layer
  b += `<rect x="40" y="40" width="1180" height="290" rx="14" fill="${C.soft2}" stroke="${C.ink}" stroke-width="1.6"/>`
  b += text(60, 76, 'Nivelul de prezentare — navigator web (aplicație SPA: React + TypeScript)', { size: 24, weight: 'bold', anchor: 'start' })
  b += box(70, 100, 360, 200, { title: 'Pagini', head: C.headSoft, body: ['Panou principal', 'Persoane asistate', 'Planificare · Evenimente', 'Mesaje · Notificări', 'Administrare · Profil'], size: 20 })
  b += box(455, 100, 340, 200, { title: 'Contexte', head: C.headSoft, body: ['Autentificare (sesiune, rol)', 'Notificări (Realtime)', 'Mesaje toast', 'Internaționalizare', '(ro / en / ru)'], size: 20 })
  b += box(820, 100, 370, 200, { title: 'Acces la date', head: C.headSoft, body: ['lib/api.ts — interogări', 'supabase-js (client)', 'lib/recurrence.ts', 'lib/vitals.ts', 'lib/notificationText.ts'], size: 20 })
  // Vercel
  b += box(1360, 100, 300, 200, { title: 'Vercel (CDN)', head: C.headSoft, body: ['găzduire statică', 'index.html, JS, CSS', 'rescriere SPA'], size: 20 })
  b += arrow(1358, 200, 1222, 200, { label: 'HTTPS', lx: 1290, ly: 188, size: 18 })
  b += text(1290, 228, 'fișiere statice', { size: 18, fill: C.gray, style: 'italic' })

  // Supabase services
  b += `<rect x="40" y="440" width="1620" height="640" rx="14" fill="#fff" stroke="${C.ink}" stroke-width="1.6" stroke-dasharray="10 6"/>`
  b += text(60, 478, 'Supabase (platformă BaaS)', { size: 24, weight: 'bold', anchor: 'start' })
  b += box(90, 510, 380, 150, { title: 'Auth (GoTrue)', head: C.headSoft, body: ['înregistrare, autentificare', 'emite token JWT'], size: 20 })
  b += box(560, 510, 380, 150, { title: 'PostgREST', head: C.headSoft, body: ['API REST generat din schemă', 'rol „authenticated” + JWT'], size: 20 })
  b += box(1030, 510, 380, 150, { title: 'Realtime', head: C.headSoft, body: ['WebSocket', 'postgres_changes (cu RLS)'], size: 20 })

  // PostgreSQL
  b += `<rect x="90" y="720" width="1520" height="330" rx="12" fill="${C.soft}" stroke="${C.ink}" stroke-width="1.6"/>`
  b += text(110, 756, 'Nivelul de date și logică — PostgreSQL', { size: 23, weight: 'bold', anchor: 'start' })
  b += box(120, 780, 330, 240, { title: 'Tabele (9)', body: ['profiles, elders,', 'elder_members,', 'care_activities,', 'observations, events,', 'messages, message_reads,', 'notifications'], size: 19 })
  b += box(475, 780, 330, 240, { title: 'Politici RLS (27)', body: ['has_elder_access()', 'is_admin(), is_staff()', 'autor = auth.uid()', 'fără INSERT pe', 'notificări din client'], size: 19 })
  b += box(830, 780, 330, 240, { title: 'Triggere (9)', body: ['creare profil', 'detecție alerte', 'notificări automate', 'completare câmpuri', 'de finalizare'], size: 19 })
  b += box(1185, 780, 395, 240, { title: 'Funcții și programare', body: ['process_due_activities()', 'unread_message_counts()', 'observation_flags()', 'pg_cron: la fiecare 5 min', '(opțional)'], size: 19 })

  // arrows client → services
  b += arrow(280, 332, 280, 508, { label: 'autentificare\n(e-mail, parolă)', lx: 268, ly: 372, size: 18, anchor: 'end' })
  b += arrow(1005, 332, 750, 508, { label: 'cereri REST + JWT', lx: 820, ly: 400, size: 18, anchor: 'end' })
  b += arrow(1220, 508, 1100, 332, { label: 'evenimente push (WSS)', lx: 1180, ly: 400, size: 18, anchor: 'start' })
  b += arrow(750, 662, 750, 718, {})
  b += arrow(1220, 718, 1220, 662, { label: 'modificări (WAL)', lx: 1330, ly: 700, size: 18 })
  await save('fig_3_1_architecture', svg(W, H, b), 1600)
}

// ---------------------------------------------------------------------------
// 3.2 Diagrama de implementare (deployment)
// ---------------------------------------------------------------------------
function node3d(x, y, w, h, title, body = [], o = {}) {
  const d = 16
  return `<path d="M${x},${y} l${d},-${d} h${w} v${h} l-${d},${d}" fill="${C.soft}" stroke="${C.ink}" stroke-width="1.6"/>
  <line x1="${x + w}" y1="${y}" x2="${x + w + d}" y2="${y - d}" stroke="${C.ink}" stroke-width="1.6"/>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff" stroke="${C.ink}" stroke-width="1.6"/>
  ${text(x + w / 2, y + 32, title, { size: o.titleSize ?? 22, weight: 'bold' })}
  ${lines(x + w / 2, y + 64, body, { size: 19 })}`
}

async function deployment() {
  const W = 1700, H = 900
  let b = '<g transform="translate(0 60)">'
  b += node3d(60, 80, 380, 250, '«dispozitiv» Utilizator', ['navigator web', '(desktop sau mobil)', '', 'aplicația SPA rulează', 'integral în navigator'])
  b += node3d(640, 80, 420, 250, '«nod» Vercel Edge Network', ['CDN global, HTTPS', '', 'artefact: dist/', 'index.html · assets/*.js', 'assets/*.css · fonturi'])
  b += node3d(1220, 80, 420, 540, '«nod» Supabase Cloud', [])
  b += box(1250, 150, 360, 70, { body: ['Auth — /auth/v1'], size: 20, r: 6 })
  b += box(1250, 235, 360, 70, { body: ['PostgREST — /rest/v1'], size: 20, r: 6 })
  b += box(1250, 320, 360, 70, { body: ['Realtime — /realtime/v1'], size: 20, r: 6 })
  b += box(1250, 405, 360, 190, { title: '«bază de date»', body: ['PostgreSQL', 'schema public', 'RLS, triggere, funcții', 'pg_cron (opțional)'], size: 20, titleSize: 19, fill: C.soft2 })
  b += node3d(60, 540, 380, 230, '«dispozitiv» Stația dezvoltatorului', ['cod sursă (Git)', 'Node.js, npm, Vite', 'Vercel CLI'])
  b += node3d(640, 540, 420, 230, '«serviciu» Vercel Build', ['npm install', 'npm run build', '(tsc + vite build)'])

  b += arrow(442, 190, 638, 190, { label: 'HTTPS: resurse statice', lx: 540, ly: 176, size: 18, both: false })
  b += path('M250,62 V-20 H1430 V60')
  b += text(840, -30, 'HTTPS (REST, Auth) · WSS (Realtime) + token JWT', { size: 18, fill: C.gray, style: 'italic' })
  b += arrow(442, 655, 638, 655, { label: 'vercel deploy --prod', lx: 540, ly: 640, size: 18 })
  b += arrow(850, 538, 850, 332, { label: 'publicare artefact', lx: 945, ly: 450, size: 18 })
  b += arrow(1062, 700, 1218, 560, { dash: true })
  b += lines(1080, 760, ['variabile de mediu:', 'VITE_SUPABASE_URL,', 'VITE_SUPABASE_ANON_KEY'], { size: 17, anchor: 'start', fill: C.gray, style: 'italic', lh: 21 })
  b += '</g>'
  await save('fig_3_2_deployment', svg(W, H, b), 1600)
}

// ---------------------------------------------------------------------------
// 3.3 Procesul iterativ de dezvoltare
// ---------------------------------------------------------------------------
async function process() {
  const W = 1700, H = 640
  const it = [
    ['Iterația 0', 'Analiza domeniului,', 'cerințe, arhitectură'],
    ['Iterația 1', 'Schema BD, RLS,', 'autentificare, roluri'],
    ['Iterația 2', 'Persoane asistate,', 'echipe, planificare'],
    ['Iterația 3', 'Evidență, observații,', 'alerte, evenimente'],
    ['Iterația 4', 'Mesaje, notificări,', 'timp real, i18n'],
    ['Iterația 5', 'Testare, publicare,', 'documentație'],
  ]
  const w = 262, h = 150, y = 90
  let b = ''
  it.forEach((s, i) => {
    const x = 30 + i * (w + 12)
    const tip = 30
    const d = `M${x},${y} h${w - tip} l${tip},${h / 2} l-${tip},${h / 2} h-${w - tip} ${i ? `l${tip},-${h / 2} z` : 'z'}`
    b += `<path d="${d}" fill="${i === 5 ? C.head : i % 2 ? C.headSoft : C.soft}" stroke="${C.ink}" stroke-width="1.5"/>`
    const cx = x + w / 2 + (i ? tip / 2 : 0) - tip / 2
    const f = i === 5 ? '#fff' : C.ink
    b += text(cx, y + 42, s[0], { size: 22, weight: 'bold', fill: f })
    b += text(cx, y + 80, s[1], { size: 19, fill: f })
    b += text(cx, y + 106, s[2], { size: 19, fill: f })
  })
  // ciclul din interiorul fiecărei iterații
  const cy = 470, r = 110, cx0 = 850
  const steps = ['Planificare', 'Implementare', 'Verificare', 'Revizuire']
  b += text(cx0, 300, 'Ciclul fiecărei iterații', { size: 24, weight: 'bold' })
  b += plainLine(cx0 - 140, 312, cx0 + 140, 312, { color: C.line })
  b += `<circle cx="${cx0}" cy="${cy}" r="${r}" fill="none" stroke="${C.line}" stroke-width="2" stroke-dasharray="6 6"/>`
  const pos = [
    [cx0, cy - r],
    [cx0 + r, cy],
    [cx0, cy + r],
    [cx0 - r, cy],
  ]
  steps.forEach((s, i) => {
    const [x, y2] = pos[i]
    b += `<rect x="${x - 95}" y="${y2 - 24}" width="190" height="48" rx="24" fill="#fff" stroke="${C.ink}" stroke-width="1.5"/>`
    b += text(x, y2 + 7, s, { size: 20 })
  })
  b += path(`M${cx0 + 70},${cy - r + 20} Q${cx0 + r - 10},${cy - r + 10} ${cx0 + r - 10},${cy - 30}`)
  b += path(`M${cx0 + r - 10},${cy + 30} Q${cx0 + r - 10},${cy + r - 10} ${cx0 + 100},${cy + r - 10}`)
  b += path(`M${cx0 - 100},${cy + r - 10} Q${cx0 - r + 10},${cy + r - 10} ${cx0 - r + 10},${cy + 30}`)
  b += path(`M${cx0 - r + 10},${cy - 30} Q${cx0 - r + 10},${cy - r + 10} ${cx0 - 100},${cy - r + 10}`)
  b += lines(1180, 430, ['rezultat: increment funcțional', 'testat și publicat'], { size: 20, anchor: 'start', fill: C.gray, style: 'italic' })
  b += lines(200, 430, ['intrare: obiectivele iterației', 'și observațiile anterioare'], { size: 20, anchor: 'start', fill: C.gray, style: 'italic' })
  await save('fig_3_3_process', svg(W, H, b), 1600)
}

// ---------------------------------------------------------------------------
// 4.x Diagrama entitate–relație
// ---------------------------------------------------------------------------
function table(x, y, w, name, fields) {
  const rowH = 29
  const h = 40 + fields.length * rowH + 10
  let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff" stroke="${C.ink}" stroke-width="1.6"/>`
  out += `<rect x="${x}" y="${y}" width="${w}" height="40" fill="${C.head}" stroke="${C.ink}" stroke-width="1.6"/>`
  out += text(x + w / 2, y + 28, name, { size: 23, weight: 'bold', fill: '#fff' })
  fields.forEach((f, i) => {
    const [key, col, type] = f
    const yy = y + 40 + 26 + i * rowH
    if (key) out += text(x + 12, yy, key, { size: 16, anchor: 'start', weight: 'bold', fill: key === 'PK' ? C.accent : C.head })
    out += text(x + 58, yy, col, { size: 19, anchor: 'start', weight: key === 'PK' ? 'bold' : 'normal' })
    out += text(x + w - 12, yy, type, { size: 16, anchor: 'end', fill: C.gray })
  })
  return { svg: out, x, y, w, h }
}

async function er() {
  const W = 1900, H = 1440
  const T = {}
  T.profiles = table(40, 470, 400, 'profiles', [
    ['PK', 'id', 'uuid → auth.users'],
    ['', 'full_name', 'text'],
    ['', 'email', 'text'],
    ['', 'phone', 'text'],
    ['', 'role', 'user_role'],
    ['', 'language', 'text'],
    ['', 'is_active', 'boolean'],
    ['', 'created_at', 'timestamptz'],
  ])
  T.members = table(560, 60, 380, 'elder_members', [
    ['PK', 'elder_id', 'FK → elders'],
    ['PK', 'user_id', 'FK → profiles'],
    ['', 'relationship', 'text'],
    ['', 'created_at', 'timestamptz'],
  ])
  T.elders = table(760, 470, 400, 'elders', [
    ['PK', 'id', 'uuid'],
    ['', 'full_name', 'text'],
    ['', 'birth_date', 'date'],
    ['', 'gender', 'text'],
    ['', 'address', 'text'],
    ['', 'medical_conditions', 'text'],
    ['', 'medications', 'text'],
    ['', 'allergies', 'text'],
    ['', 'mobility_notes', 'text'],
    ['', 'emergency_contact_*', 'text'],
    ['FK', 'created_by', '→ profiles'],
  ])
  T.acts = table(1400, 40, 460, 'care_activities', [
    ['PK', 'id', 'uuid'],
    ['FK', 'elder_id', '→ elders'],
    ['', 'series_id', 'uuid'],
    ['', 'title, description', 'text'],
    ['', 'category', 'activity_category'],
    ['', 'scheduled_at', 'timestamptz'],
    ['', 'duration_minutes', 'int'],
    ['FK', 'assigned_to', '→ profiles'],
    ['', 'status', 'activity_status'],
    ['', 'completed_at', 'timestamptz'],
    ['FK', 'completed_by', '→ profiles'],
    ['', 'completion_notes', 'text'],
    ['', 'reminder_sent', 'boolean'],
  ])
  T.obs = table(1400, 560, 460, 'observations', [
    ['PK', 'id', 'uuid'],
    ['FK', 'elder_id', '→ elders'],
    ['FK', 'author_id', '→ profiles'],
    ['', 'observed_at', 'timestamptz'],
    ['', 'mood', 'mood_level'],
    ['', 'pain_level', 'smallint 0–10'],
    ['', 'systolic, diastolic', 'smallint'],
    ['', 'heart_rate, oxygen_sat.', 'smallint'],
    ['', 'temperature, glucose', 'numeric'],
    ['', 'appetite, sleep_quality', 'text'],
    ['', 'notes', 'text'],
    ['', 'is_alert', 'boolean'],
  ])
  T.events = table(1400, 1030, 460, 'events', [
    ['PK', 'id', 'uuid'],
    ['FK', 'elder_id', '→ elders'],
    ['', 'type', 'event_type'],
    ['', 'title, description', 'text'],
    ['', 'starts_at, ends_at', 'timestamptz'],
    ['', 'location', 'text'],
    ['', 'importance', 'importance_level'],
    ['FK', 'created_by', '→ profiles'],
  ])
  T.messages = table(880, 1090, 380, 'messages', [
    ['PK', 'id', 'uuid'],
    ['FK', 'elder_id', '→ elders'],
    ['FK', 'sender_id', '→ profiles'],
    ['', 'content', 'text'],
    ['', 'created_at', 'timestamptz'],
  ])
  T.reads = table(470, 1090, 370, 'message_reads', [
    ['PK', 'elder_id', 'FK → elders'],
    ['PK', 'user_id', 'FK → profiles'],
    ['', 'last_read_at', 'timestamptz'],
  ])
  T.notif = table(40, 1010, 400, 'notifications', [
    ['PK', 'id', 'uuid'],
    ['FK', 'user_id', '→ profiles'],
    ['FK', 'elder_id', '→ elders'],
    ['', 'type', 'text'],
    ['', 'payload', 'jsonb'],
    ['', 'link', 'text'],
    ['', 'is_read', 'boolean'],
    ['', 'created_at', 'timestamptz'],
  ])
  let b = ''
  const rel = (x1, y1, x2, y2, a = '1', z = 'N') => {
    let s = plainLine(x1, y1, x2, y2, { width: 1.8 })
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy)
    const ux = dx / L, uy = dy / L
    s += text(x1 + ux * 22 - uy * 14, y1 + uy * 22 + ux * 14 + 6, a, { size: 20, weight: 'bold', fill: C.head })
    s += text(x2 - ux * 24 - uy * 14, y2 - uy * 24 + ux * 14 + 6, z, { size: 20, weight: 'bold', fill: C.head })
    return s
  }
  const p = T.profiles, e = T.elders
  b += rel(p.x + p.w, p.y + 60, T.members.x, T.members.y + T.members.h - 20) // profiles–members
  b += rel(e.x + 120, e.y, T.members.x + 250, T.members.y + T.members.h) // elders–members
  b += rel(e.x + e.w, e.y + 60, T.acts.x, T.acts.y + 200)
  b += rel(e.x + e.w, e.y + 180, T.obs.x, T.obs.y + 120)
  b += rel(e.x + e.w, e.y + 300, T.events.x, T.events.y + 60)
  b += rel(e.x + 250, e.y + e.h, T.messages.x + 190, T.messages.y)
  b += rel(e.x + 60, e.y + e.h, T.reads.x + 280, T.reads.y)
  b += rel(p.x + 200, p.y + p.h, T.notif.x + 200, T.notif.y)
  b += rel(p.x + p.w, p.y + p.h - 30, T.reads.x + 60, T.reads.y)
  b += rel(e.x, e.y + e.h - 40, T.notif.x + T.notif.w, T.notif.y + 80)
  b += rel(p.x + p.w, p.y + 200, e.x, e.y + 200, '1', 'N')
  b += text(600, p.y + 190, 'created_by', { size: 17, fill: C.gray, style: 'italic' })
  for (const t of Object.values(T)) b += t.svg
  b += text(40, H - 18, 'Coloanele marcate „FK → profiles” referă tabelul profiles (responsabil, autor, expeditor, creator).', { size: 19, anchor: 'start', fill: C.gray, style: 'italic' })
  await save('fig_4_1_er', svg(W, H, b), 1700)
}

// ---------------------------------------------------------------------------
// 4.x Diagrama de secvență: alertă de sănătate
// ---------------------------------------------------------------------------
async function sequence() {
  const W = 1800, H = 960
  const L = [
    { x: 150, t: 'Îngrijitor', s: '(navigator)' },
    { x: 500, t: 'PostgREST', s: '(API + RLS)' },
    { x: 880, t: 'PostgreSQL', s: '(triggere)' },
    { x: 1260, t: 'Realtime', s: '(WebSocket)' },
    { x: 1630, t: 'Membru al familiei', s: '(navigator)' },
  ]
  let b = ''
  L.forEach((l) => {
    b += box(l.x - 130, 30, 260, 80, { body: [l.t, l.s], size: 21, fill: C.soft })
    b += plainLine(l.x, 110, l.x, H - 30, { dash: true, color: C.gray })
  })
  let y = 170
  const msg = (from, to, label, o = {}) => {
    const a = L[from].x, z = L[to].x
    let s = ''
    if (from === to) {
      const left = from === L.length - 1
      s += path(left ? `M${a},${y} h-70 v44 h66` : `M${a},${y} h70 v44 h-66`, { dash: o.dash })
      s += lines(left ? a - 84 : a + 84, y + 14, label.split('\n'), { size: 19, anchor: left ? 'end' : 'start', lh: 23 })
      y += 44 + 40
    } else {
      s += arrow(a + (z > a ? 6 : -6), y, z + (z > a ? -6 : 6), y, { dash: o.dash })
      s += lines((a + z) / 2, y - 12 - (label.split('\n').length - 1) * 23, label.split('\n'), { size: 19, lh: 23 })
      y += 66
    }
    return s
  }
  b += msg(0, 1, '1: POST /observations (temperatură 38,4 °C) + JWT')
  b += msg(1, 1, '2: verificare politică RLS\nhas_elder_access(elder_id)')
  b += msg(1, 2, '3: INSERT INTO observations')
  b += msg(2, 2, '4: BEFORE: observation_flags()\n→ [fever] ⇒ is_alert = true')
  b += msg(2, 2, "5: AFTER: notify_members('health_alert')\n→ INSERT INTO notifications")
  b += msg(2, 1, '6: rândul inserat', { dash: true })
  b += msg(1, 0, '7: 201 Created', { dash: true })
  b += msg(2, 3, '8: modificare (WAL): notifications')
  b += msg(3, 4, '9: postgres_changes (filtru user_id + RLS)')
  b += msg(4, 4, '10: mesaj toast, notificare desktop,\ncontor în meniu')
  await save('fig_4_2_sequence', svg(W, H, b), 1700)
}

// ---------------------------------------------------------------------------
// 4.x Diagrama de stări a unei activități
// ---------------------------------------------------------------------------
async function states() {
  const W = 1460, H = 720
  let b = ''
  const st = (x, y, w, t, sub, fill) => `<rect x="${x}" y="${y}" width="${w}" height="96" rx="40" fill="${fill}" stroke="${C.ink}" stroke-width="1.8"/>${text(x + w / 2, y + 42, t, { size: 25, weight: 'bold' })}${text(x + w / 2, y + 72, sub, { size: 18, fill: C.gray })}`
  b += `<circle cx="90" cy="330" r="16" fill="${C.ink}"/>`
  b += arrow(108, 330, 228, 330, { label: 'creare', lx: 168, ly: 316 })
  b += st(230, 282, 300, 'Planificată', 'status = planned', C.soft)
  b += st(1080, 60, 330, 'Realizată', 'status = done', '#eaf5ec')
  b += st(1080, 282, 330, 'Nerealizată', 'status = missed', '#fcebe8')
  b += st(1080, 510, 330, 'Anulată', 'status = cancelled', '#f1f1f1')
  b += arrow(532, 296, 1078, 110, { label: 'marcare „realizată”\n(completed_at, completed_by)', lx: 800, ly: 170 })
  b += arrow(532, 318, 1078, 318, { label: 'marcare „nerealizată” sau automat:\n+2 h după interval (process_due_activities)', lx: 805, ly: 282 })
  b += arrow(532, 372, 1078, 555, { label: 'anulare', lx: 800, ly: 470 })
  // reopen arcs
  b += path(`M1245,58 C1245,-10 470,-10 470,278`, { dash: true })
  b += text(760, 84, 'redeschidere (golește câmpurile de finalizare)', { size: 19, fill: C.gray, style: 'italic' })
  b += path(`M1245,608 C1245,720 380,720 380,380`, { dash: true })
  b += text(810, 705, 'redeschidere', { size: 19, fill: C.gray, style: 'italic' })
  b += arrow(1078, 356, 534, 356, { dash: true })
  b += text(805, 382, 'redeschidere', { size: 19, fill: C.gray, style: 'italic' })
  // reminder self-transition
  b += path(`M260,286 C250,190 380,190 372,278`)
  b += text(210, 196, 'memento la T − 30 min', { size: 19, fill: C.gray, style: 'italic', anchor: 'end' })
  await save('fig_4_3_states', svg(W, H, b), 1600)
}

// ---------------------------------------------------------------------------
// 4.x Diagrama fluxurilor de date (nivelul 1)
// ---------------------------------------------------------------------------
async function dfd() {
  const W = 1800, H = 1200
  let b = ''
  b += box(40, 380, 290, 340, { title: 'Utilizatori', body: ['administrator', 'îngrijitor', 'membru al', 'familiei'], size: 21, fill: C.soft })
  const P = [
    ['P1', 'Autentificare', 'și autorizare'],
    ['P2', 'Planificare și', 'evidența activităților'],
    ['P3', 'Jurnal de', 'observații'],
    ['P4', 'Gestionarea', 'evenimentelor'],
    ['P5', 'Comunicare', '(mesaje)'],
  ]
  const D = ['D1 profiles, elder_members', 'D2 care_activities', 'D3 observations', 'D4 events', 'D5 messages, message_reads']
  const py = (i) => 70 + i * 190
  P.forEach((p, i) => {
    const y = py(i)
    b += `<rect x="620" y="${y}" width="380" height="120" rx="60" fill="#fff" stroke="${C.ink}" stroke-width="1.8"/>`
    b += text(810, y + 38, p[0], { size: 20, weight: 'bold', fill: C.head })
    b += text(810, y + 68, p[1], { size: 21 })
    b += text(810, y + 94, p[2], { size: 21 })
    // store
    b += `<path d="M1320,${y + 30} h420 M1320,${y + 90} h420 M1320,${y + 30} v60" stroke="${C.ink}" stroke-width="1.8" fill="none"/>`
    b += text(1335, y + 68, D[i], { size: 20, anchor: 'start' })
    b += arrow(1002, y + 50, 1318, y + 50, { both: true, label: ['citire / scriere', 'INSERT / UPDATE', 'INSERT', 'INSERT', 'INSERT / SELECT'][i], lx: 1160, ly: y + 38, size: 17 })
    b += arrow(332, 550, 618, y + 60, { both: true })
  })
  b += text(185, 360, 'cereri și răspunsuri (JWT)', { size: 18, fill: C.gray, style: 'italic' })
  // notifications process
  const ny = 1030
  b += `<rect x="620" y="${ny}" width="380" height="120" rx="60" fill="${C.soft}" stroke="${C.ink}" stroke-width="1.8"/>`
  b += text(810, ny + 38, 'P6', { size: 20, weight: 'bold', fill: C.head })
  b += text(810, ny + 68, 'Generarea și livrarea', { size: 21 })
  b += text(810, ny + 94, 'notificărilor', { size: 21 })
  b += `<path d="M1320,${ny + 30} h420 M1320,${ny + 90} h420 M1320,${ny + 30} v60" stroke="${C.ink}" stroke-width="1.8" fill="none"/>`
  b += text(1335, ny + 68, 'D6 notifications', { size: 20, anchor: 'start' })
  b += arrow(1002, ny + 60, 1318, ny + 60, { label: 'INSERT (triggere)', lx: 1160, ly: ny + 48, size: 17 })
  b += path(`M1540,${py(1) + 92} C1560,700 1560,900 1100,${ny + 20}`, { dash: true })
  b += text(1110, 990, 'triggere AFTER INSERT / UPDATE', { size: 18, fill: C.gray, style: 'italic', anchor: 'start' })
  b += arrow(618, ny + 60, 186, 722, { label: 'Realtime (WSS): notificări', lx: 330, ly: 900, size: 18, dash: true })
  await save('fig_4_4_dfd', svg(W, H, b), 1700)
}

// ---------------------------------------------------------------------------
// 4.x Structura componentelor aplicației client
// ---------------------------------------------------------------------------
async function components() {
  const W = 1800, H = 1000
  let b = ''
  const prov = ['I18nProvider', 'BrowserRouter', 'ToastProvider', 'AuthProvider', 'NotificationsProvider']
  b += box(40, 40, 180, 70, { fill: C.head, stroke: C.ink })
  b += `<text x="130" y="84" text-anchor="middle" font-size="24" font-weight="bold" fill="#fff">App</text>`
  prov.forEach((p, i) => {
    const x = 270 + i * 300
    b += box(x, 40, 270, 70, { body: [p], size: 21, fill: C.soft })
    b += arrow(i ? x - 30 : 222, 75, x - 2, 75)
  })
  b += text(900, 150, 'contexte globale: limbă, rutare, mesaje toast, sesiune și rol, notificări în timp real', { size: 19, fill: C.gray, style: 'italic' })
  b += box(700, 190, 400, 80, { title: 'Layout', body: ['meniu lateral, comutator de limbă'], size: 19, titleSize: 22 })
  b += arrow(1590, 112, 1102, 225)
  const pages = ['Dashboard', 'Elders', 'ElderDetail', 'Planner', 'Events', 'Messages', 'Notifications', 'Admin', 'Profile']
  pages.forEach((p, i) => {
    const x = 40 + i * 192
    b += box(x, 340, 178, 60, { body: [p], size: 20, fill: '#fff' })
    b += arrow(900, 272, x + 89, 338, { color: C.line, width: 1.2 })
  })
  b += text(40, 330, 'Pagini (src/pages)', { size: 21, weight: 'bold', anchor: 'start' })
  const comps = [
    ['DayArc', 'arcul zilei'],
    ['activities', 'rând, detalii, formular'],
    ['observations', 'card, formular'],
    ['events', 'card, formular'],
    ['ChatThread', 'conversație live'],
    ['Sparkline', 'tendințe vitale'],
    ['ElderForm', 'profil persoană'],
    ['ui', 'Button, Modal, Ring…'],
  ]
  b += text(40, 490, 'Componente reutilizabile (src/components)', { size: 21, weight: 'bold', anchor: 'start' })
  comps.forEach((c, i) => {
    const x = 40 + i * 216
    b += box(x, 505, 204, 86, { title: c[0], body: [c[1]], size: 17, titleSize: 20 })
  })
  b += plainLine(40, 440, 1760, 440, { color: C.line, dash: true })
  b += text(900, 470, 'paginile compun componentele', { size: 18, fill: C.gray, style: 'italic' })
  b += plainLine(40, 640, 1760, 640, { color: C.line, dash: true })
  b += text(900, 670, 'componentele și paginile folosesc modulele de logică', { size: 18, fill: C.gray, style: 'italic' })
  const libs = [
    ['api.ts', 'interogări Supabase'],
    ['supabase.ts', 'client configurat'],
    ['recurrence.ts', 'serii de activități'],
    ['vitals.ts', 'praguri de alertă'],
    ['notificationText.ts', 'texte localizate'],
    ['demo.ts', 'date demonstrative'],
    ['i18n', 'ro · en · ru'],
  ]
  b += text(40, 715, 'Logică și servicii (src/lib, src/i18n)', { size: 21, weight: 'bold', anchor: 'start' })
  libs.forEach((c, i) => {
    const x = 40 + i * 247
    b += box(x, 730, 235, 86, { title: c[0], body: [c[1]], size: 17, titleSize: 20, fill: C.soft2 })
  })
  b += box(620, 880, 560, 80, { title: 'Supabase (Auth · PostgREST · Realtime)', size: 19, titleSize: 21, fill: C.soft, dash: true })
  b += arrow(157, 818, 700, 878)
  await save('fig_4_5_components', svg(W, H, b), 1700)
}

// ---------------------------------------------------------------------------
// 4.x Controlul accesului (decizia RLS)
// ---------------------------------------------------------------------------
async function access() {
  const W = 1500, H = 1180
  let b = ''
  const dia = (cx, cy, w, h, t) => `<path d="M${cx},${cy - h / 2} L${cx + w / 2},${cy} L${cx},${cy + h / 2} L${cx - w / 2},${cy} z" fill="#fff" stroke="${C.ink}" stroke-width="1.8"/>${lines(cx, cy - (t.length - 1) * 12 + 7, t, { size: 20, lh: 24 })}`
  const term = (x, y, w, t, fill) => `<rect x="${x}" y="${y}" width="${w}" height="64" rx="32" fill="${fill}" stroke="${C.ink}" stroke-width="1.8"/>${text(x + w / 2, y + 40, t, { size: 21, weight: 'bold' })}`
  b += term(520, 30, 460, 'Cerere asupra datelor unei persoane', C.soft)
  b += arrow(750, 96, 750, 138)
  b += dia(750, 210, 400, 140, ['Token JWT valid?'])
  b += arrow(952, 210, 1150, 210, { label: 'nu', lx: 1050, ly: 198 })
  b += term(1152, 178, 300, 'Acces refuzat (anon)', '#fcebe8')
  b += arrow(750, 282, 750, 330, { label: 'da', lx: 780, ly: 312 })
  b += dia(750, 400, 400, 140, ['Contul este activ?', '(profiles.is_active)'])
  b += arrow(952, 400, 1150, 400, { label: 'nu', lx: 1050, ly: 388 })
  b += term(1152, 368, 300, 'Acces refuzat', '#fcebe8')
  b += arrow(750, 472, 750, 520, { label: 'da', lx: 780, ly: 502 })
  b += dia(750, 590, 400, 140, ['Rol = administrator?', 'is_admin()'])
  b += arrow(548, 590, 352, 590, { label: 'da', lx: 450, ly: 578 })
  b += term(52, 558, 300, 'Acces permis', '#eaf5ec')
  b += arrow(750, 662, 750, 710, { label: 'nu', lx: 780, ly: 692 })
  b += dia(750, 790, 460, 160, ['Membru al echipei?', 'has_elder_access(elder_id)'])
  b += arrow(982, 790, 1150, 790, { label: 'nu', lx: 1060, ly: 778 })
  b += term(1152, 758, 300, '0 rânduri / refuz', '#fcebe8')
  b += arrow(750, 872, 750, 920, { label: 'da', lx: 780, ly: 902 })
  b += dia(750, 1000, 460, 150, ['Operație de scriere', 'asupra planului?'])
  b += arrow(518, 1000, 352, 1000, { label: 'nu (citire, observație,\neveniment, mesaj)', lx: 435, ly: 950, size: 17 })
  b += term(52, 968, 300, 'Acces permis', '#eaf5ec')
  b += arrow(982, 1000, 1150, 1000, { label: 'da', lx: 1060, ly: 988 })
  b += `<rect x="1152" y="950" width="300" height="100" rx="14" fill="#fff" stroke="${C.ink}" stroke-width="1.8"/>`
  b += lines(1302, 990, ['permis doar dacă', 'is_staff() (îngrijitor)'], { size: 20 })
  await save('fig_4_6_access', svg(W, H, b), 1400)
}

await ageing()
await usecases()
await architecture()
await deployment()
await process()
await er()
await sequence()
await states()
await dfd()
await components()
await access()
