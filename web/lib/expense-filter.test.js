import { test } from 'node:test'
// Finding one spending among many (web/lib/expense-filter.ts).
import { assertEquals } from '../../api/lib/test-utils.ts'
import {
  filterExpenses,
  monthLabel,
  periodsOf,
  phaseOf,
} from './expense-filter.ts'

const fund = { code: 'C001' }
const at = (y, m, d) => new Date(y, m - 1, d, 12).getTime()
const expense = (seq, title, name, createdAt, status, amount = 10_000) => ({
  id: `e${seq}`,
  seq,
  title,
  reason: '',
  amount,
  createdAt,
  beneficiary: { name, operator: 'Wave', last2: '01' },
  status,
})
const list = [
  expense(
    1,
    'Peinture des classes',
    'Atelier Diouf',
    at(2025, 11, 3),
    'justified',
  ),
  expense(2, 'Tableaux blancs', 'Papeterie Sow', at(2026, 9, 30), 'approved'),
  expense(
    3,
    'Riz et huile',
    'Boutique Keur Serigne',
    at(2026, 10, 2),
    'paid',
    120_000,
  ),
  expense(4, 'Repas refusé', 'Traiteur', at(2026, 10, 5), 'rejected'),
]
const statusOf = (e) => e.status
const ids = (filter) =>
  filterExpenses(list, fund, statusOf, filter).map((e) => e.id)

test('the most recent spending comes first', () => {
  assertEquals(ids({}), ['e4', 'e3', 'e2', 'e1'])
})

test('running and finished spendings', () => {
  assertEquals(phaseOf('paid'), 'en-cours')
  assertEquals(phaseOf('failed'), 'en-cours')
  assertEquals(ids({ etat: 'en-cours' }), ['e3', 'e2'])
  assertEquals(ids({ etat: 'terminees' }), ['e4', 'e1'])
})

test('a year or a month', () => {
  assertEquals(ids({ periode: '2026' }), ['e4', 'e3', 'e2'])
  assertEquals(ids({ periode: '2026-10' }), ['e4', 'e3'])
  assertEquals(monthLabel('2026-10'), 'octobre 2026')
  assertEquals(
    periodsOf(list.map((e) => e.createdAt)).map((p) => [p.year, p.count]),
    [
      ['2026', 3],
      ['2025', 1],
    ],
  )
  assertEquals(periodsOf(list.map((e) => e.createdAt))[0].months, [
    ['2026-10', 2],
    ['2026-09', 1],
  ])
})

test('search: title, beneficiary, reference, amount, without accents', () => {
  assertEquals(ids({ q: 'peinture' }), ['e1'])
  assertEquals(ids({ q: 'SERIGNE' }), ['e3'])
  assertEquals(ids({ q: 'refuse' }), ['e4'])
  assertEquals(ids({ q: 'EXP-002' }), ['e2'])
  assertEquals(ids({ q: '120000' }), ['e3'])
  assertEquals(ids({ q: 'riz serigne' }), ['e3'])
  assertEquals(ids({ q: 'riz diouf' }), [])
})
