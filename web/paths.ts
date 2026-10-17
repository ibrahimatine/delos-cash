// Every route of the app, in one place: pages never hard-code a URL.
// Clean paths, no #hash; ids stay in the query string (?id=).
export const paths = {
  // public (DESIGN §4.1)
  home: '/', // P0 annuaire ?type= ?categorie= ?q=
  organization: '/association', // P1 ?id=
  fund: '/collecte', // P2 ?id= &onglet=sorties|preuves, P3 &dialog=contribuer
  invoice: '/facture', // P4 ?id=
  receipt: '/recu', // P5 ?id=
  expense: '/depense', // P6 ?id=
  verify: '/verifier', // P7 ?id= (collecte)
  // account and identity (§4.2)
  login: '/connexion', // C1 ?onglet=creer
  identity: '/identite', // C2
  space: '/mon-espace', // C3
  // launch (§4.3, §4.4)
  launch: '/lancer',
  launchFund: '/lancer/cagnotte', // L0 blocage, L1–L3 ?etape=
  fundPublished: '/lancer/cagnotte/publiee', // L4 ?id=
  invitation: '/invitation', // L5 ?id=
  enroll: '/lancer/association', // E1–E3 ?etape=
  enrollSent: '/lancer/association/dossier', // E4 ?id=
  orgFund: '/lancer/association/collecte', // E5 ?id= (association)
  // manage a collecte (§4.5)
  manage: '/gerer', // G1 ?id= (collecte)
  newExpense: '/gerer/nouvelle-depense', // G2 ?id= (collecte)
  approval: '/gerer/depense', // G3 ?id= (dépense)
  quote: '/gerer/cotation', // G4 ?id=
  payout: '/gerer/paiement', // G5 ?id=
  proofs: '/gerer/preuves', // G6 ?id=
  // moderation (§4.6)
  moderation: '/moderation', // M1 ?onglet=identites
  moderationCase: '/moderation/dossier', // M2 ?type=association|identite&id=
  // PWA (§4.7)
  install: '/installer', // W1
  offline: '/hors-connexion', // W2 page non disponible
  components: '/dev/composants', // planche de composants
} as const

export type PathKey = keyof typeof paths

/** the tab of the bottom bar each route belongs to (mobile, DESIGN §2.2) */
export const tabOf = (path: string): 'explore' | 'launch' | 'space' | null => {
  if (path.startsWith(paths.launch) || path === paths.invitation) {
    return 'launch'
  }
  if (
    path === paths.space || path.startsWith(paths.manage) ||
    path === paths.identity || path.startsWith(paths.moderation) ||
    path === paths.login
  ) return 'space'
  if (
    path === paths.home || path === paths.organization ||
    path === paths.fund || path === paths.expense || path === paths.verify ||
    path === paths.invoice || path === paths.receipt
  ) return 'explore'
  return null
}
