import { paths } from '../paths.ts'
import { Compass } from '../assets/icons.tsx'
import { Button, EmptyState } from '../ui/primitives.tsx'
import { Page } from '../ui/shell.tsx'

export const NotFoundPage = (
  { title = 'Page introuvable', text }: { title?: string; text?: string },
) => (
  <Page title={title}>
    <EmptyState icon={Compass} title={title}>
      <p className='m-0 text-[14px] text-muted'>
        {text ??
          'Le lien est peut-être incomplet ou la collecte a été retirée.'}
      </p>
      <Button variant='secondary' size='sm' href={paths.home}>
        Retour à l’annuaire
      </Button>
    </EmptyState>
  </Page>
)
