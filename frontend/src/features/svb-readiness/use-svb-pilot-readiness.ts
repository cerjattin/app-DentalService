import { useQuery } from '@tanstack/react-query'
import { hasPermission } from '../../auth/permissions'
import { useAuth } from '../../auth/use-auth'
import { getSvbPilotReadiness, svbReadinessKeys } from './svb-readiness-api'

export function useSvbPilotReadiness() {
  const { permissions } = useAuth()
  const canRead = hasPermission(permissions, 'svb_procedure.read')
  const query = useQuery({ queryKey: svbReadinessKeys.all, queryFn: ({ signal }) => getSvbPilotReadiness(signal), enabled: canRead, retry: false, staleTime: 0, refetchOnWindowFocus: 'always' })
  // Cached permission to record is insufficient while refreshing or after an error.
  return { ...query, canRead, canRecord: canRead && query.isSuccess && !query.isFetching && query.data.manualPortalRecordingEnabled === true }
}

export const svbDeferredMessage = 'SVB submission pending — file specification not confirmed.'
