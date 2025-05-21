import { db } from '../db';

export async function addMfaColumns() {
  console.log('[Migration] Checking for MFA columns in users table...');
  const columnsQuery = `
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'users' AND column_name IN ('mfa_enabled','mfa_secret');
  `;
  const result = await db.execute(columnsQuery);
  const existing = result.rows.map((r: {column_name: string}) => r.column_name);

  if (!existing.includes('mfa_enabled')) {
    await db.execute("ALTER TABLE users ADD COLUMN mfa_enabled BOOLEAN NOT NULL DEFAULT false;");
    console.log('[Migration] Added mfa_enabled column');
  }
  if (!existing.includes('mfa_secret')) {
    await db.execute("ALTER TABLE users ADD COLUMN mfa_secret TEXT;");
    console.log('[Migration] Added mfa_secret column');
  }
}

