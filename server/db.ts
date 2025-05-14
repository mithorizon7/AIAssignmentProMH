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

// Define the types for the execute method parameters and result
type QueryParams = unknown[];
type QueryResult<T> = { rows: T[] };

// Extend drizzle object with a raw query execution method
// Using any here is unavoidable due to the complex Drizzle type structure
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = drizzleInstance as any;

// Define the execute method with more flexible parameter handling
db.execute = async function<T extends Record<string, unknown>>(
  sqlOrConfig: string | { text: string; values?: any[] },
  params?: QueryParams
): Promise<QueryResult<T>> {
  let result;
  
  if (typeof sqlOrConfig === 'string') {
    // Called with (sql, params)
    result = params ? await pool.query(sqlOrConfig, params) : await pool.query(sqlOrConfig);
  } else {
    // Called with ({ text, values }) config object
    result = await pool.query(sqlOrConfig);
  }
  
  // Safe casting - we know the result has a rows property
  return result as unknown as QueryResult<T>;
};

export { db };
