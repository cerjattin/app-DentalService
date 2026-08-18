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
