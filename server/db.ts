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

// Extend drizzle object with a raw query execution method
const db = drizzleInstance as typeof drizzleInstance & {
  execute: <T = any>(sql: string, params?: any[]) => Promise<{ rows: T[] }>
};

// Define the execute method
db.execute = async <T = any>(sql: string, params?: any[]): Promise<{ rows: T[] }> => {
  const result = params ? await pool.query(sql, params) : await pool.query(sql);
  // Safe casting - we know the result has a rows property
  return result as unknown as { rows: T[] };
};

export { db };
