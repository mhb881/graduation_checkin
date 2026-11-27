import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  __pgPool?: Pool;
  __pgConnectionString?: string;
};

function getConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  return url;
}

export function getPool(): Pool {
  const connectionString = getConnectionString();
  if (!globalForDb.__pgPool || globalForDb.__pgConnectionString !== connectionString) {
    if (globalForDb.__pgPool) {
      void globalForDb.__pgPool.end();
    }
    globalForDb.__pgPool = new Pool({
      connectionString,
      max: 20,
    });
    globalForDb.__pgConnectionString = connectionString;
  }
  return globalForDb.__pgPool;
}

export const db = drizzle(getPool(), { schema });
export type Database = typeof db;
