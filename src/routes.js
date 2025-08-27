import React from 'react';
import {
    createBrowserRouter,
    redirect,
    Navigate,
    Outlet,
    ScrollRestoration,
    useLoaderData,
    useRouteError,
    useRevalidator,
} from 'react-router-dom';
import {
    OverviewApp,
    ManagePlantApp,
    ManageGroupApp,
    RegisterApp,
    LoginApp,
    UserProfileApp,
    PasswordResetApp,
    PermissionDeniedApp,
} from './bundles';
import { Toast } from 'src/components/Toast';
import { ErrorModal } from 'src/components/ErrorModal';
import { useBackButton } from 'src/hooks/useBackButton';
import UnsupportedBrowserWarning from 'src/components/UnsupportedBrowserWarning';

// Helper used by loaders to fetch initial state, returns JSON body
// If user is not authenticated returns redirect to login page
// If other error/unexpected response returns redirect to permission denied page
async function fetchJSON(url, request) {
    const response = await fetch(url, {
        headers: { Accept: 'application/json' }
    });

    // Show error if response is not JSON
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        throw new Response('', {
            status: 500,
            statusText: 'Unexpected response'
        });
    }

    if (!response.ok) {
        // User not authenticated: redirect to login with requested URL in next
        // querystring param (will be redirected back after successful login)
        if (response.status === 401) {
            const url = new URL(request.url);
            const next = encodeURIComponent(url.pathname + url.search);
            return redirect(`/accounts/login/?next=${next}`);
        }

        // Server returned redirect: redirect to path in JSON response
        if (response.status === 302) {
            const data = await response.json();
            throw redirect(data.redirect);
        }

        // Permission denied: show error message
        const error = await response.json();
        throw new Response('', {
            status: response.status,
            statusText: error?.error || 'Unexpected response'
        });
    }

    // Success: return JSON body
    const data = await response.json();
    return data;
}

// Preloads component and initial state in parallel (faster page load)
const loadPage = async (component, endpoint, request) => {
    const [, initialState] = await Promise.all([
        component.preload(),
        fetchJSON(endpoint, request)
    ]);
    return initialState;
};

// Generic adapter: renders App with loader data as `initialState`
function makePageRoute(App) {
    return function PageRoute() {
        const payload = useLoaderData();
        document.title = payload?.title || 'Plant Tracker';
        return <App initialState={payload} />;
    };
}

const OverviewRoute = makePageRoute(OverviewApp);
const ArchivedRoute = makePageRoute(OverviewApp);
const UserProfileRoute = makePageRoute(UserProfileApp);

// Maps /manage/<uuid> initial state page key to correct component
const ManageComponentMap = {
    manage_plant: ManagePlantApp,
    manage_group: ManageGroupApp,
    register: RegisterApp,
};

// Custom route for /manage/<uuid> (load correct component for initial state)
function ManageRoute() {
    const payload = useLoaderData();
    document.title = payload?.title || 'Plant Tracker';
    const Component = ManageComponentMap[payload.page];
    return <Component initialState={payload.state} />;
}

// Renders PermissionDeniedApp with error message from response
function ErrorBoundaryRoute() {
    const error = useRouteError();
    document.title = 'Permission Denied';
    const errorMessage = error?.statusText || 'An unexpected error occurred';
    return <PermissionDeniedApp errorMessage={errorMessage} />;
}

function RootLayout() {
    // Get new state for current page when user navigates from external site
    // back to SPA using browser back/forward buttons
    const { revalidate } = useRevalidator();
    useBackButton(() => revalidate());

    return (
        <>
            <Outlet />
            <Toast />
            <ErrorModal />
            <UnsupportedBrowserWarning />
            <ScrollRestoration
                // Separate scroll position for each /manage/<uuid> page
                getKey={(location) => location.pathname + location.search}
            />
        </>
    );
}

export const routes = [
    {
        path: '/',
        element: <RootLayout />,
        errorElement: <ErrorBoundaryRoute />,
        HydrateFallback: () => null,
        children: [
            {
                index: true,
                Component: OverviewRoute,
                loader: async ({ request }) => (
                    loadPage(OverviewApp, '/get_overview_state', request)
                ),
            },
            {
                path: 'archived',
                Component: ArchivedRoute,
                loader: async ({ request }) => (
                    loadPage(OverviewApp, '/get_archived_overview_state', request)
                ),
            },
            {
                path: 'manage/:uuid',
                Component: ManageRoute,
                loader: async ({ params, request }) => {
                    return await fetchJSON(`/get_manage_state/${params.uuid}`, request);
                },
            },
            {
                path: 'accounts/login/',
                Component: LoginApp,
            },
            {
                path: 'accounts/profile/',
                Component: UserProfileRoute,
                loader: async ({ request }) => (
                    loadPage(UserProfileApp, '/accounts/get_user_details/', request)
                ),
            },
            {
                path: 'accounts/reset/:uidb64/:token/',
                Component: PasswordResetApp,
            },
            {
                path: '*',
                Component: () => <Navigate to="/" replace />,
            },
        ]
    }
];

export default createBrowserRouter(routes);
