import { pool } from '../db';
import bcrypt from 'bcrypt';

/**
 * Script to reset test accounts with proper bcrypt hashed passwords
 * This ensures that test accounts are always available for testing
 */
async function resetTestAccounts() {
  console.log('Resetting test accounts...');

  const testAccounts = [
    {
      id: 9999,
      username: 'admin@test.com',
      email: 'admin@test.com',
      password: 'admin123',
      name: 'Test Admin',
      role: 'admin'
    },
    {
      id: 9998,
      username: 'instructor@test.com',
      email: 'instructor@test.com',
      password: 'instructor123',
      name: 'Test Instructor',
      role: 'instructor'
    },
    {
      id: 9997,
      username: 'student@test.com',
      email: 'student@test.com',
      password: 'student123',
      name: 'Test Student',
      role: 'student'
    }
  ];

  try {
    for (const account of testAccounts) {
      // Hash the password using bcrypt
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(account.password, saltRounds);
      
      // Try to update existing account
      const updateResult = await pool.query(
        `UPDATE users 
         SET password = $1, name = $2
         WHERE id = $3 OR username = $4
         RETURNING id`,
        [hashedPassword, account.name, account.id, account.username]
      );
      
      if (updateResult.rowCount === 0) {
        // Account doesn't exist, create it
        await pool.query(
          `INSERT INTO users (id, username, email, password, name, role, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [account.id, account.username, account.email, hashedPassword, account.name, account.role]
        );
        console.log(`Created account: ${account.username} (${account.role})`);
      } else {
        console.log(`Updated account: ${account.username} (${account.role})`);
      }
    }
    
    console.log('Test accounts reset successfully');
  } catch (error) {
    console.error('Error resetting test accounts:', error);
  } finally {
    // Close the connection
    await pool.end();
  }
}

// Run the script
resetTestAccounts();