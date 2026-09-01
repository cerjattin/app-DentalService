import { useParams } from 'react-router'
import { FoundationPage } from '../shared/foundation-page'

export function AppointmentDetailPage() {
  const { appointmentId } = useParams()

  return (
    <FoundationPage
      title="Appointment Detail"
      description={`Appointment detail foundation for ID ${appointmentId ?? 'unknown'}.`}
      tableTitle="Appointment timeline"
    />
  )
}
