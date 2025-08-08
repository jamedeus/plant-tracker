import React from 'react';
import { fireEvent } from '@testing-library/react';
import UnsupportedBrowserWarning from 'src/components/UnsupportedBrowserWarning';
import UAParser from 'ua-parser-js';

jest.mock('ua-parser-js');

function mockUserAgent({
    name,
    major,
    version,
    deviceType = undefined,
    osName = 'Windows',
}) {
    UAParser.mockImplementation(() => ({
        browser: { name, major: String(major), version: version ?? String(major) },
        device: { type: deviceType },
        os: { name: osName },
    }));
}

describe('UnsupportedBrowserWarning', () => {
    beforeEach(() => {
        sessionStorage.clear();
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    it('shows warning for outdated Chrome (desktop)', () => {
        mockUserAgent({
            name: 'Chrome',
            major: 110,
            version: '110.0.0.0',
            deviceType: undefined,
            osName: 'Windows'
        });
        const { getByText } = render(<UnsupportedBrowserWarning />);
        expect(getByText('Your browser is not supported')).toBeInTheDocument();
        const link = getByText('Update your browser').closest('a');
        expect(link).toHaveAttribute('href', 'https://www.google.com/chrome/');
    });

    it('shows warning for outdated Firefox (desktop)', () => {
        mockUserAgent({
            name: 'Firefox',
            major: 127,
            version: '127.0',
            deviceType: undefined,
            osName: 'Windows'
        });
        const { getByText } = render(<UnsupportedBrowserWarning />);
        expect(getByText('Your browser is not supported')).toBeInTheDocument();
        const link = getByText('Update your browser').closest('a');
        expect(link).toHaveAttribute('href', 'https://www.mozilla.org/firefox/new/');
    });

    it('shows warning for outdated Safari (desktop)', () => {
        mockUserAgent({
            name: 'Safari',
            major: 16,
            version: '16.3',
            deviceType: undefined,
            osName: 'Mac OS'
        });
        const { getByText } = render(<UnsupportedBrowserWarning />);
        expect(getByText('Your browser is not supported')).toBeInTheDocument();
        const link = getByText('Update your browser').closest('a');
        expect(link).toHaveAttribute('href', 'https://support.apple.com/en-us/108382');
    });

    it('shows warning for outdated Opera', () => {
        mockUserAgent({
            name: 'Opera',
            major: 96,
            version: '96.0.0.0',
            deviceType: undefined,
            osName: 'Windows'
        });
        const { getByText } = render(<UnsupportedBrowserWarning />);
        expect(getByText('Your browser is not supported')).toBeInTheDocument();
        const link = getByText('Update your browser').closest('a');
        expect(link).toHaveAttribute('href', 'https://www.opera.com/download');
    });

    it('shows warning for any Internet Explorer', () => {
        mockUserAgent({
            name: 'IE',
            major: 11,
            version: '11.0',
            deviceType: undefined,
            osName: 'Windows'
        });
        const { getByText } = render(<UnsupportedBrowserWarning />);
        expect(getByText('Your browser is not supported')).toBeInTheDocument();
        const link = getByText('Update your browser').closest('a');
        expect(link).toHaveAttribute('href', 'https://browsehappy.com/');
    });

    it('shows warning for outdated Chrome (iOS)', () => {
        mockUserAgent({
            name: 'Chrome',
            major: 110,
            version: '110.0.0.0',
            deviceType: 'mobile',
            osName: 'iOS'
        });
        const { getByText } = render(<UnsupportedBrowserWarning />);
        expect(getByText('Your browser is not supported')).toBeInTheDocument();
        const link = getByText('Show me how to update').closest('a');
        expect(link).toHaveAttribute('href', 'https://support.apple.com/en-us/102629');
    });

    it('shows warning for outdated Firefox (iOS)', () => {
        mockUserAgent({
            name: 'Firefox',
            major: 127,
            version: '127.0',
            deviceType: 'mobile',
            osName: 'iOS'
        });
        const { getByText } = render(<UnsupportedBrowserWarning />);
        expect(getByText('Your browser is not supported')).toBeInTheDocument();
        const link = getByText('Show me how to update').closest('a');
        expect(link).toHaveAttribute('href', 'https://support.apple.com/en-us/102629');
    });

    it('shows warning for outdated Safari (iOS)', () => {
        mockUserAgent({
            name: 'Safari',
            major: 16,
            version: '16.3',
            deviceType: 'mobile',
            osName: 'iOS'
        });
        const { getByText } = render(<UnsupportedBrowserWarning />);
        expect(getByText('Your browser is not supported')).toBeInTheDocument();
        const link = getByText('Show me how to update').closest('a');
        expect(link).toHaveAttribute('href', 'https://support.apple.com/HT204204');
    });

    it('shows warning for outdated Chrome (Android)', () => {
        mockUserAgent({
            name: 'Chrome',
            major: 110,
            version: '110.0.0.0',
            deviceType: 'mobile',
            osName: 'Android'
        });
        const { getByText } = render(<UnsupportedBrowserWarning />);
        expect(getByText('Your browser is not supported')).toBeInTheDocument();
        const link = getByText('Show me how to update').closest('a');
        expect(link).toHaveAttribute('href', 'https://support.google.com/googleplay/answer/113412');
    });

    it('shows warning for unknown browsers', () => {
        mockUserAgent({
            name: undefined,
            major: 1,
            version: '1.0',
            deviceType: undefined,
            osName: 'Windows'
        });
        const { getByText } = render(<UnsupportedBrowserWarning />);
        expect(getByText('Your browser is not supported')).toBeInTheDocument();
        const link = getByText('Update your browser').closest('a');
        expect(link).toHaveAttribute('href', 'https://browsehappy.com/');
    });

    it('disappears and sets sessionStorage flag when "Continue anyway" is held for 2 seconds', () => {
        jest.useFakeTimers({ doNotFake: ['Date'] });
        mockUserAgent({
            name: 'Chrome',
            major: 110,
            version: '110.0.0.0',
            deviceType: undefined,
            osName: 'Windows'
        });
        const { getByRole, queryByText } = render(<UnsupportedBrowserWarning />);

        const button = getByRole('button', { name: 'Continue anyway' });
        fireEvent.mouseDown(button);

        act(() => {
            jest.advanceTimersByTime(2000);
        });

        expect(sessionStorage.getItem('browser-support-dismissed')).toBe('1');
        expect(queryByText('Your browser is not supported')).toBeNull();
    });

    it('does not appear when user previously dismissed warning even if unsupported', () => {
        // Simulate unsupported browser with sessionStorage flag set (previously dismissed)
        sessionStorage.setItem('browser-support-dismissed', '1');
        mockUserAgent({
            name: 'Chrome',
            major: 110,
            version: '110.0.0.0',
            deviceType: undefined,
            osName: 'Windows'
        });
        const { queryByText } = render(<UnsupportedBrowserWarning />);
        expect(queryByText('Your browser is not supported')).toBeNull();
    });

    it('shows warning when unable to parse user agent', () => {
        UAParser.mockImplementation(() => ({
            browser: {
                name: 'Chrome',
                get major() { throw new Error('boom'); },
                version: '110.0.0.0',
            },
            device: { type: undefined },
            os: { name: 'Windows' },
        }));
        const { getByText } = render(<UnsupportedBrowserWarning />);
        expect(getByText('Your browser is not supported')).toBeInTheDocument();
        const link = getByText('Update your browser').closest('a');
        expect(link).toHaveAttribute('href', 'https://www.google.com/chrome/');
    });
});

