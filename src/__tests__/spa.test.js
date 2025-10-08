import AppRoot from 'src/AppRoot';
import { routes } from 'src/routes';
import { createMemoryRouter } from 'react-router-dom';
import { render, waitFor, cleanup } from '@testing-library/react';
import FakeBarcodeDetector, { mockQrCodeInViewport } from 'src/testUtils/mockBarcodeDetector';
import { postHeaders } from 'src/testUtils/headers';
import mockCurrentURL from 'src/testUtils/mockCurrentURL';
import mockFetchResponse from 'src/testUtils/mockFetchResponse';
import mockManagePlantFetch from 'src/testUtils/mockManagePlantFetch';
import applyQrScannerMocks from 'src/testUtils/applyQrScannerMocks';
import 'jest-canvas-mock';
import { mockContext as mockOverviewContext } from 'src/pages/overview/__tests__/mockContext';
import { mockContext as mockRegisterContext } from 'src/pages/register/__tests__/mockContext';
import { mockContext as mockPlantContext } from 'src/pages/manage_plant/__tests__/mockContext';
import { mockContext as mockGroupContext } from 'src/pages/manage_group/__tests__/mockContext';

describe('SPA integration tests', () => {
    beforeAll(() => {
        // Mock all browser APIs used by QrScanner
        applyQrScannerMocks();
    });

    beforeEach(() => {
        // Allow fast forwarding (skip debounce)
        jest.useFakeTimers({ doNotFake: ['Date'] });
    });

    // Clean up pending timers and unmount react tree after each test
    afterEach(async () => {
        await act(async () => jest.runOnlyPendingTimers());
        jest.clearAllTimers();
        jest.useRealTimers();
        cleanup();
    });

    it('replaces current page when user scans a QR code', async () => {
        // Mock fetch function to return overview page state
        mockFetchResponse(mockOverviewContext);

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
        mockQrCodeInViewport('https://plants.lan/manage/5c256d96-ec7d-408a-83c7-3f86d63968b2');

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
            '/manage/5c256d96-ec7d-408a-83c7-3f86d63968b2'
        );

        // Mock fetch function to return manage_plant page state
        mockFetchResponse({
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

    it('navigates from register page to manage_plant when registration is complete', async () => {
        // Mock fetch function to return register page state on first request,
        // and /get_plant_species_options response on second
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

        // Render SPA on registration pages (makes both requests above on load)
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        mockCurrentURL('https://plants.lan/manage/102d1a8c-07e6-4ece-bac7-60ed6a95f462');
        const router = createMemoryRouter(routes, { initialEntries: [
            '/manage/102d1a8c-07e6-4ece-bac7-60ed6a95f462'
        ] });
        const { getByRole, getByLabelText, getByTestId, queryByTestId } = render(
            <AppRoot router={router} />
        );
        // Confirm rendered register page, did not render manage_plant
        await waitFor(() => {
            expect(document.title).toBe('Register New Plant');
            expect(getByTestId('register-layout')).toBeInTheDocument();
            expect(queryByTestId('manage-plant-layout')).toBeNull();
        });
        // Confirm requested both states
        expect(global.fetch).toHaveBeenNthCalledWith(
            1,
            '/get_manage_state/102d1a8c-07e6-4ece-bac7-60ed6a95f462',
            {headers: {Accept: "application/json"}}
        );
        expect(global.fetch).toHaveBeenNthCalledWith(
            2,
            '/get_plant_species_options'
        );
        jest.clearAllMocks();

        // Mock fetch function to return /register_plant response on first
        // request, manage plant state on second request
        global.fetch = jest.fn().mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                success: 'plant registered'
            }),
            headers: new Map([['content-type', 'application/json']]),
        }).mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                page: 'manage_plant',
                title: 'Manage Plant',
                state: mockPlantContext
            }),
            headers: new Map([['content-type', 'application/json']]),
        });

        // Simulate user filling in form fields and clicking Save button
        await user.type(getByRole('textbox', {name: 'Plant name'}), 'Test plant');
        await user.type(getByRole('combobox', {name: 'Plant species'}), 'Fittonia');
        await user.type(getByRole('textbox', {name: 'Description'}), 'Clay pot');
        await user.type(getByLabelText('Pot size'), '6');
        await user.click(getByRole('button', {name: 'Save'}));

        // Confirm changed to manage_plant page, register no longer rendered
        await waitFor(() => {
            expect(document.title).toBe('Manage Plant');
            expect(getByTestId('manage-plant-layout')).toBeInTheDocument();
            expect(queryByTestId('register-layout')).toBeNull();
        });

        // Confirm POSTed data to /register_plant endpoint, then requested state
        expect(global.fetch).toHaveBeenNthCalledWith(
            1,
            '/register_plant',
            {
                method: 'POST',
                body: JSON.stringify({
                    uuid: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                    name: "Test plant",
                    species: "Fittonia",
                    pot_size: "6",
                    description: "Clay pot",
                }),
                headers: postHeaders
            }
        );
        expect(global.fetch).toHaveBeenNthCalledWith(
            2,
            '/get_manage_state/102d1a8c-07e6-4ece-bac7-60ed6a95f462',
            {headers: {Accept: "application/json"}}
        );
    });

    it('navigates from archived overview page to main overview when last plant/group is un-archived', async () => {
        // Mock fetch function to return archived overview page state
        mockFetchResponse({
            ...mockOverviewContext,
            plants: Object.fromEntries(
                Object.entries(mockOverviewContext.plants).map(
                    ([uuid, plant]) => [ uuid, { ...plant, archived: true } ]
                )
            ),
            groups: Object.fromEntries(
                Object.entries(mockOverviewContext.groups).map(
                    ([uuid, group]) => [ uuid, { ...group, archived: true } ]
                )
            ),
            title: 'Archived'
        });

        // Render SPA on archived overview page
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        mockCurrentURL('https://plants.lan/archived');
        const router = createMemoryRouter(routes, { initialEntries: ['/archived'] });
        const { getByText, getByLabelText, getByTestId } = render(
            <AppRoot router={router} />
        );
        // Confirm rendered overview page, set correct title
        await waitFor(() => {
            expect(document.title).toBe('Archived');
            expect(getByTestId('overview-layout')).toBeInTheDocument();
        });

        // Mock fetch to simulate successfully un-archiving all plants and
        // groups on first request, return overview state on second request
        global.fetch = jest.fn().mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                archived: [
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                    "0640ec3b-1bed-4b16-a078-d6e7ec66be12",
                    "0640ec3b-1bed-4b15-a078-d6e7ec66be14",
                    "0640ec3b-1bed-4ba5-a078-d6e7ec66be14"
                ],
                failed: []
            }),
            headers: new Map([['content-type', 'application/json']]),
        }).mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve(mockOverviewContext),
            headers: new Map([['content-type', 'application/json']]),
        });
        jest.clearAllMocks();

        // Simulate user unarchiving all plants and groups
        await user.click(getByText('Groups (2)'));
        await user.click(getByLabelText('Select Test Plant'));
        await user.click(getByLabelText('Select Second Test Plant'));
        await user.click(getByLabelText('Select Test group'));
        await user.click(getByLabelText('Select Second Test group'));
        // Click un-archive button in floating div
        await user.click(getByText('Un-archive'));

        // Confirm updated title, still rendered overview page (shared bundle)
        await waitFor(() => {
            expect(document.title).toBe('Plant Overview');
            expect(getByTestId('overview-layout')).toBeInTheDocument();
        });

        // Confirm POSTed data to, then requested overview state
        expect(global.fetch).toHaveBeenNthCalledWith(
            1,
            '/bulk_archive_plants_and_groups', {
                method: 'POST',
                body: JSON.stringify({
                    uuids: [
                        "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                        "0640ec3b-1bed-4b16-a078-d6e7ec66be12",
                        "0640ec3b-1bed-4b15-a078-d6e7ec66be14",
                        "0640ec3b-1bed-4ba5-a078-d6e7ec66be14"
                    ],
                    archived: false
                }),
                headers: postHeaders
            }
        );
        expect(global.fetch).toHaveBeenNthCalledWith(
            2,
            '/get_overview_state',
            {headers: {Accept: "application/json"}}
        );
    });

    it('navigates from password reset page to user profile when form is submitted', async () => {
        // Render SPA on password reset page
        mockCurrentURL('https://plants.lan/accounts/reset/OA/set-password/');
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        const router = createMemoryRouter(routes, { initialEntries: [
            '/accounts/reset/OA/set-password/'
        ] });
        const { getByRole, getByLabelText, getByTestId, queryByTestId } = render(
            <AppRoot router={router} />
        );
        // Confirm rendered correct page
        await waitFor(() => {
            expect(document.title).toBe('Reset Password');
            expect(getByTestId('password-reset-page')).toBeInTheDocument();
        });

        // Mock fetch function to return expected response when password is changed
        mockFetchResponse({success: "password_changed"});

        // Simulate user entering new password twice and clicking change password
        await user.type(getByLabelText('New password'), 'thispasswordisbetter');
        await user.type(getByLabelText('Confirm new password'), 'thispasswordisbetter');
        await user.click(getByRole("button", {name: "Change Password"}));
        expect(global.fetch).toHaveBeenCalled();

        // Mock fetch function to return user profile page state
        mockFetchResponse({
            user_details: {
                username: "cdanger",
                email: "totally.not.anthony.weiner@gmail.com",
                first_name: "Carlos",
                last_name: "Danger",
                date_joined: "2025-04-06T00:08:53.392806+00:00",
                email_verified: false
            },
            title: "User Profile"
        });

        // Confirm SPA automatically navigates to profile page after animation
        await act(async () => await jest.advanceTimersByTimeAsync(1500));
        await waitFor(() => {
            // expect(document.title).toBe('User Profile');
            expect(getByTestId('user-profile-page')).toBeInTheDocument();
            expect(queryByTestId('password-reset-page')).toBeNull();
        });
    });

    it('navigates between 2 manage_plant pages when user clicks division event marker', async () => {
        // Mock fetch function to return manage_plant page state with a division event
        mockFetchResponse({
            page: 'manage_plant',
            title: 'Manage Plant',
            state: {
                ...mockPlantContext,
                division_events: {
                    "2024-02-11T04:19:23+00:00": [
                        {
                            name: "Child plant 1",
                            uuid: "cc3fcb4f-120a-4577-ac87-ac6b5bea8968"
                        },
                    ]
                }
            }
        });

        // Render SPA on manage_plant page
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        mockCurrentURL('https://plants.lan/manage/0640ec3b-1bed-4b15-a078-d6e7ec66be12');
        const router = createMemoryRouter(routes, { initialEntries: [
            '/manage/0640ec3b-1bed-4b15-a078-d6e7ec66be12'
        ] });
        const { getByText, getByTestId } = render(
            <AppRoot router={router} />
        );
        // Confirm rendered manage_plant page, set correct title
        await waitFor(() => {
            expect(document.title).toBe('Manage Plant');
            expect(getByTestId('manage-plant-layout')).toBeInTheDocument();
            expect(getByText(/Divided into/)).toBeInTheDocument();
        });
        // Confirm fetched correct state
        expect(global.fetch).toHaveBeenCalledWith(
            '/get_manage_state/0640ec3b-1bed-4b15-a078-d6e7ec66be12',
            {headers: {Accept: "application/json"}}
        );
        // Confirm did NOT call scrollIntoView
        expect(window.HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
        jest.clearAllMocks();

        // Mock fetch function to return manage_plant page state for child plant
        mockManagePlantFetch({
            ...mockPlantContext,
            plant_details: {
                ...mockPlantContext.plant_details,
                display_name: "Child plant 1",
                uuid: "cc3fcb4f-120a-4577-ac87-ac6b5bea8968"
            },
            divided_from: {
                name: "Test Plant",
                uuid: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                timestamp: "2024-02-11T04:19:23+00:00"
            }
        });
        const replaceStateSpy = jest.spyOn(window.history, 'replaceState');

        // Simulate user clicking division event marker
        await user.click(getByText('Child plant 1'));

        // Confirm rendered manage_plant page, set correct title
        await waitFor(() => {
            expect(document.title).toBe('Manage Plant');
            expect(getByTestId('manage-plant-layout')).toBeInTheDocument();
            expect(getByText(/Divided from/)).toBeInTheDocument();
        });
        // Confirm fetched correct state
        expect(global.fetch).toHaveBeenCalledWith(
            '/get_manage_state/cc3fcb4f-120a-4577-ac87-ac6b5bea8968',
            {headers: {Accept: "application/json"}}
        );
        // Confirm called scrollIntoView (division event link has scrollToDate param)
        await act(async () => await jest.advanceTimersByTimeAsync(100));
        expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
        // Confirm querystring was removed from URL after scrolling
        expect(replaceStateSpy).toHaveBeenCalledWith(
            null,
            "",
            expect.not.stringContaining('scrollToDate')
        );
    });

    it('fetches new state for current route when user navigates to SPA with back button', async () => {
        // Mock fetch function to return overview page state
        mockFetchResponse(mockOverviewContext);

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

    it('does not fetch new state when other pageshow events are triggered', async () => {
        // Mock fetch function to return overview page state
        mockFetchResponse(mockOverviewContext);

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

        // Simulate pageshow event with persisted == false (ie initial load)
        const pageshowEvent = new Event('pageshow');
        Object.defineProperty(pageshowEvent, 'persisted', { value: false });
        await act(() => window.dispatchEvent(pageshowEvent));

        // Confirm did NOT call fetch
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('switches pages if different state received after user navigates to SPA with back button', async () => {
        // Mock fetch function to return manage_group page state
        mockFetchResponse({
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

    it('follows redirects on initial page load', async () => {
        // Simulate redirect to login page when loader requests page state
        mockFetchResponse({ 'redirect': '/accounts/login' }, 302);

        // Render SPA on overview page
        const router = createMemoryRouter(routes, { initialEntries: ['/'] });
        const { getByTestId, queryByTestId } = render(
            <AppRoot router={router} />
        );

        // Confirm rendered login page, NOT overview page
        await waitFor(() => {
            expect(queryByTestId('overview-layout')).toBeNull();
            expect(queryByTestId('manage-plant-layout')).toBeNull();
            expect(getByTestId('login-page')).toBeInTheDocument();
            expect(document.title).toBe('Login');
        });
    });

    it('renders login page if initial state request receives 401', async () => {
        // Simulate get state response when user is not authenticated
        mockFetchResponse({ error: 'authentication required' }, 401);

        // Render SPA on overview page
        const router = createMemoryRouter(routes, { initialEntries: ['/'] });
        const { getByTestId, queryByTestId } = render(
            <AppRoot router={router} />
        );

        // Confirm rendered login page, NOT overview page
        await waitFor(() => {
            expect(document.title).toBe('Login');
            expect(queryByTestId('overview-layout')).toBeNull();
            expect(getByTestId('login-page')).toBeInTheDocument();
        });

        // Confirm requested overview state
        expect(global.fetch).toHaveBeenCalledOnce();
        expect(global.fetch).toHaveBeenCalledWith(
            '/get_overview_state',
            {headers: {Accept: "application/json"}}
        );
    });

    it('redirects to login page if user session expired', async () => {
        // Render SPA on overview page
        mockFetchResponse(mockOverviewContext);
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        const router = createMemoryRouter(routes, { initialEntries: ['/'] });
        const { getByLabelText, getByTestId, queryByTestId } = render(
            <AppRoot router={router} />
        );
        await waitFor(() => {
            expect(document.title).toBe('Plant Overview');
            expect(getByTestId('overview-layout')).toBeInTheDocument();
        });

        // Simulate response when user is not authenticated
        mockFetchResponse({ error: 'authentication required' }, 401);

        // Simulate user clicking plant link
        await user.click(getByLabelText('Go to Test Plant page'));

        // Confirm unrendered overview page, rendered login page, did NOT render
        // manage_plant page
        await waitFor(() => {
            expect(queryByTestId('overview-layout')).toBeNull();
            expect(queryByTestId('manage-plant-layout')).toBeNull();
            expect(getByTestId('login-page')).toBeInTheDocument();
            expect(document.title).toBe('Login');
        });
    });

    it('redirects to login page if user with expired session sends POST request', async () => {
        // Render SPA on manage_plant page
        mockFetchResponse({
            page: 'manage_plant',
            title: 'Manage Plant',
            state: mockPlantContext
        });
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        const router = createMemoryRouter(routes, { initialEntries: [
            '/manage/e1393cfd-0133-443a-97b1-06bb5bd3fcca'
        ] });
        const { getByRole, getByTestId, queryByTestId } = render(
            <AppRoot router={router} />
        );
        await waitFor(() => {
            expect(document.title).toBe('Manage Plant');
            expect(getByTestId('manage-plant-layout')).toBeInTheDocument();
        });

        // Simulate response when user is not authenticated
        mockFetchResponse({ error: 'authentication required' }, 401);

        // Simulate user clicking water button
        await user.click(getByRole('button', {name: 'Water'}));

        expect(global.fetch).toHaveBeenCalledWith('/add_plant_event', {
            method: 'POST',
            body: JSON.stringify({
                plant_id: "0640ec3b-1bed-4b15-a078-d6e7ec66be12",
                event_type: "water",
                timestamp: "2024-03-01T20:00:00.000Z"
            }),
            headers: postHeaders
        });

        // Confirm unrendered manage_plant page, rendered login page
        await waitFor(() => {
            expect(queryByTestId('manage-plant-layout')).toBeNull();
            expect(getByTestId('login-page')).toBeInTheDocument();
            expect(document.title).toBe('Login');
        });
    });

    it('redirects to error page if loader receives 403', async () => {
        // Render SPA on overview page
        mockFetchResponse(mockOverviewContext);
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTimeAsync });
        const router = createMemoryRouter(routes, { initialEntries: ['/'] });
        const { getByText, getByLabelText, getByTestId, queryByTestId } = render(
            <AppRoot router={router} />
        );
        await waitFor(() => {
            expect(document.title).toBe('Plant Overview');
            expect(getByTestId('overview-layout')).toBeInTheDocument();
        });

        // Simulate /get_manage_state response when user does not own plant
        mockFetchResponse({"error": "plant is owned by a different user"}, 403);

        // Simulate user clicking plant link
        await user.click(getByLabelText('Go to Test Plant page'));

        // Confirm unrendered overview, rendered error page, did NOT render manage_plant
        await waitFor(() => {
            expect(queryByTestId('overview-layout')).toBeNull();
            expect(queryByTestId('manage-plant-layout')).toBeNull();
            expect(getByTestId('error-page')).toBeInTheDocument();
            expect(getByText('plant is owned by a different user')).toBeInTheDocument();
            expect(document.title).toBe('Error');
        });
    });

    it('redirects to error page if loader receives non-JSON response', async () => {
        // Simulate returning HTML when SPA expects JSON
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Map([['content-type', 'text/html']]),
        });

        // Render SPA on overview page
        const router = createMemoryRouter(routes, { initialEntries: ['/'] });
        const { getByText, getByTestId, queryByTestId } = render(
            <AppRoot router={router} />
        );

        // Confirm redirected to error page, did NOT render overview
        await waitFor(() => {
            expect(queryByTestId('overview-layout')).toBeNull();
            expect(getByTestId('error-page')).toBeInTheDocument();
            expect(getByText('Unexpected response')).toBeInTheDocument();
            expect(document.title).toBe('Error');
        });
    });
});
