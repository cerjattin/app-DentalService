import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { hasPermission } from '../../auth/permissions'
import { useAuth } from '../../auth/use-auth'
import { encounterKeys, getEncounter, listProcedures } from '../clinical/clinical-api'
import { listTariffs, svbServiceKeys } from '../svb-catalog/svb-catalog-api'

export function useInvoiceTariffReview(
  appointmentId: string,
  serviceDate: string,
  currencyCode: string,
  open: boolean,
) {
  const { permissions } = useAuth()
  const client = useQueryClient()
  const canReview = ['encounter.read', 'procedure.read', 'svb_tariff.read'].every(
    permission => hasPermission(permissions, permission),
  )
  const enabled = open && canReview && (!currencyCode || /^[A-Z]{3}$/.test(currencyCode))
  const encounter = useQuery({
    queryKey: encounterKeys.appointment(appointmentId),
    queryFn: ({ signal }) => getEncounter(appointmentId, signal),
    enabled,
    retry: false,
  })
  const encounterId = encounter.data?.id ?? ''
  const procedures = useQuery({
    queryKey: encounterKeys.procedures(encounterId),
    queryFn: ({ signal }) => listProcedures(encounterId, signal),
    enabled: enabled && Boolean(encounterId),
    retry: false,
  })
  const services = [...new Map(
    (procedures.data ?? [])
      .filter(row => row.status === 'PERFORMED' && row.svbTariffId === null)
      .map(row => [row.svbProcedureId, row] as const),
  ).values()]
  const filters = {
    serviceDate,
    isActive: true,
    page: 1,
    pageSize: 100,
    ...(currencyCode ? { currencyCode } : {}),
  }
  // The catalogue API applies validity and status filters. Invoice creation
  // remains authoritative for the common currency, pricing and snapshots.
  const tariffs = useQueries({
    queries: services.map(service => ({
      queryKey: svbServiceKeys.tariffs(service.svbProcedureId, filters),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        listTariffs(service.svbProcedureId, filters, signal),
      enabled: enabled && Boolean(encounterId),
      retry: false,
      refetchOnWindowFocus: 'always' as const,
    })),
  })
  const rows = services.map((service, index) => ({
    id: service.svbProcedureId,
    code: service.procedureCodeSnapshot,
    description: service.procedureDescriptionSnapshot,
    query: tariffs[index]!,
  }))
  const busy = enabled && (
    encounter.isFetching || (Boolean(encounterId) && procedures.isFetching) ||
    tariffs.some(query => query.isFetching)
  )
  const blocked = enabled && rows.some(row =>
    row.query.isSuccess && row.query.data.data.length === 0,
  )
  const error = encounter.error ?? procedures.error ?? tariffs.find(query => query.isError)?.error
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: encounterKeys.appointment(appointmentId) }),
      ...(encounterId ? [client.invalidateQueries({ queryKey: encounterKeys.procedures(encounterId) })] : []),
      ...services.map(service => client.invalidateQueries({
        queryKey: svbServiceKeys.tariffLists(service.svbProcedureId),
      })),
    ])
  }
  return { enabled, canReview, rows, busy, blocked, error, refresh }
}
