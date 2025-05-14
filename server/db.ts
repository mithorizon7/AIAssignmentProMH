import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Create drizzle instance
const drizzleInstance = drizzle({ client: pool, schema });

// Create extension for raw SQL queries
const executeRawQuery = async <T = any>(sql: string, params?: any[]): Promise<{ rows: T[] }> => {
  if (params) {
    return await pool.query(sql, params);
  } else {
    return await pool.query(sql);
  }
};

// Extend type
export type DrizzleDb = typeof drizzleInstance & {
  execute: typeof executeRawQuery;
};

// Create extended instance
const extendedDrizzle = drizzleInstance as DrizzleDb;
extendedDrizzle.execute = executeRawQuery;

export const db = extendedDrizzle;
