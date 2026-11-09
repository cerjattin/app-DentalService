import type { QueryClient } from '@tanstack/react-query'
import { appointmentKeys, receptionKeys } from './appointment-api'
import { encounterKeys } from '../clinical/clinical-api'
import { dashboardKeys } from '../dashboard/dashboard-api'
import { invoiceKeys } from '../billing/billing-api'

export async function refreshAppointmentWorkflow(client: QueryClient, appointmentId: string, encounterId?: string) {
  await Promise.all([
    client.invalidateQueries({ queryKey: appointmentKeys.detail(appointmentId) }),
    client.invalidateQueries({ queryKey: appointmentKeys.lists() }),
    client.invalidateQueries({ queryKey: encounterKeys.appointment(appointmentId) }),
    client.invalidateQueries({ queryKey: receptionKeys.all }),
    client.invalidateQueries({ queryKey: dashboardKeys.all }),
    client.invalidateQueries({ queryKey: invoiceKeys.lists() }),
    ...(encounterId ? [client.invalidateQueries({ queryKey: encounterKeys.procedures(encounterId) })] : []),
  ])
}
