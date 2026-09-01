import { useParams } from 'react-router'
import { FoundationPage } from '../shared/foundation-page'

export function DeclarationDetailPage() {
  const { declarationId } = useParams()

  return (
    <FoundationPage
      title="Declaration Detail"
      description={`Declaration detail foundation for ID ${declarationId ?? 'unknown'}.`}
      tableTitle="Declaration items"
    />
  )
}
