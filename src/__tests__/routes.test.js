// Mock bundles to render div with testid to confirm which bundle was rendered
jest.mock('src/bundles', () => {
    const React = require('react');

    const createMockBundle = (name) => {
        const Component = () => <div data-testid={`${name}-page`}></div>;
        Component.preload = jest.fn().mockResolvedValue();
        return Component;
    };

    return {
        OverviewApp: createMockBundle('overview'),
        ManagePlantApp: createMockBundle('manage-plant'),
        ManageGroupApp: createMockBundle('manage-group'),
        RegisterApp: createMockBundle('register'),
        LoginApp: createMockBundle('login'),
        UserProfileApp: createMockBundle('user-profile'),
        PasswordResetApp: createMockBundle('password-reset'),
        PermissionDeniedApp: ({ errorMessage }) => (
            <div data-testid="permission-denied">{errorMessage}</div>
        ),
    };
});

// Import mocked bundles to access their preload methods
import {
    OverviewApp,
    ManagePlantApp,
    ManageGroupApp,
    RegisterApp,
    LoginApp,
    UserProfileApp,
} from 'src/bundles';
import { routes } from 'src/routes';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';

export function renderRouter({ routes, initialEntries = ['/'] }) {
    const router = createMemoryRouter(routes, { initialEntries });
    const utils = render(<RouterProvider router={router} />);
    return { router, ...utils };
}

// Takes JSON response and status code, mocks global fetch function
const mockFetchJSONResponse = (json, status=200) => {
    global.fetch = jest.fn(() => Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        headers: new Map([['content-type', 'application/json']]),
        json: () => Promise.resolve(json),
    }));
};

describe('SPA routes', () => {
    it('renders correct bundle when user navigates between pages', async () => {
        // Mock fetch function to return overview page state
        mockFetchJSONResponse({ title: 'Plant Overview' });

        // Render overview page
        const { router, getByTestId } = renderRouter({
            routes: routes,
            initialEntries: ['/']
        });

        // Confirm preloaded + rendered overview bundle, fetched overview state
        await waitFor(() => {
            expect(getByTestId('overview-page')).toBeInTheDocument();
            expect(document.title).toBe('Plant Overview');
        });
        expect(OverviewApp.preload).toHaveBeenCalled();
        expect(global.fetch).toHaveBeenCalledWith(
            '/get_overview_state',
            {headers: {Accept: "application/json"}}
        );

        // Mock fetch function to return archived overview page state
        jest.clearAllMocks();
        mockFetchJSONResponse({ title: 'Archived' });

        // Simulate user navigating to archived page
        await router.navigate('/archived');

        // Confirm preloaded + rendered overview bundle, fetched archived overview state
        await waitFor(() => {
            expect(getByTestId('overview-page')).toBeInTheDocument();
            expect(document.title).toBe('Archived');
        });
        expect(OverviewApp.preload).toHaveBeenCalled();
        expect(global.fetch).toHaveBeenCalledWith(
            '/get_archived_overview_state',
            {headers: {Accept: "application/json"}}
        );

        // Mock fetch function to return user profile page state
        jest.clearAllMocks();
        mockFetchJSONResponse({ title: 'User Profile' });

        // Simulate user navigating to user profile page
        await router.navigate('/accounts/profile/');

        // Confirm preloaded + rendered user profile bundle, fetched user profile state
        await waitFor(() => {
            expect(getByTestId('user-profile-page')).toBeInTheDocument();
            expect(document.title).toBe('User Profile');
        });
        expect(UserProfileApp.preload).toHaveBeenCalled();
        expect(global.fetch).toHaveBeenCalledWith(
            '/accounts/get_user_details/',
            {headers: {Accept: "application/json"}}
        );
    });

    it('renders correct manage bundle based on backend response', async () => {
        // Mock fetch function to return manage_plant page state
        mockFetchJSONResponse({ title: 'Manage Plant', page: 'manage_plant', state: {} });

        // Render manage page
        const { router, getByTestId } = renderRouter({
            routes: routes,
            initialEntries: ['/manage/5c256d96-ec7d-408a-83c7-3f86d63968b2']
        });

        // Confirm preloaded + rendered manage_plant bundle, set title from backend response
        await waitFor(() => {
            expect(getByTestId('manage-plant-page')).toBeInTheDocument();
            expect(document.title).toBe('Manage Plant');
        });
        expect(ManagePlantApp.preload).toHaveBeenCalled();
        expect(global.fetch).toHaveBeenCalledWith(
            '/resolve_manage/5c256d96-ec7d-408a-83c7-3f86d63968b2',
            {headers: {Accept: "application/json"}}
        );

        // Mock fetch function to return manage_group page state
        jest.clearAllMocks();
        mockFetchJSONResponse({ title: 'Manage Group', page: 'manage_group', state: {} });

        // Simulate user navigating to manage_group page
        await router.navigate('/manage/5c256d96-ec7d-408a-83c7-3f86d63968b3');

        // Confirm preloaded + rendered manage_group bundle, set title from backend response
        await waitFor(() => {
            expect(getByTestId('manage-group-page')).toBeInTheDocument();
            expect(document.title).toBe('Manage Group');
        });
        expect(ManageGroupApp.preload).toHaveBeenCalled();
        expect(global.fetch).toHaveBeenCalledWith(
            '/resolve_manage/5c256d96-ec7d-408a-83c7-3f86d63968b3',
            {headers: {Accept: "application/json"}}
        );

        // Mock fetch function to return register page state
        jest.clearAllMocks();
        mockFetchJSONResponse({ title: 'Register New Plant', page: 'register', state: {} });

        // Simulate user navigating to register page
        await router.navigate('/manage/5c256d96-ec7d-408a-83c7-3f86d63968b4');

        // Confirm preloaded + rendered register bundle, set title from backend response
        await waitFor(() => {
            expect(getByTestId('register-page')).toBeInTheDocument();
            expect(document.title).toBe('Register New Plant');
        });
        expect(RegisterApp.preload).toHaveBeenCalled();
        expect(global.fetch).toHaveBeenCalledWith(
            '/resolve_manage/5c256d96-ec7d-408a-83c7-3f86d63968b4',
            {headers: {Accept: "application/json"}}
        );
    });

    it('redirects to login page when loader receives 401', async () => {
        // Simulate response when user is not authenticated
        mockFetchJSONResponse({ error: 'authentication required' }, 401);

        // Simulate user loading profile page
        const { router, getByTestId } = renderRouter({
            routes: routes,
            initialEntries: ['/accounts/profile/']
        });
        // Confirm router redirected to login page after requesting user details
        await waitFor(() => expect(getByTestId('login-page')).toBeInTheDocument());
        expect(global.fetch).toHaveBeenCalledWith(
            '/accounts/get_user_details/',
            {headers: {Accept: "application/json"}}
        );
        // Confirm URL contains ?next= querystring with requested URL (profile)
        expect(router.state.location.search).toBe('?next=%2Faccounts%2Fprofile%2F');

        // Simulate user navigating to manage_plant page
        await router.navigate('/manage/5c256d96-ec7d-408a-83c7-3f86d63968b2');
        // Confirm router redirected to login page after requesting plant state
        await waitFor(() => expect(getByTestId('login-page')).toBeInTheDocument());
        expect(global.fetch).toHaveBeenCalledWith(
            '/resolve_manage/5c256d96-ec7d-408a-83c7-3f86d63968b2',
            {headers: {Accept: "application/json"}}
        );
        // Confirm URL contains ?next= querystring with requested URL (manage_plant)
        expect(router.state.location.search).toBe('?next=%2Fmanage%2F5c256d96-ec7d-408a-83c7-3f86d63968b2');
    });

    it('follows redirect when loader receives 302', async () => {
        // Simulate /get_archived_overview_state response when no archived
        // plants exist on first request, /get_overview_state response on second
        global.fetch = jest.fn().mockResolvedValueOnce({
            ok: false,
            status: 302,
            json: () => Promise.resolve({ 'redirect': '/' }),
            headers: new Map([['content-type', 'application/json']]),
        }).mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ title: 'Plant Overview' }),
            headers: new Map([['content-type', 'application/json']]),
        });

        // Simulate user loading archived overview page
        const { router, getByTestId } = renderRouter({
            routes: routes,
            initialEntries: ['/archived']
        });
        // Confirm router rendered overview page
        await waitFor(() => expect(getByTestId('overview-page')).toBeInTheDocument());
        // Confirm requested archived overview state (302) then overview state (200)
        expect(global.fetch).toHaveBeenCalledWith(
            '/get_archived_overview_state',
            {headers: {Accept: "application/json"}}
        );
        expect(global.fetch).toHaveBeenCalledWith(
            '/get_overview_state',
            {headers: {Accept: "application/json"}}
        );
        // Confirm URL is main overview page after redirect
        expect(router.state.location.pathname).toBe('/');
    });

    it('shows permission denied page when loader receives 403', async () => {
        // Simulate login page response when user accounts are disabled
        mockFetchJSONResponse({ error: 'user accounts are disabled' }, 403);
        // Simulate user loading profile page
        const { router, getByTestId } = renderRouter({
            routes: routes,
            initialEntries: ['/accounts/profile/']
        });
        // Confirm rendered permission-denied bundle with error from response
        await waitFor(() => {
            expect(getByTestId('permission-denied')).toHaveTextContent(
                'user accounts are disabled'
            );
            expect(document.title).toBe('Permission Denied');
        });

        // Simulate 403 response missing error parameter
        mockFetchJSONResponse({ denied: 'user accounts are disabled' }, 403);

        // Navigate to overview page
        await router.navigate('/');
        // Confirm rendered permission-denied bundle with fallback error message
        await waitFor(() => {
            expect(getByTestId('permission-denied')).toHaveTextContent(
                'Unexpected response'
            );
        });
    });

    it('shows permission denied page when loader receives non-JSON response', async () => {
        // Simulate returning HTML when SPA expects JSON
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Map([['content-type', 'text/html']]),
        });
        // Render overview page
        const { router, getByTestId } = renderRouter({
            routes: routes,
            initialEntries: ['/']
        });
        // Confirm rendered permission-denied bundle (not overview)
        await waitFor(() => {
            expect(getByTestId('permission-denied')).toBeInTheDocument();
            expect(document.title).toBe('Permission Denied');
        });
        // Confirm URL did not change when permission denied was rendered
        expect(router.state.location.pathname).toBe('/');

        // Simulate missing content-type header
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Map(),
        });
        // Navigate to overview page
        await router.navigate('/');
        // Confirm rendered permission-denied bundle with fallback error message
        await waitFor(() => {
            expect(getByTestId('permission-denied')).toHaveTextContent  (
                'Unexpected response'
            );
        });
    });

    it('shows unexpected error page when loader receives invalid JSON', async () => {
        // Simulate server returning JSON with invalid syntax
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Map([['content-type', 'application/json']]),
            json: () => Promise.reject(new SyntaxError('Invalid JSON')),
        });
        // Render overview page
        const { getByTestId } = renderRouter({
            routes: routes,
            initialEntries: ['/'],
        });
        // Confirm rendered permission-denied bundle with fallback error message
        await waitFor(() => {
            expect(getByTestId('permission-denied')).toHaveTextContent(
                'An unexpected error occurred'
            );
            expect(document.title).toBe('Permission Denied');
        });
    });

    it('falls back to overview page when user navigates to an unknown route', async () => {
        // Mock fetch function to return overview page state
        mockFetchJSONResponse({ title: 'Plant Overview' });

        // Render overview page
        const { router, getByTestId } = renderRouter({
            routes: routes,
            initialEntries: ['/']
        });

        // Confirm rendered overview bundle, fetched overview state
        await waitFor(() => {
            expect(getByTestId('overview-page')).toBeInTheDocument();
            expect(document.title).toBe('Plant Overview');
        });
        expect(global.fetch).toHaveBeenCalledWith(
            '/get_overview_state',
            {headers: {Accept: "application/json"}}
        );

        // Simulate user loading unknown route
        jest.clearAllMocks();
        await router.navigate('/unknown');
        // Confirm router rendered overview page, requested overview state again
        await waitFor(() => {
            expect(getByTestId('overview-page')).toBeInTheDocument();
        });
        expect(global.fetch).toHaveBeenCalledWith(
            '/get_overview_state',
            {headers: {Accept: "application/json"}}
        );
    });

    it('falls back to generic title if missing from backend response', async () => {
        // Render overview page with mock fetchJSON response missing title
        mockFetchJSONResponse({});
        const { router, getByTestId } = renderRouter({
            routes: routes,
            initialEntries: ['/']
        });

        // Confirm fell back to generic title
        await waitFor(() => {
            expect(getByTestId('overview-page')).toBeInTheDocument();
            expect(document.title).toBe('Plant Tracker');
        });

        // Navigate to manage_plant page with mock fetchJSON response missing title
        mockFetchJSONResponse({ page: 'manage_plant' });
        await router.navigate('/manage/5c256d96-ec7d-408a-83c7-3f86d63968b2');
        // Confirm fell back to generic title
        await waitFor(() => {
            expect(getByTestId('manage-plant-page')).toBeInTheDocument();
            expect(document.title).toBe('Plant Tracker');
        });
    });
});
