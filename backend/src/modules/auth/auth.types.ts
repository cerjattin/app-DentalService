export interface LoginInput {
  email: string;
  password: string;
}

export interface RequestSecurityMetadata {
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthenticatedRequestContext {
  userId: bigint;
  organizationId: bigint;

  email: string;
  firstName: string;
  lastName: string;

  roles: string[];
  permissions: string[];
}

export interface PublicAuthenticatedUser {
  id: string;
  organizationId: string;

  email: string;
  firstName: string;
  lastName: string;

  roles: string[];
  permissions: string[];
}

export interface LoginResult {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: string;

  user: PublicAuthenticatedUser;
}
export function buildAuthContext(user: {
  id: bigint;
  organizationId: bigint;

  email: string;
  firstName: string;
  lastName: string;

  userRoles: Array<{
    role: {
      code: string;
      isActive: boolean;

      rolePermissions: Array<{
        permission: {
          code: string;
        };
      }>;
    };
  }>;
}): AuthenticatedRequestContext {
  const activeRoles = user.userRoles
    .filter(({ role }) => role.isActive)
    .map(({ role }) => role);

  const roles = [...new Set(activeRoles.map((role) => role.code))];

  const permissions = [
    ...new Set(
      activeRoles.flatMap((role) =>
        role.rolePermissions.map(({ permission }) => permission.code),
      ),
    ),
  ];

  return {
    userId: user.id,
    organizationId: user.organizationId,

    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,

    roles,
    permissions,
  };
}

export function toPublicAuthUser(
  context: AuthenticatedRequestContext,
): PublicAuthenticatedUser {
  return {
    id: context.userId.toString(),

    organizationId: context.organizationId.toString(),

    email: context.email,

    firstName: context.firstName,

    lastName: context.lastName,

    roles: context.roles,

    permissions: context.permissions,
  };
}
