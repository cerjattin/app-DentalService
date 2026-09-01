import { useParams } from 'react-router'
import { FoundationPage } from '../shared/foundation-page'

export function PatientDetailPage() {
  const { patientId } = useParams()

  return (
    <FoundationPage
      title="Patient Profile"
      description={`Patient detail foundation for ID ${patientId ?? 'unknown'}.`}
      tableTitle="Patient activity"
    />
  )
}
