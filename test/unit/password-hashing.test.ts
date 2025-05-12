import { describe, it, expect, vi } from 'vitest';
import bcrypt from 'bcrypt';

describe('Password Hashing Security', () => {
  // Create functions for password hashing and comparison that match the auth implementation
  async function hashPassword(password: string): Promise<string> {
    const saltRounds = 12; // High number of rounds for security
    return bcrypt.hash(password, saltRounds);
  }
  
  async function comparePasswords(plaintext: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plaintext, hashed);
  }
  
  it('should hash passwords with bcrypt', async () => {
    // Create a test password
    const password = 'secure-test-password';
    
    // Generate hash
    const hash = await hashPassword(password);
    
    // Verify hash format (bcrypt hashes start with $2b$ or $2a$)
    expect(hash).toMatch(/^\$2[ab]\$\d+\$/);
    
    // Verify hash is not the plain password
    expect(hash).not.toBe(password);
  });
  
  it('should use sufficient salt rounds for security', async () => {
    // Spy on bcrypt.hash to capture salt rounds
    const hashSpy = vi.spyOn(bcrypt, 'hash');
    
    // Hash a password
    await hashPassword('test-password');
    
    // Verify salt rounds (second argument to bcrypt.hash)
    expect(hashSpy).toHaveBeenCalledWith('test-password', 12);
    
    // Restore original implementation
    hashSpy.mockRestore();
  });
  
  it('should verify correct passwords', async () => {
    // Create a test password and hash
    const password = 'correct-password';
    const hash = await hashPassword(password);
    
    // Verify correct password comparison
    const result = await comparePasswords(password, hash);
    expect(result).toBe(true);
  });
  
  it('should reject incorrect passwords', async () => {
    // Create a test password and hash
    const password = 'correct-password';
    const hash = await hashPassword(password);
    
    // Try incorrect password
    const result = await comparePasswords('wrong-password', hash);
    expect(result).toBe(false);
  });
  
  it('should create different hashes for the same password', async () => {
    // Create a test password
    const password = 'same-password';
    
    // Generate two hashes for the same password
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);
    
    // Verify the hashes are different (due to different salts)
    expect(hash1).not.toBe(hash2);
    
    // But both should still verify against the original password
    expect(await comparePasswords(password, hash1)).toBe(true);
    expect(await comparePasswords(password, hash2)).toBe(true);
  });
  
  it('should be slow enough to prevent brute force attacks', async () => {
    // Create a test password
    const password = 'test-for-timing';
    
    // Hash the password and measure time
    const startTime = Date.now();
    await hashPassword(password);
    const duration = Date.now() - startTime;
    
    // bcrypt with 12 rounds should take at least some time to compute
    // typically at least 80-100ms on modern hardware
    expect(duration).toBeGreaterThan(50);
  });
});