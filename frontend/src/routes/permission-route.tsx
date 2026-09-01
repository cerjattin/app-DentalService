import { Navigate, Outlet } from 'react-router'
import { hasAllPermissions, hasAnyPermission } from '../auth/permissions'
import { useAuth } from '../auth/use-auth'

export function PermissionRoute({ anyOf = [], allOf = [] }: { anyOf?: string[]; allOf?: string[] }) {
  const { permissions } = useAuth()

  if (
    (anyOf.length > 0 && !hasAnyPermission(permissions, anyOf)) ||
    (allOf.length > 0 && !hasAllPermissions(permissions, allOf))
  ) {
    return <Navigate to="/access-denied" replace />
  }

  return <Outlet />
}
