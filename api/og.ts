// Link previews (Open Graph): a link to a collecte pasted in WhatsApp,
// Facebook or X shows its title, what it raised and an image, because the
// crawlers of these sites never run the app. The server writes the tags into
// index.html for /collecte, /association and /depense, and draws the image
// (1200 × 630 PNG, resvg) from the live figures.
import { Resvg } from '@resvg/resvg-js'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BASE_URL, ORIGIN } from './lib/env.ts'
import { log } from './lib/log.ts'
import { state } from './state.ts'
import { expenseStatus, fundStats } from '../web/lib/rules.ts'
import { paths } from '../web/paths.ts'

const fmt = (n: number) => n.toLocaleString('fr-FR').replace(/\s/g, ' ')

const escape = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** an absolute URL of the app, as a crawler fetches it */
const absolute = (path: string) => {
  const root = ORIGIN.endsWith('/') ? ORIGIN : `${ORIGIN}/`
  return new URL(
    `${BASE_URL.replace(/^\//, '')}${path.replace(/^\//, '')}`,
    root,
  )
    .href
}

type Preview = {
  title: string
  description: string
  image?: string
  url: string
}

/** what a shared link says, from the live database */
export const previewOf = (url: URL): Preview | undefined => {
  const d = state.db
  const id = url.searchParams.get('id') ?? ''
  const page = url.pathname.slice(BASE_URL.length - 1) || '/'
  if (page === paths.fund) {
    const fund = d.funds[id]
    if (!fund) return undefined
    const s = fundStats(d, fund.id)
    const who = fund.orgId
      ? `Collecte de ${
        d.organizations[fund.orgId]?.short
      }, association vérifiée`
      : `Lancée par ${
        d.persons[fund.launchers[0].personId]?.name
      }, identité vérifiée`
    return {
      title: `${fund.title} · DELOS CASH`,
      description: `${fmt(s.raised)} F collectés${
        fund.goal ? ` sur ${fmt(fund.goal)} F` : ''
      } par ${s.count} contributeurs. ${
        s.paidCount
          ? `Dépenses justifiées ${s.justifiedCount}/${s.paidCount}.`
          : 'Chaque dépense sera publique.'
      } ${who}.`,
      image: absolute(
        `api/og/collecte/${fund.id}.png?v=${s.raised}-${s.spent}`,
      ),
      url: absolute(`${paths.fund}?id=${fund.id}`),
    }
  }
  if (page === paths.organization) {
    const org = d.organizations[id]
    if (!org || org.status !== 'verified') return undefined
    const funds = Object.values(d.funds).filter((f) => f.orgId === org.id)
    const raised = funds.reduce((t, f) => t + fundStats(d, f.id).raised, 0)
    return {
      title: `${org.name} · DELOS CASH`,
      description: `Association vérifiée · ${funds.length} collecte${
        funds.length > 1 ? 's' : ''
      } · ${fmt(raised)} F reçus. ${org.cause}.`,
      url: absolute(`${paths.organization}?id=${org.id}`),
    }
  }
  if (page === paths.expense) {
    const e = d.expenses.find((x) => x.id === id)
    if (!e) return undefined
    const fund = d.funds[e.fundId]
    const status = expenseStatus(d, e)
    return {
      title: `${e.title} · ${fmt(e.amount)} F · ${fund.title}`,
      description: `${e.beneficiary.name} · ${e.beneficiary.operator}. ${
        status === 'justified'
          ? 'Payée, facture et preuves publiées.'
          : status === 'paid'
          ? 'Payée, justificatifs attendus.'
          : 'En cours : suivez chaque étape en direct.'
      }`,
      image: absolute(
        `api/og/collecte/${fund.id}.png?v=${fundStats(d, fund.id).raised}`,
      ),
      url: absolute(`${paths.expense}?id=${e.id}`),
    }
  }
  return undefined
}

/** index.html with the tags of the shared page */
export const withPreview = (html: string, url: URL) => {
  const p = previewOf(url)
  if (!p) return html
  const tags = [
    ['og:type', 'website'],
    ['og:site_name', 'DELOS CASH'],
    ['og:locale', 'fr_FR'],
    ['og:title', p.title],
    ['og:description', p.description],
    ['og:url', p.url],
    ...(p.image
      ? [
        ['og:image', p.image],
        ['og:image:width', '1200'],
        ['og:image:height', '630'],
      ]
      : []),
  ].map(([property, content]) =>
    `<meta property="${property}" content="${escape(content)}" />`
  )
  tags.push(
    `<meta name="twitter:card" content="${
      p.image ? 'summary_large_image' : 'summary'
    }" />`,
  )
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${escape(p.title)}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/>/,
      `<meta name="description" content="${escape(p.description)}" />`,
    )
    .replace('</head>', `${tags.join('\n    ')}\n  </head>`)
}

/* ---------- the image ---------- */

const fontDir = join(dirname(fileURLToPath(import.meta.url)), 'og-fonts')
let ready: Promise<Uint8Array[]> | undefined
const setup = () =>
  ready ??= (async () => {
    return Promise.all(
      ['bricolage-400.ttf', 'bricolage-700.ttf', 'unbounded-600.ttf'].map((
        f,
      ) => readFile(`${fontDir}/${f}`)),
    )
  })()

/** cuts a title in lines of about `max` characters */
const lines = (text: string, max: number, count: number) => {
  const out: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    if ((line + ' ' + word).trim().length > max && line) {
      out.push(line)
      line = word
    } else line = (line + ' ' + word).trim()
  }
  if (line) out.push(line)
  if (out.length > count) {
    out.length = count
    out[count - 1] = `${out[count - 1].replace(/\s+\S*$/, '')}…`
  }
  return out
}

const fundCard = (fundId: string) => {
  const d = state.db
  const fund = d.funds[fundId]
  const s = fundStats(d, fundId)
  const who = fund.orgId
    ? `${d.organizations[fund.orgId]?.short} · association vérifiée`
    : `${d.persons[fund.launchers[0].personId]?.name} · identité vérifiée`
  const title = lines(fund.title, 26, 3)
  // no goal (a permanent collecte): a full bar of what came in
  const progress = fund.goal ? Math.min(1, s.raised / fund.goal) : 1
  const allJustified = s.justifiedCount === s.paidCount
  const justified = !s.paidCount
    ? 'Chaque dépense sera publique'
    : allJustified
    ? `Dépenses justifiées ${s.justifiedCount}/${s.paidCount}`
    : `Justificatif attendu · ${s.justifiedCount}/${s.paidCount} justifiées`
  const tone = allJustified ? '#16804c' : '#b45f06'
  const mark = allJustified
    ? '<path d="M55 581 l5 5 l9 -10" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>'
    : '<path d="M62 573 v10 M62 588 v1" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#f4f4f9"/>
<rect x="0" y="0" width="1200" height="10" fill="#4b3fd6"/>
<rect x="48" y="58" width="44" height="44" rx="12" fill="#4b3fd6"/>
<text x="70" y="90" text-anchor="middle" font-family="Bricolage Grotesque" font-weight="700" font-size="26" fill="#fff">D</text>
<text x="108" y="90" font-family="Bricolage Grotesque" font-weight="700" font-size="24" letter-spacing="5" fill="#17182a">DELOS<tspan fill="#4b3fd6">CASH</tspan></text>
<text x="1152" y="90" text-anchor="end" font-family="Bricolage Grotesque" font-size="22" fill="#6b6e80">${
    escape(fund.kind === 'association' ? 'Association' : 'Cagnotte')
  } · ${escape(fund.commune)}</text>
${
    title.map((l, i) =>
      `<text x="48" y="${
        190 + i * 66
      }" font-family="Unbounded" font-weight="600" font-size="54" fill="#17182a">${
        escape(l)
      }</text>`
    ).join('\n')
  }
<text x="48" y="${
    190 + title.length * 66 + 4
  }" font-family="Bricolage Grotesque" font-size="26" fill="#3a3c4e">${
    escape(who)
  }</text>
<text x="48" y="500" font-family="Unbounded" font-weight="600" font-size="44" fill="#17182a">${
    fmt(s.raised)
  } F</text>
<text x="1152" y="500" text-anchor="end" font-family="Bricolage Grotesque" font-size="26" fill="#6b6e80">${
    fund.goal ? `sur ${fmt(fund.goal)} F · ` : 'collecte permanente · '
  }${s.count} contributions</text>
<rect x="48" y="522" width="1104" height="18" rx="9" fill="#e4e4ee"/>
<rect x="48" y="522" width="${
    Math.max(18, Math.round(1104 * progress))
  }" height="18" rx="9" fill="#4b3fd6"/>
<circle cx="62" cy="581" r="14" fill="${tone}"/>
${mark}
<text x="86" y="590" font-family="Bricolage Grotesque" font-weight="700" font-size="26" fill="${tone}">${
    escape(justified)
  }</text>
<text x="1152" y="590" text-anchor="end" font-family="Bricolage Grotesque" font-size="24" fill="#6b6e80">Qui collecte, ce qui entre, où va l’argent</text>
</svg>`
}

const cache = new Map<string, Uint8Array<ArrayBuffer>>()

/** GET /api/og/collecte/<id>.png */
export const handleOgImage = async (url: URL) => {
  const match = url.pathname.match(/^\/api\/og\/collecte\/([a-z0-9-]+)\.png$/)
  const fund = match && state.db.funds[match[1]]
  if (!fund) return new Response('Not found', { status: 404 })
  const s = fundStats(state.db, fund.id)
  const key = `${fund.id}:${s.raised}:${s.spent}:${s.justifiedCount}`
  let png = cache.get(key)
  if (!png) {
    try {
      const fonts = await setup()
      png = new Resvg(fundCard(fund.id), {
        fitTo: { mode: 'original' },
        font: {
          fontFiles: ['bricolage-400.ttf', 'bricolage-700.ttf', 'unbounded-600.ttf'].map((f) => join(fontDir, f)),
          loadSystemFonts: false,
          defaultFontFamily: 'Bricolage Grotesque',
        },
      }).render().asPng() as Uint8Array<ArrayBuffer>
      if (cache.size > 500) cache.clear()
      cache.set(key, png)
    } catch (err) {
      log.error('og-image-failed', { message: (err as Error).message })
      return new Response('Image indisponible', { status: 503 })
    }
  }
  return new Response(png, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=600',
    },
  })
}
