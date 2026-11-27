import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins/admin";
import { db } from "@/db";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  trustedOrigins: (request) => {
    const origins = new Set<string>([
      "http://localhost:3000",
      "https://localhost:3000",
      "http://127.0.0.1:3000",
      "https://127.0.0.1:3000",
    ]);
    if (process.env.BETTER_AUTH_URL) {
      origins.add(process.env.BETTER_AUTH_URL);
    }
    const reqOrigin = request?.headers?.get("origin");
    if (reqOrigin) {
      origins.add(reqOrigin);
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
