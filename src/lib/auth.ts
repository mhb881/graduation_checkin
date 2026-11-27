import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins/admin";
import { db } from "@/db";
import * as schema from "@/db/schema";

function resolveBaseUrl(): string {
  if (process.env.BETTER_AUTH_URL) {
    return process.env.BETTER_AUTH_URL;
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: resolveBaseUrl(),
  trustedOrigins: (request) => {
    const origins = new Set<string>([
      "http://localhost:3000",
      "https://localhost:3000",
      "http://127.0.0.1:3000",
      "https://127.0.0.1:3000",
    ]);
    for (const host of [
      process.env.VERCEL_PROJECT_PRODUCTION_URL,
      process.env.VERCEL_BRANCH_URL,
      process.env.VERCEL_URL,
    ]) {
      if (host) {
        origins.add(`https://${host}`);
      }
    }
    if (process.env.BETTER_AUTH_URL) {
      origins.add(process.env.BETTER_AUTH_URL);
    }
    if (process.env.NODE_ENV !== "production") {
      const reqOrigin = request?.headers?.get("origin");
      if (reqOrigin) {
        origins.add(reqOrigin);
      }
    }
    return Array.from(origins);
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
  },
  plugins: [
    admin({
      defaultRole: "staff",
      adminRoles: ["admin"],
    }),
    nextCookies(),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
