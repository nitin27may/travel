import { describe, expect, it } from 'vitest';
import { DEFAULT_RETURN, returnPath, returnPathFromSearch } from '@/lib/auth/return-path';

describe('returnPath (Google spec 7.4)', () => {
  it.each([
    '/',
    '/trips/',
    '/trips/dolomites-2027/',
    '/places/lake-louise/',
    '/places/?kind=trail&season=jul',
    '/globe/ca/',
    '/favourites/',
    '/mine/',
    '/mine/?show=favourites',
    '/suggest/',
    '/t/abc123/',
    '/account/',
    '/account/?tab=drafts#top',
  ])('keeps %s', (path) => {
    expect(returnPath(path)).toBe(path);
  });

  it('keeps an encoded path once decoded', () => {
    expect(returnPath('%2Ftrips%2Fdolomites%2F')).toBe('/trips/dolomites/');
  });

  it.each([
    ['//evil.example', 'protocol-relative'],
    ['//evil.example/trips/', 'protocol-relative with path'],
    ['/\\evil.example', 'slash backslash'],
    ['\\\\evil.example', 'double backslash'],
    ['/trips\\..\\api', 'backslash inside'],
    ['/%2F%2Fevil.example', 'encoded double slash'],
    ['/%2f%2fevil.example', 'encoded double slash, lower case'],
    ['%2F%2Fevil.example', 'fully encoded protocol-relative'],
    ['/%252F%252Fevil.example', 'double encoded'],
    ['/trips/%255Capi', 'double encoded backslash'],
    ['https://evil.example', 'absolute https'],
    ['http://evil.example/trips/', 'absolute http'],
    ['HTTPS://evil.example', 'absolute, upper case'],
    ['javascript:alert(1)', 'javascript scheme'],
    ['JaVaScRiPt:alert(1)', 'javascript scheme, mixed case'],
    ['data:text/html,<script>alert(1)</script>', 'data scheme'],
    ['mailto:x@example.com', 'mailto'],
    ['/api/auth/sign-out', 'auth API'],
    ['/api/v1/places/', 'public API'],
    ['/trips/../api/x', 'dot segments into the API'],
    ['/trips/%2e%2e/api/x', 'encoded dot segments into the API'],
    ['/sign-in/', 'sign-in page itself'],
    ['/sign-up/', 'sign-up page'],
    ['/admin/', 'not an allowed prefix'],
    ['/tripsX/', 'prefix look-alike'],
    ['/account', 'account without its slash (only exact prefixes)'],
    ['/trips/\u0000', 'NUL'],
    ['/trips/\n', 'new line'],
    ['/trips/\r\nSet-Cookie:x', 'header injection'],
    ['/trips/\t', 'tab'],
    ['/trips/\u007f', 'DEL'],
    ['/' + 'a'.repeat(512), '513 characters'],
    ['', 'empty'],
    ['trips/', 'no leading slash'],
    ['.', 'dot'],
    ['%', 'broken encoding'],
    ['%E0%A4%A', 'broken UTF-8 encoding'],
    ['@evil.example', 'at sign'],
    ['/\t/evil.example', 'tab between slashes'],
  ])('refuses %s (%s)', (value) => {
    expect(returnPath(value)).toBe(DEFAULT_RETURN);
  });

  it.each([undefined, null, 42, {}, ['/trips/']])('refuses a non-string %j', (value) => {
    expect(returnPath(value)).toBe(DEFAULT_RETURN);
  });

  it('accepts exactly 512 characters', () => {
    const p = '/trips/' + 'a'.repeat(505);
    expect(p).toHaveLength(512);
    expect(returnPath(p)).toBe(p);
  });

  it('reads next from a search string and never echoes a refused value', () => {
    expect(returnPathFromSearch('?next=%2Fplaces%2Fx%2F')).toBe('/places/x/');
    expect(returnPathFromSearch('?next=https%3A%2F%2Fevil.example')).toBe(DEFAULT_RETURN);
    expect(returnPathFromSearch('')).toBe(DEFAULT_RETURN);
    expect(returnPathFromSearch('?other=1')).toBe(DEFAULT_RETURN);
  });
});
