import { useParams } from 'react-router'
import { FoundationPage } from '../shared/foundation-page'

export function ClinicalAppointmentPage() {
  const { appointmentId } = useParams()

  return (
    <FoundationPage
      title="Clinical Workspace"
      description={`Tablet-friendly clinical shell for appointment ${appointmentId ?? 'unknown'}.`}
      tableTitle="Clinical actions"
    />
  )
}
