// Demo data (DESIGN §3), all fictitious. Dates are relative to the moment
// the demo is (re)initialised, so "Aujourd'hui · 09:58" stays true.
import type {
  Contribution,
  Db,
  Doc,
  Expense,
  FileRef,
  Fund,
  Operator,
  Organization,
  Person,
  Quote,
} from '../lib/types.ts'
import { appendEvent, type EventInput } from '../lib/ledger.ts'
import { fcfa, toSats } from '../lib/format.ts'
// real files of the demo documents (task-seed-files.ts)
import { seedFiles } from '../lib/seed-files.ts'

export const DB_VERSION = 5

const files = seedFiles

/** the stored file of a demo document (empty before task-seed-files ran) */
const fileRef = (name: string): FileRef => {
  const { sha256 = '', size = 0, type = 'image/png' } = files[name] ?? {}
  return { sha256, size, type }
}

/** a demo file, as if just picked in a drop zone (guided demo) */
export const seedFile = (name: string) => {
  const file = files[name]
  if (!file) throw Error(`no demo file ${name}: pnpm seed-files`)
  return { name, ...file }
}

/** deterministic pseudo-random generator, the demo is the same every time */
const makeRng = (seed: number) => () =>
  (seed = (seed * 16807) % 2147483647) / 2147483647

export const hexFrom = (rng: () => number, length = 64) =>
  Array.from({ length }, () => Math.floor(rng() * 16).toString(16)).join('')

const BECH32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
export const bolt11For = (satsAmount: number, rng: () => number) =>
  `lntbs${satsAmount * 10}n1pn9x7qfpp5${
    Array.from({ length: 180 }, () => BECH32[Math.floor(rng() * 32)]).join('')
  }q7k3c`

const pad = (n: number, size: number) => String(n).padStart(size, '0')
export const contribRef = (code: string, seq: number) =>
  `DELOS-${code}-CONTRIB-${pad(seq, 4)}`
export const expenseRef = (code: string, seq: number) =>
  `DELOS-${code}-EXP-${pad(seq, 3)}`
export const payoutRef = (code: string, seq: number, attempt: number) =>
  `${expenseRef(code, seq)}-PAYOUT-${pad(attempt, 3)}`

/** quote of a payout (CDC §7.7): Bitnob pays settlement_amount in XOF */
export const RATE = 37_000_000
export const makeQuote = (
  id: string,
  amount: number,
  at: number,
  feeFactor = 1,
): Quote => {
  const debitSats = toSats(amount)
  const feeSats = Math.round(debitSats * 0.0012686 * feeFactor)
  return {
    id,
    at,
    expiresAt: at + 15 * 60_000,
    amount,
    debitSats,
    feeSats,
    rate: RATE,
    effectiveRate: Math.round(amount / (debitSats + feeSats) * 1e8 / 1000) *
      1000,
  }
}

export const buildSeed = (now = Date.now()): Db => {
  const rng = makeRng(20261017)
  const minutesAgo = (min: number) => now - min * 60_000
  const at = (daysAgo: number, h: number, m: number) => {
    const d = new Date(now)
    d.setDate(d.getDate() - daysAgo)
    d.setHours(h, m, 0, 0)
    return d.getTime()
  }

  // --- people ------------------------------------------------------------
  const person = (
    id: string,
    name: string,
    email: string,
    verifiedDaysAgo?: number,
    extra: Partial<Person> = {},
  ): Person => ({
    id,
    name,
    email,
    identity: verifiedDaysAgo === undefined ? 'none' : 'verified',
    verifiedAt: verifiedDaysAgo === undefined
      ? undefined
      : at(verifiedDaysAgo, 11, 20),
    ...extra,
  })
  const persons: Record<string, Person> = {}
  for (
    const p of [
      person('awa', 'Awa Diop', 'awa.diop@example.sn', 29, { feminine: true }),
      person('moussa', 'Moussa Sarr', 'moussa.sarr@example.sn', 29),
      person('fatou', 'Fatou Ndiaye', 'fatou.ndiaye@example.sn', 29, {
        feminine: true,
      }),
      person('ibrahima', 'Ibrahima Fall', 'ibrahima.fall@example.sn', 27),
      person('mariama', 'Mariama Ba', 'mariama.ba@example.sn', undefined, {
        identity: 'pending',
        feminine: true,
        request: {
          legalName: 'Mariama Ba',
          birthDate: '1994-03-12',
          docType: 'CNI',
          docNumber: '1 754 1994 00231',
          fileName: 'cni-mariama-ba-recto.png',
          file: fileRef('cni-mariama-ba-recto.png'),
          submittedAt: minutesAgo(4),
        },
      }),
      person('khadija', 'Khadija', 'khadija@delos.cash', 60, {
        moderator: true,
        feminine: true,
      }),
      person('cheikh', 'Cheikh Faye', 'cheikh.faye@example.sn', 33),
      person('aminata', 'Aminata Diallo', 'aminata.diallo@example.sn', 39, {
        feminine: true,
      }),
      person('rokhaya', 'Rokhaya Ndiaye', 'rokhaya.ndiaye@example.sn', 38, {
        feminine: true,
      }),
      person('pape', 'Pape Guèye', 'pape.gueye@example.sn', 110),
      person('ndeye', 'Ndèye Sow', 'ndeye.sow@example.sn', 110, {
        feminine: true,
      }),
      person('lamine', 'Lamine Diop', 'lamine.diop@example.sn', 108),
      person('ousmane', 'Dr Ousmane Baldé', 'ousmane.balde@example.sn', 6),
      person('aissatou', 'Aïssatou Diallo', 'aissatou.diallo@example.sn', 5, {
        feminine: true,
      }),
      person('fanta', 'Fanta Sané', 'fanta.sane@example.sn', 5, {
        feminine: true,
      }),
    ]
  ) persons[p.id] = p

  // --- documents -----------------------------------------------------------
  let docCount = 0
  const doc = (
    name: string,
    size: number,
    when: number,
    authorId: string,
    kind: Doc['kind'],
    sha256 = hexFrom(rng),
    visibility: Doc['visibility'] = 'public',
  ): Doc => ({
    id: `doc-${++docCount}`,
    name,
    // the generated file wins: its hash is the one anybody can check
    size: files[name]?.size ?? size,
    sha256: files[name]?.sha256 ?? sha256,
    at: when,
    authorId,
    visibility,
    kind,
  })

  // --- organizations -------------------------------------------------------
  const organizations: Record<string, Organization> = {
    'ape-ndiass': {
      id: 'ape-ndiass',
      name: 'Association des parents d’élèves de Ndiass',
      short: 'APE Ndiass',
      initials: 'APE',
      category: 'Éducation',
      region: 'Thiès',
      commune: 'Ndiass',
      cause: 'Équiper l’école et soutenir les élèves de Ndiass',
      contact: 'ape.ndiass@example.sn',
      receipt: '000123/2026',
      status: 'verified',
      submittedAt: at(31, 9, 12),
      verifiedAt: at(28, 15, 40),
      members: [
        { personId: 'moussa', role: 'Président', representative: true },
        { personId: 'awa', role: 'Trésorière', representative: true },
        { personId: 'fatou', role: 'Contrôleuse', representative: false },
      ],
      rule: { required: 2, of: 3 },
    },
    'asc-grand-yoff': {
      id: 'asc-grand-yoff',
      name: 'ASC Grand-Yoff',
      short: 'ASC Grand-Yoff',
      initials: 'ASC',
      category: 'Sport',
      region: 'Dakar',
      commune: 'Grand-Yoff',
      cause: 'Faire jouer les jeunes du quartier toute l’année',
      contact: 'asc.grandyoff@example.sn',
      receipt: '000087/2025',
      status: 'verified',
      submittedAt: at(115, 10, 0),
      verifiedAt: at(112, 16, 5),
      members: [
        { personId: 'pape', role: 'Président', representative: true },
        { personId: 'ndeye', role: 'Trésorière', representative: true },
        { personId: 'lamine', role: 'Contrôleur', representative: false },
      ],
      rule: { required: 2, of: 3 },
    },
    'sante-kolda': {
      id: 'sante-kolda',
      name: 'Collectif Santé Kolda',
      short: 'CSK',
      initials: 'CSK',
      category: 'Santé',
      region: 'Kolda',
      commune: 'Kolda',
      cause:
        'Prévention du paludisme dans les villages du département de Kolda',
      contact: 'contact@sante-kolda.example',
      receipt: '000456/2026',
      receiptDoc: doc(
        'recepisse-csk.png',
        640_000,
        at(2, 18, 0),
        'ousmane',
        'receipt',
        '5a1b7c02d94e3f6a8b0c1d2e3f405162738495a6b7c8d9e0f1a2b3c4d5ee93c',
        'private',
      ),
      statutesDoc: doc(
        'statuts-csk.pdf',
        319_488,
        at(2, 18, 1),
        'ousmane',
        'statutes',
      ),
      status: 'pending',
      submittedAt: at(2, 18, 2),
      members: [
        { personId: 'ousmane', role: 'Président', representative: true },
        { personId: 'aissatou', role: 'Trésorière', representative: true },
        { personId: 'fanta', role: 'Membre', representative: false },
      ],
      rule: { required: 2, of: 3 },
    },
  }

  // --- funds ---------------------------------------------------------------
  const funds: Record<string, Fund> = {
    'ecole-ndiass': {
      id: 'ecole-ndiass',
      code: 'C014',
      kind: 'association',
      orgId: 'ape-ndiass',
      launchers: [],
      title: 'Équipement de l’école de Ndiass',
      story:
        'Tables, bancs et tableaux pour les deux nouvelles classes de CE1.',
      category: 'Éducation',
      commune: 'Ndiass',
      goal: 1_000_000,
      createdAt: at(40, 9, 0),
      beneficiaries: [],
    },
    'cantine-2025': {
      id: 'cantine-2025',
      code: 'C009',
      kind: 'association',
      orgId: 'ape-ndiass',
      launchers: [],
      title: 'Cantine de la rentrée 2025',
      story: 'Un repas chaud par jour pour les 120 élèves pendant le premier ' +
        'mois de classe.',
      category: 'Éducation',
      commune: 'Ndiass',
      goal: 270_000,
      createdAt: at(400, 9, 0),
      closedAt: at(352, 18, 0),
      beneficiaries: [],
    },
    'tournoi-grand-yoff': {
      id: 'tournoi-grand-yoff',
      code: 'C021',
      kind: 'association',
      orgId: 'asc-grand-yoff',
      launchers: [],
      title: 'Tournoi inter-quartiers 2026',
      story: 'Seize équipes de jeunes, un mois de matchs et une finale au ' +
        'stade Demba Diop.',
      category: 'Sport',
      commune: 'Grand-Yoff',
      goal: 600_000,
      createdAt: at(60, 10, 0),
      beneficiaries: [],
    },
    'fournitures-cm2': {
      id: 'fournitures-cm2',
      code: 'C027',
      kind: 'cagnotte',
      launchers: [{ personId: 'cheikh', status: 'accepted' }],
      title: 'Fournitures pour la classe de CM2',
      story:
        'Cahiers, stylos et manuels pour les 32 élèves de CM2 de l’école ' +
        'Keury Kao.',
      category: 'Éducation',
      commune: 'Rufisque',
      goal: 200_000,
      createdAt: at(18, 8, 30),
      beneficiaries: [{
        name: 'Papeterie de Rufisque',
        operator: 'Wave',
        last2: '58',
        relation: 'fournisseur des fournitures',
      }],
    },
    'basket-thies': {
      id: 'basket-thies',
      code: 'C031',
      kind: 'cagnotte',
      launchers: [
        { personId: 'aminata', status: 'accepted' },
        { personId: 'rokhaya', status: 'accepted' },
      ],
      title: 'Déplacement de l’équipe de basket féminine',
      story: 'Transport et hébergement de l’équipe cadette de Thiès pour le ' +
        'tournoi national de Ziguinchor.',
      category: 'Sport',
      commune: 'Thiès',
      goal: 500_000,
      createdAt: at(30, 17, 0),
      beneficiaries: [{
        name: 'GIE Transport Cayor',
        operator: 'Wave',
        last2: '81',
        relation: 'transporteur de l’équipe',
      }],
    },
  }

  // --- contributions -------------------------------------------------------
  const contributions: Contribution[] = []
  const seq: Db['seq'] = {}
  const contribute = (
    fundId: string,
    amount: number,
    name: string | null,
    when: number,
  ) => {
    const code = funds[fundId].code
    const counters = seq[code] ||= { contrib: 0, expense: 0 }
    const s = ++counters.contrib
    const sats = toSats(amount)
    contributions.push({
      id: `${fundId}-${s}`,
      fundId,
      seq: s,
      amount,
      sats,
      name,
      at: when,
      status: 'paid',
      expiresAt: when + 3_600_000,
      bolt11: bolt11For(sats, rng),
      paymentHash: hexFrom(rng),
      preimage: hexFrom(rng),
      paidAt: when,
    })
  }
  const shuffle = <T>(list: T[]) => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[list[i], list[j]] = [list[j], list[i]]
    }
    return list
  }
  const names = [
    null,
    'Fatou K.',
    null,
    'Ibou N.',
    'Anciens élèves de Ndiass',
    null,
    'Khady S.',
    null,
    'Serigne M.',
    'Awa T.',
    null,
    'Babacar D.',
    null,
    'Coumba F.',
    'Modou L.',
    null,
  ]
  const spread = (
    fundId: string,
    amounts: number[],
    fromDay: number,
    toDay: number,
  ) =>
    amounts.forEach((amount, i) => {
      const day = Math.round(fromDay - (fromDay - toDay) * i / amounts.length)
      contribute(
        fundId,
        amount,
        names[i % names.length],
        at(day, 8 + Math.floor(rng() * 13), Math.floor(rng() * 60)),
      )
    })

  // École de Ndiass: 38 contributions, 975 000 FCFA (DESIGN §3.3)
  spread(
    'ecole-ndiass',
    shuffle([
      50,
      25,
      10,
      5,
      100,
      20,
      15,
      25,
      50,
      10,
      5,
      30,
      25,
      20,
      50,
      10,
      15,
      25,
      40,
      5,
      10,
      25,
      50,
      20,
      10,
      15,
      25,
      5,
      50,
      100,
      20,
    ].map((k) => k * 1000)),
    38,
    4,
  )
  contribute('ecole-ndiass', 3_000, 'Oumar K.', at(3, 12, 40))
  contribute('ecole-ndiass', 15_000, null, at(2, 19, 12))
  contribute('ecole-ndiass', 25_000, 'Mame Diarra N.', at(1, 18, 30))
  contribute('ecole-ndiass', 2_000, 'Cheikh D.', at(1, 21, 5))
  contribute('ecole-ndiass', 50_000, null, minutesAgo(137))
  contribute('ecole-ndiass', 5_000, 'Aminata S.', minutesAgo(49))
  contribute('ecole-ndiass', 10_000, null, minutesAgo(31))

  // Cantine 2025 (closed): 12 contributions, 270 000 FCFA
  spread(
    'cantine-2025',
    [30, 25, 20, 15, 40, 10, 25, 20, 30, 15, 20, 20].map((k) => k * 1000),
    398,
    360,
  )
  // Tournoi: 29 contributions, 410 000 FCFA
  spread(
    'tournoi-grand-yoff',
    shuffle([
      ...Array(20).fill(10_000),
      ...Array(5).fill(25_000),
      ...Array(3).fill(5_000),
      70_000,
    ]),
    58,
    1,
  )
  // Fournitures CM2: 21 contributions, 180 000 FCFA
  spread(
    'fournitures-cm2',
    shuffle([
      ...Array(10).fill(5_000),
      ...Array(8).fill(10_000),
      15_000,
      15_000,
      20_000,
    ]),
    17,
    1,
  )
  // Basket féminin: 27 contributions, 320 000 FCFA
  spread(
    'basket-thies',
    shuffle([
      ...Array(12).fill(10_000),
      ...Array(10).fill(5_000),
      ...Array(4).fill(25_000),
      50_000,
    ]),
    29,
    1,
  )

  // --- expenses ------------------------------------------------------------
  const expenses: Expense[] = []
  type Plan = {
    fundId: string
    seq?: number
    title: string
    amount: number
    reason: string
    beneficiary: Expense['beneficiary']
    authorId: string
    createdAt: number
    quoteDoc: [string, number, string?]
    approvals: [string, number][]
    paidAt?: number
    proofs?: [string, number, number, Doc['kind'], string?][]
  }
  const expense = (p: Plan) => {
    const fund = funds[p.fundId]
    const counters = seq[fund.code] ||= { contrib: 0, expense: 0 }
    const s = p.seq ?? ++counters.expense
    counters.expense = Math.max(counters.expense, s)
    const e: Expense = {
      id: `${p.fundId}-exp-${s}`,
      seq: s,
      fundId: p.fundId,
      title: p.title,
      amount: p.amount,
      reason: p.reason,
      beneficiary: p.beneficiary,
      authorId: p.authorId,
      createdAt: p.createdAt,
      quoteDoc: doc(
        p.quoteDoc[0],
        p.quoteDoc[1],
        p.createdAt,
        p.authorId,
        'quote',
        p.quoteDoc[2],
      ),
      approvals: p.approvals.map(([personId, at]) => ({ personId, at })),
      proofs: (p.proofs || []).map(([name, size, when, kind, hash]) =>
        doc(name, size, when, p.authorId, kind, hash)
      ),
      deliveryConfirmed: !!p.proofs?.length,
    }
    if (p.paidAt) {
      const quoteAt = p.paidAt - 4 * 60_000
      e.quote = makeQuote(
        `QT2_${31_000_000 + Math.floor(rng() * 900_000)}`,
        p.amount,
        quoteAt,
      )
      const step = (i: number) => quoteAt + [2, 4, 41, 63, 97, 132][i] * 1000
      e.payout = {
        ref: payoutRef(fund.code, s, 1),
        attempt: 1,
        status: 'completed',
        steps: [0, 1, 2, 3, 4, 5].map(step),
        settlement: `sandbox_txn_${hexFrom(rng, 4)}…${hexFrom(rng, 4)}`,
        startedAt: quoteAt,
        completedAt: step(5),
      }
    }
    if (e.proofs.length) e.justifiedAt = e.proofs.at(-1)!.at
    expenses.push(e)
    return e
  }

  expense({
    fundId: 'ecole-ndiass',
    seq: 5,
    title: 'Peinture des deux classes',
    amount: 120_000,
    reason: 'Peinture des murs et des portes des deux classes de CE1',
    beneficiary: { name: 'Atelier Diouf', operator: 'Wave', last2: '03' },
    authorId: 'awa',
    createdAt: at(21, 9, 20),
    quoteDoc: ['devis-peinture.pdf', 142_000],
    approvals: [['moussa', at(21, 11, 2)], ['fatou', at(20, 8, 45)]],
    paidAt: at(18, 10, 5),
    proofs: [
      ['facture-atelier-diouf.pdf', 176_000, at(15, 16, 18), 'invoice'],
      ['classes-peintes.png', 1_320_000, at(15, 16, 20), 'photo'],
    ],
  })
  expense({
    fundId: 'ecole-ndiass',
    seq: 6,
    title: 'Tableaux blancs ×2',
    amount: 90_000,
    reason: 'Deux tableaux blancs 120 × 240 cm pour les classes de CE1',
    beneficiary: {
      name: 'Papeterie Sow',
      operator: 'Orange Money',
      last2: '18',
    },
    authorId: 'awa',
    createdAt: at(1, 17, 2),
    quoteDoc: ['devis-tableaux.pdf', 90_112],
    approvals: [['moussa', at(1, 18, 20)]],
  })
  const cantine: [string, number, string][] = [
    ['Riz et huile pour le mois', 120_000, 'Boutique Keur Serigne'],
    ['Légumes et poisson', 90_000, 'GIE des femmes de Ndiass'],
    ['Gaz et ustensiles', 60_000, 'Quincaillerie Ndiaye'],
  ]
  cantine.forEach(([title, amount, name], i) =>
    expense({
      fundId: 'cantine-2025',
      title,
      amount,
      reason: 'Repas de la cantine scolaire, rentrée 2025',
      beneficiary: { name, operator: 'Wave', last2: String(21 + i * 17) },
      authorId: 'awa',
      createdAt: at(372 - i * 6, 9, 30),
      quoteDoc: [`devis-cantine-${i + 1}.pdf`, 70_000 + i * 9_000],
      approvals: [['moussa', at(372 - i * 6, 12, 0)], [
        'fatou',
        at(371 - i * 6, 9, 0),
      ]],
      paidAt: at(370 - i * 6, 10, 0),
      proofs: [
        [
          `facture-cantine-${i + 1}.pdf`,
          120_000,
          at(368 - i * 6, 17, 0),
          'invoice',
        ],
      ],
    })
  )
  expense({
    fundId: 'tournoi-grand-yoff',
    title: 'Maillots et ballons',
    amount: 150_000,
    reason: 'Seize jeux de maillots et vingt ballons pour le tournoi',
    beneficiary: { name: 'Sport Afrique Dakar', operator: 'Wave', last2: '36' },
    authorId: 'ndeye',
    createdAt: at(26, 10, 0),
    quoteDoc: ['devis-maillots.pdf', 101_000],
    approvals: [['pape', at(26, 12, 30)], ['lamine', at(25, 9, 10)]],
    paidAt: at(24, 11, 0),
    proofs: [
      ['facture-sport-afrique.pdf', 98_000, at(20, 15, 0), 'invoice'],
      ['maillots-equipes.png', 1_100_000, at(20, 15, 2), 'photo'],
    ],
  })
  expense({
    fundId: 'fournitures-cm2',
    title: 'Cahiers, stylos et manuels',
    amount: 150_000,
    reason: 'Fournitures de l’année pour les 32 élèves de CM2',
    beneficiary: funds['fournitures-cm2'].beneficiaries[0],
    authorId: 'cheikh',
    createdAt: at(3, 10, 10),
    quoteDoc: ['devis-fournitures.pdf', 76_000],
    approvals: [],
    paidAt: at(2, 11, 30),
  })
  expense({
    fundId: 'basket-thies',
    title: 'Location du minibus Thiès–Ziguinchor',
    amount: 150_000,
    reason: 'Aller-retour de l’équipe cadette pour le tournoi national',
    beneficiary: funds['basket-thies'].beneficiaries[0],
    authorId: 'aminata',
    createdAt: at(7, 9, 12),
    quoteDoc: [
      'devis-minibus.pdf',
      96_000,
      '75afd2248e15701fb3a0c225791395336d1eb0dc9f72b17d1c082b4536fd3940',
    ],
    approvals: [['rokhaya', at(7, 11, 40)]],
    paidAt: at(7, 11, 52),
    proofs: [
      [
        'facture-transport-cayor.pdf',
        131_000,
        at(4, 19, 3),
        'invoice',
        '01e150c2bcde999f0d44f331d317ff6714a4cbc4993347cddd9547dabad708a7',
      ],
      [
        'equipe-minibus.png',
        1_240_000,
        at(4, 19, 5),
        'photo',
        'ffa6ed370c3c8c77b34a20030cf7016daa8f836f09e82ac4305a70640dfc04d5',
      ],
    ],
  })

  // Fonctionnement de l'APE: a permanent collecte (no goal), a year of
  // small spendings, so the map is read with its search and its filters
  funds['ape-fonctionnement'] = {
    id: 'ape-fonctionnement',
    code: 'C006',
    kind: 'association',
    orgId: 'ape-ndiass',
    launchers: [],
    title: 'Fonctionnement de l’APE',
    story: 'Dons libres pour la vie de l’école toute l’année : entretien, ' +
      'petites réparations, hygiène, fêtes et remise des prix.',
    category: 'Éducation',
    commune: 'Ndiass',
    goal: 0,
    createdAt: at(420, 9, 0),
    beneficiaries: [],
  }
  spread(
    'ape-fonctionnement',
    [
      ...Array(4).fill([10, 25, 5, 50, 15, 20, 30, 10, 5, 100]).flat(),
      25,
      10,
      5,
      50,
      20,
    ].map((k: number) => k * 1000),
    410,
    1,
  )
  const running: [number, string, number, string, Operator, string][] = [
    [
      395,
      'Réparation des tables-bancs',
      35_000,
      'Menuiserie Ndiaye',
      'Wave',
      '47',
    ],
    [
      370,
      'Craies et cahiers de préparation',
      18_000,
      'Papeterie Sow',
      'Orange Money',
      '18',
    ],
    [
      345,
      'Entretien des toilettes',
      25_000,
      'GIE Propreté Ndiass',
      'Wave',
      '62',
    ],
    [
      320,
      'Fête de fin de trimestre',
      60_000,
      'Traiteur Fatou Cissé',
      'Wave',
      '71',
    ],
    [
      300,
      'Remplacement des ampoules',
      12_000,
      'Quincaillerie Ndiaye',
      'Wave',
      '55',
    ],
    [280, 'Peinture du portail', 40_000, 'Atelier Diouf', 'Wave', '03'],
    [
      255,
      'Kits d’hygiène pour la rentrée',
      45_000,
      'Pharmacie de Ndiass',
      'Orange Money',
      '29',
    ],
    [
      230,
      'Ballons et filets de sport',
      30_000,
      'Sport Afrique Dakar',
      'Wave',
      '36',
    ],
    [
      205,
      'Réparation du robinet de la cour',
      15_000,
      'Plomberie Mbaye',
      'Wave',
      '84',
    ],
    [
      180,
      'Impression des bulletins',
      22_000,
      'Imprimerie du Cayor',
      'Orange Money',
      '12',
    ],
    [
      150,
      'Fournitures du deuxième trimestre',
      55_000,
      'Papeterie Sow',
      'Orange Money',
      '18',
    ],
    [120, 'Nettoyage de la cour', 20_000, 'GIE Propreté Ndiass', 'Wave', '62'],
    [
      95,
      'Remise des prix de fin d’année',
      75_000,
      'Librairie Clairafrique',
      'Orange Money',
      '40',
    ],
    [70, 'Serrures des classes', 28_000, 'Quincaillerie Ndiaye', 'Wave', '55'],
    [45, 'Entretien du château d’eau', 50_000, 'Plomberie Mbaye', 'Wave', '84'],
    // paid, the invoice is awaited
    [
      25,
      'Rideaux pour les classes de CE1',
      32_000,
      'Couture Mame Diarra',
      'Wave',
      '12',
    ],
    // approved, not paid yet
    [9, 'Bancs pour la cour', 48_000, 'Menuiserie Ndiaye', 'Wave', '47'],
    // waiting for its second approval
    [
      2,
      'Trousse de premiers secours',
      16_000,
      'Pharmacie de Ndiass',
      'Orange Money',
      '29',
    ],
  ]
  running.forEach(([day, title, amount, name, operator, last2], i) => {
    const n = String(i + 1).padStart(2, '0')
    const last = running.length - i
    expense({
      fundId: 'ape-fonctionnement',
      title,
      amount,
      reason: `${title}, école élémentaire de Ndiass`,
      beneficiary: { name, operator, last2 },
      authorId: 'awa',
      createdAt: at(day, 9, 10),
      quoteDoc: [`devis-fonctionnement-${n}.pdf`, 60_000],
      approvals: last === 1
        ? [['moussa', at(day, 11, 30)]]
        : [['moussa', at(day, 11, 30)], ['fatou', at(day, 16, 5)]],
      paidAt: last > 2 ? at(day - 1, 10, 0) : undefined,
      proofs: last > 3
        ? [[
          `facture-fonctionnement-${n}.pdf`,
          80_000,
          at(day - 2, 17, 0),
          'invoice',
        ]]
        : undefined,
    })
  })

  const db: Db = {
    version: DB_VERSION,
    seededAt: now,
    persons,
    organizations,
    funds,
    contributions,
    expenses,
    ledger: {},
    seq,
  }

  // --- register: replay the history in chronological order ---------------
  const events = Object.keys(funds).flatMap((id) => historyOf(db, id))
  events.sort((a, b) => a.at - b.at)
  for (const e of events) appendEvent(db, e)
  return db
}

/** name shown in the register for a person id */
const nameOf = (db: Db, id: string) => db.persons[id]?.name ?? id

/** events a fund's seeded history produces, for the initial register */
const historyOf = (db: Db, fundId: string): EventInput[] => {
  const fund = db.funds[fundId]
  const out: EventInput[] = [{
    fundId,
    at: fund.createdAt,
    type: 'FUND_PUBLISHED',
    actor: fund.orgId
      ? db.organizations[fund.orgId].short
      : nameOf(db, fund.launchers[0].personId),
    title: 'Collecte publiée',
    detail: fund.title,
    ref: `DELOS-${fund.code}`,
  }]
  let total = 0
  const paid = db.contributions
    .filter((c) => c.fundId === fundId && c.status === 'paid')
    .sort((a, b) => a.at - b.at)
  for (const c of paid) {
    total += c.amount
    out.push({
      fundId,
      at: c.at,
      type: 'CONTRIBUTION_CONFIRMED',
      actor: c.name ?? 'Anonyme',
      title: 'Contribution confirmée',
      detail: c.name ?? 'Anonyme',
      amount: c.amount,
      ref: contribRef(fund.code, c.seq),
    })
    if (fund.goal > 0 && total >= fund.goal && total - c.amount < fund.goal) {
      out.push({
        fundId,
        at: c.at + 1,
        type: 'GOAL_REACHED',
        actor: 'DELOS',
        title: 'Objectif atteint',
        detail: fcfa(fund.goal),
        ref: `DELOS-${fund.code}`,
      })
    }
  }
  const required = fund.orgId ? db.organizations[fund.orgId].rule.required : 1
  for (const e of db.expenses.filter((x) => x.fundId === fundId)) {
    const ref = expenseRef(fund.code, e.seq)
    out.push({
      fundId,
      at: e.createdAt,
      type: fund.kind === 'cagnotte' && fund.launchers.length === 1
        ? 'EXPENSE_PUBLISHED'
        : 'EXPENSE_PROPOSED',
      actor: nameOf(db, e.authorId),
      title: fund.kind === 'cagnotte' && fund.launchers.length === 1
        ? 'Dépense publiée'
        : 'Dépense proposée',
      detail: `« ${e.title} » · ${nameOf(db, e.authorId)}`,
      amount: e.amount,
      ref,
      expenseId: e.id,
    })
    e.approvals.forEach((a, i) => {
      const final = i + 1 >= required
      out.push({
        fundId,
        at: a.at,
        type: final ? 'EXPENSE_APPROVED' : 'EXPENSE_APPROVAL',
        actor: nameOf(db, a.personId),
        title: final
          ? required > 1
            ? `Dépense approuvée ${required}/${required}`
            : 'Dépense approuvée'
          : 'Approbation',
        detail: `${nameOf(db, a.personId)} · ${e.title}`,
        ref,
        expenseId: e.id,
      })
    })
    if (e.quote && e.payout) {
      out.push({
        fundId,
        at: e.payout.startedAt,
        type: 'PAYOUT_STARTED',
        actor: nameOf(db, e.authorId),
        title: 'Payout lancé',
        detail: `Cotation ${e.quote.id}`,
        ref: e.quote.id,
        expenseId: e.id,
      })
      out.push({
        fundId,
        at: e.payout.completedAt!,
        type: 'PAYOUT_COMPLETED',
        actor: 'Bitnob',
        title: 'Payout terminé',
        detail: `${e.beneficiary.name} via ${e.beneficiary.operator}`,
        amount: -e.amount,
        ref: e.payout.ref,
        expenseId: e.id,
      })
    }
    for (const p of e.proofs) {
      out.push({
        fundId,
        at: p.at,
        type: 'PROOF_ADDED',
        actor: nameOf(db, p.authorId),
        title: 'Justificatif ajouté',
        detail: `${p.name} · ${nameOf(db, p.authorId)}`,
        ref: `SHA-256 · ${p.sha256.slice(0, 8)}…${p.sha256.slice(-8)}`,
        expenseId: e.id,
      })
    }
  }
  if (fund.closedAt) {
    out.push({
      fundId,
      at: fund.closedAt,
      type: 'FUND_CLOSED',
      actor: fund.orgId
        ? db.organizations[fund.orgId].short
        : nameOf(db, fund.launchers[0].personId),
      title: 'Collecte terminée',
      detail: 'Plus de nouvelles contributions',
      ref: `DELOS-${fund.code}`,
    })
  }
  return out
}
