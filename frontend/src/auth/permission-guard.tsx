import type { ReactNode } from 'react'
import { hasAllPermissions, hasAnyPermission } from './permissions'
import { useAuth } from './use-auth'

interface PermissionGuardProps {
  anyOf?: string[]
  allOf?: string[]
  fallback?: ReactNode
  children: ReactNode
}

export function PermissionGuard({
  anyOf = [],
  allOf = [],
  fallback = null,
  children,
}: PermissionGuardProps) {
  const { permissions } = useAuth()
  const allowedByAny = anyOf.length === 0 || hasAnyPermission(permissions, anyOf)
  const allowedByAll = allOf.length === 0 || hasAllPermissions(permissions, allOf)

  if (!allowedByAny || !allowedByAll) {
    return fallback
  }

  return children
}
