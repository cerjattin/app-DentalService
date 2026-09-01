import { useParams } from 'react-router'
import { FoundationPage } from '../shared/foundation-page'

export function InvoiceDetailPage() {
  const { invoiceId } = useParams()

  return (
    <FoundationPage
      title="Invoice Detail"
      description={`Invoice detail foundation for ID ${invoiceId ?? 'unknown'}.`}
      tableTitle="Invoice versions"
    />
  )
}
