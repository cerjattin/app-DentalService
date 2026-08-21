import { jwtVerify, SignJWT } from "jose";

import { env } from "../../config/env.js";

import { AppError } from "../../shared/errors/app-error.js";

interface VerifiedAccessToken {
  userId: bigint;
  organizationId: bigint;
}

const secret = new TextEncoder().encode(env.ACCESS_TOKEN_SECRET);

if (secret.byteLength < 32) {
  throw new Error("ACCESS_TOKEN_SECRET must be at least 32 bytes");
}

export class AccessTokenService {
  async sign(userId: bigint, organizationId: bigint): Promise<string> {
    return new SignJWT({
      org: organizationId.toString(),

      typ: "access",
    })
      .setProtectedHeader({
        alg: "HS256",
        typ: "JWT",
      })
      .setSubject(userId.toString())
      .setIssuer(env.JWT_ISSUER)
      .setAudience(env.JWT_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(env.ACCESS_TOKEN_TTL)
      .sign(secret);
  }

  async verify(token: string): Promise<VerifiedAccessToken> {
    try {
      const { payload } = await jwtVerify(token, secret, {
        issuer: env.JWT_ISSUER,

        audience: env.JWT_AUDIENCE,

        algorithms: ["HS256"],
      });

      if (payload.typ !== "access") {
        throw new Error("Invalid token type");
      }

      if (typeof payload.sub !== "string" || !/^\d+$/.test(payload.sub)) {
        throw new Error("Invalid subject");
      }

      if (typeof payload.org !== "string" || !/^\d+$/.test(payload.org)) {
        throw new Error("Invalid organization");
      }

      return {
        userId: BigInt(payload.sub),

        organizationId: BigInt(payload.org),
      };
    } catch {
      throw new AppError(
        401,
        "INVALID_ACCESS_TOKEN",
        "Access token is invalid or expired",
      );
    }
  }
}

export const accessTokenService = new AccessTokenService();
