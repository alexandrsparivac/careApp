// Generează teza de licență (DOCX) conform Ghidului UTM (2019).
// Rulare: node docs/teza/build.mjs
//
// Surse: docs/teza/content/*.md (text), docs/teza/bibliografie.mjs, docs/teza/img/*.png.
// Doi pași: (1) DOCX → PDF cu LibreOffice pentru a afla paginile titlurilor,
// (2) DOCX final cu cuprinsul completat (câmp TOC actualizabil în Word).
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import JSZip from 'jszip'
import sharp from 'sharp'
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  ImageRun,
  LineRuleType,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  SectionType,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TabStopType,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx'
import { BIB } from './bibliografie.mjs'
import { META } from './meta.mjs'

const DIR = fileURLToPath(new URL('.', import.meta.url))
const IMG = join(DIR, 'img')
const OUT_DOCX = join(DIR, 'Teza_de_licenta_CareBridge.docx')
const TMP = '/tmp/teza_build'

// ------------------------------------------------------------------ dimensiuni
const MM = 56.6929 // twips / mm
const TEXT_WIDTH = Math.round(180 * MM) // A4 210 − 20 (stânga) − 10 (dreapta)
const PX_PER_CM = 96 / 2.54
const FONT = 'Times New Roman'
const MONO = 'Courier New'

// ------------------------------------------------------------------ conținut
const CONTENT_DIR = join(DIR, 'content')
const files = readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.md')).sort()
const source = files.map((f) => readFileSync(join(CONTENT_DIR, f), 'utf8')).join('\n\n')
const lines = source.split('\n')

// ------------------------------------------------------------------ pre-scanare: numerotarea figurilor și tabelelor
const labels = { fig: {}, tab: {} }
{
  let chapter = '0'
  const count = { fig: 0, tab: 0 }
  for (const raw of lines) {
    const l = raw.trim()
    let m
    if ((m = l.match(/^# (\d+) /))) {
      chapter = m[1]
      count.fig = count.tab = 0
    } else if ((m = l.match(/^@@anexa (\d+)/))) {
      chapter = `A${m[1]}`
      count.fig = count.tab = 0
    } else if ((m = l.match(/^@@(fig|screen)\s+(\S+)/))) {
      labels.fig[m[2]] = `${chapter}.${++count.fig}`
    } else if ((m = l.match(/^@@table\s+(\S+)/))) {
      labels.tab[m[1]] = `${chapter}.${++count.tab}`
    }
  }
}

// ------------------------------------------------------------------ citări (ordinea primei apariții)
const citeOrder = []
function citeNumber(key) {
  if (!BIB[key]) throw new Error(`Sursă bibliografică necunoscută: ${key}`)
  let i = citeOrder.indexOf(key)
  if (i === -1) {
    citeOrder.push(key)
    i = citeOrder.length - 1
  }
  return i + 1
}

// ------------------------------------------------------------------ text inline
function runs(text, base = {}) {
  const out = []
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\{\{[^}]+\}\}|\[@[^\]]+\]|\[\[(?:fig|tab):[^\]]+\]\])/g
  let last = 0
  let m
  const push = (t, o = {}) => t && out.push(new TextRun({ text: t, font: FONT, ...base, ...o }))
  while ((m = re.exec(text))) {
    push(text.slice(last, m.index))
    const tok = m[0]
    if (tok.startsWith('**')) push(tok.slice(2, -2), { bold: true })
    else if (tok.startsWith('`')) push(tok.slice(1, -1), { font: MONO, size: 20 })
    else if (tok.startsWith('{{')) push(tok.slice(2, -2), { highlight: 'yellow' })
    else if (tok.startsWith('[@')) {
      const nums = tok
        .slice(1, -1)
        .split(/[,;]\s*/)
        .map((k) => {
          const [key, loc] = k.replace(/^@/, '').split(/\s+(?=p\.)/)
          return loc ? `${citeNumber(key)}, ${loc}` : citeNumber(key)
        })
      push(`[${nums.join('; ')}]`)
    } else if (tok.startsWith('[[')) {
      const [, kind, key] = tok.match(/\[\[(fig|tab):([^\]]+)\]\]/)
      const n = labels[kind][key]
      if (!n) throw new Error(`Referință necunoscută: ${tok}`)
      push(n)
    } else push(tok.slice(1, -1), { italics: true })
    last = m.index + tok.length
  }
  push(text.slice(last))
  return out
}

// ------------------------------------------------------------------ elemente de bloc
const P = (children, o = {}) => new Paragraph({ children: Array.isArray(children) ? children : [children], ...o })
const center = AlignmentType.CENTER

function para(text) {
  return P(runs(text), { style: 'Normal' })
}

function listItem(text, marker) {
  return P([new TextRun({ text: `${marker}\t`, font: FONT }), ...runs(text)], { style: 'ListItem' })
}

const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder }

function defList(rows) {
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  const nb = { top: none, bottom: none, left: none, right: none }
  const w1 = Math.round(TEXT_WIDTH * 0.22)
  return new Table({
    width: { size: TEXT_WIDTH, type: WidthType.DXA },
    columnWidths: [w1, TEXT_WIDTH - w1],
    borders: { ...nb, insideHorizontal: none, insideVertical: none },
    rows: rows.map(
      ([t, d]) =>
        new TableRow({
          children: [
            new TableCell({ borders: nb, width: { size: w1, type: WidthType.DXA }, children: [P(runs(t, { bold: true }), { style: 'TableText', spacing: { line: 300, after: 40 } })] }),
            new TableCell({ borders: nb, width: { size: TEXT_WIDTH - w1, type: WidthType.DXA }, children: [P(runs(`– ${d}`), { style: 'TableText', alignment: AlignmentType.JUSTIFIED, spacing: { line: 300, after: 40 } })] }),
          ],
        }),
    ),
  })
}

function tableBlock(rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0)
  const colW = widths.map((w) => Math.round((w / total) * TEXT_WIDTH))
  return new Table({
    width: { size: TEXT_WIDTH, type: WidthType.DXA },
    columnWidths: colW,
    rows: rows.map(
      (cells, ri) =>
        new TableRow({
          tableHeader: ri === 0,
          cantSplit: true,
          children: cells.map(
            (c, ci) =>
              new TableCell({
                width: { size: colW[ci], type: WidthType.DXA },
                borders,
                verticalAlign: VerticalAlign.CENTER,
                margins: { top: 40, bottom: 40, left: 80, right: 80 },
                shading: ri === 0 ? { type: ShadingType.CLEAR, color: 'auto', fill: 'E7ECEC' } : undefined,
                children: c.split('<br>').map((part) =>
                  P(runs(part.trim(), { size: 22, bold: ri === 0 || undefined }), {
                    style: 'TableText',
                    alignment: ri === 0 ? center : AlignmentType.LEFT,
                  }),
                ),
              }),
          ),
        }),
    ),
  })
}

async function imageBlock(file, widthCm) {
  const buf = readFileSync(join(IMG, file))
  const meta = await sharp(buf).metadata()
  const w = widthCm * PX_PER_CM
  const h = (w * meta.height) / meta.width
  const maxH = 21 * PX_PER_CM
  const scale = h > maxH ? maxH / h : 1
  return P(new ImageRun({ data: buf, type: 'png', transformation: { width: Math.round(w * scale), height: Math.round(h * scale) } }), {
    alignment: center,
    keepNext: true,
    spacing: { before: 120, after: 60 },
  })
}

function placeholderBlock(file, caption) {
  return new Table({
    width: { size: Math.round(TEXT_WIDTH * 0.8), type: WidthType.DXA },
    alignment: center,
    rows: [
      new TableRow({
        height: { value: 2600, rule: 'atLeast' },
        children: [
          new TableCell({
            borders: { top: { style: BorderStyle.DASHED, size: 6, color: '888888' }, bottom: { style: BorderStyle.DASHED, size: 6, color: '888888' }, left: { style: BorderStyle.DASHED, size: 6, color: '888888' }, right: { style: BorderStyle.DASHED, size: 6, color: '888888' } },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              P([new TextRun({ text: `[Captură de ecran: ${caption}]`, font: FONT, highlight: 'yellow' })], { style: 'TableText', alignment: center }),
              P([new TextRun({ text: `Se generează cu docs/teza/screenshots.mjs (fișierul img/${file}) sau se inserează manual.`, font: FONT, size: 20, italics: true })], { style: 'TableText', alignment: center }),
            ],
          }),
        ],
      }),
    ],
  })
}

function codeBlock(codeLines) {
  return codeLines.map((l, i) =>
    P([new TextRun({ text: l.replace(/\t/g, '  ') || ' ', font: MONO, size: 20 })], {
      style: 'Code',
      spacing: { before: i === 0 ? 120 : 0, after: i === codeLines.length - 1 ? 120 : 0, line: 240, lineRule: LineRuleType.AUTO },
    }),
  )
}

// ------------------------------------------------------------------ conversia markdown → blocuri DOCX
const headings = [] // pentru cuprins
const stats = { figures: 0, tables: 0, annexes: 0 }

async function renderBody() {
  const out = []
  let i = 0
  let firstH1 = false
  let paragraphBuf = []
  const flush = () => {
    if (paragraphBuf.length) out.push(para(paragraphBuf.join(' ')))
    paragraphBuf = []
  }

  while (i < lines.length) {
    const raw = lines[i]
    const l = raw.trim()
    let m

    if (l.startsWith('<!--')) {
      while (i < lines.length && !lines[i].includes('-->')) i++
      i++
      continue
    }
    if (!l) {
      flush()
      i++
      continue
    }
    if ((m = l.match(/^(#{1,3}) (.+)$/))) {
      flush()
      const level = m[1].length
      const text = m[2].trim()
      const style = `Heading${level}`
      const extra = level === 1 && firstH1 ? { pageBreakBefore: false } : {}
      if (level === 1) firstH1 = false
      out.push(P(runs(text), { style, ...extra }))
      headings.push({ level, text })
      i++
      continue
    }
    if (l === '@@BODYSTART') {
      flush()
      out.push({ split: true })
      firstH1 = true
      i++
      continue
    }
    if (l === '@@deflist') {
      flush()
      i++
      const rows = []
      while (i < lines.length && lines[i].includes('::')) {
        const [term, def] = lines[i].split('::').map((x) => x.trim())
        rows.push([term, def])
        i++
      }
      out.push(defList(rows))
      continue
    }
    if (l === '\\pagebreak') {
      flush()
      out.push(P(new PageBreak()))
      i++
      continue
    }
    if ((m = l.match(/^@@anexa (\d+)\s*\|\s*(.+)$/))) {
      flush()
      stats.annexes++
      const firstAnnex = stats.annexes === 1 && out.length && headings.at(-1)?.text === 'ANEXE'
      out.push(
        P([new TextRun({ text: `Anexa ${m[1]}`, font: FONT, bold: true }), new TextRun({ text: m[2], font: FONT, bold: true, break: 1 })], {
          style: 'AnnexTitle',
          pageBreakBefore: !firstAnnex,
        }),
      )
      headings.push({ level: 2, text: `Anexa ${m[1]}. ${m[2]}`, find: m[2] })
      i++
      continue
    }
    if ((m = l.match(/^@@fig\s+(\S+)\s*\|\s*([^|]+)\|\s*(.+?)(?:\s*\|\s*w=([\d.]+))?$/))) {
      flush()
      stats.figures++
      out.push(await imageBlock(m[2].trim(), Number(m[4] ?? 16)))
      out.push(P(runs(`Figura ${labels.fig[m[1]]} – ${m[3].trim()}`), { style: 'FigCaption' }))
      i++
      continue
    }
    if ((m = l.match(/^@@screen\s+(\S+)\s*\|\s*([^|]+)\|\s*(.+?)(?:\s*\|\s*w=([\d.]+))?$/))) {
      flush()
      stats.figures++
      const file = m[2].trim()
      if (existsSync(join(IMG, file))) out.push(await imageBlock(file, Number(m[4] ?? 16)))
      else out.push(placeholderBlock(file, m[3].trim()))
      out.push(P(runs(`Figura ${labels.fig[m[1]]} – ${m[3].trim()}`), { style: 'FigCaption' }))
      i++
      continue
    }
    if ((m = l.match(/^@@table\s+(\S+)\s*\|\s*([^|]+?)\s*\|\s*([\d,\s]+)$/))) {
      flush()
      stats.tables++
      out.push(P(runs(`Tabelul ${labels.tab[m[1]]} – ${m[2].trim()}`), { style: 'TabCaption' }))
      const widths = m[3].split(',').map((n) => Number(n.trim()))
      i++
      const rows = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const row = lines[i].trim()
        if (!/^\|[\s:-]+\|/.test(row.replace(/[^|:\-\s]/g, 'x')) || /[^|:\-\s]/.test(row)) {
          if (!/^\|(\s*:?-{3,}:?\s*\|)+$/.test(row)) rows.push(row.slice(1, -1).split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, '|').trim()))
        }
        i++
      }
      out.push(tableBlock(rows, widths))
      out.push(P([], { style: 'AfterTable' }))
      continue
    }
    if (l.startsWith('```')) {
      flush()
      i++
      const code = []
      while (i < lines.length && !lines[i].trim().startsWith('```')) code.push(lines[i++].replace(/\s+$/, ''))
      i++
      out.push(...codeBlock(code))
      continue
    }
    if ((m = l.match(/^@@include\s+(\S+)(?:\s+(\d+)-(\d+))?$/))) {
      flush()
      const file = readFileSync(join(DIR, '..', '..', m[1]), 'utf8').split('\n')
      const slice = m[2] ? file.slice(Number(m[2]) - 1, Number(m[3])) : file
      out.push(P(runs(`Fișierul \`${m[1]}\`${m[2] ? `, liniile ${m[2]}–${m[3]}` : ''}:`), { style: 'NoIndent' }))
      out.push(...codeBlock(slice.map((s) => s.replace(/\s+$/, ''))))
      i++
      continue
    }
    if ((m = l.match(/^- (.+)$/))) {
      flush()
      out.push(listItem(m[1], '–'))
      i++
      continue
    }
    if ((m = l.match(/^(\d+)\. (.+)$/))) {
      flush()
      out.push(listItem(m[2], `${m[1]}.`))
      i++
      continue
    }
    paragraphBuf.push(l)
    i++
  }
  flush()
  return out
}

function bibliography() {
  const out = []
  const unused = Object.keys(BIB).filter((k) => !citeOrder.includes(k))
  if (unused.length) console.warn('⚠ Surse necitate în text:', unused.join(', '))
  citeOrder.forEach((key, idx) => {
    out.push(P([new TextRun({ text: `${idx + 1}.\t`, font: FONT }), ...runs(BIB[key])], { style: 'BibItem' }))
  })
  return out
}

// ------------------------------------------------------------------ pagini preliminare
const bold = (text, size, o = {}) => new TextRun({ text, font: FONT, bold: true, size: size * 2, ...o })
const plain = (text, size = 12, o = {}) => new TextRun({ text, font: FONT, size: size * 2, ...o })
const hl = (text, size, o = {}) => new TextRun({ text, font: FONT, size: size * 2, highlight: 'yellow', ...o })
const cp = (children, o = {}) => P(children, { alignment: center, spacing: { line: 240, before: 0, after: 0 }, ...o })

function infoTable(rows, size) {
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  return new Table({
    width: { size: Math.round(TEXT_WIDTH * 0.86), type: WidthType.DXA },
    alignment: center,
    columnWidths: [Math.round(TEXT_WIDTH * 0.3), Math.round(TEXT_WIDTH * 0.56)],
    borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
    rows: rows.map(
      ([k, v]) =>
        new TableRow({
          children: [
            new TableCell({ borders: { top: none, bottom: none, left: none, right: none }, children: [P([bold(k, size)], { spacing: { after: 160 } })] }),
            new TableCell({ borders: { top: none, bottom: none, left: none, right: none }, children: v.map((line) => P(line, { alignment: AlignmentType.LEFT, spacing: { line: 240 } })) }),
          ],
        }),
    ),
  })
}

function cover() {
  return [
    cp([bold('Universitatea Tehnică a Moldovei', 16)], { spacing: { before: 400 } }),
    cp([hl('[sigla UTM]', 12)], { spacing: { before: 240 } }),
    cp([bold(META.title, 20)], { spacing: { before: 3200, line: 360 } }),
    P([], { spacing: { before: 2400 } }),
    infoTable(
      [
        ['Student:', [[hl(META.student, 16, { bold: true })]]],
        ['Coordonator:', [[hl(META.coordinator, 16, { bold: true })], [hl(META.coordinatorTitle, 16, { bold: true })]]],
      ],
      16,
    ),
    cp([bold('Chișinău, ', 16), hl(META.year, 16, { bold: true })], { spacing: { before: 3000 } }),
  ]
}

function titlePage() {
  const right = (children, o = {}) => P(children, { alignment: AlignmentType.RIGHT, spacing: { line: 240 }, ...o })
  return [
    cp([bold('MINISTERUL EDUCAȚIEI ȘI CERCETĂRII AL REPUBLICII MOLDOVA', 13)]),
    cp([bold('Universitatea Tehnică a Moldovei', 13)], { spacing: { before: 60 } }),
    cp([hl(META.faculty, 13, { bold: true })]),
    cp([hl(META.department, 13, { bold: true })]),
    right([bold('Admis la susținere', 11)], { spacing: { before: 900, line: 240 } }),
    right([bold('Șef departament:', 11)]),
    right([hl(META.headOfDepartment, 11, { bold: true })]),
    right([bold('______________________________', 11)], { spacing: { before: 120, line: 240 } }),
    right([bold('„____” _________________ ', 11), hl(META.year, 11, { bold: true })], { spacing: { before: 60, line: 240 } }),
    cp([bold(META.title, 20)], { spacing: { before: 1800, line: 240 } }),
    cp([bold('Teză de licență', 16)], { spacing: { before: 700 } }),
    P([], { spacing: { before: 1400 } }),
    infoTable(
      [
        ['Student:', [[hl(`${META.student}, ${META.group}`, 12, { bold: true })]]],
        ['Coordonator:', [[hl(`${META.coordinator}, ${META.coordinatorTitle}`, 12, { bold: true })]]],
      ],
      12,
    ),
    cp([bold('Chișinău, ', 12), hl(META.year, 12, { bold: true })], { spacing: { before: 2200 } }),
  ]
}

function assignment() {
  const left = (children, o = {}) => P(children, { spacing: { line: 276 }, ...o })
  const blank = (label, value) => left([bold(label, 12), value ? plain(value) : plain('_______________________________________________')], { spacing: { before: 120, line: 276 } })
  const out = [
    cp([bold('Universitatea Tehnică a Moldovei', 13)]),
    left([hl(META.faculty, 12, { bold: true })], { spacing: { before: 200, line: 276 } }),
    left([hl(META.department, 12, { bold: true })]),
    left([hl(META.program, 12, { bold: true })]),
    P([bold('Aprob', 12)], { alignment: AlignmentType.RIGHT, spacing: { before: 200 } }),
    P([bold('Șef departament:', 12)], { alignment: AlignmentType.RIGHT }),
    P([hl(META.headOfDepartment, 12, { bold: true })], { alignment: AlignmentType.RIGHT }),
    P([bold('_______________________', 12)], { alignment: AlignmentType.RIGHT }),
    P([bold('„____” _____________ ', 12), hl(META.yearStart, 12, { bold: true })], { alignment: AlignmentType.RIGHT }),
    cp([bold('CAIET DE SARCINI', 13)], { spacing: { before: 300 } }),
    cp([bold('pentru teza de licență a studentului', 13)]),
    cp([hl(META.student, 12, { bold: true })], { spacing: { before: 120 } }),
    cp([plain('(numele și prenumele studentului)', 10, { italics: true })]),
    left([bold('1. Tema tezei de licență: ', 12), plain(META.title)], { spacing: { before: 200, line: 276 } }),
    left([plain('confirmată prin hotărârea Consiliului facultății nr. ______ din „___” __________ '), hl(META.yearStart, 12)]),
    left([bold('2. Termenul limită de prezentare a tezei de licență: ', 12), plain('„___” __________ '), hl(META.year, 12)], { spacing: { before: 120, line: 276 } }),
    left([bold('3. Date inițiale pentru elaborarea tezei de licență: ', 12), plain(META.initialData)], { spacing: { before: 120, line: 276 } }),
    left([bold('4. Conținutul memoriului explicativ:', 12)], { spacing: { before: 120, line: 276 } }),
    ...META.chapters.map((c) => left([plain(c)], { indent: { left: 567 } })),
    left([bold('5. Conținutul părții grafice a tezei de licență: ', 12), plain(META.graphics)], { spacing: { before: 120, line: 276 } }),
    left([bold('6. Lista consultanților:', 12)], { spacing: { before: 200, line: 276 } }),
    tableBlock(
      [
        ['Consultant', 'Capitol', 'Semnătura consultantului (data)', 'Semnătura studentului (data)'],
        [' ', ' ', ' ', ' '],
      ],
      [25, 25, 25, 25],
    ),
    left([bold('7. Data înmânării caietului de sarcini: ', 12), plain('„___” __________ '), hl(META.yearStart, 12)], { spacing: { before: 200, line: 276 } }),
    left([plain('Coordonator '), hl(META.coordinator, 12), plain('  ________________________')], { spacing: { before: 120, line: 276 } }),
    left([plain('Sarcina a fost luată pentru a fi executată de studentul '), hl(META.student, 12), plain('  ________________')], { spacing: { before: 120, line: 276 } }),
    cp([bold('PLAN CALENDARISTIC', 13)], { pageBreakBefore: true, spacing: { after: 200 } }),
    tableBlock(
      [['Nr. crt.', 'Denumirea etapelor de elaborare', 'Termenul de realizare a etapelor', 'Nota'], ...META.plan.map((s, i) => [String(i + 1), s, ' ', ' '])],
      [10, 55, 22, 13],
    ),
    left([plain('Student '), hl(META.student, 12), plain(' ______________________')], { spacing: { before: 600, line: 276 } }),
    left([plain('Coordonator de teză de licență '), hl(META.coordinator, 12), plain(' ______________________')], { spacing: { before: 200, line: 276 } }),
  ]
  return out
}

function declaration() {
  return [
    cp([bold('DECLARAȚIA STUDENTULUI', 13)], { pageBreakBefore: true, spacing: { after: 600 } }),
    P([plain('Subsemnatul(a) '), hl(META.student, 12), plain(', declar pe proprie răspundere că lucrarea de față este rezultatul muncii mele, realizată pe baza propriilor cercetări și pe baza informațiilor obținute din surse care au fost citate și indicate conform normelor etice în note și în bibliografie.')], { style: 'Normal' }),
    P([plain('Declar că lucrarea nu a mai fost prezentată sub această formă la nicio instituție de învățământ superior în vederea obținerii titlului de licențiat.')], { style: 'Normal', spacing: { before: 240 } }),
    P([plain('Semnătura autorului ___________________')], { alignment: AlignmentType.RIGHT, spacing: { before: 1200 } }),
    P([plain('Notă: conform Ghidului UTM, textul declarației se scrie de mână.', 10, { italics: true, highlight: 'yellow' })], { spacing: { before: 1200 } }),
  ]
}

function review() {
  const items = ['Actualitatea temei', 'Caracteristica tezei de licență', 'Analiza prototipului', 'Estimarea rezultatelor obținute', 'Corectitudinea materialului expus', 'Calitatea materialului grafic', 'Valoarea practică a tezei', 'Observații și recomandări', 'Caracteristica studentului și titlul conferit']
  const line = () => P([plain('________________________________________________________________________________')], { spacing: { line: 276 } })
  return [
    cp([bold('UNIVERSITATEA TEHNICĂ A MOLDOVEI', 12)], { pageBreakBefore: true }),
    cp([hl(META.faculty.toUpperCase(), 12, { bold: true })], { spacing: { before: 60 } }),
    cp([hl(META.department.toUpperCase(), 12, { bold: true })]),
    cp([hl(META.program.toUpperCase(), 12, { bold: true })]),
    cp([bold('AVIZ', 13)], { spacing: { before: 240 } }),
    cp([bold('la teza de licență', 12)]),
    P([bold('Titlul: ', 12), plain(META.title)], { spacing: { before: 200, line: 276 } }),
    P([bold('Studentul(a): ', 12), hl(META.student, 12), plain('     grupa '), hl(META.group, 12)], { spacing: { before: 60, line: 276 } }),
    ...items.flatMap((t, i) => [P([bold(`${i + 1}. ${t}: `, 12), plain('____________________________________________')], { spacing: { before: 100, line: 276 } }), line()]),
    P([plain('Lucrarea în forma electronică corespunde originalului prezentat către susținere publică.')], { spacing: { before: 200, line: 276 } }),
    P([plain('Coordonatorul tezei de licență _______________________________')], { spacing: { before: 200, line: 276 } }),
    P([plain('(titlul științifico-didactic, titlul științific, semnătura, data, numele, prenumele)', 10, { italics: true })], { alignment: AlignmentType.RIGHT }),
  ]
}

function annotation(title, textKey, keywordsLabel, keywords, extra) {
  const body = META[textKey](extra)
  return [
    cp([bold(title, 13)], { pageBreakBefore: true, spacing: { after: 240 } }),
    ...body.map((t) => P(runs(t), { style: 'Normal' })),
    P([bold(`${keywordsLabel}: `, 12), plain(keywords)], { style: 'NoIndent', spacing: { before: 240 } }),
  ]
}

function tocPlaceholder() {
  return [cp([bold('CUPRINS', 12)], { pageBreakBefore: true, spacing: { after: 240 } }), P([plain('@@TOC@@')])]
}

// ------------------------------------------------------------------ stiluri
const styles = {
  default: { document: { run: { font: FONT, size: 24, color: '000000' } } },
  paragraphStyles: [
    { id: 'Normal', name: 'Normal', run: { font: FONT, size: 24 }, paragraph: { alignment: AlignmentType.JUSTIFIED, spacing: { line: 360, before: 0, after: 0 }, indent: { firstLine: 709 } } },
    { id: 'NoIndent', name: 'No Indent', basedOn: 'Normal', paragraph: { indent: { firstLine: 0 } } },
    { id: 'Heading1', name: 'heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { bold: true, size: 26 }, paragraph: { alignment: center, indent: { firstLine: 0 }, spacing: { before: 0, after: 360, line: 360 }, keepNext: true, keepLines: true, pageBreakBefore: true, outlineLevel: 0 } },
    { id: 'Heading2', name: 'heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { bold: true, size: 24 }, paragraph: { alignment: AlignmentType.LEFT, indent: { firstLine: 0 }, spacing: { before: 240, after: 120, line: 360 }, keepNext: true, keepLines: true, outlineLevel: 1 } },
    { id: 'Heading3', name: 'heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { bold: true, size: 24 }, paragraph: { alignment: AlignmentType.LEFT, indent: { firstLine: 0 }, spacing: { before: 180, after: 60, line: 360 }, keepNext: true, keepLines: true, outlineLevel: 2 } },
    { id: 'AnnexTitle', name: 'Annex Title', basedOn: 'Normal', next: 'Normal', run: { bold: true, size: 24 }, paragraph: { alignment: center, indent: { firstLine: 0 }, spacing: { before: 0, after: 240, line: 360 }, keepNext: true, outlineLevel: 1 } },
    { id: 'FigCaption', name: 'Figure Caption', basedOn: 'Normal', run: { size: 24 }, paragraph: { alignment: center, indent: { firstLine: 0 }, spacing: { before: 60, after: 240, line: 276 } } },
    { id: 'TabCaption', name: 'Table Caption', basedOn: 'Normal', run: { size: 24 }, paragraph: { alignment: AlignmentType.RIGHT, indent: { firstLine: 0 }, spacing: { before: 200, after: 80, line: 276 }, keepNext: true } },
    { id: 'TableText', name: 'Table Text', basedOn: 'Normal', run: { size: 22 }, paragraph: { alignment: AlignmentType.LEFT, indent: { firstLine: 0 }, spacing: { line: 240, before: 0, after: 0 } } },
    { id: 'AfterTable', name: 'After Table', basedOn: 'Normal', run: { size: 12 }, paragraph: { spacing: { line: 240, before: 0, after: 120 } } },
    { id: 'Code', name: 'Source Code', basedOn: 'Normal', run: { font: MONO, size: 20 }, paragraph: { alignment: AlignmentType.LEFT, indent: { firstLine: 0 }, spacing: { line: 240, before: 0, after: 0 } } },
    { id: 'ListItem', name: 'List Item', basedOn: 'Normal', paragraph: { indent: { left: 1134, hanging: 425 }, tabStops: [{ type: TabStopType.LEFT, position: 1134 }] } },
    { id: 'BibItem', name: 'Bibliography Item', basedOn: 'Normal', paragraph: { alignment: AlignmentType.JUSTIFIED, indent: { left: 567, hanging: 567 }, tabStops: [{ type: TabStopType.LEFT, position: 567 }], spacing: { line: 360 } } },
    { id: 'TOC1', name: 'toc 1', basedOn: 'Normal', run: { bold: true }, paragraph: { alignment: AlignmentType.LEFT, indent: { firstLine: 0, left: 0, right: 567 }, spacing: { line: 360 }, tabStops: [{ type: TabStopType.RIGHT, position: TEXT_WIDTH, leader: 'dot' }] } },
    { id: 'TOC2', name: 'toc 2', basedOn: 'Normal', paragraph: { alignment: AlignmentType.LEFT, indent: { firstLine: 0, left: 284, right: 567 }, spacing: { line: 360 }, tabStops: [{ type: TabStopType.RIGHT, position: TEXT_WIDTH, leader: 'dot' }] } },
    { id: 'TOC3', name: 'toc 3', basedOn: 'Normal', paragraph: { alignment: AlignmentType.LEFT, indent: { firstLine: 0, left: 567, right: 567 }, spacing: { line: 360 }, tabStops: [{ type: TabStopType.RIGHT, position: TEXT_WIDTH, leader: 'dot' }] } },
  ],
}

const page = {
  size: { width: Math.round(210 * MM), height: Math.round(297 * MM) },
  margin: { top: Math.round(20 * MM), bottom: Math.round(20 * MM), left: Math.round(20 * MM), right: Math.round(10 * MM), header: Math.round(10 * MM), footer: Math.round(8 * MM) },
}

// ------------------------------------------------------------------ asamblare
async function buildDocx(extra) {
  headings.length = 0
  citeOrder.length = 0
  stats.figures = stats.tables = stats.annexes = 0
  const all = await renderBody()
  const cut = all.findIndex((b) => b && b.split)
  const front = cut === -1 ? [] : all.slice(0, cut)
  const body = cut === -1 ? all : all.slice(cut + 1)
  const bib = bibliography()
  // Bibliografia se inserează la marcajul @@BIBLIOGRAPHY din conținut
  const idx = body.findIndex((b) => b instanceof Paragraph && JSON.stringify(b).includes('@@BIBLIOGRAPHY'))
  if (idx === -1) throw new Error('Lipsește marcajul @@BIBLIOGRAPHY')
  body.splice(idx, 1, ...bib)
  extra.refs = citeOrder.length
  extra.figures = stats.figures
  extra.tables = stats.tables
  extra.annexes = stats.annexes

  const footer = new Footer({ children: [P([new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 24 })], { alignment: center })] })
  const doc = new Document({
    creator: META.student,
    title: META.title,
    description: 'Teză de licență',
    styles,
    features: { updateFields: false },
    sections: [
      { properties: { page }, children: cover() },
      {
        properties: { page: { ...page, pageNumbers: { start: 1 } }, type: SectionType.NEXT_PAGE },
        children: [
          ...titlePage(),
          P(new PageBreak()),
          ...assignment(),
          ...declaration(),
          ...review(),
          ...annotation('ADNOTARE', 'annotationRo', 'Cuvinte-cheie', META.keywordsRo, extra),
          ...annotation('ANNOTATION', 'annotationEn', 'Keywords', META.keywordsEn, extra),
          ...tocPlaceholder(),
          ...front,
        ],
      },
      { properties: { page, type: SectionType.NEXT_PAGE }, footers: { default: footer }, children: body },
    ],
  })
  return Packer.toBuffer(doc)
}

function tocXml(entries) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const plainText = (s) => s.replace(/\*\*|`|\{\{|\}\}/g, '')
  return entries
    .map((e, i) => {
      const begin = i === 0 ? '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-3" \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>' : ''
      const end = i === entries.length - 1 ? '<w:r><w:fldChar w:fldCharType="end"/></w:r>' : ''
      return `<w:p><w:pPr><w:pStyle w:val="TOC${e.level}"/></w:pPr>${begin}<w:r><w:t xml:space="preserve">${esc(plainText(e.text))}</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>${e.page}</w:t></w:r>${end}</w:p>`
    })
    .join('')
}

async function injectToc(buffer, entries) {
  const zip = await JSZip.loadAsync(buffer)
  let xml = await zip.file('word/document.xml').async('string')
  const re = /<w:p\b(?:(?!<w:p\b).)*?@@TOC@@.*?<\/w:p>/s
  if (!re.test(xml)) throw new Error('Marcajul cuprinsului nu a fost găsit')
  xml = xml.replace(re, tocXml(entries))
  zip.file('word/document.xml', xml)
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

function toPdf(docxPath) {
  rmSync(TMP, { recursive: true, force: true })
  mkdirSync(TMP, { recursive: true })
  execFileSync('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', TMP, docxPath], { stdio: 'ignore' })
  const pdf = join(TMP, docxPath.split('/').pop().replace(/\.docx$/, '.pdf'))
  const text = execFileSync('pdftotext', ['-enc', 'UTF-8', pdf, '-'], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8')
  return { pdf, pages: text.split('\f') }
}

const norm = (s) => s.replace(/[*`{}]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()

function locateHeadings(pages) {
  const P2 = pages.map(norm)
  const L2 = pages.map((pg) => pg.split('\n').map(norm).filter((l) => l.length >= 6))
  const isHeadingOn = (p, key) =>
    L2[p].some((l) => l.startsWith(key) || (key.startsWith(l) && l.length >= Math.min(key.length, 20)))
  // ultima intrare a cuprinsului apare mai întâi în cuprins; căutarea începe după el
  const lastKey = norm(headings.at(-1).find ?? headings.at(-1).text).slice(0, 40)
  const tocEnd = P2.findIndex((p) => p.includes(lastKey))
  let from = tocEnd + 1
  return headings.map((h) => {
    const key = norm(h.find ?? h.text).slice(0, 40)
    let p = from
    while (p < P2.length && !isHeadingOn(p, key)) p++
    if (p >= P2.length) {
      console.warn('⚠ Titlu negăsit în PDF:', h.text)
      return { ...h, page: '?' }
    }
    from = p
    return { ...h, page: p } // pagina fizică p (index 0 = copertă) = numărul tipărit
  })
}

// ------------------------------------------------------------------ rulare
const extra = { pages: '…', refs: 0, figures: 0, tables: 0, annexes: 0 }
let buf = await buildDocx(extra)
let draft = await injectToc(buf, headings.map((h) => ({ ...h, page: '00' })))
writeFileSync(OUT_DOCX, draft)
let { pages } = toPdf(OUT_DOCX)
let located = locateHeadings(pages)

// volumul memoriului: de la Introducere până înainte de Bibliografie
const pIntro = located.find((h) => h.text === 'INTRODUCERE')?.page
const pBib = located.find((h) => h.text === 'BIBLIOGRAFIE')?.page
extra.pages = pIntro && pBib ? String(pBib - pIntro) : '…'

buf = await buildDocx(extra)
draft = await injectToc(buf, located)
writeFileSync(OUT_DOCX, draft)
;({ pages } = toPdf(OUT_DOCX))
located = locateHeadings(pages)
const final = await injectToc(buf, located)
writeFileSync(OUT_DOCX, final)
const { pdf, pages: finalPages } = toPdf(OUT_DOCX)
execFileSync('cp', [pdf, join(DIR, 'Teza_de_licenta_CareBridge.pdf')])

console.log(`\n✓ ${OUT_DOCX}`)
console.log(`  pagini totale: ${finalPages.length - 1} (inclusiv coperta)`)
console.log(`  memoriu (Introducere → Concluzii): ${extra.pages} pagini`)
console.log(`  figuri: ${extra.figures}, tabele: ${extra.tables}, surse: ${extra.refs}, anexe: ${extra.annexes}`)
for (const h of located.filter((h) => h.level === 1)) console.log(`  p. ${String(h.page).padStart(3)}  ${h.text}`)
