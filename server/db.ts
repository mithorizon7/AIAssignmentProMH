import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Use NEON_DATABASE_URL if available, otherwise fall back to DATABASE_URL
const databaseUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "NEON_DATABASE_URL or DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ 
  connectionString: databaseUrl,
  max: 10,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 60000
});

// Create drizzle instance
const drizzleInstance = drizzle({ client: pool, schema });

// Define the types for the execute method parameters and result
type QueryParams = unknown[];
type QueryResult<T> = { rows: T[] };

// Extend drizzle object with a raw query execution method
// Using any here is unavoidable due to the complex Drizzle type structure
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = drizzleInstance as any;

// Define the execute method with proper handling for Drizzle SQL queries
db.execute = async function<T extends Record<string, unknown>>(
  query: any
): Promise<QueryResult<T>> {
  let result;
  
  // Handle Drizzle SQL template objects
  if (query && typeof query === 'object') {
    // Check for different possible SQL template formats
    if ('queryChunks' in query && 'values' in query) {
      // Drizzle SQL template format
      const sqlString = query.queryChunks.join('$' + (query.values.length + 1));
      result = await pool.query(sqlString, query.values);
    } else if ('sql' in query) {
      // Alternative format
      const sqlString = query.sql;
      const values = query.params || query.values || [];
      result = await pool.query(sqlString, values);
    } else {
      // Try to convert to string if it has a toString method
      const sqlString = query.toString();
      result = await pool.query(sqlString);
    }
  } else if (typeof query === 'string') {
    // Plain SQL string
    result = await pool.query(query);
  } else {
    throw new Error('Invalid query format: ' + typeof query);
  }
  
  // Safe casting - we know the result has a rows property
  return result as unknown as QueryResult<T>;
};

export { db };
