// The files of the demo documents (DESIGN §3): quotes, invoices and
// statutes as PDF, photos and specimens as PNG. Every document of the seed
// is a real file, so « Voir » opens it and its SHA-256 can be checked by
// anyone who downloads it. Content is fixed (no dates), so the hashes stay
// the same from one run to the next.
//
// The files are not in the repository, only their manifest (names, hashes,
// sizes), which the seed reads:
// - pnpm seed-files: after editing a document, rewrites the files
//   and the manifest (web/lib/seed-files.ts, to commit)
// - --if-missing (dev, tests, builds, Docker): writes the files only when
//   some are missing, and fails if they differ from the manifest
// Offline and reproducible: the fonts are the project's (server/og-fonts),
// resvg the installed npm package.
import { Resvg } from '@resvg/resvg-js'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { encodeHex } from './server/lib/hex.ts'
import { buildSeed, payoutRef } from './web/lib/seed.ts'
import { seedFiles } from './web/lib/seed-files.ts'
import type { Db, Expense } from './web/lib/types.ts'

const OUT = 'server/seed-files'
const MANIFEST = 'web/lib/seed-files.ts'
const ENSURE = process.argv.includes('--if-missing')

const sha = async (bytes: Uint8Array<ArrayBuffer>) =>
  encodeHex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))

// --if-missing: nothing to do when every file of the manifest is there
if (ENSURE) {
  const present = await Promise.all(
    Object.entries(seedFiles).map(([name, f]) =>
      readFile(`${OUT}/${name}`).then(
        async (bytes) => (await sha(bytes)) === f.sha256,
        () => false,
      )
    ),
  )
  if (present.length && present.every(Boolean)) process.exit(0)
  console.log('Fichiers des documents de démo manquants : génération…')
}

/* ---------- PDF (one A4 page, Helvetica, WinAnsiEncoding) ---------- */

const WIN_ANSI: Record<string, number> = {
  '€': 0x80,
  '…': 0x85,
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '•': 0x95,
  '–': 0x96,
  '—': 0x97,
  'œ': 0x9c,
  'Œ': 0x8c,
  ' ': 0xa0,
}

/** a PDF string: ASCII kept, everything else as an octal escape */
const pdfString = (text: string) =>
  `(${
    [...text].map((ch) => {
      const code = WIN_ANSI[ch] ?? ch.charCodeAt(0)
      if (code > 0xff) throw Error(`no WinAnsi code for ${ch}`)
      if (ch === '(' || ch === ')' || ch === '\\') return `\\${ch}`
      return code < 0x80 ? ch : `\\${code.toString(8).padStart(3, '0')}`
    }).join('')
  })`

/** Helvetica widths are not embedded: a fair estimate to align right */
const textWidth = (text: string, size: number, bold = false) =>
  text.length * size * (bold ? 0.56 : 0.52)

type Rgb = [number, number, number]
const rgb = ([r, g, b]: Rgb) =>
  [r, g, b].map((v) => (v / 255).toFixed(3)).join(' ')

class Page {
  ops: string[] = []
  text(
    x: number,
    y: number,
    text: string,
    {
      size = 10,
      bold = false,
      color = [40, 42, 60] as Rgb,
      right = false,
      center = false,
    } = {},
  ) {
    const width = textWidth(text, size, bold)
    const left = right ? x - width : center ? x - width / 2 : x
    this.ops.push(
      `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${rgb(color)} rg ${
        left.toFixed(1)
      } ${y} Td ${pdfString(text)} Tj ET`,
    )
  }
  rect(x: number, y: number, w: number, h: number, color: Rgb) {
    this.ops.push(`${rgb(color)} rg ${x} ${y} ${w} ${h} re f`)
  }
  line(x1: number, y1: number, x2: number, y2: number, color: Rgb) {
    this.ops.push(`${rgb(color)} RG 0.6 w ${x1} ${y1} m ${x2} ${y2} l S`)
  }
  /** wraps a paragraph on whole words, returns the next y */
  paragraph(x: number, y: number, text: string, width: number, size = 10) {
    const max = Math.floor(width / (size * 0.5))
    let line = ''
    for (const word of text.split(' ')) {
      if ((line + ' ' + word).trim().length > max) {
        this.text(x, y, line, { size })
        y -= size * 1.45
        line = word
      } else line = (line + ' ' + word).trim()
    }
    if (line) this.text(x, y, line, { size }), y -= size * 1.45
    return y
  }
}

const pdf = (title: string, page: Page) => {
  const stream = page.ops.join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    `<< /Title ${pdfString(title)} /Producer (DELOS CASH demo) >>`,
  ]
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) {
    out += `${String(offset).padStart(10, '0')} 00000 n \n`
  }
  out += `trailer\n<< /Size ${
    objects.length + 1
  } /Root 1 0 R /Info 7 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  // the whole file is ASCII: one byte per character
  return new TextEncoder().encode(out)
}

/* ---------- quotes and invoices ---------- */

const amount = (n: number) =>
  `${n.toLocaleString('fr-FR').replace(/\s/g, ' ')} FCFA`

type Line = [label: string, qty: number, unit: number]

/** the lines of each spending: they add up to its amount */
const LINES: Record<string, Line[]> = {
  'ecole-ndiass-exp-5': [
    ['Peinture acrylique lavable, seau de 20 L', 4, 15_000],
    ['Main-d’œuvre, deux classes (murs et portes)', 2, 25_000],
    ['Rouleaux, brosses, bâches et enduit', 1, 10_000],
  ],
  'ecole-ndiass-exp-6': [
    ['Tableau blanc émaillé 120 × 240 cm', 2, 40_000],
    ['Pose et fixations murales', 1, 10_000],
  ],
  'cantine-2025-exp-1': [
    ['Riz brisé, sac de 50 kg', 4, 22_500],
    ['Huile végétale, bidon de 20 L', 2, 15_000],
  ],
  'cantine-2025-exp-2': [
    ['Légumes, lot hebdomadaire', 4, 12_500],
    ['Poisson frais, lot hebdomadaire', 4, 10_000],
  ],
  'cantine-2025-exp-3': [
    ['Recharge de gaz 12,5 kg', 2, 7_500],
    ['Marmite aluminium 50 L', 3, 10_000],
    ['Louches, bassines et seaux (lot)', 1, 15_000],
  ],
  'tournoi-grand-yoff-exp-1': [
    ['Jeu de maillots numérotés (16 équipes)', 16, 5_000],
    ['Ballon de football taille 5', 20, 3_500],
  ],
  'fournitures-cm2-exp-1': [
    ['Kit de cahiers par élève', 32, 2_500],
    ['Kit stylos, crayons et règle par élève', 32, 1_000],
    ['Manuels de lecture et de calcul (lot classe)', 1, 38_000],
  ],
  'basket-thies-exp-1': [
    ['Minibus 30 places, aller-retour Thiès–Ziguinchor', 1, 130_000],
    ['Supplément carburant et péage', 1, 20_000],
  ],
  // DESIGN §3.3: the spending of the guided demo
  'demo-tables': [
    ['Table-banc biplace en bois rouge', 20, 16_000],
    ['Livraison et montage à l’école', 1, 30_000],
  ],
}

type Bill = {
  kind: 'quote' | 'invoice'
  number: string
  supplier: string
  town: string
  phone: string
  client: string
  subject: string
  lines: Line[]
  /** the payout that settled the invoice */
  paidBy?: string
}

const bill = (b: Bill) => {
  const p = new Page()
  const ink: Rgb = [24, 26, 44]
  const muted: Rgb = [100, 104, 124]
  const band: Rgb = [236, 238, 246]
  // supplier
  p.text(50, 780, b.supplier, { size: 20, bold: true, color: ink })
  p.text(50, 760, `${b.town}, Sénégal · Tél. ${b.phone}`, { color: muted })
  // title
  p.text(545, 780, b.kind === 'quote' ? 'DEVIS' : 'FACTURE', {
    size: 22,
    bold: true,
    color: [75, 63, 214],
    right: true,
  })
  p.text(545, 760, `N° ${b.number}`, { color: muted, right: true })
  p.line(50, 740, 545, 740, [210, 212, 224])
  // client and subject
  p.text(50, 712, b.kind === 'quote' ? 'Établi pour' : 'Facturé à', {
    size: 9,
    bold: true,
    color: muted,
  })
  p.text(50, 696, b.client, { size: 12, bold: true, color: ink })
  p.text(50, 670, 'Objet', { size: 9, bold: true, color: muted })
  let y = p.paragraph(50, 654, b.subject, 495, 11)
  // table
  y -= 14
  p.rect(50, y - 6, 495, 22, band)
  p.text(58, y, 'Désignation', { size: 9, bold: true, color: muted })
  p.text(370, y, 'Qté', { size: 9, bold: true, color: muted, right: true })
  p.text(455, y, 'Prix unitaire', {
    size: 9,
    bold: true,
    color: muted,
    right: true,
  })
  p.text(537, y, 'Montant', { size: 9, bold: true, color: muted, right: true })
  y -= 28
  let total = 0
  for (const [label, qty, unit] of b.lines) {
    total += qty * unit
    p.text(58, y, label, { size: 10, color: ink })
    p.text(370, y, String(qty), { size: 10, color: ink, right: true })
    p.text(455, y, amount(unit), { size: 10, color: ink, right: true })
    p.text(537, y, amount(qty * unit), { size: 10, color: ink, right: true })
    y -= 8
    p.line(50, y, 545, y, [226, 228, 236])
    y -= 18
  }
  y -= 6
  p.rect(330, y - 10, 215, 30, [238, 236, 252])
  p.text(342, y, 'TOTAL', { size: 11, bold: true, color: ink })
  p.text(537, y, amount(total), {
    size: 12,
    bold: true,
    color: ink,
    right: true,
  })
  y -= 50
  if (b.kind === 'quote') {
    p.text(50, y, 'Devis valable 30 jours. Paiement par Mobile Money.', {
      color: muted,
    })
  } else {
    p.text(50, y, 'Facture acquittée, réglée par Mobile Money.', {
      bold: true,
      color: [22, 128, 76],
    })
    if (b.paidBy) {
      p.text(50, y - 16, `Référence du paiement DELOS : ${b.paidBy}`, {
        color: muted,
      })
    }
  }
  // demo notice
  p.rect(0, 0, 595, 36, [247, 247, 251])
  p.text(
    297,
    14,
    'Document de démonstration · DELOS CASH · entreprise et montants fictifs',
    { size: 8, color: muted, center: true },
  )
  return {
    total,
    bytes: pdf(`${b.kind === 'quote' ? 'Devis' : 'Facture'} ${b.number}`, p),
  }
}

const statutes = (o: {
  name: string
  short: string
  commune: string
  cause: string
  rule: { required: number; of: number }
}) => {
  const p = new Page()
  const ink: Rgb = [24, 26, 44]
  const muted: Rgb = [100, 104, 124]
  p.text(297, 780, 'STATUTS', {
    size: 22,
    bold: true,
    color: ink,
    center: true,
  })
  p.text(297, 754, o.name, {
    size: 12,
    bold: true,
    color: [75, 63, 214],
    center: true,
  })
  p.line(50, 736, 545, 736, [210, 212, 224])
  const articles: [string, string][] = [
    [
      'Article 1 · Dénomination',
      `Il est fondé entre les adhérents aux présents statuts une association régie par la loi, dénommée « ${o.name} » (${o.short}).`,
    ],
    [
      'Article 2 · Objet',
      `L’association a pour objet : ${o.cause.charAt(0).toLowerCase()}${
        o.cause.slice(1)
      }.`,
    ],
    ['Article 3 · Siège', `Le siège de l’association est fixé à ${o.commune}.`],
    [
      'Article 4 · Membres',
      'Sont membres les personnes physiques à jour de leur cotisation annuelle et agréées par le bureau.',
    ],
    [
      'Article 5 · Bureau',
      'L’association est administrée par un bureau élu pour deux ans : un président, un secrétaire général et un trésorier.',
    ],
    [
      'Article 6 · Dépenses',
      `Toute dépense est approuvée par ${o.rule.required} des ${o.rule.of} membres du bureau avant paiement. Les comptes sont publiés sur DELOS CASH.`,
    ],
    [
      'Article 7 · Ressources',
      'Les ressources comprennent les cotisations, les dons et les subventions.',
    ],
  ]
  let y = 708
  for (const [title, body] of articles) {
    p.text(50, y, title, { size: 11, bold: true, color: ink })
    y = p.paragraph(50, y - 17, body, 495, 10.5) - 12
  }
  p.text(
    50,
    y - 10,
    `Fait à ${o.commune}, en assemblée générale constitutive.`,
    {
      color: muted,
    },
  )
  p.rect(0, 0, 595, 36, [247, 247, 251])
  p.text(
    297,
    14,
    'Document de démonstration · DELOS CASH · association fictive',
    {
      size: 8,
      color: muted,
      center: true,
    },
  )
  return pdf(`Statuts ${o.short}`, p)
}

/* ---------- images (SVG rendered by resvg) ---------- */

const fonts = await Promise.all(
  ['bricolage-400.ttf', 'bricolage-700.ttf', 'space-mono-400.ttf'].map((f) =>
    readFile(`server/og-fonts/${f}`)
  ),
)
const esc = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** every image says it is a demo, in the same corner */
const demoTag = (w: number) =>
  `<g transform="translate(${
    w - 300
  } 24)"><rect width="276" height="40" rx="20" fill="#17182a" fill-opacity=".72"/><text x="138" y="26" text-anchor="middle" font-family="Bricolage Grotesque" font-weight="700" font-size="17" fill="#fff">PHOTO DE DÉMONSTRATION</text></g>`

const png = (svg: string) =>
  new Resvg(svg, {
    fitTo: { mode: 'original' },
    font: {
      fontFiles: ['bricolage-400.ttf', 'bricolage-700.ttf', 'unbounded-600.ttf'].map((f) => `server/og-fonts/${f}`),
      loadSystemFonts: false,
      defaultFontFamily: 'Bricolage Grotesque',
    },
  }).render().asPng()

const scene = (body: string, caption: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe3f7"/><stop offset="1" stop-color="#f6efe0"/></linearGradient></defs>
<rect width="1200" height="900" fill="url(#sky)"/>
<circle cx="1030" cy="170" r="70" fill="#ffd27a"/>
<rect y="690" width="1200" height="210" fill="#e8c992"/>
${body}
${demoTag(1200)}
<rect x="0" y="830" width="1200" height="70" fill="#17182a" fill-opacity=".55"/>
<text x="40" y="874" font-family="Bricolage Grotesque" font-size="26" fill="#fff">${
    esc(caption)
  }</text>
</svg>`

const classroom = scene(
  `<rect x="140" y="300" width="920" height="400" fill="#fdf3d8"/>
<rect x="140" y="300" width="920" height="120" fill="#4b3fd6" fill-opacity=".85"/>
<polygon points="110,300 600,170 1090,300" fill="#c0563b"/>
${
    [210, 690].map((x) =>
      `<rect x="${x}" y="470" width="300" height="230" rx="6" fill="#2f8f6b"/><rect x="${
        x + 30
      }" y="500" width="100" height="80" fill="#cfeaf7"/><rect x="${
        x + 170
      }" y="500" width="100" height="80" fill="#cfeaf7"/><rect x="${
        x + 115
      }" y="600" width="70" height="100" fill="#8a4b2a"/>`
    ).join('')
  }
<text x="600" y="375" text-anchor="middle" font-family="Bricolage Grotesque" font-weight="700" font-size="44" fill="#fff">ÉCOLE DE NDIASS · CE1</text>`,
  'Les deux classes de CE1 repeintes · Ndiass',
)

const jerseys = scene(
  `<rect x="80" y="230" width="1040" height="480" rx="24" fill="#ffffff" fill-opacity=".7"/>
${
    Array.from({ length: 8 }, (_, i) => {
      const x = 130 + (i % 4) * 250
      const y = 270 + Math.floor(i / 4) * 220
      const color = ['#e0483e', '#2a6fdb', '#f2b631', '#2f8f6b'][i % 4]
      return `<path transform="translate(${x} ${y})" d="M40 0 L70 12 Q100 22 130 12 L160 0 L200 40 L170 70 L160 60 L160 190 L40 190 L40 60 L30 70 L0 40 Z" fill="${color}"/><text x="${
        x + 100
      }" y="${
        y + 130
      }" text-anchor="middle" font-family="Bricolage Grotesque" font-weight="700" font-size="64" fill="#fff">${
        i + 4
      }</text>`
    }).join('')
  }`,
  'Maillots reçus pour le tournoi inter-quartiers · Grand-Yoff',
)

const minibus = scene(
  `<rect x="0" y="640" width="1200" height="60" fill="#6d6f7d"/>
<rect x="0" y="664" width="1200" height="8" fill="#f4f4f4" stroke-dasharray="60 40" stroke="#f4f4f4"/>
<rect x="230" y="360" width="700" height="290" rx="40" fill="#f2b631"/>
<rect x="230" y="560" width="700" height="40" fill="#e0483e"/>
${
    [270, 400, 530, 660].map((x) =>
      `<rect x="${x}" y="400" width="110" height="110" rx="12" fill="#cfeaf7"/>`
    ).join('')
  }
<rect x="790" y="400" width="110" height="200" rx="12" fill="#9ccbe4"/>
<circle cx="360" cy="660" r="56" fill="#26283a"/><circle cx="360" cy="660" r="24" fill="#b9bccb"/>
<circle cx="800" cy="660" r="56" fill="#26283a"/><circle cx="800" cy="660" r="24" fill="#b9bccb"/>
<text x="580" y="545" text-anchor="middle" font-family="Bricolage Grotesque" font-weight="700" font-size="34" fill="#17182a">TRANSPORT CAYOR</text>`,
  'L’équipe cadette au départ pour Ziguinchor · Thiès',
)

const tables = scene(
  `<rect x="100" y="330" width="1000" height="360" fill="#f3e6cf"/>
${
    Array.from({ length: 6 }, (_, i) => {
      const x = 150 + (i % 3) * 330
      const y = 420 + Math.floor(i / 3) * 150
      return `<rect x="${x}" y="${y}" width="250" height="34" rx="6" fill="#9a4f2c"/><rect x="${
        x + 14
      }" y="${y + 34}" width="16" height="80" fill="#7a3c20"/><rect x="${
        x + 220
      }" y="${y + 34}" width="16" height="80" fill="#7a3c20"/><rect x="${
        x + 20
      }" y="${y + 80}" width="210" height="16" fill="#b5653b"/>`
    }).join('')
  }
<text x="600" y="390" text-anchor="middle" font-family="Bricolage Grotesque" font-weight="700" font-size="38" fill="#7a3c20">20 TABLES-BANCS LIVRÉES</text>`,
  'Livraison des 20 tables-bancs à l’école de Ndiass',
)

/** a paper document marked SPECIMEN: never the layout of a real one */
const specimen = (title: string, rows: [string, string][], footer: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1300" viewBox="0 0 1000 1300">
<rect width="1000" height="1300" fill="#e9e7e1"/>
<rect x="60" y="60" width="880" height="1180" fill="#fffdf7" stroke="#d9d4c6" stroke-width="2"/>
<text x="500" y="190" text-anchor="middle" font-family="Bricolage Grotesque" font-weight="700" font-size="40" fill="#17182a">${
    esc(title)
  }</text>
<line x1="140" y1="230" x2="860" y2="230" stroke="#c9c3b3" stroke-width="2"/>
${
    rows.map(([label, value], i) =>
      `<text x="140" y="${
        320 + i * 110
      }" font-family="Bricolage Grotesque" font-size="24" fill="#6b6e80">${
        esc(label)
      }</text><text x="140" y="${
        362 + i * 110
      }" font-family="Bricolage Grotesque" font-weight="700" font-size="32" fill="#17182a">${
        esc(value)
      }</text>`
    ).join('')
  }
<circle cx="760" cy="1010" r="110" fill="none" stroke="#4b3fd6" stroke-width="6" stroke-opacity=".55"/>
<text x="760" y="1020" text-anchor="middle" font-family="Bricolage Grotesque" font-weight="700" font-size="30" fill="#4b3fd6" fill-opacity=".6">CACHET</text>
<text x="140" y="1160" font-family="Bricolage Grotesque" font-size="22" fill="#6b6e80">${
    esc(footer)
  }</text>
<text x="500" y="760" text-anchor="middle" transform="rotate(-28 500 760)" font-family="Bricolage Grotesque" font-weight="700" font-size="150" fill="#e0483e" fill-opacity=".22">SPÉCIMEN</text>
</svg>`

const idCard = (name: string, birth: string, number: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760" viewBox="0 0 1200 760">
<rect width="1200" height="760" fill="#e9e7e1"/>
<rect x="60" y="60" width="1080" height="640" rx="36" fill="#f4f7fb" stroke="#c7cfdc" stroke-width="3"/>
<rect x="60" y="60" width="1080" height="110" rx="36" fill="#4b3fd6" fill-opacity=".14"/>
<text x="110" y="132" font-family="Bricolage Grotesque" font-weight="700" font-size="40" fill="#17182a">PIÈCE D’IDENTITÉ · SPÉCIMEN</text>
<rect x="110" y="220" width="300" height="380" rx="20" fill="#d9dfea"/>
<circle cx="260" cy="350" r="80" fill="#aab4c6"/><path d="M130 590 Q260 420 390 590 Z" fill="#aab4c6"/>
${
    ([['Nom', name], ['Date de naissance', birth], ['Numéro', number]] as const)
      .map(([label, value], i) =>
        `<text x="470" y="${
          260 + i * 120
        }" font-family="Bricolage Grotesque" font-size="26" fill="#6b6e80">${label}</text><text x="470" y="${
          302 + i * 120
        }" font-family="Bricolage Grotesque" font-weight="700" font-size="38" fill="#17182a">${
          esc(value)
        }</text>`
      ).join('')
  }
<text x="110" y="660" font-family="Space Mono" font-size="22" fill="#6b6e80">Document fictif · démonstration DELOS CASH · aucune valeur</text>
<text x="600" y="470" text-anchor="middle" transform="rotate(-18 600 470)" font-family="Bricolage Grotesque" font-weight="700" font-size="170" fill="#e0483e" fill-opacity=".2">SPÉCIMEN</text>
</svg>`

/* ---------- the documents of the seed ---------- */

// the names come from the seed, with the manifest of the previous run:
// they do not depend on it
const d: Db = buildSeed(Date.UTC(2026, 9, 17))
const files = new Map<string, Uint8Array>()
const orgOf = (e: Expense) => {
  const fund = d.funds[e.fundId]
  return fund.orgId
    ? d.organizations[fund.orgId].name
    : `${d.persons[fund.launchers[0].personId].name}, pour « ${fund.title} »`
}

let n = 0
for (const e of Object.values(d.expenses)) {
  // the small spendings of a permanent collecte: one line each
  const lines = LINES[e.id] ?? [[e.title, 1, e.amount]]
  const fund = d.funds[e.fundId]
  const common = {
    supplier: e.beneficiary.name,
    town: fund.commune,
    phone: `+221 77 000 00 ${e.beneficiary.last2}`,
    client: orgOf(e),
    subject: e.reason,
    lines,
  }
  const quote = bill({
    ...common,
    kind: 'quote',
    number: `DV-2026-${++n + 10}`,
  })
  if (quote.total !== e.amount) {
    throw Error(`${e.id}: ${quote.total} instead of ${e.amount}`)
  }
  files.set(e.quoteDoc.name, quote.bytes)
  for (const proof of e.proofs) {
    if (proof.kind === 'invoice') {
      files.set(
        proof.name,
        bill({
          ...common,
          kind: 'invoice',
          number: `FA-2026-${n + 40}`,
          paidBy: e.payout?.ref ?? payoutRef(fund.code, e.seq, 1),
        }).bytes,
      )
    }
  }
}

// DESIGN §3.3: the spending of the guided demo (« Achat de 20 tables »)
const tablesBill = {
  supplier: 'Menuiserie Ndiaye',
  town: 'Ndiass',
  phone: '+221 77 000 00 47',
  client: d.organizations['ape-ndiass'].name,
  subject: '20 tables biplaces pour les classes de CE1, livrées à l’école',
  lines: LINES['demo-tables'],
}
files.set(
  'devis-tables.pdf',
  bill({ ...tablesBill, kind: 'quote', number: 'DV-2026-31' }).bytes,
)
files.set(
  'facture-menuiserie-ndiaye.pdf',
  bill({ ...tablesBill, kind: 'invoice', number: 'FA-2026-58' }).bytes,
)

const csk = d.organizations['sante-kolda']
files.set('statuts-csk.pdf', statutes(csk))
files.set(
  'statuts-fsr.pdf',
  statutes({
    name: 'Femmes solidaires de Rufisque',
    short: 'FSR',
    commune: 'Rufisque',
    cause: 'Formation et matériel pour les femmes transformatrices de poisson',
    rule: { required: 2, of: 3 },
  }),
)

files.set('classes-peintes.png', png(classroom))
files.set('maillots-equipes.png', png(jerseys))
files.set('equipe-minibus.png', png(minibus))
files.set('livraison-tables.png', png(tables))
files.set(
  'recepisse-csk.png',
  png(specimen('RÉCÉPISSÉ DE DÉCLARATION', [
    ['Association', csk.name],
    ['Siège', `${csk.commune}, région de ${csk.region}`],
    ['Numéro de récépissé', csk.receipt],
  ], 'Document fictif · démonstration DELOS CASH · aucune valeur')),
)
files.set(
  'recepisse-fsr.png',
  png(specimen('RÉCÉPISSÉ DE DÉCLARATION', [
    ['Association', 'Femmes solidaires de Rufisque'],
    ['Siège', 'Rufisque, région de Dakar'],
    ['Numéro de récépissé', '000519/2026'],
  ], 'Document fictif · démonstration DELOS CASH · aucune valeur')),
)
const mariama = d.persons.mariama.request!
files.set(
  'cni-mariama-ba-recto.png',
  png(idCard(mariama.legalName, '12/03/1994', mariama.docNumber)),
)

/* ---------- write ---------- */

await rm(OUT, { recursive: true, force: true })
await mkdir(OUT, { recursive: true })
const manifest: Record<string, { sha256: string; size: number; type: string }> =
  {}
for (const [name, bytes] of [...files].sort(([a], [b]) => a.localeCompare(b))) {
  await writeFile(`${OUT}/${name}`, bytes)
  manifest[name] = {
    sha256: await sha(bytes as Uint8Array<ArrayBuffer>),
    size: bytes.length,
    type: name.endsWith('.pdf') ? 'application/pdf' : 'image/png',
  }
  if (!ENSURE) {
    console.log(`${name.padEnd(34)} ${String(bytes.length).padStart(8)} o`)
  }
}

if (ENSURE) {
  // the files must be the ones the seed points at: same name, same hash
  const wrong = Object.entries(seedFiles).filter(([name, f]) =>
    manifest[name]?.sha256 !== f.sha256
  ).map(([name]) => name)
  if (wrong.length) {
    console.error(
      `Ces fichiers ne correspondent pas au manifeste : ${wrong.join(', ')}.
` +
        'Lancez « pnpm seed-files » puis commitez web/lib/seed-files.ts.',
    )
    process.exit(1)
  }
  console.log(`${files.size} fichiers de démo générés dans ${OUT}`)
} else {
  await writeFile(
    MANIFEST,
    `// Generated by task-seed-files.ts: the files of the demo documents.
// The files themselves are generated, not committed (server/seed-files/).
import type { FileRef } from './types.ts'

export const seedFiles: Record<string, FileRef> = ${
      JSON.stringify(manifest, null, 2)
    }
`,
  )
  console.log(`${files.size} fichiers · ${MANIFEST}`)
}
