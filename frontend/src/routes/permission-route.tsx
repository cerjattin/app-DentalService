import { Navigate, Outlet } from 'react-router'
import { hasAnyPermission } from '../auth/permissions'
import { useAuth } from '../auth/use-auth'

export function PermissionRoute({ anyOf }: { anyOf: string[] }) {
  const { permissions } = useAuth()

  if (anyOf.length > 0 && !hasAnyPermission(permissions, anyOf)) {
    return <Navigate to="/access-denied" replace />
  }

  return <Outlet />
}
