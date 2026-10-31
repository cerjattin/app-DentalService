import type { QueryClient } from '@tanstack/react-query'
import { invoiceKeys } from '../billing/billing-api'
import { dashboardKeys } from '../dashboard/dashboard-api'
import { candidateKeys, declarationKeys } from './declaration-api'
export async function refreshDeclarationResources(client: QueryClient, id: string) {
  await Promise.all([
    client.invalidateQueries({ queryKey: declarationKeys.detail(id) }),
    client.invalidateQueries({ queryKey: declarationKeys.lists() }),
    client.invalidateQueries({ queryKey: candidateKeys.all }),
    client.invalidateQueries({ queryKey: invoiceKeys.all }),
    client.invalidateQueries({ queryKey: dashboardKeys.all }),
  ])
}
