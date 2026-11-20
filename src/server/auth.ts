import { betterAuth } from "better-auth";
import type { Pool } from "pg";

export function createAuth(pool: Pool, origin: string, secret: string) {
  return betterAuth({
    database: pool,
    baseURL: origin,
    secret,
    trustedOrigins: [origin],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      disableSessionRefresh: true,
      cookieCache: { enabled: false },
    },
    account: { accountLinking: { enabled: false } },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 5 },
      },
    },
    advanced: {
      useSecureCookies: new URL(origin).protocol === "https:",
      cookiePrefix: "fieldnote",
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", path: "/" },
      crossSubDomainCookies: { enabled: false },
      ipAddress: { ipAddressHeaders: ["x-fieldnote-connection-ip"] },
    },
    logger: { disabled: true },
  });
}
