import { describe, expect, it } from 'vitest';
import { databaseName, NeonNotConfiguredError } from '@/lib/server/neon-env';

describe('databaseName', () => {
  it('parses the database name from a pooled connection string', () => {
    expect(databaseName('postgresql://user:pw@ep-x.pooler.aws.neon.tech/neondb?sslmode=require')).toBe('neondb');
    expect(databaseName('postgresql://user:pw@host/my_app_db')).toBe('my_app_db');
  });

  it('fails explicitly on a malformed URL instead of guessing a fallback', () => {
    expect(() => databaseName('not a url')).toThrow(NeonNotConfiguredError);
  });

  it('fails explicitly when the URL carries no database name', () => {
    expect(() => databaseName('postgresql://user:pw@host/')).toThrow(NeonNotConfiguredError);
  });

  it('never echoes the connection string in the error (no credentials leak)', () => {
    const secret = 'postgresql://user:SUPERSECRET@host';
    try {
      databaseName(secret);
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as Error).message).not.toContain('SUPERSECRET');
    }
  });
});
