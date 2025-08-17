import React from 'react';
import {
    createBrowserRouter,
    redirect,
    Navigate,
    useLoaderData,
    useRouteError,
    isRouteErrorResponse,
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
        // Permission denied: show error message
        const error = await response.json();
        throw new Response('', {
            status: response.status,
            statusText: error?.error || `Request failed (${response.status})`,
        });
    }

    // Success: return JSON body
    const data = await response.json();
    return data;
}

// Generic adapter: renders App with loader data as `initialState`
function makePageRoute(App) {
    return function PageRoute() {
        const payload = useLoaderData();
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
    if (!payload || !payload.page) return null;
    const Component = ManageComponentMap[payload.page];
    return <Component initialState={payload.state || {}} />;
}

// Renders PermissionDeniedApp with error message from response
function ErrorBoundaryRoute() {
    const error = useRouteError();

    if (isRouteErrorResponse(error)) {
        if (error.status === 403) {
            const message = error.statusText || 'You do not have permission to view this page';
            document.title = 'Permission Denied';
            return <PermissionDeniedApp errorMessage={message} />;
        }
        const message = error.statusText || `Request failed (${error.status})`;
        return <PermissionDeniedApp errorMessage={message} />;
    }

    // Non-Response thrown (e.g., unexpected)
    return <PermissionDeniedApp errorMessage="An unexpected error occurred" />;
}

const router = createBrowserRouter([
    {
        path: '/',
        Component: OverviewRoute,
        errorElement: <ErrorBoundaryRoute />,
        loader: async ({ request }) => {
            await OverviewApp.preload();
            return await fetchJSON('/get_overview_state', request);
        },
    },
    {
        path: '/archived',
        Component: ArchivedRoute,
        errorElement: <ErrorBoundaryRoute />,
        loader: async ({ request }) => {
            await OverviewApp.preload();
            return await fetchJSON('/get_archived_overview_state', request);
        },
    },
    {
        path: '/manage/:uuid',
        Component: ManageRoute,
        errorElement: <ErrorBoundaryRoute />,
        loader: async ({ params, request }) => {
            const body = await fetchJSON(`/resolve_manage/${params.uuid}`, request);

            // Don't preload bundle if response is a redirect
            if (body instanceof Response) {
                return body;
            }

            if (body?.title) {
                document.title = body.title;
            }
            if (body?.page === 'manage_plant') await ManagePlantApp.preload();
            else if (body?.page === 'manage_group') await ManageGroupApp.preload();
            else if (body?.page === 'register') await RegisterApp.preload();

            return body;
        },
    },
    {
        path: '/accounts/login/',
        Component: LoginApp,
        errorElement: <ErrorBoundaryRoute />,
    },
    {
        path: '/accounts/profile/',
        Component: UserProfileRoute,
        errorElement: <ErrorBoundaryRoute />,
        loader: async ({ request }) => {
            await UserProfileApp.preload();
            return await fetchJSON('/accounts/get_user_details/', request);
        },
    },
    {
        path: '/accounts/password_reset/',
        Component: PasswordResetApp,
        errorElement: <ErrorBoundaryRoute />,
    },
    {
        path: '/accounts/reset/:uidb64/:token/',
        Component: PasswordResetApp,
        errorElement: <ErrorBoundaryRoute />,
    },
    {
        path: '*',
        Component: () => <Navigate to="/" replace />,
    },
]);

export default router;
