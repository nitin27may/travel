// Hotfix A1, review SF8: the client IP for quota keys comes from Vercel's own headers only.
import { describe, expect, it } from 'vitest';
import { clientIp } from '@/lib/server/client-ip';

const at = (headers: Record<string, string>) => clientIp(new Request('https://travel.test/', { headers }));

describe('clientIp', () => {
  it('prefers x-vercel-forwarded-for over x-real-ip', () => {
    expect(at({ 'x-vercel-forwarded-for': '198.51.100.9', 'x-real-ip': '203.0.113.7' })).toBe('198.51.100.9');
  });
  it('takes the right-most entry of a list (the hop Vercel saw)', () => {
    expect(at({ 'x-vercel-forwarded-for': '192.0.2.1, 198.51.100.10' })).toBe('198.51.100.10');
  });
  it('falls back to x-real-ip when the Vercel header is missing or not an IP', () => {
    expect(at({ 'x-real-ip': '203.0.113.7' })).toBe('203.0.113.7');
    expect(at({ 'x-vercel-forwarded-for': 'nope', 'x-real-ip': '2001:DB8::1' })).toBe('2001:db8::1');
  });
  it('never trusts x-forwarded-for or cf-connecting-ip', () => {
    expect(at({ 'x-forwarded-for': '198.51.100.1', 'cf-connecting-ip': '198.51.100.2' })).toBe('unknown');
  });
  it('is unknown without a usable header', () => {
    expect(at({})).toBe('unknown');
    expect(at({ 'x-real-ip': 'not-an-ip' })).toBe('unknown');
  });
});
