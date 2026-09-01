import type { Permission } from '../types/auth'

export function hasPermission(
  permissions: Iterable<Permission>,
  permission: Permission,
) {
  return new Set(permissions).has(permission)
}

export function hasAnyPermission(
  permissions: Iterable<Permission>,
  requiredPermissions: Permission[],
) {
  const permissionSet = new Set(permissions)
  return requiredPermissions.some((permission) => permissionSet.has(permission))
}

export function hasAllPermissions(
  permissions: Iterable<Permission>,
  requiredPermissions: Permission[],
) {
  const permissionSet = new Set(permissions)
  return requiredPermissions.every((permission) => permissionSet.has(permission))
}
