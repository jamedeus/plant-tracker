import mockCurrentURL from 'src/testUtils/mockCurrentURL';
import { sanitizeNext } from '../App';

// Test the function which sanitizes the ?next= querystring param
describe('sanitizeNext', () => {
    beforeEach(() => {
        // Mock window.location to expected URL (parsed after logging in)
        mockCurrentURL('https://plants.lan/accounts/login/');
    });

    it('accepts relative paths', async () => {
        expect(sanitizeNext('/accounts/profile/')).toBe('/accounts/profile/');
    });

    it('rejects non-relative paths', async () => {
        // Should return fallback (overview)
        expect(sanitizeNext('accounts/profile/')).toBe('/');
    });

    it('rejects excessively long paths', async () => {
        // Should return fallback (overview)
        expect(sanitizeNext('z'.repeat(2049))).toBe('/');
    });

    it('rejects empty paths', async () => {
        // Should return fallback (overview)
        expect(sanitizeNext('')).toBe('/');
    });

    it('rejects paths with invalid characters', async () => {
        // Should return fallback (overview)
        expect(sanitizeNext('/465%99')).toBe('/');
    });

    it('rejects external origins', async () => {
        // Should return fallback (overview)
        expect(window.location.origin).toBe('https://plants.lan');
        expect(sanitizeNext('https://evil.com/accounts/profile/')).toBe('/');
    });
});
