import type { Patient } from '../../types/patient'

export function patientFullName(patient: Patient) {
  return [
    patient.firstName,
    patient.middleName,
    patient.lastName,
    patient.secondLastName,
  ]
    .filter(Boolean)
    .join(' ')
}

export function formatDateOnly(value: string | null) {
  if (!value) return 'Not provided'
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    timeZone: 'America/Curacao',
  }).format(new Date(`${year}-${month}-${day}T12:00:00-04:00`))
}
