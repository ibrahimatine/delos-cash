import { paths } from './paths.ts'

// Screens of the brief (DESIGN §4), with their code. `back` is where the
// mobile back arrow goes when there is no history (a shared link).
export type Screen = {
  code: string
  title: string
  path: string
  /** top-level screens: no back arrow in mobile */
  top?: boolean
  /** screens without a bottom action bar show the tab bar in mobile */
  tabs?: boolean
}

export const screens: Screen[] = [
  { code: 'P0', title: 'Annuaire', path: paths.home, top: true, tabs: true },
  {
    code: 'P1',
    title: 'Fiche d’association',
    path: paths.organization,
    tabs: true,
  },
  { code: 'P2', title: 'Collecte', path: paths.fund },
  { code: 'P4', title: 'Facture Lightning', path: paths.invoice },
  { code: 'P5', title: 'Reçu de contribution', path: paths.receipt },
  { code: 'P6', title: 'Chaîne de preuves', path: paths.expense, tabs: true },
  { code: 'P7', title: 'Vérification d’intégrité', path: paths.verify },
  { code: 'C1', title: 'Connexion', path: paths.login },
  { code: 'C2', title: 'Vérifier mon identité', path: paths.identity },
  { code: 'C3', title: 'Mon espace', path: paths.space, top: true, tabs: true },
  { code: 'L', title: 'Lancer', path: paths.launch, top: true, tabs: true },
  { code: 'L1', title: 'Lancer une cagnotte', path: paths.launchFund },
  { code: 'L4', title: 'Cagnotte publiée', path: paths.fundPublished },
  { code: 'L5', title: 'Invitation', path: paths.invitation },
  { code: 'E1', title: 'Enrôler une association', path: paths.enroll },
  { code: 'E4', title: 'Dossier envoyé', path: paths.enrollSent },
  { code: 'G1', title: 'Trésorerie', path: paths.manage },
  { code: 'G2', title: 'Nouvelle dépense', path: paths.newExpense },
  { code: 'G3', title: 'Dépense', path: paths.approval },
  { code: 'G4', title: 'Cotation', path: paths.quote },
  { code: 'G5', title: 'Suivi du paiement', path: paths.payout },
  { code: 'G6', title: 'Preuves de livraison', path: paths.proofs },
  {
    code: 'M1',
    title: 'File de vérification',
    path: paths.moderation,
    tabs: true,
  },
  { code: 'M2', title: 'Dossier', path: paths.moderationCase },
  { code: 'W1', title: 'Installer', path: paths.install },
  { code: 'W2', title: 'Hors connexion', path: paths.offline },
  { code: 'UI', title: 'Planche de composants', path: paths.components },
]

export const screenOf = (path: string) => screens.find((s) => s.path === path)
