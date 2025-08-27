import AppRoot from 'src/AppRoot';
import { routes } from 'src/routes';
import { createMemoryRouter } from 'react-router-dom';
import { render, waitFor } from '@testing-library/react';
import FakeBarcodeDetector from 'src/testUtils/mockBarcodeDetector';
import mockCurrentURL from 'src/testUtils/mockCurrentURL';
import applyQrScannerMocks from 'src/testUtils/applyQrScannerMocks';
import 'jest-canvas-mock';
import { mockContext as mockOverviewContext } from 'src/pages/overview/__tests__/mockContext';
import { mockContext as mockRegisterContext } from 'src/pages/register/__tests__/mockContext';
import { mockContext as mockPlantContext } from 'src/pages/manage_plant/__tests__/mockContext';
import { mockContext as mockGroupContext } from 'src/pages/manage_group/__tests__/mockContext';

// Takes JSON response and status code, mocks global fetch function
const mockFetchJSONResponse = (json, status=200) => {
    global.fetch = jest.fn(() => Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve(json),
    }));
};

describe('SPA integration tests', () => {
    beforeAll(() => {
        // Mock all browser APIs used by QrScanner
        applyQrScannerMocks();
    });

    beforeEach(() => {
        // Allow fast forwarding (skip debounce)
        jest.useFakeTimers({ doNotFake: ['Date'] });
    });

    // Clean up pending timers after each test
    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it('replaces current page when user scans a QR code', async () => {
        // Mock fetch function to return overview page state
        mockFetchJSONResponse(mockOverviewContext);

        // Render SPA on overview page
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        const router = createMemoryRouter(routes, { initialEntries: ['/'] });
        const { getByTitle, getByTestId, queryByTestId } = render(
            <AppRoot router={router} />
        );

        // Confirm rendered overview page, did not render manage_plant or scanner
        await waitFor(() => {
            expect(document.title).toBe('Plant Overview');
            expect(getByTestId('overview-layout')).toBeInTheDocument();
            expect(queryByTestId('manage-plant-layout')).toBeNull();
            expect(queryByTestId('qr-scanner-overlay')).toBeNull();
        });
        // Confirm fetched overview state
        expect(global.fetch).toHaveBeenCalledWith(
            '/get_overview_state',
            {headers: {Accept: "application/json"}}
        );

        // Mock barcode-detector to simulate detecting a QR code with a domain
        // that matches the current URL
        mockCurrentURL('https://plants.lan/');
        jest.spyOn(FakeBarcodeDetector.prototype, 'detect').mockResolvedValue([{
            rawValue: 'https://plants.lan/manage/5c256d96-ec7d-408a-83c7-3f86d63968b2',
            boundingBox: { x: 0, y: 0, width: 200, height: 100 },
            cornerPoints: [
                { x: 0,   y: 0   },
                { x: 200, y: 0   },
                { x: 200, y: 100 },
                { x: 0,   y: 100 }
            ],
            format: 'qr_code',
        }]);

        // Click button to open scanner, confirm scanner appeared
        await user.click(getByTitle('Open QR scanner'));
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(getByTestId('qr-scanner-overlay')).toBeInTheDocument();

        // Fast forward to detect QR code, confirm link to scanned URL appears
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        await waitFor(() =>
            expect(FakeBarcodeDetector.prototype.detect).toHaveBeenCalled()
        );
        expect(getByTestId('scanned-url')).toBeInTheDocument();
        expect(getByTestId('scanned-url')).toHaveAttribute(
            'href',
            'https://plants.lan/manage/5c256d96-ec7d-408a-83c7-3f86d63968b2'
        );

        // Mock fetch function to return manage_plant page state
        mockFetchJSONResponse({
            page: 'manage_plant',
            title: 'Manage Plant',
            state: mockPlantContext
        });

        // Click link to scanned URL
        await user.click(getByTestId('scanned-url'));
        await act(async () => {
            await jest.advanceTimersByTimeAsync(100);
        });

        // Confirm closed scanner, unrendered overview, and rendered manage_plant
        expect(queryByTestId('qr-scanner-overlay')).toBeNull();
        expect(queryByTestId('overview-layout')).toBeNull();
        expect(getByTestId('manage-plant-layout')).toBeInTheDocument();
        expect(document.title).toBe('Manage Plant');
        // Confirm fetched manage_plant state
        expect(global.fetch).toHaveBeenCalledWith(
            '/get_manage_state/5c256d96-ec7d-408a-83c7-3f86d63968b2',
            {headers: {Accept: "application/json"}}
        );
    });

    it('fetches new state for current route when user navigates to SPA with back button', async () => {
        // Mock fetch function to return overview page state
        mockFetchJSONResponse(mockOverviewContext);

        // Render SPA on overview page, confirm rendered + fetched overview state
        const router = createMemoryRouter(routes, { initialEntries: ['/'] });
        const { getByTestId } = render(
            <AppRoot router={router} />
        );

        // Confirm rendered overview page, fetched overview state
        await waitFor(() => {
            expect(document.title).toBe('Plant Overview');
            expect(getByTestId('overview-layout')).toBeInTheDocument();
        });
        expect(global.fetch).toHaveBeenCalledWith(
            '/get_overview_state',
            {headers: {Accept: "application/json"}}
        );
        jest.clearAllMocks();

        // Simulate user navigating to external site then returning to SPA by
        // pressing browser back button
        const pageshowEvent = new Event('pageshow');
        Object.defineProperty(pageshowEvent, 'persisted', { value: true });
        await act(() => window.dispatchEvent(pageshowEvent));

        // Confirm fetched new state (may be outdated)
        expect(global.fetch).toHaveBeenCalledWith(
            '/get_overview_state',
            {headers: {Accept: "application/json"}}
        );
    });

    it('switches pages if different state received after user navigates to SPA with back button', async () => {
        // Mock fetch function to return manage_group page state
        mockFetchJSONResponse({
            page: 'manage_group',
            title: 'Manage Group',
            state: mockGroupContext
        });

        // Render SPA on manage_group page
        const router = createMemoryRouter(routes, { initialEntries: [
            '/manage/102d1a8c-07e6-4ece-bac7-60ed6a95f462'
        ] });
        const { getByTestId, queryByTestId } = render(
            <AppRoot router={router} />
        );

        // Confirm rendered manage_group page, fetched manage_group state
        await waitFor(() => {
            expect(document.title).toBe('Manage Group');
            expect(getByTestId('manage-group-layout')).toBeInTheDocument();
        });
        // Confirm fetched manage_group state
        expect(global.fetch).toHaveBeenCalledWith(
            '/get_manage_state/102d1a8c-07e6-4ece-bac7-60ed6a95f462',
            {headers: {Accept: "application/json"}}
        );
        jest.clearAllMocks();

        // Mock fetch function to return register page state on first request,
        // and /get_plant_species_options response on second
        //
        // Simulates group being deleted while user was on external site
        global.fetch = jest.fn().mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                page: 'register',
                title: 'Register New Plant',
                state: mockRegisterContext
            }),
            headers: new Map([['content-type', 'application/json']]),
        }).mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                options: [
                    "Parlor Palm",
                    "Spider Plant",
                    "Calathea"
                ]
            }),
            headers: new Map([['content-type', 'application/json']]),
        });

        // Simulate user navigating to external site then returning to SPA by
        // pressing browser back button
        const pageshowEvent = new Event('pageshow');
        Object.defineProperty(pageshowEvent, 'persisted', { value: true });
        await act(() => window.dispatchEvent(pageshowEvent));

        // Confirm unrendered manage_group page, rendered register page
        await waitFor(() => {
            expect(queryByTestId('manage-group-layout')).toBeNull();
            expect(getByTestId('register-layout')).toBeInTheDocument();
            expect(document.title).toBe('Register New Plant');
        });

        // Confirm fetched new state, then fetched plant species options
        expect(global.fetch).toHaveBeenCalledTimes(2);
        expect(global.fetch).toHaveBeenNthCalledWith(
            1,
            '/get_manage_state/102d1a8c-07e6-4ece-bac7-60ed6a95f462',
            {headers: {Accept: "application/json"}}
        );
        expect(global.fetch).toHaveBeenNthCalledWith(
            2,
            '/get_plant_species_options'
        );
    });
});
