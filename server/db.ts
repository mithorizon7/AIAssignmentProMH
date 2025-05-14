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

// Create a DrizzleDb type that includes properly typed execute method
export type DrizzleDb = ReturnType<typeof drizzle> & {
  execute: (sql: string, params?: any[]) => Promise<{ rows: any[] }>
};

// Extend the drizzle instance with the execute method
const drizzleInstance = drizzle({ client: pool, schema });
const extendedDrizzle = drizzleInstance as DrizzleDb;

// Define the execute method to ensure proper type checking
extendedDrizzle.execute = async (sql: string, params?: any[]) => {
  if (params) {
    return await pool.query(sql, params);
  } else {
    return await pool.query(sql);
  }
};

export const db = extendedDrizzle;
